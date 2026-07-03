"""Needfire HTTP server — pure stdlib (http.server).

Serves the static card UI from web/ and a small JSON API. Answers stream via
Server-Sent Events so the UI can render a live "typing" answer. No framework.
"""
import json
import mimetypes
import posixpath
import re
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import (__version__, auth, config, corpus, db, embed, index, models,
               power, rag, router, studio)

# Endpoints that require the owner password (see auth.py). Everything else —
# Library, Emergency, Toolkit, read-only status/corpus/models — stays open so
# phones on the Wi-Fi keep working.
PROTECTED_PREFIXES = (
    "/api/fs", "/api/run", "/api/models/pull", "/api/models/delete",
    "/api/models/roles", "/api/content", "/api/reindex",
)

# Read-only status endpoints that would otherwise match a protected prefix.
OPEN_EXCEPTIONS = ("/api/reindex/status",)


# ---- shared helpers --------------------------------------------------------

def _categories(conn):
    counts = db.stats(conn)["by_domain"]
    cards = []
    for key, label, icon in config.DOMAINS:
        cards.append({
            "domain": key,
            "label": label,
            "icon": icon,
            "count": counts.get(key, 0),
            "critical": key in config.CRITICAL_DOMAINS,
        })
    return cards


def _system_status(conn):
    st = power.snapshot()
    backend = db.get_meta(conn, "embed_backend", "hash")
    model_ok = models.available()
    st["models"] = {
        "available": model_ok,
        "installed": models.list_models(),
        "embed_backend": backend,
        # False = index was built with Ollama embeddings but Ollama is down,
        # so retrieval has silently degraded to keyword search.
        "embed_ready": backend == "hash" or model_ok or embed.ollama_available(),
    }
    st["corpus"] = db.stats(conn)
    st["version"] = __version__
    return st


def _answer_events(conn, question, power_state):
    """Generator yielding SSE event dicts for a question."""
    category, force_cite, domain_hint = router.classify(question)
    chunks, how = rag.retrieve(conn, question, domain=domain_hint)

    yield {"event": "meta", "data": {
        "category": category, "critical": force_cite,
        "retrieval": how, "domain": domain_hint,
        "sources": [_source_card(i, c) for i, c in enumerate(chunks, 1)],
    }}

    if not chunks:
        yield {"event": "answer", "data": {"token": "Not in the available sources."}}
        yield {"event": "done", "data": {"mode": "empty"}}
        return

    model = router.pick_model(category, force_cite, power_state, models.available())
    if not model:
        # sources-only degrade: no synthesis, just the top snippets.
        yield {"event": "answer", "data": {"token":
               "No language model is loaded, so here are the most relevant "
               "sources. Open each to read the full text."}}
        yield {"event": "done", "data": {"mode": "sources-only"}}
        return

    prompt = router.build_prompt(question, chunks, force_cite)
    try:
        for tok in models.generate_stream(prompt, model=model):
            yield {"event": "answer", "data": {"token": tok}}
        yield {"event": "done", "data": {"mode": "model", "model": model}}
    except Exception as exc:  # noqa: BLE001 - degrade to sources-only on any error
        yield {"event": "answer", "data": {"token":
               f"(Model error: {exc}. Showing sources only.)"}}
        yield {"event": "done", "data": {"mode": "sources-only"}}


def _source_card(n, c):
    snippet = re.sub(r"\s+", " ", rag.strip_md(c["text"]))[:280].strip()
    return {
        "n": n,
        "doc_id": c["doc_id"],
        "title": c["doc_title"],
        "domain": c["domain"],
        "tier": c.get("tier"),
        "license": c["license"],
        "snippet": snippet,
        "score": c.get("score"),
    }


# ---- request handler -------------------------------------------------------

