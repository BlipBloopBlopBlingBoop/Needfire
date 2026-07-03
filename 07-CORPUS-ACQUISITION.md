# 07 — Corpus Acquisition

What to download, where it comes from, how big it is, what license it carries, and how to verify it.
This is the part that takes the longest and matters the most — do it **while you have internet.**

> **Licensing & legality:** most sources below are **openly licensed** (Creative Commons, GFDL,
> public domain) and safe to store, index, and share within a household or community. A few of the
> best references are **not** — they are marked below as *personal-use download* or *purchase*.
> Every downloaded artifact's license is recorded in `NEEDFIRE_HOME/manifest.json`; comply with your
> jurisdiction. This package does not circumvent anything. The download catalog
> ([`catalog/catalog.json`](catalog/catalog.json)) lists **openly-licensed** sources only.

> **Sizes are approximate and drift** — Wikipedia, textbook dumps, and ZIM bundles grow over time.
> Check the live Kiwix library for current filenames and sizes before allocating storage.

---

## 0. How downloading works in Needfire

- The **catalog** (`catalog/catalog.json`) lists each source: id, tier, license, destination, URL.
  ZIM filenames on the Kiwix mirrors change with each dump, so several URLs ship as
  `<PLACEHOLDER>` values — **edit them to the current filenames first**; placeholders are skipped
  with a notice, never guessed.
- Download from the **Corpus tab** in the web UI, or from the shell:
  ```
  python3 -m needfire download --tier C1          # or --id wikipedia-en-maxi
  bash scripts/download-corpus.sh --tier C1  # same thing, wrapper form
  ```
  Downloads are resumable and SHA-256-hashed into `NEEDFIRE_HOME/manifest.json` as they complete.
- After downloading, re-run `python3 -m needfire index`. ZIM contents are indexed **only if** the
  optional `libzim` Python package is installed; without it the ZIMs still sit safely on disk
  (and `.md`/`.txt` under `NEEDFIRE_HOME/docs/` always index). For browsing ZIMs with their original
  page rendering, see the kiwix-serve sketch in [`08-ALTERNATIVE-STACK.md`](08-ALTERNATIVE-STACK.md).

---

## 1. Backbone: Kiwix ZIM files — openly licensed ✓

