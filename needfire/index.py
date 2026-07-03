"""Build the searchable index from the corpus.

Sources, in order of how standalone they are:
  * seed-corpus/*.md   — original CC0 docs, always indexable (zero deps).
  * NEEDFIRE_HOME/docs/**   — plain .md/.txt placed by the operator or downloaders.
  * NEEDFIRE_HOME/zim/**    — Kiwix ZIM files, indexed only if `libzim` is importable.

Each document is stored whole (docs table, for the reader) and as paragraph-
packed chunks with embeddings (chunks/vectors tables, for retrieval).
"""
import json
import re

from . import config, db, embed

_WORD = re.compile(r"\S+")
_FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)


def _parse_frontmatter(text):
    """Minimal YAML-ish front-matter parser (key: value lines). Stdlib only."""
    meta = {}
    m = _FRONTMATTER.match(text)
    body = text
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip().strip('"').strip("'")
        body = text[m.end():]
    return meta, body


def normalize_text(text):
    """Normalize whitespace while PRESERVING markdown structure: newlines
    delimit blocks and leading indentation marks list continuations, so touch
    neither — only strip trailing space and collapse interior runs."""
    t = text.replace("\r\n", "\n").replace("\r", "\n")
    t = re.sub(r"[ \t]+\n", "\n", t)          # trailing whitespace
    t = re.sub(r"(?<=\S)[ \t]{2,}", " ", t)   # interior runs (keep indents)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def chunk_text(text, chunk_tokens=None, overlap=None):
    """Pack whole paragraphs into chunks of ~chunk_tokens (0.75 words/token).

    Overlap = the last paragraph of the previous chunk is carried into the
    next, so context isn't cut mid-thought. Oversized single paragraphs fall
    back to a plain word window. Returns [(word_start, text), ...].
    """
    chunk_tokens = chunk_tokens or config.CHUNK_TOKENS
    per = max(1, int(chunk_tokens * 0.75))  # word budget per chunk

    paras = []  # (word_start, n_words, text)
    pos = 0
    for p in re.split(r"\n{2,}", text):
        p = p.strip()
        if not p:
            continue
        n = len(_WORD.findall(p))
        paras.append((pos, n, p))
        pos += n

    out = []
    cur, cur_words = [], 0

    def flush():
        if cur:
            out.append((cur[0][0], "\n\n".join(p[2] for p in cur)))

    for start, n, ptext in paras:
        if n >= per:  # oversized paragraph: flush, then window it by words
            flush()
            cur, cur_words = [], 0
            words = _WORD.findall(ptext)
            for i in range(0, len(words), per):
                out.append((start + i, " ".join(words[i:i + per])))
            continue
        if cur and cur_words + n > per:
            flush()
            prev = cur[-1]  # overlap: carry the last paragraph forward
            cur, cur_words = [prev], prev[1]
        cur.append((start, n, ptext))
        cur_words += n
    flush()
    return out


def _iter_markdown(directory, default_domain="reference", default_tier="C1"):
    """Yield (doc_id, title, domain, tier, license, text) for .md/.txt files."""
    if not directory.exists():
        return
    for path in sorted(directory.rglob("*")):
        if path.suffix.lower() not in (".md", ".txt"):
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")
        meta, body = _parse_frontmatter(raw)
        body = normalize_text(body)
        if len(body) < 40:
            continue
        yield (
            path.relative_to(directory).as_posix(),  # unique even when nested
            meta.get("title", path.stem.replace("-", " ").title()),
            meta.get("domain", default_domain),
            meta.get("tier", default_tier),
            meta.get("license", "CC0-1.0"),
            body,
        )


