"""Studio backend: a workspace file API and a command/Python runner.

This is deliberate, authenticated remote code execution for the appliance's
owner — it is what turns Needfire into a standalone computer. Everything here
is behind the auth gate (see server.PROTECTED_PREFIXES); it is never reachable
before a password is set.

Two file roots are allowed:
  * "workspace" — NEEDFIRE_HOME/workspace, the owner's scratch space.
  * "web"       — the app's own web/ dir, so the owner can customize the UI.
All paths are resolved and confirmed to stay inside their root (traversal and
symlink-escape guarded), with a size cap on reads/writes.

The runner is a LINE-STREAMED, non-interactive command runner (not a TTY):
stdlib `pty` is POSIX-only, so this works identically on Windows. It streams
merged stdout/stderr, enforces a timeout, and remembers a per-session working
directory so `cd` persists between commands.
"""
import os
import subprocess
import sys
import threading
import time

from . import config

MAX_FILE_BYTES = 5 * 1024 * 1024
DEFAULT_TIMEOUT = 60
MAX_TIMEOUT = 300
_CWD_SENTINEL = "__NF_CWD__"

_cwd_lock = threading.Lock()
_session_cwd = {}          # session token -> current working dir (str)


def roots():
    return {
        "workspace": (config.NEEDFIRE_HOME / "workspace").resolve(),
        "web": config.WEB_DIR.resolve(),
    }


def ensure_workspace():
    (config.NEEDFIRE_HOME / "workspace").mkdir(parents=True, exist_ok=True)


class FsError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def resolve(root_key, rel):
    """Resolve rel under the named root, rejecting any escape. Returns a Path."""
    base = roots().get(root_key)
    if base is None:
        raise FsError(400, "unknown root")
    base.mkdir(parents=True, exist_ok=True)
    rel = (rel or "").replace("\\", "/").lstrip("/")
    target = (base / rel).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise FsError(403, "path escapes the allowed folder")
    # realpath check defends against a symlink placed inside base pointing out
    real = os.path.realpath(str(target))
    if os.path.commonpath([real, str(base)]) != str(base):
        raise FsError(403, "symlink escapes the allowed folder")
    return target


def listdir(root_key, rel):
    target = resolve(root_key, rel)
    if not target.exists():
        raise FsError(404, "not found")
    if not target.is_dir():
        raise FsError(400, "not a directory")
    entries = []
    for p in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
        try:
            st = p.stat()
            entries.append({
                "name": p.name,
                "type": "dir" if p.is_dir() else "file",
                "size": st.st_size,
                "mtime": int(st.st_mtime),
            })
        except OSError:
            continue
    return {"root": root_key, "path": rel, "entries": entries}


def read_file(root_key, rel):
    target = resolve(root_key, rel)
    if not target.is_file():
        raise FsError(404, "not found")
    if target.stat().st_size > MAX_FILE_BYTES:
        raise FsError(413, "file too large to edit here")
    try:
        content = target.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise FsError(415, "binary file — not editable as text")
    return {"root": root_key, "path": rel, "content": content}


def write_file(root_key, rel, content):
    content = content or ""
    if len(content.encode("utf-8")) > MAX_FILE_BYTES:
        raise FsError(413, "content too large")
    target = resolve(root_key, rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".nf-tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, target)
    return {"root": root_key, "path": rel, "bytes": len(content.encode("utf-8"))}


def mkdir(root_key, rel):
    target = resolve(root_key, rel)
    target.mkdir(parents=True, exist_ok=True)
    return {"root": root_key, "path": rel}


def delete(root_key, rel):
    target = resolve(root_key, rel)
    if not target.exists():
        raise FsError(404, "not found")
    if target.is_dir():
        import shutil
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"root": root_key, "path": rel, "deleted": True}


def rename(root_key, src, dst):
    s = resolve(root_key, src)
    d = resolve(root_key, dst)
    if not s.exists():
        raise FsError(404, "source not found")
    d.parent.mkdir(parents=True, exist_ok=True)
    os.replace(s, d)
    return {"root": root_key, "from": src, "to": dst}


# ---- command / python runner ----------------------------------------------

def _default_cwd():
    ensure_workspace()
    return str((config.NEEDFIRE_HOME / "workspace").resolve())


def get_cwd(session):
    with _cwd_lock:
        cwd = _session_cwd.get(session)
    if cwd and os.path.isdir(cwd):
        return cwd
    return _default_cwd()


def _set_cwd(session, cwd):
    with _cwd_lock:
        _session_cwd[session] = cwd


def _argv(command):
    # non-login shell: a login shell (-l) would source profile scripts that can
    # print their own noise into the terminal output
    if os.name == "nt":
        return ["cmd", "/c", command]
    return ["/bin/sh", "-c", command]


def run_stream(command, session, timeout=DEFAULT_TIMEOUT, is_python=False):
    """Yield ('out', {line}) events, then ('done', {code}).

    Runs the command in the session's cwd. For shells, a trailing sentinel
    prints the resulting $PWD so a leading `cd` persists to the next command.
    """
    timeout = max(1, min(MAX_TIMEOUT, int(timeout or DEFAULT_TIMEOUT)))
    cwd = get_cwd(session)
    tmp_path = None

    if is_python:
        ensure_workspace()
        tmp_path = os.path.join(cwd, f".nf_scratch_{int(time.time()*1000)}.py")
        with open(tmp_path, "w", encoding="utf-8") as fh:
            fh.write(command or "")
        argv = [sys.executable, "-u", tmp_path]
        track_cwd = False
    else:
        # append a sentinel so we can capture the new working directory
        if os.name == "nt":
            wrapped = f"{command} & echo {_CWD_SENTINEL}%CD%"
        else:
            wrapped = f"{command}\nprintf '{_CWD_SENTINEL}%s\\n' \"$PWD\""
        argv = _argv(wrapped)
        track_cwd = True

    env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
    # own process group / session so a timeout can kill child processes too
    # (killing just the shell leaves e.g. a `sleep` holding the output pipe open)
    popen_kw = {}
    if os.name == "nt":
        popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kw["start_new_session"] = True
    try:
        proc = subprocess.Popen(
            argv, cwd=cwd, env=env, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
            encoding="utf-8", errors="replace", **popen_kw,
        )
    except OSError as exc:
        yield ("out", {"line": f"[could not start: {exc}]"})
        yield ("done", {"code": -1})
        return

    timed_out = {"v": False}

    def _kill():
        timed_out["v"] = True
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                               capture_output=True)
            else:
                import signal
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (OSError, ProcessLookupError):
            try:
                proc.kill()
            except OSError:
                pass

    timer = threading.Timer(timeout, _kill)
    timer.start()
    try:
        for line in proc.stdout:
            line = line.rstrip("\n")
            if track_cwd and _CWD_SENTINEL in line:
                new_cwd = line.split(_CWD_SENTINEL, 1)[1].strip()
                if new_cwd and os.path.isdir(new_cwd):
                    _set_cwd(session, new_cwd)
                continue
            yield ("out", {"line": line})
        proc.wait()
    finally:
        timer.cancel()
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    if timed_out["v"]:
        yield ("out", {"line": f"[stopped: exceeded {timeout}s time limit]"})
    yield ("done", {"code": proc.returncode, "cwd": get_cwd(session)})
