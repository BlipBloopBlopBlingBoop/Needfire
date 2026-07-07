# Changelog

## Versioning scheme

The artifacts in this repository version independently, on purpose:

| Number | Where | Meaning |
|---|---|---|
| App version (`2.3.0`) | `needfire/__init__.py` `__version__` | **The release number** — the only user-facing version. SemVer. The `docker-compose.yml` image tag tracks it; bump both together. |
| Index schema (`2`) | `needfire/db.py` `SCHEMA_VERSION` | Integer. A mismatch with an existing index triggers the rebuild warning in the server; bump when the SQLite layout changes. |
| Seed manifest (`2.3.0`) | `seed-corpus/seed-manifest.json` | Bumped when the bundled seed documents change (regenerate with `make seed-manifest`). |
| Catalog (`1.0.0`) | `catalog/catalog.json` | Bumped when the download-source list changes. |
| Protocols (`1`) | `web/data/protocols.json` | The emergency-protocol data format. |

## 2.3.0 — 2026-07-07

More tools and knowledge.

### New seed documents (40 → 46)
Six new CC0 reference documents, all offline-first and cited by the toolkit
where relevant:
- **Shock — Recognition and First Aid** (medicine): whole-body circulatory
  shock — the picture, the causes, and the field priorities. Also closes the
  gap behind the router's deliberately un-hinted bare "shock" query.
- **Carbon Monoxide — The Silent Killer** (medicine): the leading killer after
  storms and power cuts — never run generators/stoves/engines indoors,
  recognition, and response.
- **Lightning and Severe-Storm Safety** (reference): flash-to-bang ranging, the
  30-30 rule, where to shelter, and the caught-in-the-open crouch.
- **Wind Chill and Heat Index** (reference): the standard "feels-like" formulas
  and frostbite/heat-illness danger bands that drive the new exposure tool.
- **Rationing Food and Water** (reference): planning figures and survival floors
  for water (~3 L/day plan, ~2 L floor) and food (~2,000 kcal/day, ~1,200 floor).
- **Eye Injuries and Chemical Splashes** (medicine): flush-first for chemicals,
  foreign bodies, and never-remove-embedded-objects.

*Navigation:* added a "judging distance and travel time" section (pace count +
Naismith's rule) to *Navigation with Map and Compass*.

### New toolkit tools (8 → 13)
All pure client-side, offline, and citing their source document:
- **Feels-like temperature** — wind chill (cold) and heat index (heat) with
  frostbite-time and heat-illness warnings.
- **Lightning range** — flash-to-bang distance in km/mi with the 30-30 shelter
  warning.
- **Ration planner** — days of water and food from stores, people, and per-day
  rates, flagging plans below the survival floor.
- **Pace & travel time** — calibrate stride, estimate distance from a pace
  tally, and estimate walking time (Naismith).
- **Declination converter** — true ↔ magnetic bearing conversion.

## 2.2.0 — 2026-07-03

Launch-hardening release.

### Content accuracy
- Full fact-check pass over all 40 seed documents, the 12 emergency protocols,
  and the toolkit's embedded constants against current guidelines (AHA/ERC,
  WHO, Stop the Bleed, CDC/EPA, ICAO, NEC). The corpus was already highly
  accurate; verified corrections and completeness additions:
  - Fixed the toolkit signal card's Morse "repeat" code (`··––··`, the IMI /
    "?" prosign; was the letter É).
  - ORS: added WHO zinc-for-children guidance. Fractures: added the
    femur/pelvis internal-hemorrhage red flag. Food preservation: added
    "low-acid foods need a pressure canner" and the no-honey-under-1-year
    infant-botulism note. Wild game: added a chronic-wasting-disease caveat.
  - Protocols: eye-flush timer now anchors 20 min; drowning breathing-branch
    names the recovery position; heat-stroke branch ends with an explicit
    evacuation step; cold protocol adds a trench-foot triage branch and step.
  (Seed corpus manifest → 2.2.0.)

### Legal & safety
- New top-level **`DISCLAIMER.md`** (not professional advice, use at your own
  risk, not a substitute for emergency services, AI/hardware/medication
  caveats, corpus licensing) — linked from README, START-HERE, QUICKSTART,
  PROJECT, LICENSE, and shipped in the dist/appliance/image packages.
- Every emergency protocol now leads with **"call your local emergency number
  first"** — in the always-visible player footer and as a banner on the
  emergency grid. (Protocol text only; the data format is unchanged, so
  `protocols.json` stays format version 1.)
- Every model-generated answer now carries an **"AI answers can be wrong"**
  note (the stronger safety-critical banner is unchanged).
- Explicit **battery/electrical/fire hazard warnings** in the hardware docs
  (02, 05, 06): lithium venting, DC arc fires, mains work → licensed
  electrician.
- Strengthened footers on the medication, antibiotics, radiation, and
  chemical-safety seed docs (seed manifest → 2.1.0).

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

### Documentation & community
- New: `SECURITY.md` (threat model, reporting), `CONTRIBUTING.md`,
  `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, and `DISCLAIMER.md`.
- **CI workflow** (`.github/workflows/ci.yml`): test matrix incl. the
  Python 3.8 floor, byte-compile, shell-syntax, and JSON checks.
- Issue forms, a PR template, UI screenshots (`docs/screenshots/`), a social
  preview image, and a reworked README (quick start above the fold, badges,
  comparison table, screenshot gallery).
- Scrubbed stale references to the project's pre-rename directory name and
  reworded the image-builder status caveat.

## 2.1.1 and earlier

Pre-launch development; see the git history.