[Kiwix](https://kiwix.org) is the offline-content standard. ZIM files are compressed, full-text
searchable bundles. This is the majority of the corpus, and all of it is openly licensed.

| Source (ZIM) | Content | Tier | ~Size | License |
|--------------|---------|------|-------|---------|
| Wikipedia (full, with images) | general human knowledge | C2 | ~100 GB | CC-BY-SA / GFDL |
| Wikipedia (mini / no-pic) | lighter Wikipedia for Personal | C2 | ~10–50 GB | CC-BY-SA / GFDL |
| Wiktionary | dictionary, etymology, translations | C2 | ~5–15 GB | CC-BY-SA |
| Wikibooks / Wikiversity | open textbooks & courses | C2/C3 | ~5–20 GB | CC-BY-SA |
| Wikisource | source documents, public-domain texts | C2/C4 | varies | mixed / PD |
| Project Gutenberg | ~75k public-domain books | C2/C4 | ~60–90 GB | Public domain |
| Stack Exchange (Chem/Physics/Electronics/etc.) | practical expert Q&A | C2/C3 | varies | CC-BY-SA |
| iFixit | repair guides for real devices | C1/C2 | ~1–3 GB | CC-BY-NC-SA |
| WikiMed Medical Encyclopedia | offline medical reference | C1 | ~1–2 GB | CC-BY-SA |
| MedlinePlus / medical ZIMs | consumer health, conditions, meds | C1 | varies | US-gov / open |
| Wikivoyage | travel, geography, local practical info | C2 | ~5 GB | CC-BY-SA |
| Kiwix "zimgit" collections (medicine, water, post-disaster) | curated practical bundles | C1 | varies | mixed open |

---

## 2. The "rebuild civilization" deep stack (C3)

The explicit goal: chemistry, pharma, nuclear physics, metallurgy, electronics — **the works.** These
come from open textbook projects, public-domain technical archives, and curated survival libraries.

| Domain | Recommended sources | ~Size |
|--------|---------------------|-------|
| **Chemistry** | LibreTexts Chemistry, OpenStax Chemistry, public-domain industrial-chemistry texts; Stack Exchange Chemistry | 10–40 GB |
| **Pharmaceuticals** | Pharmacology open textbooks, pharmacognosy/medicinal-plant references, open formularies; Hesperian field guides (see licensing note below) | 2–10 GB |
| **Nuclear & physics** | OpenStax/LibreTexts Physics (incl. modern/nuclear), public-domain nuclear-engineering & radiological-safety references | 5–20 GB |
| **Materials & manufacturing** | Public-domain metallurgy/machining/foundry texts (many in Gutenberg & the Survivor Library), welding & toolmaking guides | 5–20 GB |
| **Energy & electronics** | LibreTexts/OpenStax engineering, open electronics references, power-generation texts; ARRL handbooks (purchase — see below) | 5–20 GB |
| **Agriculture** | FAO open publications, agronomy & permaculture open texts, seed-saving & animal-husbandry guides | 5–20 GB |
| **Math & computing** | OpenStax/LibreTexts Math, open algorithms texts, toolchain sources (gcc/clang/python) + offline docs | 5–15 GB |
| **Survivor Library** | scanned public-domain practical/industrial knowledge (~pre-1964) — the deep "how things were actually made" archive | 50 GB–1 TB+ |
| **Appropriate-technology archives** | CD3WD-style development/village-tech collections | 10–50 GB |

> **On the Survivor Library & similar:** these aggregate **public-domain** older technical works
> precisely because that era documented how to do things **without** modern infrastructure — which is
> exactly what a rebuild needs. Verify each item's public-domain status as recorded in your manifest.

### 2b. The excellent-but-not-open references (know the difference)

| Reference | Status | How to acquire it legitimately |
|-----------|--------|--------------------------------|
| Hesperian's *Where There Is No Doctor* / *…No Dentist* | **Free to download, NOT openly licensed** — no redistribution; some titles CC-BY-NC-SA | Download for **personal use** from hesperian.org; do not mirror or bundle |
| ARRL handbooks (radio/antenna) | **Commercial / proprietary** | **Purchase** print or ebook copies |
| *Encyclopedia of Country Living* | **Commercial / proprietary** | **Purchase** print or ebook copies |

These are worth having — as *your own purchased/downloaded copies*, plus print. They are exactly why
the catalog can't include everything: the openly-licensed corpus is the redistributable backbone, and
you top it up personally.

---

## 3. Maps & geographic data

| Source | Content | Tier | Notes |
|--------|---------|------|-------|
| OpenStreetMap extracts (Geofabrik) | regional/global map data | C1 | ODbL license; store in `NEEDFIRE_HOME/maps/` |
| Wikivoyage (above) | practical place knowledge | C2 | pairs with maps |

Download **regional** maps for your area at high detail; global at lower detail. Maps are C1 — survival
navigation.

**How maps work in Needfire:** map downloads are **stored and served as files** for client apps —
e.g. load the extract into **Organic Maps** or a similar offline map app on a phone connected to the
Needfire's Wi-Fi. **Needfire does not render map tiles itself**; it preserves the data and hands it to
tools built for the job.

---

## 4. Download order (by criticality)

Always download so that **if your internet dies partway, you still have the most important knowledge.**
The tiers are ordered by criticality — download them in order:

```
1. C1  survival-critical   (medical, water, food, repair, regional maps)   ← first, ~tens of GB
2. C2  reference           (Wikipedia — even the mini ZIM, Gutenberg, Stack Exchange)
3. C3  rebuild stack       (chemistry, pharma, physics, metallurgy, …)
4. C4  cultural / morale   (education, literature, language, media)
```

`python3 -m needfire download` (and the `download-corpus.sh` wrapper) take repeatable `--tier` flags so
you can run C1 → C2 → C3 → C4 and resume safely at any point.

---

## 5. Integrity & verification

1. As it downloads, Needfire records each artifact's **SHA-256**, size, license, and tier in
   `NEEDFIRE_HOME/manifest.json`.
2. Optionally **sign** the manifest once the corpus is complete (detached GPG signature →
   `manifest.json.sig`). `scripts/verify-integrity.sh` checks the signature first and treats a
   failure as fatal.
3. Run `scripts/verify-integrity.sh` (wrapping `python3 -m needfire verify`) after the initial download,
   after any transport, and on the monthly schedule. It re-hashes every artifact and flags
   **missing, changed, or corrupt** files — catching bad transfers, tampering, and silent bit-rot
   **before** you depend on the data.
4. Verify the **bundled seed library** too: `python3 -m needfire verify --seed` checks all 40 documents
   against `seed-corpus/seed-manifest.json`.
5. Verify **every clone** the same way (`--home /mnt/backup/needfire`). A backup you haven't verified is
   not a backup.

---

## 6. Storage allocation (plan before downloading)

Cross-check against [`03-DATA-ARCHITECTURE.md`](03-DATA-ARCHITECTURE.md) §7:

| Tier | Hot (SSD) | Cold (HDD/SSD) | Total target |
|------|-----------|----------------|--------------|
| Personal | C1 + curated C2/C3 + models + index (~1–2 TB) | — | 2–4 TB |
| Homestead | C1 + hot C2 + models + index (~2 TB) | full C2–C4 (6–12 TB) | 8–16 TB |
| Community | per-node hot (~2 TB) | full archive, replicated (24 TB+) | 24 TB+ |

Leave **~15–20% free space** on every volume (filesystem health, index rebuilds, new snapshots).

---

## 7. Keeping it fresh (while you still can)

- Re-pull updated ZIMs periodically (Wikipedia and textbooks improve); keep the prior snapshot until the
  new one verifies. Update the catalog URLs as dump filenames change.
- After any corpus change, **rebuild the index** (`python3 -m needfire index`) and **re-verify**
  (re-sign the manifest if you sign it), then refresh your clones and the Faraday cold spare.
- Track what you have and what you're missing in the manifest — it's your inventory of human knowledge.

Back to [`README.md`](README.md) · Build steps in [`06-BUILD-RUNBOOK.md`](06-BUILD-RUNBOOK.md) ·
Advanced kiwix-serve/llama.cpp appendix in [`08-ALTERNATIVE-STACK.md`](08-ALTERNATIVE-STACK.md).
