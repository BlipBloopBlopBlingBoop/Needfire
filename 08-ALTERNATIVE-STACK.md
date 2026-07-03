# 08 — Alternative Stack (Advanced Appendix)

> ## ⚠️ This is NOT the shipped appliance
> Needfire you install with `os/install.sh` and run with `python3 -m needfire` is the **pure-stdlib stack**
> documented in [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md)–[`07-CORPUS-ACQUISITION.md`](07-CORPUS-ACQUISITION.md).
> It depends on none of what follows. This appendix preserves an earlier, heavier reference design —
> `kiwix-serve` + llama.cpp/GGUF + FAISS — as a **design sketch** for operators who want more and are
> willing to maintain it themselves.

---

## 1. What this stack adds (and what it costs)

| You gain | You pay |
|----------|---------|
| **Pixel-perfect ZIM browsing** — kiwix-serve renders Wikipedia/iFixit articles with their original layout, images, and built-in full-text search | another always-on service + port to run, patch, and document |
| **llama.cpp serving of raw GGUF files** — finer quantization control, exotic models Ollama doesn't package, no model-store abstraction | manual model file management; you become the packager |
| **FAISS + sentence-transformers retrieval** — ANN speed at millions-of-chunks scale, stronger embedding models | a pip/venv dependency tree (numpy, torch…) that must survive offline for decades |
| **whisper.cpp / Piper voice** — the STT/TTS the shipped app deliberately leaves as future work ([`04-AI-MODEL-STACK.md`](04-AI-MODEL-STACK.md) §7) | audio hardware, more services, more power |

The shipped stack chose the other side of every one of those trades on purpose: one dependency
(`python3`), one service, one index file. Read [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md) §5 before
deciding you need this.

---

## 2. The components

```
┌───────────────────────────────────────────────────────────────┐
│  Browser / phone on Needfire's Wi-Fi AP                         │
│     :8848  Needfire (shipped app — unchanged, still the front)  │
│     :8080  kiwix-serve (full ZIM browsing, own search UI)      │
├───────────────────────────────────────────────────────────────┤
│  kiwix-serve --port 8080 --library library.xml                 │
│     serves every ZIM in NEEDFIRE_HOME/zim/ with original rendering  │
├───────────────────────────────────────────────────────────────┤
│  llama.cpp server (OpenAI-compatible HTTP, GGUF files on disk) │
│     replaces Ollama; same roles: tiny / reasoner / embedder    │
├───────────────────────────────────────────────────────────────┤
│  FAISS index + sentence-transformers embedder (Python venv)    │
│     replaces the SQLite brute-force vectors at large scale     │
│     (middle option: sqlite-vec, successor to the deprecated    │
│      sqlite-vss — ANN speed while keeping the single-file DB)  │
└───────────────────────────────────────────────────────────────┘
```

- **kiwix-serve** — `apt install kiwix-tools`, build a library file over `NEEDFIRE_HOME/zim/**/*.zim`,
  run it as a systemd unit *you write* on port **8080**. Clients browse it directly alongside the
  Needfire UI.
- **llama.cpp** — compile from source (keep the source tarball on-disk per the bootstrap-toolchain
  principle), download GGUF quantizations yourself, run `llama-server` per model or with on-demand
  loading. Needfire can point at it **if** you expose an Ollama-compatible API in front of it; the
  shipped client (`needfire/models.py`) speaks Ollama's API, not raw llama.cpp — that adapter is yours
  to build or find.
- **FAISS / sentence-transformers** — a separate indexing pipeline you own: extract → chunk →
  embed → `vectors.faiss` + a chunk DB. Nothing in `needfire/` reads a FAISS index.

---

## 3. Integration points with the shipped app

These are the places where the two stacks genuinely meet — everything else is parallel operation:

1. **ZIM text indexing (supported today).** If the `libzim` Python package is installed,
   `python3 -m needfire index` extracts article text straight out of `NEEDFIRE_HOME/zim/**` into the normal
   SQLite index. You get Needfire-side search + cited answers over ZIM content with zero extra services —
   kiwix-serve is only needed for *browsing* the originals with full fidelity.
2. **Side-by-side serving.** kiwix-serve on :8080 and Needfire on :8848 don't conflict. A reasonable
   pattern: use Needfire for question-answering with citations, and open kiwix-serve when you want to
   *read around* a topic in rendered Wikipedia. Bookmark both on client devices.
3. **Same corpus, same manifest.** Point kiwix-serve at the ZIMs Needfire already downloaded and
   verified — one copy of the data, one `manifest.json`, one verification schedule.
4. **Model runtime swap.** Everything model-facing in the app goes through `NEEDFIRE_OLLAMA_URL`. Any
   server that faithfully implements Ollama's `/api/tags`, `/api/generate` (streaming), and
   embeddings endpoints can stand in.

---

## 4. Honest caveats

- **You maintain it.** None of this is installed by `os/install.sh`, exercised by `tests/`, or
  covered by the runbook's validation steps. When a distro upgrade breaks hostapd *and* your
  llama.cpp build the same week, both are your problem.
- **The dependency tree is the risk.** FAISS + torch + sentence-transformers is hundreds of MB of
  wheels that must be mirrored offline and kept compatible with the Python you'll have in ten years.
  The shipped stack exists precisely because that's a hard promise to keep.
- **Fail-down still rules.** If you adopt this stack, preserve the property that every layer works
  when the one above it dies: kiwix-serve down must not take out Needfire; FAISS gone must fall back
  to the SQLite index; models gone must still return sources.
- **Document your deviation** in your printed paper layer (runbook §10) — a future operator must be
  able to discover that :8080 exists and how to restart it.

Back to [`README.md`](README.md) · Shipped architecture in [`01-ARCHITECTURE.md`](01-ARCHITECTURE.md).