class NeedfireHandler(BaseHTTPRequestHandler):
    server_version = f"Needfire/{__version__}"

    def handle(self):
        # A client vanishing mid-request (browser tab closed, health poll
        # timed out, phone left the Wi-Fi) is normal, not a server error —
        # swallow it instead of letting socketserver print a traceback.
        # ConnectionError covers WinError 10053/10054 and BrokenPipeError.
        try:
            super().handle()
        except (ConnectionError, TimeoutError):
            self.close_connection = True

    def log_message(self, fmt, *args):  # quieter logs
        pass

    # -- response helpers --
    def _json(self, obj, status=200, cookie=None):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    # -- auth --
    def _session(self):
        return auth.session_from_cookie(self.headers.get("Cookie"))

    def _require_auth(self, path):
        """Return True (and send 401) if this path is protected and no valid
        session cookie is present. Call first in do_GET/do_POST."""
        if path in OPEN_EXCEPTIONS:
            return False
        if any(path.startswith(p) for p in PROTECTED_PREFIXES):
            if not auth.check_session(self._session()):
                self._json({"error": "password required", "code": "unauthorized"},
                           status=401)
                return True
        return False

    def _sse_start(self):
        # Close the connection when the stream ends so clients get a clean EOF.
        self.close_connection = True
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

    def _sse_send(self, event, data):
        chunk = f"event: {event}\ndata: {json.dumps(data)}\n\n".encode()
        self.wfile.write(chunk)
        self.wfile.flush()

    def _sse_stream(self, events, done=None):
        """Drive an SSE response from an iterator of (event, data) tuples.
        Emits a final `done` event unless the iterator already emitted one;
        tolerates client disconnects; turns a pre-stream error into a JSON 500
        and a mid-stream error into an `error` event (mirrors the /api/ask
        contract)."""
        streaming = False
        try:
            self._sse_start()
            streaming = True
            last = {}
            sent_done = False
            for event, data in events:
                self._sse_send(event, data)
                if event == "done":
                    sent_done = True
                last = data
            if not sent_done:
                self._sse_send("done", done if done is not None else last)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:  # noqa: BLE001
            if not streaming:
                return self._json({"error": str(exc)}, status=500)
            try:
                self._sse_send("error", {"error": str(exc)})
                self._sse_send("done", {"error": str(exc)})
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _fs(self, fn):
        try:
            return self._json(fn())
        except studio.FsError as exc:
            return self._json({"error": exc.message}, status=exc.status)

    def _body_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return {}

    # -- routing --
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if self._require_auth(path):
            return

        if path == "/api/health":
            return self._json({"ok": True, "version": __version__})

        if path == "/api/auth/status":
            return self._json({"needs_setup": auth.needs_setup(),
                               "authed": auth.check_session(self._session())})

        if path == "/api/models":
            ok = models.available()
            return self._json({
                "ollama_up": ok,
                "ollama_url": config.OLLAMA_URL,
                "installed": models.list_models() if ok else [],
                "roles": models.roles(),
                "recommended": models.RECOMMENDED,
            })

        if path == "/api/models/pull":
            name = (qs.get("name") or [""])[0]
            if not name:
                return self._json({"error": "missing ?name="}, status=400)
            return self._sse_stream(
                (("progress", ev) for ev in models.pull_stream(name)),
                done={"name": name})

        if path == "/api/fs/list":
            return self._fs(lambda: studio.listdir(
                (qs.get("root") or ["workspace"])[0], (qs.get("path") or [""])[0]))

        if path == "/api/fs/read":
            return self._fs(lambda: studio.read_file(
                (qs.get("root") or ["workspace"])[0], (qs.get("path") or [""])[0]))

        if path == "/api/run":
            cmd = (qs.get("cmd") or [None])[0]
            code = (qs.get("code") or [None])[0]
            is_py = (qs.get("py") or ["0"])[0] == "1"
            timeout = (qs.get("timeout") or [""])[0]
            src = code if is_py else cmd
            if src is None:
                return self._json({"error": "missing cmd/code"}, status=400)
            session = self._session()
            gen = studio.run_stream(src, session,
                                    timeout=int(timeout) if timeout.isdigit() else studio.DEFAULT_TIMEOUT,
                                    is_python=is_py)
            return self._sse_stream(gen)

        if path == "/api/reindex/status":
            return self._json(index.JOB.snapshot())

        if path == "/api/system":
            conn = db.connect();
            try:
                return self._json(_system_status(conn))
            finally:
                conn.close()

        if path == "/api/categories":
            conn = db.connect()
            try:
                return self._json({"categories": _categories(conn)})
            finally:
                conn.close()

        if path == "/api/search":
            q = (qs.get("q") or [""])[0]
            domain = (qs.get("domain") or [None])[0]
            conn = db.connect()
            try:
                chunks, how = rag.retrieve(conn, q, domain=domain)
                return self._json({
                    "query": q, "retrieval": how,
                    "results": [_source_card(i, c) for i, c in enumerate(chunks, 1)],
                })
            finally:
                conn.close()

        if path == "/api/source":
            doc = (qs.get("doc") or [""])[0]
            conn = db.connect()
            try:
                d = rag.get_document(conn, doc)
                return self._json(d or {"error": "not found"}, status=200 if d else 404)
            finally:
                conn.close()

        if path == "/api/domain":
            d = (qs.get("d") or [""])[0]
            if not d:
                return self._json({"error": "missing ?d=<domain>"}, status=400)
            if d not in config.DOMAIN_LABELS:
                return self._json({"error": "unknown domain"}, status=404)
            conn = db.connect()
            try:
                return self._json({
                    "domain": d,
                    "label": config.DOMAIN_LABELS[d],
                    "documents": db.list_docs(conn, domain=d),
                })
            finally:
                conn.close()

        if path == "/api/ask":  # SSE streaming
            q = (qs.get("q") or [""])[0]
            power_state = (qs.get("power") or ["normal"])[0]
            if not q.strip():
                return self._json({"error": "empty question"}, status=400)
            conn = db.connect()
            streaming = False
            try:
                self._sse_start()
                streaming = True
                for evt in _answer_events(conn, q, power_state):
                    self._sse_send(evt["event"], evt["data"])
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as exc:  # noqa: BLE001 - keep the stream well-formed
                if not streaming:
                    return self._json({"error": str(exc)}, status=500)
                try:
                    self._sse_send("error", {"error": str(exc)})
                    self._sse_send("done", {"mode": "error"})
                except (BrokenPipeError, ConnectionResetError):
                    pass
            finally:
                conn.close()
            return

        if path == "/api/corpus":
            return self._json({
                "sources": corpus.installed_status(),
                "job": corpus.JOB.snapshot(),
            })

        if path == "/api/corpus/status":
            return self._json(corpus.JOB.snapshot())

        if path.startswith("/api/"):
            # unknown API path: a JSON 404, not the SPA fallback page
            return self._json({"error": "not found"}, status=404)

        # static files
        return self._serve_static(path)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # auth endpoints are open (they establish the session); everything in
        # PROTECTED_PREFIXES needs a valid cookie
        if path == "/api/auth/setup":
            body = self._body_json()
            if not auth.needs_setup():
                return self._json({"error": "password already set"}, status=409)
            try:
                auth.set_password(body.get("password", ""))
            except ValueError as exc:
                return self._json({"error": str(exc)}, status=400)
            token = auth.create_session()
            return self._json({"ok": True}, cookie=auth.cookie_header(token))

        if path == "/api/auth/login":
            body = self._body_json()
            ip = self.client_address[0]
            wait = auth.blocked_for(ip)
            if wait:
                return self._json({"error": f"too many attempts — wait {wait}s"},
                                  status=429)
            if auth.verify_password(body.get("password", "")):
                auth.clear_failures(ip)
                token = auth.create_session()
                return self._json({"ok": True}, cookie=auth.cookie_header(token))
            auth.record_failure(ip)
            return self._json({"error": "wrong password"}, status=401)

        if path == "/api/auth/logout":
            auth.destroy_session(self._session())
            return self._json({"ok": True}, cookie=auth.cookie_header("", clear=True))

        if self._require_auth(path):
            return

        if path == "/api/models/delete":
            name = self._body_json().get("name", "")
            if not name:
                return self._json({"error": "missing name"}, status=400)
            try:
                models.delete(name)
                return self._json({"ok": True})
            except Exception as exc:  # noqa: BLE001
                return self._json({"error": str(exc)}, status=502)

        if path == "/api/models/roles":
            body = self._body_json()
            installed = set(models.list_models())
            for key in ("tiny", "reason", "embed"):
                val = body.get(key)
                if val and installed and val not in installed:
                    return self._json({"error": f"{val} is not installed"}, status=400)
            return self._json({"roles": models.set_roles(body)})

        if path == "/api/content/url":
            body = self._body_json()
            try:
                corpus.set_source_url(body["id"], body["url"], body.get("sha256"))
            except (KeyError, ValueError) as exc:
                return self._json({"error": str(exc)}, status=400)
            if body.get("download"):
                corpus.JOB.start([body["id"]])
            return self._json({"ok": True, "sources": corpus.installed_status()})

        if path == "/api/content/add":
            body = self._body_json()
            try:
                src = corpus.add_custom_source(body)
            except ValueError as exc:
                return self._json({"error": str(exc)}, status=400)
            corpus.JOB.start([src["id"]])
            return self._json({"ok": True, "source": src})

        if path == "/api/content/import":
            body = self._body_json()
            try:
                res = corpus.import_local(body.get("path", ""),
                                          title=body.get("title"),
                                          domain=body.get("domain", "reference"))
            except ValueError as exc:
                return self._json({"error": str(exc)}, status=400)
            return self._json({"ok": True, **res})

        if path == "/api/reindex":
            started = index.JOB.start()
            return self._json({"started": started, "status": index.JOB.snapshot()})

        if path == "/api/fs/write":
            b = self._body_json()
            return self._fs(lambda: studio.write_file(b.get("root", "workspace"),
                                                      b.get("path", ""), b.get("content", "")))
        if path == "/api/fs/mkdir":
            b = self._body_json()
            return self._fs(lambda: studio.mkdir(b.get("root", "workspace"), b.get("path", "")))
        if path == "/api/fs/delete":
            b = self._body_json()
            return self._fs(lambda: studio.delete(b.get("root", "workspace"), b.get("path", "")))
        if path == "/api/fs/rename":
            b = self._body_json()
            return self._fs(lambda: studio.rename(b.get("root", "workspace"),
                                                  b.get("from", ""), b.get("to", "")))

        if path == "/api/corpus/download":
            body = self._body_json()
            ids = body.get("ids")
            if not ids and body.get("tier"):
                ids = [s["id"] for s in corpus.load_catalog()
                       if s.get("tier") == body["tier"]]
            ids = ids or []
            started = corpus.JOB.start(ids)
            return self._json({"started": started, "ids": ids})

        if path == "/api/corpus/verify":
            return self._json(corpus.verify())

        return self._json({"error": "not found"}, status=404)

    # -- static serving --
    def _serve_static(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        # normalize and prevent traversal
        clean = posixpath.normpath(urllib.parse.unquote(path)).lstrip("/")
        target = (config.WEB_DIR / clean).resolve()
        try:
            target.relative_to(config.WEB_DIR.resolve())
        except ValueError:
            return self._json({"error": "forbidden"}, status=403)
        if not target.is_file():
            # SPA fallback to index.html for unknown non-API routes
            target = config.WEB_DIR / "index.html"
            if not target.is_file():
                return self._json({"error": "web UI not found"}, status=404)
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass


def _lan_ip():
    """Best-effort LAN address so phones on the same network can connect.
    The UDP 'connection' never sends a packet — it just selects a route."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return None if ip.startswith("127.") else ip
    except OSError:
        return None


def serve(host=None, port=None):
    config.ensure_dirs()
    conn = db.connect()
    db.init_schema(conn)
    st = db.stats(conn)
    stale = (st["chunks"] > 0
             and db.get_meta(conn, "schema_version", "1") != str(db.SCHEMA_VERSION))
    conn.close()
    if st["chunks"] == 0:
        # First run (or wiped NEEDFIRE_HOME): build the seed index so the server
        # can actually answer instead of returning "Not in the available sources."
        print("No index found — building the seed index (one-time)…")
        from . import index as index_mod
        index_mod.build()
    elif stale:
        print("  [warn] index was built by an older version of Needfire — the "
              "document reader may be degraded. Rebuild with `python3 -m needfire index`.")
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    host = host or config.HOST
    port = port or config.PORT
    try:
        httpd = ThreadingHTTPServer((host, port), NeedfireHandler)
    except OSError as exc:
        print(f"Could not start: port {port} is already in use ({exc}).")
        print("Another Needfire (or another program) may be running. Either use "
              "that one, or set NEEDFIRE_PORT to a different number (e.g. 8899) "
              "and start again.")
        raise SystemExit(1)
    backend = "ollama" if embed.ollama_available() else "hash (stdlib)"
    print(f"Needfire v{__version__} is running.")
    print(f"  On this computer:            http://localhost:{port}")
    lan_ip = _lan_ip() if host in ("0.0.0.0", "::") else None
    if lan_ip:
        print(f"  From phones on this network: http://{lan_ip}:{port}")
    print(f"  embeddings backend: {backend}   models: "
          f"{'available' if models.available() else 'none (sources-only mode)'}")
    print("  Press Ctrl+C to stop (or just close this window).")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
        httpd.shutdown()
