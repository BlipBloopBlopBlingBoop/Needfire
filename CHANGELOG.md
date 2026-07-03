# Changelog

## Versioning scheme

The artifacts in this repository version independently, on purpose:

| Number | Where | Meaning |
|---|---|---|
| App version (`2.2.0`) | `needfire/__init__.py` `__version__` | **The release number** — the only user-facing version. SemVer. The `docker-compose.yml` image tag tracks it; bump both together. |
| Index schema (`2`) | `needfire/db.py` `SCHEMA_VERSION` | Integer. A mismatch with an existing index triggers the rebuild warning in the server; bump when the SQLite layout changes. |
| Seed manifest (`2.0.0`) | `seed-corpus/seed-manifest.json` | Bumped when the bundled seed documents change (regenerate with `make seed-manifest`). |
| Catalog (`1.0.0`) | `catalog/catalog.json` | Bumped when the download-source list changes. |
| Protocols (`1`) | `web/data/protocols.json` | The emergency-protocol data format. |

## 2.2.0 — 2026-07-03

Launch-hardening release.

### Security
- Owner password minimum raised from 4 to **8 characters** (it gates Studio,
  which is code execution by design).
- Catalog downloads can pin an expected **SHA-256** (`sha256` per source, also
  settable from the Content UI); pinned hashes are enforced before a download
  lands, and a mismatch is discarded. New URL policy: public sources must be
  `https://`; plain `http://` only for LAN mirrors or with a pinned hash.
- The Raspberry Pi image builder now **checksum-verifies the base OS image**
  (auto-fetches the publisher's `.sha256`, or pin with `--sha256`).
- The Docker image runs as a **non-root user** (uid 10001) with a pinned
  base-image patch tag; `make docker` tags the image with the app version.
- Docker install advice no longer suggests `curl | sh`.

### Fixed
- `os/install.sh --port` now templates the chosen port into the airplane-mode
  firewall — a custom port is no longer silently blocked (vestigial port 8080
  removed from the ruleset).
- `/api/run` no longer emits a duplicate `done` SSE event.
- `install.sh` installs `PROJECT.md`/`README.md`/`QUICKSTART.md`/`SECURITY.md`/
  `LICENSE` to `/opt/needfire`, so the systemd unit's `Documentation=` link
  resolves.
- Removed the dead `overlap` parameter of `index.chunk_text()` and the unused
  `NEEDFIRE_CHUNK_OVERLAP` setting (overlap is the built-in carry-last-paragraph
  behavior).
- `PROTECTED_PREFIXES` cleanup: dropped the nonexistent `/api/studio` entry;
  the read-only `GET /api/reindex/status` poll is open again (POST stays
  gated). Content UI now surfaces server-side errors instead of swallowing
  them.

### Documentation
- New: `SECURITY.md` (threat model, reporting), `CONTRIBUTING.md`,
  `CHANGELOG.md`.
- Scrubbed stale references to the project's pre-rename directory name and
  reworded the image-builder status caveat.

## 2.1.1 and earlier

Pre-launch development; see the git history.
