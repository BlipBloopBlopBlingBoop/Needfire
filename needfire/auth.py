"""Password gate for Needfire's powerful features (Studio, model pull/delete,
content download, reindex). Pure stdlib.

Design: a single owner password is set on first use. Login issues an in-memory
session token delivered as an HttpOnly, SameSite=Strict cookie (the web client
uses EventSource, which is GET-only and cannot set Authorization headers, so a
cookie is the only auth channel that works for the streaming endpoints).

Threat model: this is a single-owner appliance. Anyone with the password gets a
shell on the box (that is the point). The gate keeps casual devices on the Wi-Fi
out of the dangerous surfaces while leaving Library/Emergency/Toolkit open.
"""
import hashlib
import hmac
import http.cookies
import json
import os
import secrets
import threading
import time

from . import config

COOKIE_NAME = "nf_session"
SESSION_TTL = 12 * 3600
_ITERATIONS = 200_000
_MAX_FAILS = 5
_LOCKOUT_BASE = 5          # seconds, doubles per fail past the threshold
_LOCKOUT_CAP = 300

_lock = threading.Lock()
_sessions = {}             # token -> expiry (monotonic)
_fails = {}                # ip -> [count, blocked_until_monotonic]


def _path():
    return config.NEEDFIRE_HOME / "security.json"


def _load():
    try:
        return json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save(data):
    config.NEEDFIRE_HOME.mkdir(parents=True, exist_ok=True)
    # write private (0600) — this holds the password hash + server secret
    fd = os.open(str(_path()), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)


def needs_setup():
    return not _load().get("hash")


def _hash(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS).hex()


def set_password(password):
    """Set the owner password. Refuses to overwrite an existing one (call only
    when needs_setup() is true — the server enforces this)."""
    if not password or len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    if not needs_setup():
        raise PermissionError("password already set")
    salt = os.urandom(16)
    _save({
        "version": 1,
        "salt": salt.hex(),
        "hash": _hash(password, salt),
        "secret": secrets.token_urlsafe(32),
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


def verify_password(password):
    data = _load()
    if not data.get("hash"):
        return False
    salt = bytes.fromhex(data["salt"])
    return hmac.compare_digest(_hash(password, salt), data["hash"])


# ---- sessions --------------------------------------------------------------

def create_session():
    token = secrets.token_urlsafe(32)
    with _lock:
        _sessions[token] = time.monotonic() + SESSION_TTL
    return token


def check_session(token):
    if not token:
        return False
    now = time.monotonic()
    with _lock:
        exp = _sessions.get(token)
        if exp is None:
            return False
        if exp < now:
            _sessions.pop(token, None)
            return False
        return True


def destroy_session(token):
    with _lock:
        _sessions.pop(token, None)


# ---- login backoff ---------------------------------------------------------

def blocked_for(ip):
    """Return remaining lockout seconds for an IP, or 0 if not blocked."""
    with _lock:
        rec = _fails.get(ip)
        if not rec:
            return 0
        remaining = rec[1] - time.monotonic()
        return int(remaining) if remaining > 0 else 0


def record_failure(ip):
    with _lock:
        rec = _fails.get(ip, [0, 0.0])
        rec[0] += 1
        if rec[0] >= _MAX_FAILS:
            wait = min(_LOCKOUT_CAP, _LOCKOUT_BASE * (2 ** (rec[0] - _MAX_FAILS)))
            rec[1] = time.monotonic() + wait
        _fails[ip] = rec


def clear_failures(ip):
    with _lock:
        _fails.pop(ip, None)


# ---- cookie helper ---------------------------------------------------------

def session_from_cookie(cookie_header):
    if not cookie_header:
        return None
    try:
        jar = http.cookies.SimpleCookie(cookie_header)
    except http.cookies.CookieError:
        return None
    morsel = jar.get(COOKIE_NAME)
    return morsel.value if morsel else None


def cookie_header(token, clear=False):
    if clear:
        return f"{COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
    return (f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Path=/; "
            f"Max-Age={SESSION_TTL}")
