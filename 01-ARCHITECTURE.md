# 01 — System Architecture

This document describes how Needfire is put together as a system: the layers, how data and queries
flow through it, the three build tiers, and the shared software stack. The stack described here is
the **shipped application** in [`needfire/`](needfire/) — one pure-stdlib Python program (`python3 -m needfire`)
serving the web UI and JSON API on port **8848** (`NEEDFIRE_PORT`).

---

## 1. Layered architecture

Needfire is a stack of layers. Each layer depends only on the one below it, and **each layer keeps
working if the layers above it fail.** That "fail-down" property is the whole design.

```
┌─────────────────────────────────────────────────────────────────────┐
│ L6  INTERFACE                                                        │
│     • Card-based web app (PWA; browser on any device via Wi-Fi AP)   │
│     • CLI (`python3 -m needfire ask "…"`)                                 │
│     • Printed paper quick-start & index (works with zero power)      │
├─────────────────────────────────────────────────────────────────────┤
│ L5  REASONING / ROUTER  (needfire/router.py)                              │
│     • Classify intent (MEDICAL/NAV/TECHNICAL/GENERAL), pick model,   │
│       respect power state; domain hint = soft retrieval boost        │
│     • Models answer ONLY from retrieved sources, with citations      │
├─────────────────────────────────────────────────────────────────────┤
│ L4  AI MODELS (OPTIONAL — Ollama at NEEDFIRE_OLLAMA_URL)                  │
│     • Tiny always-on LLM (~1B)  • On-demand reasoning LLM (~4–12B)   │
│     • Embeddings model (semantic vectors)                            │
│     • Absent/down → "sources-only" answers + hash embeddings         │
├─────────────────────────────────────────────────────────────────────┤
│ L3  RETRIEVAL (RAG)  (needfire/rag.py, needfire/db.py)                         │
│     • SQLite index (NEEDFIRE_HOME/index/chunks.sqlite): float32 vectors,  │
│       brute-force cosine  →  FTS5 keyword  →  LIKE scan (fail-down)  │
│     • Citation resolver → full source document via /api/source       │
├─────────────────────────────────────────────────────────────────────┤
│ L2  KNOWLEDGE CORPUS (read-mostly data in NEEDFIRE_HOME)                  │
│     • Bundled seed library (53 CC0 docs, works out of the box)       │
│     • Downloaded ZIMs + plain-text/markdown docs + offline map files │
│     • manifest.json (SHA-256, license, tier per artifact)            │
├─────────────────────────────────────────────────────────────────────┤
│ L1  OS & SERVICES (hardened Debian/Ubuntu LTS)                       │
│     • Full-disk encryption (LUKS)  • needfire.service (the app, systemd)  │
│     • needfire-ap.service (hostapd Wi-Fi AP; dnsmasq for DHCP/DNS)        │
│     • Airplane-mode nftables firewall (no outbound by default)       │
├─────────────────────────────────────────────────────────────────────┤
│ L0  HARDWARE (hardened off-the-shelf)                                │
│     • Compute (mini-PC/SBC/cluster) • Storage (SSD hot + HDD cold)   │
│     • Power (LiFePO₄ + solar + MPPT) • Faraday enclosure • Wi-Fi     │
└─────────────────────────────────────────────────────────────────────┘
```

**Fail-down example:** the reasoning model won't run on a low battery → router picks the tiny model
→ if Ollama is down entirely, the app returns the top retrieved sources with no synthesis
("sources-only" mode) → if the vector index is unusable (e.g. embedder mismatch), it degrades to
FTS5 keyword search, then to a LIKE scan → if the whole computer is dead, the **printed index**
(runbook §10) tells the operator which physical drive and folder holds "water purification."

---

## 2. Query flow (what happens when you ask a question)

```
  "How do I treat a deep wound with limited supplies?"
        │
        ▼
   [L5 Router] ── classify: MEDICAL / survival-critical ──► force-cite = ON
        │            domain hint "medicine" = soft boost (+0.10 to matching
        │            chunks' scores — never a filter; see 03 §5)
        ▼
   [L3 Retrieval] ── embed query ──► cosine top-k over stored vectors
        │           ◄── chunks + source IDs (seed docs, WikiMed, …)
        │           (no vectors / mismatch → FTS5 keyword → LIKE)
        ▼
   [L4 Model] ── prompt = SYSTEM_RULES + retrieved chunks + question
        │      ── "Answer ONLY from the sources. Cite each claim as [n].
        │          If unsupported, say 'Not in the available sources.'"
        ▼
   [L6 Interface] ── /api/ask streams SSE events: meta (sources) → answer
                     tokens → done. Each citation opens the FULL source
                     document in the built-in reader (/api/source).
```

Survival-critical categories (medical, pharma, chemistry, physics, electronics) **always** surface
the underlying source and never present model prose alone. With no model available the answer step
is skipped and the UI shows ranked sources ("sources-only" mode) — clearly labeled as such.

---

## 3. The three tiers

One architecture, three physical sizes. Same software, same data format, same interface — different
compute, storage, and power envelopes.

