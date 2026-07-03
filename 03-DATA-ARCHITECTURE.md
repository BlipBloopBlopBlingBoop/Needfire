# 03 — Data Architecture

How knowledge is organized, stored, indexed, retrieved, verified, and replicated. This is the heart of
the system: the hardware is replaceable, the **corpus is the irreplaceable asset.**

---

## 1. The goal, stated honestly

"Know everything imaginable" is not literally achievable, and a local model does **not** contain all
knowledge. What *is* achievable: **curate the highest-leverage human knowledge into a few terabytes of
openly-licensed, full-text-searchable documents, and put an AI reasoning layer in front of it that can
find, explain, and cross-reference — always pointing back at the source.**

The curation target is **"rebuild-civilization grade"**: enough to survive *and* to restart the chain
of *tools that make tools* — agriculture, medicine, chemistry, metallurgy, power, electronics, and the
science underneath them.

---

## 2. Corpus taxonomy (by criticality)

Knowledge is organized into four criticality tiers. **Tier C1 is loaded first and on every device,
including Personal.** C3/C4 fill out the Homestead and Community archives.

### C0, in effect — the bundled seed library
The repo ships **40 original CC0 documents** (`seed-corpus/documents/`, hashed in
`seed-manifest.json`) so the system answers real questions before you download anything: first aid
(CPR, choking, bleeding control, burns, fractures, anaphylaxis, poisoning, snakebite, seizures, heat
illness, frostbite, wound care, drowning, emergency childbirth, dental, mental-health crisis),
water purification & sanitation, food (preservation, foraging safety, fishing & trapping, wild game),
energy & electrical safety, chemistry (soap, chemical safety), radiation shielding, navigation &
signaling, knots, tool sharpening, and seed saving. It is a demonstration set, **not** a substitute
for the tiers below.

### C1 — Survival-critical (load first, everywhere)
- **Medicine & first aid:** WikiMed, medical reference ZIMs, wound care, triage, CPR, childbirth,
  common illnesses, dosing references.
- **Water:** sourcing, filtration, purification (chemical & boiling), storage.
- **Food:** foraging, preservation (canning, drying, salting, fermentation), safety, basic cooking.
- **Shelter & warmth:** insulation, fire, hypothermia/heat management.
- **Immediate repair:** knots, basic tools, improvised fixes, iFixit core guides.
- **Navigation:** offline maps (OSM extracts), compass, signaling.

### C2 — Reference (broad human knowledge)
- **Full offline Wikipedia** (with images), **Wiktionary**, **Wikibooks**, **Wikiversity**.
- **Project Gutenberg** (public-domain books, education, fiction for morale).
- **Stack Exchange** dumps (practical Q&A across domains).
- General how-to libraries and encyclopedias.

### C3 — Civilizational / rebuild stack (the deep STEM — "the works")
This is the explicit "rebuild civilization" requirement. Each sub-domain below is a curated collection
of textbooks, references, and process manuals.

