# Needfire — the running application

This folder is both the **design package** (architecture docs + BOM, see
[`README.md`](README.md)) and the **real, runnable software**. This file is the
entry point for actually running it.

> **Completely standalone.** The app is **pure Python standard library** and a
> **no-build vanilla web UI**. The only hard requirement is `python3` (3.8+).
> No pip, no Node, no internet — except the optional corpus download.

## Run it in 30 seconds

```bash
cd Needfire
python3 -m needfire serve      # first run auto-builds the seed index, then serves
# open http://localhost:8848
```

Or with Docker:

```bash
docker compose up         # then open http://localhost:8848
```

That's it — it works fully offline using the bundled **40-document seed
library** and a stdlib hashing retriever. No AI model required (it answers in
"sources-only" mode and shows you the cited documents).

## The field console

The web UI is built for the situations the Bothy is actually used in:

- **EMERGENCY** — one tap (or the `E` key) from anywhere: 12 guided protocols
  (CPR, bleeding, choking, burns, anaphylaxis, poisoning, snakebite, seizure,
  drowning, heat, cold, childbirth) with huge step-through buttons, decision
  branches, a WebAudio **CPR metronome**, countdowns (20-min burn cooling),
  and **persistent time stamps** (tourniquet time survives reloads and shows
  as a badge on every screen). Protocol data is service-worker precached, so
  emergency mode works even if the index or server hiccups. Every protocol
  links its full source document.
- **TOOLKIT** — pure-offline field tools: water-disinfection calculator, ORS
  mixer, solar/battery sizer, Ohm's-law + wire-gauge helper, field timers,
  an SOS screen strobe, and a signal reference card.
- **LIBRARY** — search, ask (cited answers), browse by category, and a clean
  document reader with **pin-to-kit** (pinned docs appear on the home screen).
- **SYSTEM** — a hub for running the box: the old **Status** page plus
  **AI Models** (install/manage local models via Ollama from the UI — see
  below), **Content** (paste the real URL for a catalog source, add any
  download URL for a ZIM/PDF/text, import a file already on the machine, then
  **Reindex** to make it searchable), **Studio**, and a "build an appliance
  image" how-to.
- **STUDIO** — a password-gated standalone-computer workspace: a web
  **Playground** (live HTML/CSS/JS preview), **Files & Editor** (edit files in
  a workspace folder, or the app's own `web/` UI), a **Terminal** (a
  line-streamed command runner, ~60 s/command, not a full TTY), and a **Python**
  scratchpad. The first time anyone opens Studio (or pulls a model / downloads
  content) they set an **owner password**; after that these powerful tools need
  it, while Library/Emergency/Toolkit stay open to everyone on the Wi-Fi.
  **Honest warning:** anyone with the password can run any code on the computer
  — that's intentional for a single-owner appliance. Pick a real password (at
  least 8 characters); the tools are only as private as your Wi-Fi and that
  password. See [SECURITY.md](SECURITY.md) for the full threat model.
- **Display modes** — dark (default), **NIGHT** (red-on-black, night-vision
  safe), and **DAY** (high-contrast for sunlight), plus 4 text sizes; both
  persist per device. Layouts adapt to phones over the Bothy's Wi-Fi AP
  (bottom thumb nav), the built-in 800×480 touchscreen (kiosk grid, 56 px
  targets), and desktops (keyboard: `/` search, `E` emergency, `1–9` open
  sources).
- **Instrument strip** — live link LED, Bothy battery, corpus size, and clock
  on every screen.

Runtime data (index, downloads, manifest) lives in `NEEDFIRE_HOME`:
`<repo>/.needfire-home` for a dev checkout, `/data` in Docker, `/var/lib/needfire` on an
installed appliance.

## Make it smarter (optional local AI)

