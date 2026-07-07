"""Clean corpus handling: catalog, resumable download, SHA-256 verify, manifest.

Promotes scripts/download-corpus.sh + scripts/verify-integrity.sh into Python so
the same logic drives both the CLI and the Corpus UI. Downloads only the
openly-licensed sources listed in catalog/catalog.json. Network use is confined
to this module — everything else in the app is fully offline.
"""
import hashlib
import ipaddress
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request

from . import config


def _is_lan_host(host):
    """Loopback/private addresses, localhost, and mDNS .local names — places a
    local mirror can live, where plain http is acceptable."""
    if not host:
        return False
    if host == "localhost" or host.endswith(".local"):
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private


def _check_url_policy(url, pinned_sha=None):
    """Download-source URL policy: https always OK; plain http only for LAN
    hosts (a local mirror) or when a sha256 is pinned so tampering is caught."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme == "https":
        return
    if parts.scheme == "http":
        if pinned_sha or _is_lan_host(parts.hostname):
            return
        raise ValueError("plain http:// is only allowed for LAN mirrors or "
                         "with a pinned sha256 — use https://")
    raise ValueError("URL must start with http:// or https://")


# ---- one-click URL resolution ----------------------------------------------
# Kiwix ZIM filenames are dated (e.g. wikimed_en_all_maxi_2024-06.zim) and roll
# forward over time, which is why the shipped catalog can't hard-code a link.
# Instead each source names a Kiwix directory + base name, and we look up the
# current dated file at download time — so the UI is one-click, not paste-a-link,
# and keeps working as Kiwix publishes newer builds.

_RESOLVE_TIMEOUT = 30


def _http_get_text(url, timeout=_RESOLVE_TIMEOUT):
    req = urllib.request.Request(url, headers={"User-Agent": "Needfire-corpus"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, "replace")


def _resolve_kiwix_latest(dir_url, base, timeout=_RESOLVE_TIMEOUT):
    """Find the newest dated ZIM (`<base>_YYYY-MM.zim`) in a Kiwix autoindex
    directory listing. Returns the absolute download URL."""
    if not dir_url.endswith("/"):
        dir_url += "/"
    html = _http_get_text(dir_url, timeout=timeout)
    fname_re = re.compile(r"^" + re.escape(base) + r"_\d{4}-\d{2}(?:-\d{2})?\.zim$")
    names = []
    for href in re.findall(r'href="([^"]+)"', html):
        name = urllib.parse.unquote(href.rsplit("/", 1)[-1])
        if fname_re.match(name):
            names.append(name)
    if not names:
        raise ValueError(f"no current build matching {base}_*.zim at {dir_url}")
    return urllib.parse.urljoin(dir_url, max(names))  # YYYY-MM sorts chronologically


def _fetch_sidecar_sha256(file_url, timeout=_RESOLVE_TIMEOUT):
    """Best-effort fetch of a Kiwix `<file>.sha256` sidecar to auto-pin integrity
    on a one-click download. Returns the lowercase hash or None."""
    try:
        text = _http_get_text(file_url + ".sha256", timeout=timeout)
    except Exception:  # noqa: BLE001 - integrity pin is best-effort
        return None
    m = re.search(r"\b([a-fA-F0-9]{64})\b", text)
    return m.group(1).lower() if m else None


def is_resolvable(source):
    """True when a source can be downloaded with no hand-pasted URL: it has a
    real explicit URL, or a Kiwix directory + base name we can look up."""
    url = (source.get("url") or "").strip()
    if url and "<" not in url:
        return True
    return bool(source.get("dir") and source.get("base"))


def resolve_download_url(source):
    """Return (url, sha256) for a source, discovering the current Kiwix filename
    when the catalog gives a `dir` + `base` instead of a fixed link. An explicit
    (or user-overridden) real URL always wins. Raises if nothing resolves."""
    url = (source.get("url") or "").strip()
    if url and "<" not in url:
        return url, ((source.get("sha256") or "").strip().lower() or None)
    d, base = source.get("dir"), source.get("base")
    if d and base:
        resolved = _resolve_kiwix_latest(d, base)
        sha = ((source.get("sha256") or "").strip().lower()
               or _fetch_sidecar_sha256(resolved))
        return resolved, sha
    raise ValueError("no download URL for this source — set one below")


def _overrides_path():
    return config.NEEDFIRE_HOME / "catalog-overrides.json"


def _load_overrides():
    try:
        return json.loads(_overrides_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"urls": {}, "sources": []}


def _save_overrides(data):
    config.NEEDFIRE_HOME.mkdir(parents=True, exist_ok=True)
    _overrides_path().write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_catalog():
    """Repo catalog merged with the user's NEEDFIRE_HOME overrides: per-source
    URL replacements (fills the shipped <placeholder> URLs), sha256 pins, plus
    custom sources the user added. The repo catalog stays read-only."""
    base = []
    if config.CATALOG_PATH.exists():
        base = json.loads(config.CATALOG_PATH.read_text(encoding="utf-8")).get("sources", [])
    ov = _load_overrides()
    urls = ov.get("urls", {})
    pins = ov.get("sha256", {})
    out = []
    for s in base:
        s = dict(s)
        if s["id"] in urls:
            s["url"] = urls[s["id"]]
        if pins.get(s["id"]):
            s["sha256"] = pins[s["id"]]
        out.append(s)
    have = {s["id"] for s in out}
    for extra in ov.get("sources", []):
        if extra.get("id") and extra["id"] not in have:
            out.append(extra)
    return out


def set_source_url(source_id, url, sha256=None):
    """Replace a catalog source's URL (fills a shipped placeholder), optionally
    pinning the publisher's SHA-256 (enforced at download time)."""
    sha256 = (sha256 or "").strip().lower() or None
    _check_url_policy(url, pinned_sha=sha256)
    ov = _load_overrides()
    ov.setdefault("urls", {})[source_id] = url
    if sha256:
        ov.setdefault("sha256", {})[source_id] = sha256
    else:
        ov.get("sha256", {}).pop(source_id, None)
    _save_overrides(ov)
    return load_catalog()


