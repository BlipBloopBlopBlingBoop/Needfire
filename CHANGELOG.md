# Changelog

## Versioning scheme

The artifacts in this repository version independently, on purpose:

| Number | Where | Meaning |
|---|---|---|
| App version (`2.8.0`) | `needfire/__init__.py` `__version__` | **The release number** — the only user-facing version. SemVer. The `docker-compose.yml` image tag tracks it; bump both together. |
| Index schema (`2`) | `needfire/db.py` `SCHEMA_VERSION` | Integer. A mismatch with an existing index triggers the rebuild warning in the server; bump when the SQLite layout changes. |
| Seed manifest (`2.8.0`) | `seed-corpus/seed-manifest.json` | Bumped when the bundled seed documents change (regenerate with `make seed-manifest`). |
| Catalog (`1.1.0`) | `catalog/catalog.json` | Bumped when the download-source list changes. |
| Protocols (`1`) | `web/data/protocols.json` | The emergency-protocol data format. |

## 2.8.0 — 2026-07-08

A full offline navigation package — stars, sun, charts, position, and grids.

Everything is pure client-side math in `web/js/nav.js` (~28 KB source incl. a
~2 KB catalog of 41 bright navigation stars), service-worker precached, so the
whole package works with no server, no signal, and no GPS. The astronomy and
geodesy are validated in node against published anchors (GMST at J2000, solstice/
equinox solar declination, London solstice sunrise/sunset to the minute, Polaris
altitude ≈ latitude, sun azimuth = 180° at solar noon, UTM round-trips < 1e-6°).

### New toolkit tools (22 → 27)
- **Sun & moon** — the sun's TRUE bearing and altitude for your position and time
  (a working sun compass), sunrise/solar-noon/sunset with polar day/night
  handling, day length, equation of time, and the moon's phase/illumination
  (night-travel light). Comparing the computed true bearing with a compass
  needle also measures your local magnetic declination in the field.
- **Star chart** — a computed planisphere: 41 bright navigation stars with the
  asterisms drawn (Big Dipper → Polaris pointers, Cassiopeia, Orion, Southern
  Cross + Pointers, Summer Triangle) for any latitude/longitude and time,
  rendered on canvas in the app's theme (night-vision mode included).
- **Find position** — latitude from Polaris altitude or from the noon sun (solar
  declination computed for the date, equator/pole-side handling), and longitude
  from the UTC time of local solar noon with equation-of-time correction.
- **Dead-reckoning log** — log each leg (true bearing + distance); it keeps the
  running north/east offset, distance from start, and the bearing home, persisted
  in localStorage so it survives closing the app.
- **Grid converter** — latitude/longitude ↔ UTM (WGS-84) for paper-map grid work.

### New seed documents (81 → 84)
- **celestial-navigation.md** (navigation, C2) — measuring angles with hand/
  quadrant, latitude from Polaris and the noon sun, longitude from time, and the
  watch-as-compass method. Backs the sun & position tools.
- **reading-topographic-maps.md** (navigation, C1) — scale, contours, symbols,
  grid references (read right then up), orienting the map, terrain association.
  Backs the grid converter.
- **route-planning-dead-reckoning.md** (navigation, C1) — legs, attack points,
  handrails, catching features, aiming off, boxing obstacles, leapfrogging in
  fog, and lost procedure. Backs the dead-reckoning log.

### UI
- The toolkit home is now **grouped by category** (Medical, Navigation & sky,
  Water & rations, Power & electrical, Timers & signals, Field reference) — 27
  tools were outgrowing a flat grid. SW cache v9 → v10.

### Router
- Added navigation query words (bearing, latitude, longitude, sunrise, sunset,
  stars, declination) so these route to the navigation domain.

## 2.7.2 — 2026-07-08

Documentation cleanup for a clean release — one clear doc per path.

