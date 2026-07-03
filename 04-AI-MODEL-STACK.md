# 04 — AI Model Stack

Needfire uses **a few small models, each doing one job**, served by a local **Ollama** instance
(`NEEDFIRE_OLLAMA_URL`, default `http://127.0.0.1:11434`). Small + specialized + quantized beats one big
model you can't power.

> **Models are optional.** The shipped application runs with **no model at all**: retrieval still
> works (hash embeddings + keyword search) and answers degrade to "sources-only" — ranked source
> snippets with links to the full documents. Ollama upgrades the experience; it never gates it.

> **The cardinal rule:** the models do not *contain* the knowledge — the **corpus** does. Models
> retrieve, explain, translate, and cross-reference. Every factual answer is grounded in retrieved
> source text and **cited**. See [`03-DATA-ARCHITECTURE.md`](03-DATA-ARCHITECTURE.md) §5.

---

## 1. The model roster (three roles, name-agnostic)

The architecture defines **capabilities**, not model names. Any Ollama-served instruct model slots
into each role via an environment variable:

| Role | Env var | Shipped default | Size class | Job |
|------|---------|-----------------|-----------|-----|
| **Tiny (always-on)** | `NEEDFIRE_TINY_MODEL` | `llama3.2:1b` | ~1B | instant answers when power is low or the question is simple; cheap enough to stay resident |
| **Reasoner (on-demand)** | `NEEDFIRE_REASON_MODEL` | `llama3.1:8b` | ~4–12B (up to ~34B on a Community GPU) | cited synthesis for medical/technical questions; deeper multi-step explanation, teaching |
| **Embedder** | `NEEDFIRE_EMBED_MODEL` | `nomic-embed-text` | small | turn corpus chunks + queries into semantic vectors for retrieval |

Newer alternatives worth considering at build time (all real Ollama tags; RAM figures are
approximate working footprints for the default quantization, before context):

| Model tag | Class | ~RAM to run | Notes |
|-----------|-------|-------------|-------|
| `qwen3:4b` | reasoner (light) | ~4–6 GB | strong small reasoner; good Personal-tier default |
| `qwen3:8b` | reasoner | ~7–10 GB | solid Homestead reasoner on CPU or modest GPU |
| `gemma3:4b` | reasoner (light) | ~4–6 GB | multimodal-capable family, efficient |
| `gemma3:12b` | reasoner (heavy) | ~10–14 GB | Homestead-with-GPU / Community class |

Swap by pulling the model and setting the env var (e.g. in `/etc/needfire/needfire.env` on the appliance):

```bash
ollama pull qwen3:4b
echo 'NEEDFIRE_REASON_MODEL=qwen3:4b' | sudo tee -a /etc/needfire/needfire.env
sudo systemctl restart needfire
```

Changing the **embedder** additionally requires an index rebuild — see §8.

> Model names drift fast — pick current, well-supported **open-weight** models in each size class at
> build time. The roles and the routing are name-agnostic on purpose.

There is **no separate medical model** in the shipped stack: medical questions get the reasoner plus
a retrieval boost toward medical sources and a mandatory read-the-source banner (see §5–6). A
medically-tuned open model can be dropped into `NEEDFIRE_REASON_MODEL` if you prefer one.

---

## 2. Why multiple small models instead of one big one

- **Power:** a ~1B model answers most lookups at a few watts; you only wake the big model when needed.
- **Latency:** the tiny model responds instantly for simple Q&A and low-power operation.
- **Resilience:** if a model is missing or corrupt, the others still work — and if *all* models are
  gone, the app still answers in sources-only mode (fail-down).
- **Specialization by retrieval:** domain-boosted retrieval over the medical corpus beats a
  generalist prompt for the highest-stakes questions.
- **Hardware fit:** the same Ollama models run CPU-only on Personal and GPU-accelerated on Community —
  one configuration, three performance envelopes.

---

## 3. Quantization & what fits

