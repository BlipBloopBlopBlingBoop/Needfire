#!/usr/bin/env python3
"""Regenerate seed-corpus/seed-manifest.json from the documents on disk.

Reads each markdown file's front-matter (domain/tier) and records its SHA-256
and size so `python3 -m needfire verify --seed` can prove the bundled reference
library hasn't been corrupted or tampered with. Run after adding or editing
any seed document:  python3 scripts/update-seed-manifest.py  (or `make seed-manifest`)
"""
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from needfire.index import _parse_frontmatter  # noqa: E402 - stdlib-only import

SEED_DIR = REPO / "seed-corpus"
MANIFEST = SEED_DIR / "seed-manifest.json"


def main():
    data = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    docs = []
    for path in sorted((SEED_DIR / "documents").glob("*.md")):
        raw = path.read_bytes()
        meta, _body = _parse_frontmatter(raw.decode(errors="replace"))
        docs.append({
            "file": path.name,
            "title": meta.get("title", path.stem.replace("-", " ").title()),
            "domain": meta.get("domain", "reference"),
            "tier": meta.get("tier", "C1"),
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
        })
    changed = docs != data.get("documents")
    data["documents"] = docs
    MANIFEST.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"seed-manifest.json: {len(docs)} documents "
          f"({'updated' if changed else 'unchanged'})")


if __name__ == "__main__":
    main()