The getting-started docs overlapped and competed (`START-HERE.txt` and
`QUICKSTART.md` both walked through per-OS launch; `PROJECT.md` re-explained "run
in 30 seconds"). Each doc now has one job:
- **`QUICKSTART.md`** is the single complete how-to-run guide (every OS, phones,
  iPhone/iPad, appliance, troubleshooting).
- **`START-HERE.txt`** is slimmed to a minimal plain-text launch card for the
  downloadable package — double-click the launcher, then defer to QUICKSTART for
  everything else (no more duplicated per-OS steps).
- **`PROJECT.md`** is reframed as the developer/run-from-source reference (the
  running app + field-console reference), pointing to QUICKSTART for install.
- **`README.md`** "Who are you?" now gives exactly one doc per audience, and the
  repo-layout map describes each entry doc distinctly.
No broken links (all relative links verified); no code changes.

## 2.7.1 — 2026-07-08

Run Needfire on iOS (iPhone / iPad).

- **Installable web app on iOS.** Added the iOS PWA meta tags
  (`apple-mobile-web-app-capable`, status-bar style, app title, plus the standard
  `mobile-web-app-capable`) so Safari's **Add to Home Screen** launches Needfire
  full-screen with its own icon. The service worker already precaches the shell and
  `protocols.json`, so **Emergency mode and the Toolkit work with no signal** once
  installed. Bumped the SW cache (`v8 → v9`).
- **Documented two iOS paths** in `QUICKSTART.md` (§4a) and `START-HERE.txt`:
  (A) install from a Bothy/computer on your Wi-Fi; (B) run it **entirely on the
  phone** — because Needfire is pure-stdlib with zero dependencies, `python3 -m
  needfire serve` runs inside the free **a-Shell** (or **iSH**) app and you open
  Safari to `localhost:8848`. Runs in sources-only mode (no on-device model).
- Added a test guarding the iOS install meta tags in the served page.

## 2.7.0 — 2026-07-07

Deeper emergency guides and expanded documents for real off-grid use.

The guided protocols and their documents were accurate but shallow, and leaned on
"call an ambulance" — the opposite of the situation Needfire is built for. This
release rebuilds them into real decision trees with off-grid branches (identify
the specific problem, manage it when no professional help is coming, know when to
evacuate), and expands the underlying documents to match.

### Emergency protocols (`web/data/protocols.json`)
- **Poisoning** rebuilt from 10 shallow steps into a **24-step decision tree**:
  scene safety → primary survey (recovery/CPR/seizure branches) → route in →
  *what was swallowed* (corrosive / fuel / pesticide / painkillers / opioids /
  alcohol / plants & mushrooms / unknown), each with its own correct management
  (no-vomit rules, dilution, button-battery honey, naloxone, methanol/paracetamol
  red flags), an activated-charcoal decision, an ongoing-monitoring loop, and an
  explicit "if no help is coming / when to evacuate" step. Uses the collapsible
  "More detail" field to carry depth without cluttering each screen.
- **Severe bleeding** rebuilt (7 → **12 steps**): direct pressure → *where is it*
  (limb / junctional / torso / other), wound packing, tourniquet with improvised
  windlass and second-tourniquet guidance, an **off-grid tourniquet-conversion**
  step (swap to a pressure dressing when help is hours/days away), sucking-chest
  and abdominal-evisceration handling, shock treatment, and multi-day aftercare.
- **Anaphylaxis** rebuilt (8 → **11 steps**) with a **"do you have adrenaline?"**
  branch — the off-grid reality many kits face — including real no-adrenaline
  management (positioning, inhaler, airway, evacuate), correct dosing, position
  branches, repeat-dose timer, and biphasic watch.
- **CPR** gained an off-grid **"when is it reasonable to stop?"** step — the
  hardest question when no ambulance is coming: very low survival after ~20–30 min
  with no signs of life, but keep going far longer for cold/drowning/avalanche/
  lightning ("not dead until warm and dead").
- **Burns** critical-burn list corrected to include **feet** (matching its doc).

### Documents (expanded to real off-grid depth)
- **poisoning-first-aid.md** (~2 KB → ~7 KB): universal rules, decontamination by
  route, per-class management (corrosives, hydrocarbons, pesticides, medicines
  incl. paracetamol/opioid/alcohol, plants & mushrooms, gases/CO, botulism),
  activated-charcoal guidance, and ongoing care / evacuation triggers.
- **control-bleeding.md** (~1.5 KB → ~5 KB): direct pressure, wound packing,
  tourniquet + improvised windlass + conversion, junctional/torso wounds, shock,
  and days-long aftercare/infection watch.
- **anaphylaxis-allergy.md** expanded with an off-grid "no adrenaline available"
  section, fuller recognition, and position/biphasic detail.
- **snakebite-treatment.md** expanded: the two venom families and their signs,
  and off-grid management without antivenom (breathe for the paralysed, no
  aspirin/NSAIDs, limb/shock/infection watch) — most bites are survivable on
  supportive care.
- **burn-treatment.md** expanded: depth assessment, the fluid-loss that kills
  large burns and oral-ORS resuscitation (keep urine pale), circumferential-burn
  warning, and days-to-weeks wound care incl. honey dressings and infection watch.

### More protocols + docs deepened
- **Choking** rebuilt (8 → **13 steps**) with proper "did it clear?" branches, an
  infant path, a **self-rescue-when-alone** branch, and aftercare (abdominal-thrust
  injury check). Doc expanded to match.
- **Drowning** rebuilt (8 → **9 steps**): reach-throw-row, keep-horizontal
  extraction, spinal caveat, breaths-first CPR, expect-vomiting, prolonged cold-
  water CPR, and 24-hour secondary-drowning watch. Doc expanded.
- **Seizure** rebuilt (7 → **8 steps**) with a duration decision that surfaces
  **status epilepticus**, a stamp timer, and an off-grid causes step (febrile,
  low sugar, low salt, withdrawal, recurrent-without-help). Doc expanded.
- **Heat illness** rebuilt (9 → **12 steps**): cramps/exhaustion/stroke triage, a
  cool-by-immersion-vs-douse branch, stop-when-alert, and a recheck that escalates
  to stroke. **Cold injury** rebuilt (11 → **12 steps**): hypothermia severity
  branch (afterdrop, gentle handling, prolonged CPR) and the frostbite
  refreeze/rewarm decision with fire-burn warning. **Emergency childbirth** rebuilt
  (10 → **14 steps**) with nuchal-cord, shoulder-dystocia/breech detail, newborn
  resuscitation (3:1), delayed cord clamping, and postpartum-haemorrhage management.
  frostbite-cold-injuries.md and emergency-childbirth.md expanded to match.

With this, **all 12 emergency protocols and their documents** have been rebuilt as
real off-grid decision trees.

## 2.6.0 — 2026-07-07

One-click corpus downloads, plus a quality pass over the whole library.

### One-click downloads (no more pasting links)
The shipped catalog used `<placeholder>` URLs because Kiwix ZIM filenames are
dated and change over time, which forced the user to paste a real link for every
source. Now each Kiwix source ships a stable **directory + base name**, and
Needfire **resolves the current dated build at download time** — so every catalog
source is a genuine one-click **Download** (13 of the 14 sources; only the
region-specific map still needs a link). It also **auto-pins the publisher's
SHA-256** from the `.sha256` sidecar next to each ZIM, so one-click downloads are
still integrity-checked. Added a one-click **Download all C1** button for the
survival-critical set. Manual URL override is preserved as a fallback (a local
mirror, a specific build, or if a lookup fails). Both the Content UI and the
`needfire download` CLI use the resolver. (`catalog.json` → 1.1.0.)

### Corpus quality pass
- Fact-checked all 81 bundled documents (medical against AHA/ERC/Red Cross/WHO/
  Stop the Bleed; survival, technical, and tool formulas against their sources).
  No factual or safety errors were found — the values (CPR rate/depth, ORS recipe,
  bleach dosing, boil times, wind-chill/heat-index, radiation half-values, the
  7-10 rule, mechanical advantage, battery math) all check out.
- Consistency: added the standard closing disclaimer to six documents that were
  missing one (`finding-water`, `food-preservation`, `hypothermia-shelter`,
  `compass-navigation`, `solar-power-basics`, `sewing-and-mending`).

## 2.5.0 — 2026-07-07

Comprehensive corpus completion — balance every domain and round out the toolkit.

The bundled library had grown lopsided (26 medicine docs vs. one each for
agriculture, energy, and physics). Because the download catalog ships only
placeholder URLs, the bundled docs are the real always-offline knowledge, so this
release fills the gaps across all 13 domains.

### New seed documents (53 → 81; +28)
- **water:** rainwater-harvesting-storage
- **food:** cooking-methods-offgrid, nutrition-basics
- **shelter:** staying-warm-clothing, improvised-shelter-types
- **repair:** lashings-and-frames, sewing-and-mending, improvised-repairs-adhesives
- **navigation:** weather-prediction, natural-navigation-stars
- **medicine:** head-injury-concussion, sprains-strains,
  minor-wounds-blisters-splinters, tick-insect-borne-disease
- **pharma:** pain-and-fever-management, medicine-storage-shelf-life
- **chemistry:** making-disinfectants, lye-from-wood-ash
- **physics:** radiation-detection-dosimetry, mechanical-advantage
- **electronics:** radio-communications, multimeter-and-testing
- **energy:** batteries-and-charging, generators-and-fuel-safety
- **agriculture:** growing-food-basics, composting-and-soil
- **reference:** survival-priorities, emergency-preparedness-kit

Result: no domain below 3 docs; the thin C3 rebuild-stack domains roughly double.

### New toolkit tools (16 → 22)
Each pure-offline and citing its source doc:
- **disinfectant mix** — surface vs. blood/spill bleach dilution ratios
- **battery bank** — usable Wh (Ah × V × depth-of-discharge) and runtime
- **mechanical advantage** — block-and-tackle pull force + safe working load
- **fallout decay** — Way–Wigner / 7-10-rule dose-rate projection
- **wind & weather** — Beaufort force + storm-sign reference card
- **survival priorities** — rule-of-threes / STOP / priorities-of-work card

### Router
- Added `concussion` and `fallout` to the critical-query keywords.

### Fixes
- Corrected stale bundled-doc counts (some docs still said "40") across
  `01-ARCHITECTURE.md`, `03-DATA-ARCHITECTURE.md`, and `07-CORPUS-ACQUISITION.md`.

## 2.4.0 — 2026-07-07

More tools and knowledge (round two).

### New seed documents (46 → 53)
Seven new CC0 reference documents, weighted toward high-frequency medical
emergencies that were not yet covered:
- **Stroke — Recognize It FAST** (medicine): the FAST test, act-fast window, and
  why NOT to give aspirin.
- **Heart Attack and Chest Pain** (medicine): warning signs (including the quiet
  presentations), the sit-and-rest position, chew-aspirin guidance, and the
  slide into cardiac arrest.
- **Diabetic Emergencies** (medicine): low vs high blood sugar, and the
  when-in-doubt-give-sugar rule.
- **Asthma Attack and Sudden Breathing Trouble** (medicine): reliever-inhaler
  technique, danger signs, and the no-inhaler fallback.
- **Assessing a Casualty — DR-ABC** (medicine): the primary survey, the AVPU
  response scale, and the recovery position — backs the new casualty-check tool.
- **Measuring and Estimating Without Instruments** (reference): body ruler,
  shadow-stick height, thumb-jump distance, daylight-left, and conversions —
  backs the field estimator and unit converter.
- **Altitude Sickness — AMS, HACE, HAPE** (medicine): recognition and the
  descend-now rules.

### Router
- Added `stroke`, `cardiac`, `chest`, `asthma`, `wheez`, `diabet`, `hypoglyc`,
  `hyperglyc`, `unconscious`, and `unrespons` to the critical-query keywords so
  these emergencies route to depth and carry the read-the-source banner.

### New toolkit tools (13 → 16)
- **Casualty check** — a DR-ABC / AVPU / recovery-position reference card with a
  one-tap jump to the CPR protocol.
- **Field estimator** — body-ruler length, height-by-shadow, and daylight-left.
- **Unit converter** — two-way temperature, distance, mass, and volume.

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