def _iter_zim(zim_dir):
    """Yield documents from ZIM files if libzim is available, else nothing."""
    if not zim_dir.exists():
        return
    try:
        from libzim.reader import Archive  # type: ignore
    except ImportError:
        zims = list(zim_dir.rglob("*.zim"))
        if zims:
            print(f"  [info] {len(zims)} ZIM file(s) present but `libzim` not "
                  f"installed — skipping. `pip install libzim` to index them.")
        return
    tag = re.compile(r"<[^>]+>")
    block_end = re.compile(r"</(?:p|div|h[1-6]|li|tr|blockquote)>|<br\s*/?>", re.I)
    for path in sorted(zim_dir.rglob("*.zim")):
        tier = path.parent.name if path.parent.name.startswith("C") else "C2"
        archive = Archive(str(path))
        # Prefer the public accessor; older bindings only had the private one.
        get_entry = getattr(archive, "get_entry_by_id", None) or archive._get_entry_by_id
        for i in range(archive.entry_count):
            try:
                entry = get_entry(i)
                if getattr(entry, "is_redirect", False):
                    continue
                item = entry.get_item()
                mimetype = getattr(item, "mimetype", "") or ""
                if not mimetype.startswith(("text/html", "text/plain")):
                    continue  # skip CSS/JS/images — not articles
                blob = bytes(item.content).decode("utf-8", "replace")
                blob = block_end.sub("\n", blob)  # keep paragraph breaks
                text = normalize_text(tag.sub(" ", blob))
                if len(text) > 200:
                    yield (f"{path.name}#{entry.path}", entry.title or path.stem,
                           "reference", tier, "see-manifest", text)
            except Exception:
                continue


def build(include_seed=True, embed_backend=None):
    config.ensure_dirs()
    conn = db.connect()
    db.init_schema(conn)
    db.reset_content(conn)

    embedder = embed.Embedder(backend=embed_backend)

    sources = []
    if include_seed:
        sources.append(_iter_markdown(config.SEED_DIR / "documents"))
    sources.append(_iter_markdown(config.DOCS_DIR, default_tier="C2"))
    sources.append(_iter_zim(config.ZIM_DIR))

    n_docs = n_chunks = 0
    for src in sources:
        for doc_id, title, domain, tier, lic, body in src:
            n_docs += 1
            db.insert_doc(conn, doc_id, title, domain, tier, lic, body)
            for word_start, piece in chunk_text(body):
                cid = db.insert_chunk(conn, doc_id, title, tier, domain, lic, word_start, piece)
                vec = embedder.embed(piece)
                db.insert_vector(conn, cid, vec)
                n_chunks += 1
        conn.commit()

    db.set_meta(conn, "embed_backend", embedder.backend)
    db.set_meta(conn, "embed_dims", embedder.dims or config.EMBED_DIMS)
    db.set_meta(conn, "schema_version", db.SCHEMA_VERSION)
    conn.commit()
    stats = db.stats(conn)
    conn.close()
    print(f"Indexed {n_docs} documents -> {n_chunks} chunks "
          f"(embed backend: {embedder.backend}). {json.dumps(stats['by_domain'])}")
    return stats


# ---- background reindex (for the Content UI) -------------------------------

class ReindexJob:
    """Rebuild the index in a daemon thread so the HTTP request returns at once
    (a large corpus reindex can take a while). Mirrors corpus.DownloadJob."""

    def __init__(self):
        import threading
        self._lock = threading.Lock()
        self.active = False
        self.done = False
        self.error = None
        self.stats = None

    def snapshot(self):
        with self._lock:
            return {"active": self.active, "done": self.done,
                    "error": self.error, "stats": self.stats}

    def start(self):
        import threading
        with self._lock:
            if self.active:
                return False
            self.active = True
            self.done = False
            self.error = None
            self.stats = None
        threading.Thread(target=self._run, daemon=True).start()
        return True

    def _run(self):
        try:
            stats = build()
            with self._lock:
                self.stats = stats
        except Exception as exc:  # noqa: BLE001 - surface to the UI
            with self._lock:
                self.error = str(exc)
        finally:
            with self._lock:
                self.active = False
                self.done = True


JOB = ReindexJob()