| Domain | What it must cover |
|--------|--------------------|
| **Chemistry** | General/organic/inorganic/physical chemistry textbooks; *Handbook of Chemistry & Physics*-class data (constants, properties, reactions); **industrial process chemistry** — ammonia/Haber-Bosch → fertilizer, chlor-alkali, sulfuric & nitric acid, soap/lye, glass, ceramics, dyes, solvents; lab technique, glassware, and **safety**. |
| **Pharmaceuticals** | Pharmacology; **pharmacognosy** (medicinal plants); drug synthesis & **galenical/compounding** references; antibiotic production (e.g. penicillin culturing); anesthetics & analgesics; vaccine & cold-chain basics; formularies & dosing; field-medicine guides. |
| **Nuclear & advanced physics** | Full physics textbook stack — classical mechanics, E&M, thermodynamics, quantum, **nuclear**, solid-state; nuclear engineering references (fission, decay, cross-sections, reactor principles); **radiation detection, dosimetry, shielding, RTGs**; radiological **safety**. *Knowledge preservation and radiation safety/power — not weapons engineering.* |
| **Materials & manufacturing** | Metallurgy & smelting, casting/foundry, **machining & toolmaking** (machinist's-handbook-class), welding, mining & ore processing, cement/concrete, plastics & polymers, woodworking. |
| **Energy & electronics** | Electrical engineering; power generation (hydro, wind, solar, steam); motors & generators; **electronics fundamentals** (*The Art of Electronics*-class); semiconductors; radio & communications. |
| **Agriculture & food systems** | Agronomy, soil science, **seed saving**, crop & pest management, animal husbandry, veterinary basics, irrigation, food preservation at scale, brewing/fermentation. |
| **Math & computing** | Mathematics reference (algebra → calculus → statistics → numerical methods); algorithms; and a **bootstrap toolchain** (compiler/interpreter sources + docs) so the software itself is rebuildable. |
| **Construction & infra** | Structural basics, sanitation & sewage, well drilling, basic civil engineering, surveying. |
| **Governance / law / records** | Basic legal codes, civics, record-keeping, and "how knowledge was organized" so institutions can re-bootstrap. |

**Curation model / anchors:** the *Survivor Library*, Dartnell's *The Knowledge: How to Rebuild Our
World from Scratch* (as an **index of what matters**, not a substitute for the references), the
*Encyclopedia of Country Living* (commercial — buy a copy), the appropriate-technology archives
(CD3WD-style), and openly-licensed textbook collections (OpenStax, LibreTexts) for
chemistry/physics/biology/math. Licensing per source: [`07-CORPUS-ACQUISITION.md`](07-CORPUS-ACQUISITION.md).

### C4 — Cultural / morale / continuity
- Children's education (reading, math, science curricula), literature, music theory, art, history,
  religious/philosophical texts as desired, language learning. **Morale and continuity of culture are
  survival functions too**, especially for groups and children.

---

## 3. Storage layout (`NEEDFIRE_HOME`)

All runtime data lives under one directory, set by the **`NEEDFIRE_HOME`** environment variable:

| Environment | `NEEDFIRE_HOME` default |
|-------------|--------------------|
| Dev checkout (`python3 -m needfire serve`) | `<repo>/.needfire-home` |
| Docker (`docker compose up`) | `/data` (named volume) |
| Appliance (`os/install.sh`) | `/var/lib/needfire` (app code in `/opt/needfire`, env in `/etc/needfire/needfire.env`) |

```
$NEEDFIRE_HOME/
├── manifest.json            # record of every DOWNLOADED artifact: id, sha256, size, license, tier
├── manifest.json.sig        # optional detached GPG signature (verify-integrity.sh checks it)
├── zim/                     # Kiwix ZIM files, by tier (indexed directly if libzim is installed)
│   ├── C1/  wikimed_*.zim  ifixit_*.zim ...
│   ├── C2/  wikipedia_*.zim  gutenberg_*.zim ...
│   ├── C3/  wikibooks_*.zim  stackexchange_*.zim ...
│   └── C4/  ...
├── docs/                    # loose .md/.txt placed by the operator — indexed as-is
│   └── C3/ chemistry/ pharma/ physics/ metallurgy/ electronics/ ...
├── maps/                    # OSM extracts / map files — stored & served as files for
│                            # client apps (e.g. Organic Maps); Needfire does NOT render tiles
├── index/
│   └── chunks.sqlite        # THE index: docs + chunks + vectors + FTS + meta (see §5)
└── logs/
```

The bundled seed corpus stays in the repo/app directory (`seed-corpus/`, `NEEDFIRE_SEED_DIR`) — it is
part of the software, verified separately (`python3 -m needfire verify --seed`), and indexed into
`chunks.sqlite` alongside everything else.

### Hot vs cold placement
- **Hot (NVMe SSD):** `index/`, model files (Ollama's store), and the **C1 + most-queried C2**
  content. These need fast random reads. Personal tier keeps everything it has here.
- **Cold (HDD/SSD, spun down when idle):** full `zim/C2–C4`, `docs/`, `maps/`. The manifest records
  a `placement` hint (`hot` for C1, `cold` otherwise) to guide where you mount things.

---

## 4. The manifests (source of truth)

**`$NEEDFIRE_HOME/manifest.json`** is the authoritative record of downloaded artifacts, written by
`python3 -m needfire download` as it goes. Schema (per artifact, see `needfire/corpus.py`):

```json
{
  "id": "wikimed-en",
  "title": "WikiMed Medical Encyclopedia (English)",
  "tier": "C1",
  "domain": "medicine",
  "bytes": 1825361100,
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "license": "CC-BY-SA-4.0",
  "source": "https://download.kiwix.org/zim/...",
  "placement": "hot",
  "added": "2026-06-01"
}
```

- **Integrity:** the `sha256` lets `python3 -m needfire verify` (wrapped by `scripts/verify-integrity.sh`)
  detect bit-rot, bad transfers, or tampering. Verified entries are stamped `verified_at`.
- **Signing:** if you GPG-sign the manifest (`manifest.json.sig`), the wrapper checks the signature
  first and refuses to proceed on failure — hash checks against a tampered manifest are meaningless.
- **Licensing:** every artifact carries its license so you know what you may redistribute.
- **Selective sync:** copying a tier to a Personal device = filter the manifest by `tier` and `rsync`
  only those artifacts.

**`seed-corpus/seed-manifest.json`** (v2.0.0) plays the same role for the 40 bundled documents:
per-file SHA-256 + size + domain/tier. `python3 -m needfire verify --seed` checks it; regenerate after
editing seed docs with `make seed-manifest` (`scripts/update-seed-manifest.py`).

---

## 5. The index & RAG pipeline (build time → query time)

Everything searchable lives in **one SQLite file**, `$NEEDFIRE_HOME/index/chunks.sqlite`
(schema in `needfire/db.py`, `schema_version = 2`):

| Table | Contents |
|-------|----------|
| `docs` | full document text (what the reader view renders) |
| `chunks` | paragraph-packed retrieval chunks (~750 words ≈ 1,000 tokens) with doc/tier/domain/license metadata |
| `vectors` | one float32 BLOB per chunk — brute-force cosine search, no vector library |
| `chunks_fts` | FTS5 full-text index over chunks (created when SQLite has FTS5 — the common case) |
| `meta` | `embed_backend` (hash/ollama), `embed_dims`, `schema_version` |

**Build time** — `python3 -m needfire index` (run automatically on first `serve`):

```
seed-corpus/*.md  +  $NEEDFIRE_HOME/docs/**  +  $NEEDFIRE_HOME/zim/** (if libzim installed)
   ──► extract & normalize text (front-matter → title/domain/tier/license)
   ──► store the whole document (docs table)
   ──► pack whole paragraphs into ~750-word chunks; the last paragraph of each
        chunk carries into the next so context isn't cut mid-thought
   ──► embed each chunk (Ollama if reachable, else stdlib hashing) ──► vectors
   ──► mirror chunk text into chunks_fts
   ──► stamp meta: embed_backend, embed_dims, schema_version
```

**Query time** — `/api/ask` (SSE) or `python3 -m needfire ask`:

```
question ──► router classifies (MEDICAL / NAV / TECHNICAL / GENERAL) and emits a
             domain hint ──► retrieve top-k (k = NEEDFIRE_TOP_K, default 6)
   ──► the hint is a SOFT BOOST: chunks in the hinted domain get +0.10 added to
        their similarity score (config.DOMAIN_BOOST, env NEEDFIRE_DOMAIN_BOOST).
        It is NEVER a filter — a wrong hint can't hide documents.
   ──► assemble grounded prompt: SYSTEM_RULES + retrieved chunks + question
   ──► model streams the answer, citing chunk numbers [n]
   ──► each citation resolves to the FULL document via /api/source (built-in reader)
```

**Fallbacks (fail-down, per architecture):**
1. No vectors, or stored vectors don't match the current embedder → **FTS5 keyword search**.
2. No FTS5 in the local SQLite build → **LIKE scan** scored by term hits.
3. No model reachable → **sources-only**: ranked snippets + links to full documents, no synthesis.
4. Everything down → the **printed corpus index** tells the operator which drive/folder to read.

---

## 6. Versioning, integrity & redundancy

- **Snapshots:** corpus downloads are dated in the manifest (`added`); ZIM filenames carry their dump
  date. Keep the previous snapshot until the new one is verified.
- **Signing:** GPG-sign `manifest.json` after major corpus changes; `verify-integrity.sh` treats a
  bad signature as fatal.
- **3-2-1 redundancy:** ≥3 copies, on ≥2 media types, with ≥1 offline. For Needfire, the offline copy is
  the **Faraday-stored cold clone**.
- **Re-verification schedule:** power up cold/spare drives periodically and run
  `scripts/verify-integrity.sh` to catch silent bit-rot **before** you depend on the data. Unpowered
  SSDs especially can drift over long timescales — don't trust a drive you haven't checked.
- **Cloning a backup:** `rsync` the `$NEEDFIRE_HOME` tree + manifest to a spare drive, then run the
  verifier on the clone (`bash scripts/verify-integrity.sh --home /mnt/backup/needfire`). A backup you
  haven't verified is a hope, not a backup.
- **Index rebuilds:** the index is derived data — never back it up *instead of* the corpus. After any
  corpus change (or embedder change), re-run `python3 -m needfire index`. The server warns at startup if
  the on-disk index was built by an older schema version.

---

## 7. Sizing budget (rough, plan accordingly)

| Tier | Typical content | Approx. size |
|------|-----------------|--------------|
| C1 survival-critical | medical, water, food, repair, maps (regional) | 20–80 GB |
| C2 reference | full Wikipedia w/ images (~100 GB), Gutenberg, Stack Exchange | 200–600 GB |
| C3 rebuild stack | chemistry/physics/pharma/metallurgy/electronics textbooks + Survivor Library + appropriate-tech | 1–4 TB |
| C4 cultural | education, literature, language, media | 0.5–3 TB+ (scales with media) |
| Models + index | Ollama model store + `chunks.sqlite` | 10–60 GB |

- **Personal** ships **C1 + curated C2/C3** → ~1–2 TB on a single SSD.
- **Homestead** holds the **full C1–C4** → ~6–12 TB across hot+cold.
- **Community** replicates the full archive with redundancy → 24 TB+.

The rebuild stack (C3) plus full Wikipedia is what pushes this into multi-TB territory — which is exactly
why storage is tiered and why Homestead/Community carry far more than Personal.

Next: [`04-AI-MODEL-STACK.md`](04-AI-MODEL-STACK.md).
