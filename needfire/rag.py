"""Retrieval: vector search with a keyword fallback (fail-down).

Order of preference, matching the architecture's degrade ladder:
  1. Vector search  — cosine over stored float32 vectors (faiss if installed,
     else a stdlib brute-force scan that is plenty fast for a survival corpus).
  2. Keyword search — SQLite FTS5 if available, else a LIKE scan.

Either path returns the same chunk-row shape so the rest of the app is agnostic
to how retrieval happened.
"""
import math
import re

from . import config, db, embed

_WORD = re.compile(r"[a-z0-9]+")


def strip_md(text):
    """Reduce markdown to plain text for snippets and LLM prompts."""
    t = re.sub(r"```.*?```", " ", text, flags=re.S)
    t = re.sub(r"`([^`]*)`", r"\1", t)
    t = re.sub(r"^#{1,6}\s*", "", t, flags=re.M)
    t = re.sub(r"^\s*>\s?", "", t, flags=re.M)
    t = re.sub(r"^\s*[-*+]\s+", "", t, flags=re.M)
    t = re.sub(r"^\s*\d+\.\s+", "", t, flags=re.M)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"(\*\*|__)(.*?)\1", r"\2", t, flags=re.S)
    t = re.sub(r"(?<!\w)([*_])([^*_]+)\1(?!\w)", r"\2", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


def _cosine(a, b):
    # vectors are stored normalized, so dot product == cosine
    return sum(x * y for x, y in zip(a, b))


def _row_to_dict(row, score=None, how=None):
    d = {
        "chunk_id": row["chunk_id"],
        "doc_id": row["doc_id"],
        "doc_title": row["doc_title"],
        "domain": row["domain"],
        "tier": row["tier"],
        "license": row["license"],
        "text": row["text"],
    }
    if score is not None:
        d["score"] = round(float(score), 4)
    if how:
        d["how"] = how
    return d


def vector_search(conn, query, k=None, domain=None):
    """Cosine search over all stored vectors. The domain hint is a soft boost,
    never a filter, so a wrong hint from the router can't hide documents."""
    k = k or config.TOP_K
    backend = db.get_meta(conn, "embed_backend", "hash")
    embedder = embed.Embedder(backend=backend)
    qv = embedder.embed(query)

    rows = conn.execute(
        "SELECT v.chunk_id, v.dims, v.vec, c.* FROM vectors v "
        "JOIN chunks c ON c.chunk_id = v.chunk_id"
    ).fetchall()
    if not rows:
        return None  # signal: no vectors, caller falls back

    scored = []
    mismatched = 0
    for r in rows:
        vec = db.unpack_vector(r["vec"], r["dims"])
        if len(vec) != len(qv):
            mismatched += 1  # embedder changed since indexing — skip
            continue
        score = _cosine(qv, vec)
        if domain and r["domain"] == domain:
            score += config.DOMAIN_BOOST
        scored.append((score, r))
    if not scored:
        if mismatched:
            print("  [warn] stored vectors don't match the current embedder "
                  "(index built with a different backend?) — using keyword "
                  "search. Rebuild with `python3 -m needfire index`.")
        return None  # fall back to keyword search
    scored.sort(key=lambda t: -t[0])
    return [_row_to_dict(r, score=s, how="vector") for s, r in scored[:k]]


def keyword_search(conn, query, k=None, domain=None):
    """FTS5 (or LIKE) search. The domain hint promotes matching chunks within
    the candidate set but never excludes anything."""
    k = k or config.TOP_K
    terms = [t for t in _WORD.findall(query.lower())
             if len(t) > 2 and t not in embed.STOPWORDS][:8]
    if not terms:
        return []

    if db.has_fts(conn):
        match = " OR ".join(terms)
        try:
            rows = conn.execute(
                "SELECT c.* FROM chunks_fts f JOIN chunks c ON c.chunk_id = f.rowid "
                "WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?",
                (match, k * 3),
            ).fetchall()
        except Exception:
            rows = None  # fall through to LIKE
        if rows is not None:
            # stable sort: domain matches first, then original FTS rank order
            ranked = sorted(
                enumerate(rows),
                key=lambda t: (0 if (domain and t[1]["domain"] == domain) else 1, t[0]),
            )
            return [_row_to_dict(r, how="keyword") for _pos, r in ranked[:k]]

    # LIKE fallback: score by number of distinct term hits + a domain bonus.
    clause = " OR ".join("text LIKE ?" for _ in terms)
    params = [f"%{t}%" for t in terms]
    rows = conn.execute(f"SELECT * FROM chunks WHERE ({clause})", params).fetchall()
    scored = []
    for r in rows:
        text = r["text"].lower()
        hits = sum(1 for t in terms if t in text)
        if domain and r["domain"] == domain:
            hits += 0.5
        scored.append((hits, r))
    scored.sort(key=lambda t: -t[0])
    return [_row_to_dict(r, score=s, how="keyword") for s, r in scored[:k]]


def retrieve(conn, query, k=None, domain=None):
    """Top-level retrieval. Returns (chunks, how).

    Fuses vector and keyword results with reciprocal-rank fusion: the hash
    embedding is strong on overall topic, exact keyword match is strong on
    rare terms ("snakebite", "voltage") — together they cover each other's
    blind spots. Degrades to whichever side is available.
    """
    k = k or config.TOP_K
    vec = vector_search(conn, query, k=k * 2, domain=domain)
    kw = keyword_search(conn, query, k=k * 2, domain=domain)
    if vec is None or not vec:
        return kw[:k], "keyword"
    if not kw:
        return vec[:k], "vector"
    scores, pool = {}, {}
    for lst in (vec, kw):
        for rank, c in enumerate(lst):
            cid = c["chunk_id"]
            pool.setdefault(cid, c)
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (60.0 + rank)
    ranked = sorted(scores.items(), key=lambda t: -t[1])[:k]
    return [pool[cid] for cid, _s in ranked], "hybrid"


def get_document(conn, doc_id):
    """Return the full original document text (stored at index time)."""
    row = conn.execute("SELECT * FROM docs WHERE doc_id = ?", (doc_id,)).fetchone()
    if row:
        return {
            "doc_id": doc_id,
            "doc_title": row["title"],
            "domain": row["domain"],
            "tier": row["tier"],
            "license": row["license"],
            "text": row["text"],
        }
    # Legacy fallback for an index built before the docs table existed:
    # reassemble from chunks (may repeat overlapped text — reindex to fix).
    rows = conn.execute(
        "SELECT * FROM chunks WHERE doc_id = ? ORDER BY word_start", (doc_id,)
    ).fetchall()
    if not rows:
        return None
    return {
        "doc_id": doc_id,
        "doc_title": rows[0]["doc_title"],
        "domain": rows[0]["domain"],
        "tier": rows[0]["tier"],
        "license": rows[0]["license"],
        "text": "\n\n".join(r["text"] for r in rows),
    }