def add_custom_source(source):
    """Add a user-defined download source. Requires id,title,url,filename.
    An optional `sha256` key pins the expected hash."""
    for key in ("id", "title", "url"):
        if not source.get(key):
            raise ValueError(f"missing {key}")
    _check_url_policy(source["url"], pinned_sha=source.get("sha256"))
    source.setdefault("domain", "reference")
    source.setdefault("tier", "C2")
    source.setdefault("dest", "docs")
    source.setdefault("filename", source["url"].rstrip("/").split("/")[-1] or source["id"])
    source.setdefault("license", "see source")
    source.setdefault("approx_bytes", 0)
    ov = _load_overrides()
    ov.setdefault("sources", [])
    ov["sources"] = [s for s in ov["sources"] if s.get("id") != source["id"]]
    ov["sources"].append(source)
    _save_overrides(ov)
    return source


def import_local(path, title=None, domain="reference"):
    """Register a file already on this machine into the library. Markdown/text
    goes to DOCS_DIR (ingested directly on reindex); .zim goes to zim/C2."""
    import shutil
    src = os.path.abspath(os.path.expanduser(path))
    if not os.path.isfile(src):
        raise ValueError("file not found on this computer")
    ext = os.path.splitext(src)[1].lower()
    if ext in (".md", ".txt", ".markdown"):
        dest_dir = config.DOCS_DIR
    elif ext == ".zim":
        dest_dir = config.NEEDFIRE_HOME / "zim" / "C2"
    else:
        raise ValueError("only .md, .txt, or .zim files can be imported")
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / os.path.basename(src)
    shutil.copy2(src, dest)
    return {"imported": str(dest.relative_to(config.NEEDFIRE_HOME)),
            "kind": "document" if ext != ".zim" else "zim"}