The easiest path is **System → AI Models** in the UI: it shows per-OS download
links if Ollama isn't installed yet, then gives one-click **Install** buttons
(with a live progress bar) for curated small models and lets you delete models
and choose which fills the tiny/reason/embed role. Or do it from the shell —
install [Ollama](https://ollama.com) and pull small models; Needfire auto-detects
it and switches from "sources-only" to synthesized, cited answers plus semantic
embeddings:

```bash
ollama pull llama3.2:1b        # tiny always-on model (NEEDFIRE_TINY_MODEL)
ollama pull llama3.1:8b        # on-demand reasoning model (NEEDFIRE_REASON_MODEL)
ollama pull nomic-embed-text   # semantic embeddings (NEEDFIRE_EMBED_MODEL)
python3 -m needfire index           # rebuild the index with semantic vectors
```

Point the app at Ollama with `NEEDFIRE_OLLAMA_URL` (default `http://127.0.0.1:11434`).
Newer model alternatives and RAM sizing live in
[`04-AI-MODEL-STACK.md`](04-AI-MODEL-STACK.md).

## Load the real knowledge corpus

The bundled seed library is a small starter set. Download the full openly-licensed
corpus (Wikipedia, WikiMed, iFixit, Stack Exchange, textbooks, …) from the
**Corpus** tab in the UI, or:

```bash
python3 -m needfire download --tier C1     # survival-critical first
python3 -m needfire index                  # re-index after downloading
python3 -m needfire verify                 # check SHA-256 integrity vs the manifest
python3 -m needfire verify --seed          # check the bundled seed docs too
```

(`scripts/download-corpus.sh` and `scripts/verify-integrity.sh` are thin shell
wrappers around the same commands, for cron jobs and shell workflows.)

See [`07-CORPUS-ACQUISITION.md`](07-CORPUS-ACQUISITION.md) for sources, sizes, and
licensing. ZIM files become searchable when the optional `libzim` package is
present; the seed `.md` library always works with zero dependencies.

## Turn a machine into the appliance ("the OS")

```bash
sudo bash os/install.sh --ap        # provision Debian/Ubuntu: service + Wi-Fi AP + firewall
```

This installs Needfire to `/opt/needfire`, puts runtime data in `/var/lib/needfire`, writes
`/etc/needfire/needfire.env`, runs the server as a hardened systemd service (`needfire.service`),
optionally sets up a local Wi-Fi access point (`needfire-ap.service`, so phones/laptops
can reach it), and applies an airplane-mode firewall (no outbound internet by
default). Works on x86 mini-PCs and Raspberry Pi. To bake a flashable
burn-and-boot image, see [`os/image/README.md`](os/image/README.md).

## CLI reference

| Command | What it does |
|---------|--------------|
| `python3 -m needfire serve` | Run the web server + API (default; auto-builds the seed index on first run) |
| `python3 -m needfire index` | Build the search index (seed + `NEEDFIRE_HOME` content) |
| `python3 -m needfire ask "…"` | Ask a question from the terminal |
| `python3 -m needfire download --tier C1` | Download corpus sources (also `--id <source>`) |
| `python3 -m needfire verify` | Verify downloaded corpus integrity (SHA-256 vs `NEEDFIRE_HOME/manifest.json`) |
| `python3 -m needfire verify --seed` | Verify the bundled seed docs vs `seed-corpus/seed-manifest.json` |
| `python3 -m needfire status` | Print system + corpus status as JSON |

Useful env vars: `NEEDFIRE_HOME` (data dir), `NEEDFIRE_PORT` (default 8848), `NEEDFIRE_HOST`,
`NEEDFIRE_OLLAMA_URL`, `NEEDFIRE_TINY_MODEL`, `NEEDFIRE_REASON_MODEL`, `NEEDFIRE_EMBED_MODEL`,
`NEEDFIRE_DOMAIN_BOOST`. `make help` lists convenience targets (`make serve`,
`make ask Q='…'`, `make test`, `make seed-manifest`, `make icons`, …).

## Architecture

| Layer | Tech | File(s) |
|-------|------|---------|
| Web UI (cards, PWA) | vanilla JS + CSS, service worker, no build | `web/` |
| HTTP API + SSE | `http.server` (stdlib) | `needfire/server.py` |
| Query router | classify, pick model, grounded prompt | `needfire/router.py` |
| Retrieval (RAG) | vector → FTS5 → LIKE fail-down | `needfire/rag.py`, `needfire/db.py` |
| Embeddings | Ollama or stdlib hashing | `needfire/embed.py` |
| Models | Ollama client, degrades cleanly | `needfire/models.py` |
| Indexing | extract, chunk, embed | `needfire/index.py` |
| Corpus | catalog, download, verify | `needfire/corpus.py` |
| Power/status | `/proc`, `/sys` (stdlib) | `needfire/power.py` |

The deep design rationale lives in [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md)
through [`07-CORPUS-ACQUISITION.md`](07-CORPUS-ACQUISITION.md).

## Tests

```bash
python3 -m unittest discover -s tests -v
```

Pure stdlib, no network: embeddings, chunking, routing, retrieval (vector +
keyword), corpus catalog, and an in-process HTTP smoke test of every endpoint.
