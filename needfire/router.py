"""Query routing: classify intent, pick a model, build the grounded prompt.

The system prompt forces source-grounded, cited answers and an explicit
"not in sources" path.
"""
import re

from . import config

_CRIT_WORDS = re.compile(
    r"\b(dose|dosage|bleed|bleeding|wound|poison|venom|voltage|volt|amp|amps|"
    r"radiation|radioactive|acid|antibiotic|cpr|burn|burns|fracture|shock|"
    r"toxic|overdose|seizure|allergic|anaphyl|choking|drown|snakebite|"
    r"frostbite|hypothermia|heatstroke|stroke|cardiac|asthma|wheez|diabet|"
    r"hypoglyc|hyperglyc|unconscious|unrespons|chest|concussion|fallout)\w*\b",
    re.I,
)
_MED_WORDS = ("medical", "first aid", "doctor", "drug", "injury", "infection")
_TECH_WORDS = ("how", "build", "make", "repair", "circuit", "reaction", "synthesize", "construct")
_NAV_WORDS = ("where", "map", "route", "navigate", "direction", "coordinates")

# Domain hints, most specific first. The hint is only a soft retrieval boost
# (see rag.py) — a wrong or missing hint can never hide documents — so bare
# "shock" (electric? hypovolemic?) deliberately gets no hint at all.
_DOMAIN_HINTS = (
    ("electronics", re.compile(
        r"\b(voltage|volts?|amps?|amperage|circuit\w*|wiring|electrocut\w*|"
        r"electric\w*)\b", re.I)),
    ("energy", re.compile(
        r"\b(solar|battery|batteries|inverter|generator|charge\s+controller)\b",
        re.I)),
    ("physics", re.compile(r"\b(radiation|radioactive|fallout|geiger)\b", re.I)),
    ("chemistry", re.compile(
        r"\b(acids?|lye|caustic|reaction|synthesi[sz]e\w*|bleach)\b", re.I)),
)

SYSTEM_RULES = (
    "You are Needfire, an offline survival reference assistant. Answer ONLY using "
    "the numbered SOURCES provided. Cite every claim as [n] matching a source. If "
    "the sources do not contain the answer, say exactly 'Not in the available "
    "sources.' and stop — do NOT use outside knowledge or guess. For medical, "
    "chemical, electrical, structural, or radiological questions, explicitly tell "
    "the user to read the cited source before acting, because errors can be "
    "dangerous. Be concise, practical, and direct."
)


def _domain_hint(q):
    for domain, pat in _DOMAIN_HINTS:
        if pat.search(q):
            return domain
    return None


def classify(question):
    """Return (category, force_cite, domain_hint)."""
    q = question.lower()
    hint = _domain_hint(q)
    if _CRIT_WORDS.search(q) or any(w in q for w in _MED_WORDS):
        if hint is None and not re.search(r"\bshock\w*\b", q):
            hint = "medicine"
        return "MEDICAL", True, hint
    if any(w in q for w in _NAV_WORDS):
        return "NAV", False, hint or "navigation"
    if any(w in q for w in _TECH_WORDS):
        return "TECHNICAL", False, hint
    return "GENERAL", False, hint


def pick_model(category, force_cite, power_state, model_available):
    """Choose tiny vs reasoning model given query + power + availability."""
    if not model_available:
        return None
    want_depth = force_cite or category in ("TECHNICAL", "MEDICAL")
    if want_depth and power_state != "low":
        return config.REASON_MODEL
    return config.TINY_MODEL


def build_prompt(question, chunks, force_cite):
    """Assemble the grounded prompt from retrieved chunks."""
    from . import rag
    lines = []
    for i, c in enumerate(chunks, 1):
        snippet = rag.strip_md(c["text"])[:700].replace("\n", " ")
        lines.append(f"[{i}] (title: {c['doc_title']}; domain: {c['domain']}) {snippet}")
    sources = "\n".join(lines)
    extra = "Name the exact source to read directly. " if force_cite else ""
    return (
        f"{SYSTEM_RULES}\n\nSOURCES:\n{sources}\n\n"
        f"QUESTION: {question}\n\n"
        f"ANSWER (cite [n]; {extra}say 'Not in the available sources.' if unsupported):"
    )


def is_critical(domain):
    return domain in config.CRITICAL_DOMAINS