def load_manifest():
    if not config.MANIFEST.exists():
        return []
    try:
        return json.loads(config.MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def save_manifest(entries):
    config.MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    config.MANIFEST.write_text(json.dumps(sorted(entries, key=lambda e: e["id"]), indent=2), encoding="utf-8")


def _merge(entries, entry):
    entries = [e for e in entries if e.get("id") != entry["id"]]
    entries.append(entry)
    return entries


def _dest_for(source):
    sub = source.get("dest", f"zim/{source.get('tier', 'C2')}")
    d = config.NEEDFIRE_HOME / sub
    d.mkdir(parents=True, exist_ok=True)
    return d / source["filename"]


def installed_status():
    """Return catalog augmented with on-disk presence + sizes.

    `verified` means a verify() re-hash succeeded since the file last changed;
    `sha256_recorded` only means a hash was captured at download time.
    """
    manifest = {e["id"]: e for e in load_manifest()}
    out = []
    for s in load_catalog():
        dest = _dest_for(s)
        present = dest.exists()
        entry = dict(s)
        entry["installed"] = present
        entry["installed_bytes"] = dest.stat().st_size if present else 0
        # resolvable: can download with one click (explicit URL, or a Kiwix
        # dir+base we look up). placeholder: still needs a hand-pasted URL
        # (e.g. the region-specific map extract).
        entry["resolvable"] = is_resolvable(s)
        entry["placeholder"] = not entry["resolvable"]
        # pinned: an expected hash ships with the source and is enforced at
        # download time (vs. sha256_recorded, which is trust-on-first-use)
        entry["pinned"] = bool(s.get("sha256"))
        m = manifest.get(s["id"], {})
        entry["sha256_recorded"] = bool(m.get("sha256"))
        verified_at = m.get("verified_at") or 0
        entry["verified"] = bool(present and verified_at
                                 and verified_at >= dest.stat().st_mtime)
        out.append(entry)
    return out


# ---- download with progress (threaded, resumable) --------------------------

class DownloadJob:
    def __init__(self):
        self.lock = threading.Lock()
        self.active = False
        self.items = {}      # id -> {state, bytes, total, error}
        self.thread = None

    def snapshot(self):
        with self.lock:
            return {"active": self.active, "items": dict(self.items)}

    def start(self, source_ids):
        with self.lock:
            if self.active:
                return False
            self.active = True
            self.items = {sid: {"state": "queued", "bytes": 0, "total": 0, "error": None}
                          for sid in source_ids}
        self.thread = threading.Thread(target=self._run, args=(source_ids,), daemon=True)
        self.thread.start()
        return True

    def _set(self, sid, **kw):
        with self.lock:
            self.items[sid].update(kw)

    def _run(self, source_ids):
        catalog = {s["id"]: s for s in load_catalog()}
        manifest = load_manifest()
        for sid in source_ids:
            source = catalog.get(sid)
            if not source:
                self._set(sid, state="error", error="not in catalog")
                continue
            try:
                self._set(sid, state="resolving")
                url, sha = resolve_download_url(source)  # finds the current Kiwix file
            except Exception as exc:  # noqa: BLE001 - no URL / offline / layout change
                self._set(sid, state="skipped", error=str(exc))
                continue
            try:
                entry = self._download_one(sid, source, url=url, sha256=sha)
                manifest = _merge(manifest, entry)
                save_manifest(manifest)
                self._set(sid, state="done")
            except Exception as exc:  # noqa: BLE001 - surface any failure to UI
                self._set(sid, state="error", error=str(exc))
        with self.lock:
            self.active = False

    def _download_one(self, sid, source, url=None, sha256=None):
        if url is None:  # standalone callers (and tests) resolve on demand
            url, sha256 = resolve_download_url(source)
        expected = (sha256 or source.get("sha256") or "").strip().lower()
        _check_url_policy(url, pinned_sha=expected or None)
        dest = _dest_for(source)
        tmp = dest.with_suffix(dest.suffix + ".part")
        resume_from = tmp.stat().st_size if tmp.exists() else 0
        req = urllib.request.Request(url)
        if resume_from:
            req.add_header("Range", f"bytes={resume_from}-")
        sha = hashlib.sha256()
        if resume_from:  # re-hash the part already on disk
            with open(tmp, "rb") as fh:
                for block in iter(lambda: fh.read(1 << 20), b""):
                    sha.update(block)
        self._set(sid, state="downloading", bytes=resume_from)
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resume_from and resp.status != 206:
                # Server ignored the Range header and sent the whole file.
                # Appending would corrupt it — restart from byte 0.
                resume_from = 0
                sha = hashlib.sha256()
                self._set(sid, bytes=0)
            if resp.status == 206:
                m = re.match(r"bytes \d+-\d+/(\d+)",
                             resp.headers.get("Content-Range", ""))
                total = (int(m.group(1)) if m else
                         int(resp.headers.get("Content-Length", 0)) + resume_from)
            else:
                total = int(resp.headers.get("Content-Length", 0))
            self._set(sid, total=total)
            mode = "ab" if resume_from else "wb"
            written = resume_from
            with open(tmp, mode) as fh:
                while True:
                    block = resp.read(1 << 20)
                    if not block:
                        break
                    fh.write(block)
                    sha.update(block)
                    written += len(block)
                    self._set(sid, bytes=written)
        digest = sha.hexdigest()
        if expected and digest != expected:
            # a corrupt .part would poison every resume attempt — discard it
            tmp.unlink(missing_ok=True)
            raise ValueError(f"sha256 mismatch: expected {expected[:12]}…, "
                             f"got {digest[:12]}… — download discarded")
        os.replace(tmp, dest)
        return {
            "id": source["id"],
            "title": source.get("title", source["id"]),
            "tier": source.get("tier"),
            "domain": source.get("domain"),
            "bytes": dest.stat().st_size,
            "sha256": digest,
            "license": source.get("license"),
            "source": url,
            "placement": "hot" if source.get("tier") == "C1" else "cold",
            "added": time.strftime("%Y-%m-%d"),
        }


JOB = DownloadJob()


# ---- verification ----------------------------------------------------------

def verify():
    """Re-hash every manifest artifact. Returns a report dict and stamps
    `verified_at` on entries that pass (consumed by installed_status)."""
    report = {"ok": [], "changed": [], "missing": []}
    entries = load_manifest()
    now = time.time()
    for e in entries:
        path = config.NEEDFIRE_HOME / _rel_for(e)
        if not path.exists():
            e.pop("verified_at", None)
            report["missing"].append(e["id"])
            continue
        sha = hashlib.sha256()
        with open(path, "rb") as fh:
            for block in iter(lambda: fh.read(1 << 20), b""):
                sha.update(block)
        if sha.hexdigest() == e.get("sha256"):
            e["verified_at"] = now
            report["ok"].append(e["id"])
        else:
            e.pop("verified_at", None)
            report["changed"].append(e["id"])
    if entries:
        save_manifest(entries)
    return report


def verify_seed():
    """Check the bundled seed documents against seed-manifest.json hashes."""
    manifest_path = config.SEED_DIR / "seed-manifest.json"
    report = {"ok": [], "changed": [], "missing": []}
    if not manifest_path.exists():
        return report
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    for d in data.get("documents", []):
        path = config.SEED_DIR / "documents" / d["file"]
        if not path.exists():
            report["missing"].append(d["file"])
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if d.get("sha256") and digest == d["sha256"]:
            report["ok"].append(d["file"])
        else:
            report["changed"].append(d["file"])
    return report


def _rel_for(entry):
    # The manifest id may be a catalog id; resolve via catalog dest if needed.
    for s in load_catalog():
        if s["id"] == entry["id"]:
            sub = s.get("dest", f"zim/{s.get('tier', 'C2')}")
            return os.path.join(sub, s["filename"])
    return entry["id"]