| Dimension | Personal | Homestead *(reference)* | Community |
|-----------|----------|--------------------------|-----------|
| **Primary use** | one person on the move | one household, fixed base | a group / settlement |
| **Compute** | x86 mini-PC (32 GB) or ARM SBC (16 GB) | x86 mini-PC/SFF, 64 GB RAM, optional 16 GB-class GPU | 2–3 mini-PC nodes + 1 GPU node, gigabit switch |
| **Always-on model** | ~1B CPU | ~1B CPU | ~1B CPU on a low-power node |
| **Reasoning model** | 4–8B on demand (slow) | 8–14B (GPU-accelerated if fitted) | 14–34B on the GPU node |
| **Corpus** | curated subset (~1–2 TB) | full archive (6–12 TB) | full archive replicated (24 TB+) |
| **Storage** | 2–4 TB NVMe SSD | NVMe hot (2 TB) + HDD/SSD cold (8–16 TB) | NVMe per node + redundant HDD array |
| **Power** | USB-C PD power bank + 100 W foldable solar | LiFePO₄ 1–2 kWh + 400–800 W solar + MPPT | LiFePO₄ 5 kWh+ + 1–2 kW array |
| **Network** | none, or phone over hotspot | local Wi-Fi AP (WPA3) for a few devices | Wi-Fi mesh for dozens of clients |
| **Enclosure** | rugged Pelican-style case | ammo-can / rugged box, Faraday-lined | rackable rugged cases, distributed |
| **Redundancy** | 1 cold backup drive | mirror + Faraday cold spare | node + drive redundancy, replicated corpus |

**Growth path:** a Personal build upgrades into a Homestead by adding cold storage, a bigger model,
and a solar/battery bank — the application, index format, and corpus layout don't change.

---

## 4. Software stack (identical across tiers)

| Concern | Choice | Why |
|---------|--------|-----|
| OS | Debian stable or Ubuntu LTS (x86); Debian/Armbian (ARM) | long support, huge offline package mirror availability, runs anywhere |
| Disk encryption | LUKS full-disk | standard, auditable, recoverable |
| Application | **`python3 -m needfire`** — pure Python stdlib, no pip | one dependency (python3); auditable; rebuildable from source anywhere |
| Web server / API | stdlib `http.server` + SSE streaming (`needfire/server.py`) | no framework to install, patch, or lose |
| Web UI | vanilla JS card SPA + PWA service worker (`web/`) | works on any phone/laptop browser over the AP; no build step |
| Index & search | **SQLite** (`chunks.sqlite`): docs, chunks, float32 vector BLOBs, FTS5 | single file, no server to babysit, copies to a backup drive intact |
| Vector search | brute-force cosine in Python (fine at survival-corpus scale) | zero dependencies; `sqlite-vec` (successor to the deprecated sqlite-vss) is an option if you grow to millions of chunks |
| Model serving | **Ollama** (optional, `NEEDFIRE_OLLAMA_URL`) | CPU-first, GPU-optional; the app degrades cleanly without it |
| Embeddings | Ollama embed model, or stdlib hashing fallback | semantic search when available, keyword-class search always |
| ZIM content | indexed directly if `libzim` is installed | full-text search over Wikipedia-class archives without extra servers |
| Maps | OSM extracts stored as **files**, served to client apps (e.g. Organic Maps on a phone) | Needfire does **not** render map tiles — it preserves and serves the data |
| Orchestration | `systemd`: `needfire.service` (+ optional `needfire-ap.service`) via `os/install.sh` | boots into a working state unattended |
| Sync/backup | `rsync` + `manifest.json` (SHA-256, optional GPG signature) | clone to spare drives, verify integrity |

Everything is open-source and offline-installable. A **bootstrap toolchain** (gcc/clang, Python) is
kept on-disk so the software stack itself can be rebuilt from source if binaries are lost — see
[`03-DATA-ARCHITECTURE.md`](03-DATA-ARCHITECTURE.md) §"Math & computing".

> Operators who want full-Wikipedia browsing via `kiwix-serve`, llama.cpp/GGUF serving, or a FAISS
> index can run those **alongside** Needfire — see the clearly-labeled design sketch in
> [`08-ALTERNATIVE-STACK.md`](08-ALTERNATIVE-STACK.md). The shipped appliance depends on none of it.

---

## 5. Why these choices

- **Pure stdlib application** — the single most fragile thing in a long-lived offline system is its
  dependency tree. Needfire's is exactly one item: `python3`. Anything Debian can boot can run it.
- **SQLite as the whole index** — chunk text, full documents, vectors, and FTS live in one file that
  `rsync` can clone and a hash can verify. No database server, no index format migrations.
- **Ollama as an optional accelerator, never a requirement** — models improve the answers; their
  absence must not break the system. Every code path has a modelless fallback.
- **RAG over fine-tuning** — knowledge lives in *data you can read and verify*, not baked into opaque
  weights. You can add, audit, and correct sources without retraining anything.
- **systemd + `os/install.sh`** — the box boots into a serving state with no operator interaction,
  which matters when the operator is stressed, injured, or absent.

Next: [`02-HARDWARE-INVENTORY.md`](02-HARDWARE-INVENTORY.md).
