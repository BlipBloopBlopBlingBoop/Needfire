"""Configuration and paths for Needfire.

Everything is overridable by environment variable so the same code runs from a
dev checkout, a Docker container, or an installed appliance. The only hard
requirement is Python 3.8+.
"""
import os
from pathlib import Path

# Repository root (this file is offline-survival-computer/needfire/config.py).
PKG_DIR = Path(__file__).resolve().parent
REPO_DIR = PKG_DIR.parent

# NEEDFIRE_HOME holds runtime data: the corpus, the index, the manifest, logs.
# Defaults to <repo>/.needfire-home so a fresh checkout works with zero setup.
NEEDFIRE_HOME = Path(os.environ.get("NEEDFIRE_HOME", REPO_DIR / ".needfire-home"))

# Static web UI.
WEB_DIR = Path(os.environ.get("NEEDFIRE_WEB_DIR", REPO_DIR / "web"))

# Bundled content that ships in the repo.
SEED_DIR = Path(os.environ.get("NEEDFIRE_SEED_DIR", REPO_DIR / "seed-corpus"))
CATALOG_PATH = Path(os.environ.get("NEEDFIRE_CATALOG", REPO_DIR / "catalog" / "catalog.json"))

# Derived runtime paths.
ZIM_DIR = NEEDFIRE_HOME / "zim"
DOCS_DIR = NEEDFIRE_HOME / "docs"
MAPS_DIR = NEEDFIRE_HOME / "maps"
INDEX_DIR = NEEDFIRE_HOME / "index"
LOG_DIR = NEEDFIRE_HOME / "logs"
CHUNK_DB = INDEX_DIR / "chunks.sqlite"
MANIFEST = NEEDFIRE_HOME / "manifest.json"

# Server.
HOST = os.environ.get("NEEDFIRE_HOST", "0.0.0.0")
PORT = int(os.environ.get("NEEDFIRE_PORT", "8848"))

# Model runtime (Ollama-compatible HTTP API). Optional — absence degrades cleanly.
OLLAMA_URL = os.environ.get("NEEDFIRE_OLLAMA_URL", "http://127.0.0.1:11434")
TINY_MODEL = os.environ.get("NEEDFIRE_TINY_MODEL", "llama3.2:1b")
REASON_MODEL = os.environ.get("NEEDFIRE_REASON_MODEL", "llama3.1:8b")
EMBED_MODEL = os.environ.get("NEEDFIRE_EMBED_MODEL", "nomic-embed-text")

# Runtime override for model roles, set from the Models UI. Env vars are the
# base default; NEEDFIRE_HOME/models.json overrides them and persists across
# restarts. Applied here so router/rag read the chosen models with no restart.
_MODELS_JSON = NEEDFIRE_HOME / "models.json"


def _load_model_roles():
    import json
    try:
        return json.loads(_MODELS_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def set_model_roles(mapping):
    """Persist {tiny,reason,embed} overrides and apply them to this process."""
    import json as _json
    global TINY_MODEL, REASON_MODEL, EMBED_MODEL
    current = _load_model_roles()
    for key in ("tiny", "reason", "embed"):
        val = (mapping or {}).get(key)
        if val:
            current[key] = val
    NEEDFIRE_HOME.mkdir(parents=True, exist_ok=True)
    _MODELS_JSON.write_text(_json.dumps(current, indent=2), encoding="utf-8")
    TINY_MODEL = current.get("tiny", TINY_MODEL)
    REASON_MODEL = current.get("reason", REASON_MODEL)
    EMBED_MODEL = current.get("embed", EMBED_MODEL)
    return {"tiny": TINY_MODEL, "reason": REASON_MODEL, "embed": EMBED_MODEL}


# Apply any persisted overrides at import time.
_roles = _load_model_roles()
TINY_MODEL = _roles.get("tiny", TINY_MODEL)
REASON_MODEL = _roles.get("reason", REASON_MODEL)
EMBED_MODEL = _roles.get("embed", EMBED_MODEL)

# Retrieval.
EMBED_DIMS = int(os.environ.get("NEEDFIRE_EMBED_DIMS", "512"))  # hashing-fallback dims
TOP_K = int(os.environ.get("NEEDFIRE_TOP_K", "6"))
CHUNK_TOKENS = int(os.environ.get("NEEDFIRE_CHUNK_TOKENS", "1000"))
CHUNK_OVERLAP = float(os.environ.get("NEEDFIRE_CHUNK_OVERLAP", "0.15"))
# Added to a chunk's similarity score when it matches the router's domain hint.
# A soft boost, not a filter: a wrong hint can never zero out recall.
DOMAIN_BOOST = float(os.environ.get("NEEDFIRE_DOMAIN_BOOST", "0.10"))

# Domains shown as category cards (key -> display label + icon id used by the UI).
DOMAINS = [
    ("medicine", "Medicine & First Aid", "medical"),
    ("water", "Water", "water"),
    ("food", "Food & Foraging", "food"),
    ("shelter", "Fire & Shelter", "fire"),
    ("energy", "Energy & Power", "energy"),
    ("chemistry", "Chemistry", "flask"),
    ("pharma", "Pharmaceuticals", "pill"),
    ("physics", "Physics & Nuclear", "atom"),
    ("electronics", "Electronics", "chip"),
    ("agriculture", "Agriculture", "plant"),
    ("repair", "Repair & Tools", "wrench"),
    ("navigation", "Navigation", "compass"),
    ("reference", "Reference", "book"),
]
DOMAIN_LABELS = {k: label for k, label, _icon in DOMAINS}

# Domains where answers must surface the primary source and carry a safety banner.
CRITICAL_DOMAINS = {"medicine", "pharma", "chemistry", "physics", "electronics"}


def ensure_dirs():
    """Create the runtime directory tree if missing."""
    for d in (NEEDFIRE_HOME, ZIM_DIR, DOCS_DIR, MAPS_DIR, INDEX_DIR, LOG_DIR,
              NEEDFIRE_HOME / "workspace"):
        d.mkdir(parents=True, exist_ok=True)