Quantization shrinks models to run in less RAM/VRAM at a small quality cost. **Q4_K_M-class
quantization (Ollama's default for most tags) is the standard sweet spot.** Approximate footprints
(RAM/VRAM to load, before context):

| Model size | ~Q4 size on disk | ~RAM/VRAM to run | Realistic placement |
|-----------|------------------|-------------------|---------------------|
| 1–3B | 0.8–2 GB | 2–4 GB | Personal always-on (CPU) |
| 7–8B | 4–5 GB | 6–8 GB | Homestead reasoning (CPU ok, GPU better) |
| 13–14B | 8–9 GB | 10–12 GB | Homestead w/ GPU, or patient CPU |
| 30–34B | 18–20 GB | 22–26 GB | Community GPU node (24 GB-class card) |

**Throughput, order-of-magnitude** (varies wildly with hardware):
- 1–3B on a modern CPU: **fast** (tens of tokens/s) — feels interactive.
- 7–14B on CPU: **slow** (a few tokens/s) — usable for considered answers, not chat.
- 7–34B on a GPU: **fast** — interactive even at the larger sizes.

This is why Personal leans on the tiny model + search, and why a used GPU is the single biggest
quality-of-life upgrade for Homestead/Community.

---

## 4. Serving stack

```
            ┌────────────────────────────────────────────┐
            │  web UI / python3 -m needfire ask   (L5/L6)      │
            └───────────────┬────────────────────────────┘
                            │ needfire/models.py, needfire/embed.py
                            │ HTTP (localhost)
                            ▼
                     Ollama  (NEEDFIRE_OLLAMA_URL)
                     ├─ NEEDFIRE_TINY_MODEL    (kept warm)
                     ├─ NEEDFIRE_REASON_MODEL  (loaded on demand)
                     └─ NEEDFIRE_EMBED_MODEL   (embeddings API)
                            │
                            ▼
                 model files in Ollama's local store
```

- **Ollama** exposes a local HTTP API; `needfire/models.py` streams generations from it and probes
  availability (cached ~5 s so a down Ollama can't stall the UI). Nothing leaves the machine.
- **On-demand loading:** Ollama keeps recently-used models resident and unloads after idle
  (keep-alive), so the reasoner only costs RAM and watts while it's actually answering.
- **Context window:** budget context for the retrieved chunks + question + answer. 4–8k context is
  plenty for RAG (you're feeding a handful of chunks, not whole books).
- **No Ollama at all?** `models.available()` returns false, the router returns no model, and the
  server answers in sources-only mode. Embeddings fall back to the stdlib hashing embedder.

---

## 5. The router (query → the right model + sources)

Implemented in `needfire/router.py` (used by both the server and the CLI). Simplified:

```
def classify(question):
    # returns (category, force_cite, domain_hint)
    # category ∈ MEDICAL / NAV / TECHNICAL / GENERAL
    # force_cite = True for medical/critical keyword hits
    # domain_hint = "medicine" / "electronics" / "physics" / … or None

def pick_model(category, force_cite, power_state, model_available):
    if not model_available:      return None            # → sources-only
    if wants_depth and power_state != "low":
        return NEEDFIRE_REASON_MODEL
    return NEEDFIRE_TINY_MODEL

chunks, how = rag.retrieve(conn, question, domain=domain_hint)
prompt = build_prompt(question, chunks, force_cite)     # SYSTEM_RULES + sources
```

**The domain hint is a soft boost, never a filter.** Retrieval adds `config.DOMAIN_BOOST`
(default **0.10**, env `NEEDFIRE_DOMAIN_BOOST`) to the similarity score of chunks whose domain matches
the hint. A wrong or missing hint can therefore never zero out recall — ambiguous words like bare
"shock" (electric? hypovolemic?) deliberately get no hint at all.

The `power_state` comes from the client (`/api/ask?...&power=low`) so a battery-aware UI can keep
the box on the tiny model when the sun isn't shining.

`SYSTEM_RULES` (the system prompt, verbatim intent) enforces grounding:

> "You are Needfire, an offline survival reference assistant. Answer **only** using the numbered
> SOURCES provided. Cite every claim as [n] matching a source. If the sources do not contain the
> answer, say exactly *'Not in the available sources.'* and stop — do **not** use outside knowledge
> or guess. For medical, chemical, electrical, structural, or radiological questions, explicitly
> tell the user to read the cited source before acting. Be concise, practical, and direct."

---

## 6. Hallucination mitigation (non-negotiable)

A wrong answer about dosage, voltage, or a chemical reaction can kill someone. Mitigations, layered:

1. **RAG grounding** — the model only sees retrieved source text; it's instructed to answer solely from it.
2. **Mandatory citations** — every claim maps to a source `[n]`; unsourced prose is a red flag.
3. **Source-first for critical categories** — medical/pharma/chemistry/physics/electronics answers
   surface the **full original document** in the built-in reader (`/api/source`), not just the
   paraphrase. The model points; the human reads.
4. **"Not in sources" path** — the model is allowed and required to say it doesn't know.
5. **Show retrieval** — the UI's `meta` event lists exactly which documents were retrieved (and how:
   vector or keyword), so the operator can judge relevance.
6. **Labeled answer modes** — every answer ends with its mode (`model` vs `sources-only`), so the
   operator always knows whether an LLM was involved.

The model is a **librarian and a tutor, never the final authority.**

---

## 7. Voice & accessibility — **future work, NOT IMPLEMENTED**

The shipped application has **no speech interface**. Voice remains on the roadmap because it matters
for injured/hands-busy operators, and the pieces exist as mature offline projects:

- **Speech-to-text:** whisper.cpp (quantized Whisper) — would transcribe spoken questions.
- **Text-to-speech:** Piper — would read answers aloud for eyes-free or low-vision use.

Both run offline on CPU and could front the existing `/api/ask` endpoint, but **nothing in this repo
installs, configures, or depends on them today.** Plan power/storage budget for them only if you
intend to integrate them yourself (see also [`08-ALTERNATIVE-STACK.md`](08-ALTERNATIVE-STACK.md)).

---

## 8. Updating & swapping models

Because knowledge lives in the corpus, **you can swap models freely without losing anything.** To
adopt a newer/better open model: `ollama pull` it, set the env var (§1), restart the service. No
retraining, no data migration. The **only** thing that must stay consistent is the **embedding
backend** — if you change `NEEDFIRE_EMBED_MODEL` (or switch between hash and Ollama embeddings), you must
**rebuild the index** (`python3 -m needfire index`), because vectors from different embedders aren't
comparable. The index's `meta` table records `embed_backend` and `embed_dims`, and retrieval detects
a mismatch at query time and falls back to keyword search (with a warning) rather than returning
nonsense.

At survival-corpus scale the stdlib brute-force cosine scan is fast enough. If you grow the index to
millions of chunks, the natural upgrade is **sqlite-vec** (the successor to the deprecated
sqlite-vss) — same single-file SQLite philosophy, real ANN performance — or the FAISS route in
[`08-ALTERNATIVE-STACK.md`](08-ALTERNATIVE-STACK.md).

Next: [`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md).
