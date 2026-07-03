"""Embeddings with graceful degradation.

Two backends:
  * "ollama"  — calls a local Ollama embeddings endpoint (real semantic vectors).
  * "hash"    — a deterministic bag-of-words hashing embedding using only the
                stdlib. No semantic understanding, but it makes vector search
                *work* with zero dependencies and zero models, which is the
                whole point of the standalone guarantee.

The active backend is recorded in the index meta so query time uses the same one
that built the index (mixing embedders produces nonsense — see 04-AI-MODEL-STACK.md).
"""
import hashlib
import json
import math
import re
import urllib.request

from . import config

_WORD = re.compile(r"[a-z0-9]+")

# Function words carry no topical signal but dominate bag-of-words vectors,
# drowning out rare, high-value terms ("snakebite", "voltage"). Skip them.
STOPWORDS = frozenset("""
a an the and or but if then else for nor so yet of to in on at by from with
without about as into onto over under is are was were be been being am do does
did doing have has had having i you he she it we they them his her its their
our your my me him us this that these those there here when where why how what
which who whom can could should would will shall may might must not no dont
doesnt didnt wont up down out off again further once than too very just also
only own same such some any each few more most other
""".split())


def _normalize(vec):
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def embed_hash(text, dims=None):
    """Deterministic hashing embedding (stdlib-only fallback)."""
    dims = dims or config.EMBED_DIMS
    vec = [0.0] * dims
    for tok in _WORD.findall(text.lower()):
        if tok in STOPWORDS:
            continue
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        vec[h % dims] += 1.0
        # a second hashed feature reduces collisions a little
        vec[(h >> 16) % dims] += 0.5
    return _normalize(vec)


def embed_ollama(text, model=None, url=None, timeout=30):
    """Call Ollama's /api/embeddings. Raises on failure (caller handles fallback)."""
    model = model or config.EMBED_MODEL
    url = (url or config.OLLAMA_URL).rstrip("/") + "/api/embeddings"
    body = json.dumps({"model": model, "prompt": text}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.load(resp)
    vec = data.get("embedding")
    if not vec:
        raise ValueError("ollama returned no embedding")
    return _normalize(vec)


def ollama_available(url=None, timeout=1.5):
    url = (url or config.OLLAMA_URL).rstrip("/") + "/api/tags"
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


class Embedder:
    """Picks the best available backend once, then embeds consistently."""

    def __init__(self, backend=None):
        if backend is None:
            backend = "ollama" if ollama_available() else "hash"
        self.backend = backend
        self.dims = None  # learned from the first embedding

    def embed(self, text):
        if self.backend == "ollama":
            try:
                vec = embed_ollama(text)
                self.dims = len(vec)
                return vec
            except Exception:
                # fall back permanently for this run if ollama disappears
                self.backend = "hash"
        vec = embed_hash(text)
        self.dims = len(vec)
        return vec
