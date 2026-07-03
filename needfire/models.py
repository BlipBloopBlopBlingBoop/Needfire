"""Local LLM client (Ollama-compatible). Optional — absence degrades cleanly.

If no model runtime is reachable, the app returns ranked source snippets instead
of a synthesized answer ("sources-only" mode). The UI shows which mode produced
the response so the operator always knows whether a model was involved.
"""
import json
import threading
import time
import urllib.request

from . import config

# Availability probes hit the network; without a cache every /api/system
# request pays for two of them (multi-second stalls when Ollama is slow).
_CACHE_TTL = 5.0
_cache_lock = threading.Lock()
_cache = {"at": 0.0, "ok": False, "models": []}


def _probe(url, timeout):
    tags_url = url.rstrip("/") + "/api/tags"
    try:
        with urllib.request.urlopen(tags_url, timeout=timeout) as resp:
            if resp.status != 200:
                return False, []
            data = json.load(resp)
        return True, [m.get("name") for m in data.get("models", [])]
    except Exception:
        return False, []


def _cached_probe(url=None, timeout=2, refresh=False):
    target = url or config.OLLAMA_URL
    if url and url != config.OLLAMA_URL:  # non-default URL: don't cache
        return _probe(target, timeout)
    now = time.monotonic()
    with _cache_lock:
        if not refresh and now - _cache["at"] < _CACHE_TTL:
            return _cache["ok"], _cache["models"]
    ok, names = _probe(target, timeout)
    with _cache_lock:
        _cache.update(at=time.monotonic(), ok=ok, models=names)
    return ok, names


def available(url=None, timeout=1.5, refresh=False):
    ok, _names = _cached_probe(url=url, timeout=timeout, refresh=refresh)
    return ok


def list_models(url=None, timeout=2, refresh=False):
    _ok, names = _cached_probe(url=url, timeout=timeout, refresh=refresh)
    return names


def generate_stream(prompt, model=None, url=None, timeout=300):
    """Yield answer tokens from Ollama /api/generate (streaming).

    Raises on connection failure so the caller can fall back to sources-only.
    """
    model = model or config.REASON_MODEL
    url = (url or config.OLLAMA_URL).rstrip("/") + "/api/generate"
    body = json.dumps({"model": model, "prompt": prompt, "stream": True}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        for line in resp:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            tok = obj.get("response", "")
            if tok:
                yield tok
            if obj.get("done"):
                break


def generate(prompt, model=None, url=None, timeout=300):
    """Non-streaming convenience wrapper."""
    return "".join(generate_stream(prompt, model=model, url=url, timeout=timeout))


# ---- model management (pull / delete / roles) ------------------------------

# Curated small models that run on modest hardware. Real Ollama tags; sizes are
# approximate download sizes and a rough RAM floor to run comfortably.
RECOMMENDED = [
    {"name": "llama3.2:1b", "role": "tiny", "size_gb": 1.3, "ram_gb": 2,
     "note": "Fast, tiny always-on model. Good on a Raspberry Pi."},
    {"name": "llama3.2:3b", "role": "reason", "size_gb": 2.0, "ram_gb": 4,
     "note": "Better answers, still light."},
    {"name": "qwen3:4b", "role": "reason", "size_gb": 2.6, "ram_gb": 6,
     "note": "Strong reasoner for its size."},
    {"name": "gemma3:4b", "role": "reason", "size_gb": 3.3, "ram_gb": 6,
     "note": "Capable general model."},
    {"name": "phi3.5:3.8b", "role": "reason", "size_gb": 2.2, "ram_gb": 4,
     "note": "Compact and instruction-tuned."},
    {"name": "nomic-embed-text", "role": "embed", "size_gb": 0.28, "ram_gb": 1,
     "note": "Semantic search embeddings (upgrades retrieval)."},
]


def pull_stream(name, url=None, timeout=3600):
    """Yield Ollama /api/pull progress dicts {status,total,completed,digest}.

    Raises on connection failure so the caller can surface it. Invalidates the
    availability cache on completion so the new model appears immediately.
    """
    endpoint = (url or config.OLLAMA_URL).rstrip("/") + "/api/pull"
    body = json.dumps({"name": name, "stream": True}).encode()
    req = urllib.request.Request(endpoint, data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        for line in resp:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            yield obj
            if obj.get("error"):
                break
    _cached_probe(refresh=True)


def delete(name, url=None, timeout=30):
    """Delete an installed model via Ollama /api/delete (DELETE)."""
    endpoint = (url or config.OLLAMA_URL).rstrip("/") + "/api/delete"
    body = json.dumps({"name": name}).encode()
    req = urllib.request.Request(endpoint, data=body, method="DELETE",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        ok = resp.status in (200, 204)
    _cached_probe(refresh=True)
    return ok


def roles():
    """Current tiny/reason/embed model assignments (file override or defaults)."""
    return {
        "tiny": config.TINY_MODEL,
        "reason": config.REASON_MODEL,
        "embed": config.EMBED_MODEL,
    }


def set_roles(mapping):
    """Persist model role choices and apply them in-process."""
    return config.set_model_roles(mapping)
