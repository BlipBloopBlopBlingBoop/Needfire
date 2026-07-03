#!/usr/bin/env python3
"""Build the downloadable distribution: dist/needfire-<version>.zip (+ .sha256).

Pure stdlib. The zip contains a single top-level folder (needfire-<version>/)
with everything a non-technical person needs: the app, the web console, the
seed corpus, the launchers, START-HERE.txt, and the appliance/os tooling.
Executable bits are preserved for .sh/.command so extraction on mac/Linux
yields runnable files. An explicit allowlist (not "everything minus
excludes") keeps the artifact deterministic.

Run:  python3 scripts/make-dist.py   (or `make dist`)
"""
import hashlib
import re
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

ROOT_FILES = [
    "START-HERE.txt",
    "QUICKSTART.md",
    "Start-Needfire-Windows.bat",
    "Start-Needfire-Mac.command",
    "Start-Needfire-Linux.sh",
    "README.md",
    "PROJECT.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md",
    "Makefile",
    "Dockerfile",
    "docker-compose.yml",
    "01-ARCHITECTURE.md",
    "02-HARDWARE-INVENTORY.md",
    "03-DATA-ARCHITECTURE.md",
    "04-AI-MODEL-STACK.md",
    "05-POWER-AND-HARDENING.md",
    "06-BUILD-RUNBOOK.md",
    "07-CORPUS-ACQUISITION.md",
    "08-ALTERNATIVE-STACK.md",
]
TREES = ["needfire", "web", "seed-corpus", "catalog", "os", "bom", "tests", "scripts"]
SKIP_NAMES = {"__pycache__", ".DS_Store"}
SKIP_SUFFIXES = {".pyc"}


def version():
    text = (REPO / "needfire" / "__init__.py").read_text(encoding="utf-8")
    return re.search(r'__version__\s*=\s*"([^"]+)"', text).group(1)


def wanted(path):
    if path.name in SKIP_NAMES or path.suffix in SKIP_SUFFIXES:
        return False
    return not any(part in SKIP_NAMES for part in path.parts)


def add(zf, src, arcname):
    import os
    executable = (os.access(src, os.X_OK)
                  or src.suffix in (".sh", ".command"))
    zi = zipfile.ZipInfo(arcname)
    zi.create_system = 3  # unix, so external_attr mode bits apply
    zi.external_attr = ((0o100755 if executable else 0o100644) << 16)
    zi.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(zi, src.read_bytes())


def main():
    v = version()
    top = f"needfire-{v}"
    dist = REPO / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / f"{top}.zip"

    files = []
    for name in ROOT_FILES:
        p = REPO / name
        if not p.is_file():
            raise SystemExit(f"missing required file: {name}")
        files.append(p)
    for tree in TREES:
        for p in sorted((REPO / tree).rglob("*")):
            if p.is_file() and wanted(p.relative_to(REPO)):
                files.append(p)

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in files:
            arc = f"{top}/" + p.relative_to(REPO).as_posix()
            add(zf, p, arc)

    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    (dist / f"{top}.zip.sha256").write_text(f"{digest}  {top}.zip\n", encoding="utf-8")
    print(f"{out}  ({len(files)} files, {out.stat().st_size / 1e6:.1f} MB)")
    print(f"sha256: {digest}")


if __name__ == "__main__":
    main()
