"""Stdlib test suite for Needfire. No third-party packages, no external network
(download tests use a throwaway local HTTP server).

Run:  python3 -m unittest discover -s tests -v
"""
import hashlib
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.request
from pathlib import Path

# Make the repo importable and isolate NEEDFIRE_HOME to a temp dir per run.
REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
_TMP = tempfile.mkdtemp(prefix="needfire-test-")
os.environ["NEEDFIRE_HOME"] = _TMP

from needfire import config, db, embed, index, power, rag, router, corpus  # noqa: E402


class TestEmbedding(unittest.TestCase):
    def test_hash_embedding_is_deterministic_and_normalized(self):
        a = embed.embed_hash("water purification boiling", dims=128)
        b = embed.embed_hash("water purification boiling", dims=128)
        self.assertEqual(a, b)
        norm = sum(x * x for x in a) ** 0.5
        self.assertAlmostEqual(norm, 1.0, places=5)

    def test_similar_text_scores_higher(self):
        q = embed.embed_hash("how to purify water", dims=256)
        near = embed.embed_hash("water purification methods boiling", dims=256)
        far = embed.embed_hash("radiation shielding gamma lead", dims=256)
        dot = lambda x, y: sum(i * j for i, j in zip(x, y))
        self.assertGreater(dot(q, near), dot(q, far))


class TestChunking(unittest.TestCase):
    def test_chunks_cover_text_with_overlap(self):
        words = " ".join(f"w{i}" for i in range(2000))
        chunks = index.chunk_text(words, chunk_tokens=200)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(c[1] for c in chunks))

    def test_frontmatter_parsing(self):
        meta, body = index._parse_frontmatter(
            "---\ntitle: Test Doc\ndomain: water\n---\nHello body text here."
        )
        self.assertEqual(meta["title"], "Test Doc")
        self.assertEqual(meta["domain"], "water")
        self.assertIn("Hello body", body)


class TestRouter(unittest.TestCase):
    def test_medical_is_critical(self):
        cat, crit, dom = router.classify("how do I stop severe bleeding")
        self.assertEqual(cat, "MEDICAL")
        self.assertTrue(crit)
        self.assertEqual(dom, "medicine")

    def test_general_not_critical(self):
        cat, crit, _ = router.classify("tell me about the history of maps")
        self.assertFalse(crit)

    def test_electrical_hints_electronics_not_medicine(self):
        # regression: voltage/amp queries used to be hinted (and hard-filtered)
        # to the medicine domain, hiding every electronics document
        for q in ("how do I wire a 12 volt circuit",
                  "what amperage can this wire carry",
                  "safe voltage for a battery bank"):
            _cat, _crit, dom = router.classify(q)
            self.assertEqual(dom, "electronics", q)

    def test_burn_hints_medicine(self):
        cat, crit, dom = router.classify("how do I treat a burn")
        self.assertEqual((cat, crit, dom), ("MEDICAL", True, "medicine"))

    def test_bare_shock_gets_no_domain_hint(self):
        # "shock" is ambiguous (electric vs hypovolemic) — still critical,
        # but must not bias retrieval toward either domain
        cat, crit, dom = router.classify("someone is in shock what do I do")
        self.assertEqual(cat, "MEDICAL")
        self.assertTrue(crit)
        self.assertIsNone(dom)

    def test_prompt_contains_sources_and_rules(self):
        chunks = [{"text": "boil water 1 minute", "doc_title": "Water", "domain": "water"}]
        p = router.build_prompt("how to purify", chunks, True)
        self.assertIn("SOURCES:", p)
        self.assertIn("boil water", p)
        self.assertIn("Not in the available sources", p)


class TestIndexAndRetrieval(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config.ensure_dirs()
        index.build(include_seed=True, embed_backend="hash")

    def test_index_built_chunks(self):
        conn = db.connect()
        st = db.stats(conn)
        conn.close()
        self.assertGreaterEqual(st["documents"], 10)
        self.assertGreater(st["chunks"], 0)
        self.assertIn("medicine", st["by_domain"])

    def test_vector_retrieval_finds_water(self):
        conn = db.connect()
        chunks, how = rag.retrieve(conn, "how do I purify dirty water")
        conn.close()
        self.assertTrue(chunks)
        titles = " ".join(c["doc_title"].lower() for c in chunks)
        self.assertIn("water", titles)

    def test_keyword_fallback_works(self):
        conn = db.connect()
        res = rag.keyword_search(conn, "radiation shielding gamma")
        conn.close()
        self.assertTrue(res)
        self.assertTrue(any("radiation" in c["doc_title"].lower() for c in res))

    def test_get_document_reassembles(self):
        conn = db.connect()
        doc = rag.get_document(conn, "water-purification.md")
        conn.close()
        self.assertIsNotNone(doc)
        self.assertIn("boil", doc["text"].lower())

    def test_document_text_preserves_structure(self):
        # ingestion must keep newlines/markdown so the reader can render it
        conn = db.connect()
        doc = rag.get_document(conn, "water-purification.md")
        conn.close()
        self.assertIn("\n", doc["text"])
        self.assertIn("##", doc["text"])

    def test_domain_hint_is_soft_not_filter(self):
        # a wrong hint must not hide the right document (the old hard filter did)
        conn = db.connect()
        chunks, _how = rag.retrieve(conn, "how do I wire a simple 12 volt circuit",
                                    domain="medicine")
        conn.close()
        text = " ".join((c["doc_title"] + " " + c["text"]).lower() for c in chunks)
        self.assertTrue("circuit" in text or "electrical" in text,
                        "electronics content should surface despite a wrong hint")

    def test_classify_to_retrieve_end_to_end_electrical(self):
        conn = db.connect()
        _cat, _crit, dom = router.classify("how do I wire a 12 volt circuit")
        chunks, _how = rag.retrieve(conn, "how do I wire a 12 volt circuit", domain=dom)
        conn.close()
        titles = " ".join(c["doc_title"].lower() for c in chunks)
        self.assertTrue("circuit" in titles or "electrical" in titles, titles)

    def test_critical_topics_have_coverage(self):
        # every advertised critical keyword must retrieve at least one seed doc
        # that actually mentions it — a regression guard on corpus coverage
        keywords = ["cpr", "bleeding", "burn", "fracture", "poison", "venom",
                    "seizure", "allergic", "choking", "drowning", "snakebite",
                    "frostbite", "hypothermia", "radiation", "voltage", "acid",
                    "antibiotic", "dose", "stroke", "chest", "diabetic",
                    "asthma", "unconscious", "concussion", "sprain", "tick",
                    "battery", "compost", "shelter", "radio"]
        conn = db.connect()
        missing = []
        for kw in keywords:
            chunks, _how = rag.retrieve(conn, f"how do I deal with {kw}")
            hit = any(kw in (c["doc_title"] + " " + c["text"]).lower() for c in chunks)
            if not hit:
                missing.append(kw)
        conn.close()
        self.assertFalse(missing, f"no seed coverage retrieved for: {missing}")


class TestMultiChunkDocument(unittest.TestCase):
    """Documents bigger than one chunk must reassemble without duplication."""

    def test_long_doc_round_trips_exactly(self):
        paras = ["Paragraph %d. %s." % (i, " ".join(f"word{i}x{j}" for j in range(60)))
                 for i in range(30)]
        original = "\n\n".join(paras)
        docs_dir = config.DOCS_DIR
        docs_dir.mkdir(parents=True, exist_ok=True)
        (docs_dir / "long-test-doc.md").write_text(
            "---\ntitle: Long Test Doc\ndomain: reference\n---\n" + original)
        try:
            index.build(include_seed=True, embed_backend="hash")
            conn = db.connect()
            n_chunks = conn.execute(
                "SELECT COUNT(*) c FROM chunks WHERE doc_id='long-test-doc.md'"
            ).fetchone()["c"]
            doc = rag.get_document(conn, "long-test-doc.md")
            conn.close()
            self.assertGreater(n_chunks, 1, "test doc should span multiple chunks")
            self.assertEqual(doc["text"], index.normalize_text(original),
                             "reader text must equal the source, no overlap dupes")
        finally:
            (docs_dir / "long-test-doc.md").unlink()
            index.build(include_seed=True, embed_backend="hash")


class TestStripMd(unittest.TestCase):
    def test_strip_md_removes_syntax(self):
        md = ("# Title\n\n**Bold** and *italic* and `code`.\n\n"
              "- item one\n- item two\n\n> quoted line\n\n[link](https://x.example)")
        out = rag.strip_md(md)
        for token in ("#", "**", "`", "- item", ">", "]("):
            self.assertNotIn(token, out)
        for word in ("Title", "Bold", "italic", "code", "item one", "quoted", "link"):
            self.assertIn(word, out)


class TestSeedManifest(unittest.TestCase):
    def test_seed_hashes_match_files(self):
        data = json.loads((config.SEED_DIR / "seed-manifest.json").read_text(encoding="utf-8"))
        docs = data["documents"]
        self.assertGreaterEqual(len(docs), 40)
        for d in docs:
            path = config.SEED_DIR / "documents" / d["file"]
            self.assertTrue(path.exists(), d["file"])
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            self.assertEqual(digest, d["sha256"],
                             f"{d['file']} changed — run `make seed-manifest`")

    def test_verify_seed_reports_all_ok(self):
        report = corpus.verify_seed()
        self.assertFalse(report["missing"])
        self.assertFalse(report["changed"])
        self.assertGreaterEqual(len(report["ok"]), 40)


class TestDownloadResume(unittest.TestCase):
    """A server that ignores Range and replies 200 must not corrupt the file."""

    def test_resume_against_200_restarts_clean(self):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        payload = b"A" * 4096 + b"B" * 4096

        class NoRange(BaseHTTPRequestHandler):
            def do_GET(self):  # always the FULL body, ignoring Range
                self.send_response(200)
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *a):
                pass

        httpd = ThreadingHTTPServer(("127.0.0.1", 0), NoRange)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        port = httpd.server_address[1]
        try:
            source = {"id": "test-dl", "title": "t", "tier": "C1", "domain": "reference",
                      "license": "CC0", "filename": "resume-test.bin", "dest": "docs",
                      "url": f"http://127.0.0.1:{port}/file.bin"}
            dest = corpus._dest_for(source)
            # simulate an interrupted earlier download
            dest.with_suffix(dest.suffix + ".part").write_bytes(payload[:1000])
            job = corpus.DownloadJob()
            job.items = {"test-dl": {"state": "queued", "bytes": 0, "total": 0, "error": None}}
            entry = job._download_one("test-dl", source)
            self.assertEqual(dest.read_bytes(), payload,
                             "partial must be discarded when the server sends 200")
            self.assertEqual(entry["sha256"], hashlib.sha256(payload).hexdigest())
            dest.unlink()
        finally:
            httpd.shutdown()


class TestAuthPolicy(unittest.TestCase):
    def test_short_password_rejected(self):
        from needfire import auth
        # the length check runs before the already-set check, so this is safe
        # regardless of whether another test has set a password
        self.assertRaises(ValueError, auth.set_password, "short")
        self.assertRaises(ValueError, auth.set_password, "")


class TestUrlPolicy(unittest.TestCase):
    """https always OK; plain http only for LAN mirrors or with a pinned hash."""

    def test_https_allowed(self):
        corpus._check_url_policy("https://download.kiwix.org/zim/x.zim")

    def test_public_http_rejected_without_pin(self):
        self.assertRaises(ValueError, corpus._check_url_policy,
                          "http://example.com/x.zim")

    def test_public_http_allowed_with_pin(self):
        corpus._check_url_policy("http://example.com/x.zim", pinned_sha="ab" * 32)

    def test_lan_http_allowed(self):
        for url in ("http://127.0.0.1:8000/x.zim", "http://localhost/x.zim",
                    "http://192.168.1.10/x.zim", "http://10.0.0.5/x.zim",
                    "http://bothy.local/x.zim"):
            corpus._check_url_policy(url)

    def test_other_schemes_rejected(self):
        for url in ("file:///etc/passwd", "ftp://example.com/x"):
            self.assertRaises(ValueError, corpus._check_url_policy, url)

    def test_set_source_url_enforces_policy(self):
        self.assertRaises(ValueError, corpus.set_source_url,
                          "wikimed-en", "http://example.com/x.zim")
        cat = corpus.set_source_url("wikimed-en", "https://example.com/x.zim",
                                    sha256="AB" * 32)
        entry = next(s for s in cat if s["id"] == "wikimed-en")
        self.assertEqual(entry["url"], "https://example.com/x.zim")
        self.assertEqual(entry["sha256"], "ab" * 32)  # normalized lowercase
        # clearing the pin removes it from the merged catalog
        cat = corpus.set_source_url("wikimed-en", "https://example.com/x.zim")
        entry = next(s for s in cat if s["id"] == "wikimed-en")
        self.assertIsNone(entry.get("sha256"))


class TestCorpusResolve(unittest.TestCase):
    """One-click resolution: find the current dated Kiwix build from a directory
    listing, no hand-pasted URL."""

    @classmethod
    def setUpClass(cls):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        cls.sha = "ab" * 32
        listing = (
            b'<html><body>'
            b'<a href="wikimed_en_all_maxi_2024-05.zim">may</a>'
            b'<a href="wikimed_en_all_maxi_2024-11.zim">nov</a>'   # newest
            b'<a href="wikimed_en_all_maxi_2023-01.zim">old</a>'
            b'<a href="other_project_2025-01.zim">unrelated</a>'
            b'</body></html>'
        )
        sha_body = (cls.sha + "  wikimed_en_all_maxi_2024-11.zim\n").encode()

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path.endswith(".sha256"):
                    body = sha_body
                elif self.path.rstrip("/").endswith("/dir"):
                    body = listing
                else:
                    self.send_response(404); self.end_headers(); return
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a):
                pass

        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.dir = f"http://127.0.0.1:{cls.httpd.server_address[1]}/dir"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def test_resolves_latest_dated_build(self):
        url = corpus._resolve_kiwix_latest(self.dir, "wikimed_en_all_maxi")
        self.assertTrue(url.endswith("wikimed_en_all_maxi_2024-11.zim"), url)

    def test_resolve_download_url_returns_url_and_autopinned_sha(self):
        src = {"id": "x", "dir": self.dir, "base": "wikimed_en_all_maxi", "url": None}
        url, sha = corpus.resolve_download_url(src)
        self.assertTrue(url.endswith("2024-11.zim"))
        self.assertEqual(sha, self.sha)  # pulled from the .sha256 sidecar

    def test_explicit_url_wins_over_lookup(self):
        src = {"id": "x", "dir": self.dir, "base": "wikimed_en_all_maxi",
               "url": "https://example.com/pinned.zim", "sha256": None}
        url, _sha = corpus.resolve_download_url(src)
        self.assertEqual(url, "https://example.com/pinned.zim")

    def test_is_resolvable(self):
        self.assertTrue(corpus.is_resolvable({"dir": self.dir, "base": "b"}))
        self.assertTrue(corpus.is_resolvable({"url": "https://x/y.zim"}))
        self.assertFalse(corpus.is_resolvable({"url": "https://x/<placeholder>"}))
        self.assertFalse(corpus.is_resolvable({"url": None}))

    def test_unresolvable_source_raises(self):
        with self.assertRaises(ValueError):
            corpus.resolve_download_url({"id": "x", "url": None})

    def test_catalog_kiwix_sources_are_one_click(self):
        # every shipped Kiwix source resolves with no pasting; only the
        # region-specific map extract still needs a manual URL
        need_url = [s["id"] for s in corpus.load_catalog()
                    if not corpus.is_resolvable(s)]
        self.assertEqual(need_url, ["osm-region"], need_url)


class TestDownloadPinned(unittest.TestCase):
    """A pinned sha256 is enforced before the file lands in the library."""

    @classmethod
    def setUpClass(cls):
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

        cls.payload = b"needfire" * 512

        class Server(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header("Content-Length", str(len(cls.payload)))
                self.end_headers()
                self.wfile.write(cls.payload)

            def log_message(self, *a):
                pass

        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Server)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.httpd.server_address[1]}/file.bin"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def _source(self, sid, sha256):
        return {"id": sid, "title": "t", "tier": "C1", "domain": "reference",
                "license": "CC0", "filename": f"{sid}.bin", "dest": "docs",
                "url": self.url, "sha256": sha256}

    def _job(self, sid):
        job = corpus.DownloadJob()
        job.items = {sid: {"state": "queued", "bytes": 0, "total": 0, "error": None}}
        return job

    def test_correct_pin_succeeds(self):
        good = hashlib.sha256(self.payload).hexdigest()
        source = self._source("pin-good", good)
        entry = self._job("pin-good")._download_one("pin-good", source)
        dest = corpus._dest_for(source)
        self.assertEqual(entry["sha256"], good)
        self.assertTrue(dest.exists())
        dest.unlink()

    def test_wrong_pin_discards_download(self):
        source = self._source("pin-bad", "0" * 64)
        dest = corpus._dest_for(source)
        with self.assertRaises(ValueError):
            self._job("pin-bad")._download_one("pin-bad", source)
        self.assertFalse(dest.exists(), "mismatched download must not land")
        self.assertFalse(dest.with_suffix(dest.suffix + ".part").exists(),
                         "corrupt .part must be discarded, not resumed")


class TestPower(unittest.TestCase):
    def test_cpu_percent_thread_safe_smoke(self):
        errors = []

        def hammer():
            try:
                for _ in range(50):
                    v = power.cpu_percent()
                    if v is not None:
                        assert isinstance(v, float)
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=hammer) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertFalse(errors)


class TestCorpusCatalog(unittest.TestCase):
    def test_catalog_loads_and_is_well_formed(self):
        cat = corpus.load_catalog()
        self.assertTrue(cat)
        for s in cat:
            for key in ("id", "title", "tier", "domain", "license", "filename", "url"):
                self.assertIn(key, s, f"{s.get('id')} missing {key}")

    def test_installed_status_marks_absent(self):
        st = corpus.installed_status()
        # nothing downloaded in the test home → all not installed
        self.assertTrue(all(s["installed"] is False for s in st))


class TestHTTPSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from needfire import server
        from http.server import ThreadingHTTPServer
        index.build(include_seed=True, embed_backend="hash")
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.NeedfireHandler)
        cls.port = cls.httpd.server_address[1]
        cls.t = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.t.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def _get(self, path):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=5) as r:
            return r.status, r.read()

    def test_health(self):
        status, body = self._get("/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["ok"])

    def test_categories(self):
        _, body = self._get("/api/categories")
        cats = json.loads(body)["categories"]
        self.assertEqual(len(cats), len(config.DOMAINS))

    def test_search_returns_results(self):
        _, body = self._get("/api/search?q=fire%20starting")
        data = json.loads(body)
        self.assertTrue(data["results"])

    def test_index_html_served(self):
        status, body = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn(b"NEEDFIRE", body)
        # iOS/Android installability (Add to Home Screen → offline emergency mode)
        self.assertIn(b"apple-mobile-web-app-capable", body)
        self.assertIn(b"manifest.webmanifest", body)

    def test_ask_sse_streams_sources_only(self):
        # No model in test env → meta + sources-only answer + done.
        with urllib.request.urlopen(
            f"http://127.0.0.1:{self.port}/api/ask?q=how%20to%20stop%20bleeding", timeout=10
        ) as r:
            text = r.read().decode()
        self.assertIn("event: meta", text)
        self.assertIn("sources-only", text)
        self.assertEqual(text.count("event: done"), 1,
                         "exactly one done event per ask stream")

    def _get_status(self, path):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=5) as r:
                return r.status
        except urllib.error.HTTPError as e:
            return e.code

    def test_domain_listing(self):
        status, body = self._get("/api/domain?d=medicine")
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertGreaterEqual(len(data["documents"]), 10)
        self.assertTrue(all("doc_id" in d for d in data["documents"]))

    def test_domain_unknown_is_404(self):
        self.assertEqual(self._get_status("/api/domain?d=nonsense"), 404)

    def test_domain_missing_param_is_400(self):
        self.assertEqual(self._get_status("/api/domain"), 400)

    def test_unknown_api_path_is_404_not_spa(self):
        self.assertEqual(self._get_status("/api/does-not-exist"), 404)

    def test_reindex_status_is_open_read_only(self):
        # the status poll is read-only and stays anonymous, like /api/status
        self.assertEqual(self._get_status("/api/reindex/status"), 200)

    def test_source_missing_is_404(self):
        self.assertEqual(self._get_status("/api/source?doc=nope.md"), 404)

    def test_path_traversal_leaks_nothing(self):
        # normpath collapses the dots (SPA fallback) or the resolver 403s —
        # either way, file contents outside web/ must never be served
        for attempt in ("/%2e%2e/%2e%2e/etc/passwd", "/../../etc/passwd",
                        "/..%2f..%2fetc%2fpasswd"):
            try:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{self.port}{attempt}", timeout=5
                ) as r:
                    body = r.read()
            except urllib.error.HTTPError as e:
                self.assertIn(e.code, (403, 404))
                continue
            self.assertNotIn(b"root:", body, attempt)

    def test_source_card_snippets_are_plain_text(self):
        _, body = self._get("/api/search?q=water%20purification")
        for res in json.loads(body)["results"]:
            self.assertNotIn("##", res["snippet"])
            self.assertNotIn("**", res["snippet"])

    def test_abrupt_client_disconnect_is_not_an_error(self):
        # A client that sends a request and slams the socket shut (browser
        # preconnect, health-poll timeout — WinError 10053 on Windows) must
        # not print a traceback or wedge the server.
        import io
        import socket
        import struct
        import time
        stderr = sys.stderr
        captured = io.StringIO()
        sys.stderr = captured  # socketserver prints handler tracebacks here
        try:
            for _ in range(3):
                s = socket.create_connection(("127.0.0.1", self.port), timeout=5)
                s.sendall(b"GET /api/health HTTP/1.1\r\nHost: x\r\n\r\n")
                # RST on close (SO_LINGER 0) = hard abort without reading
                s.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER,
                             struct.pack("ii", 1, 0))
                s.close()
            time.sleep(0.3)  # let handler threads finish
        finally:
            sys.stderr = stderr
        self.assertNotIn("Traceback", captured.getvalue())
        # the server must still answer normally afterwards
        status, body = self._get("/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["ok"])


class TestStandaloneComputer(unittest.TestCase):
    """Auth gate, file API, and command runner for the Studio/system features."""

    @classmethod
    def setUpClass(cls):
        import http.cookiejar
        from needfire import server
        from http.server import ThreadingHTTPServer
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.NeedfireHandler)
        cls.port = cls.httpd.server_address[1]
        cls.base = f"http://127.0.0.1:{cls.port}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.jar = http.cookiejar.CookieJar()
        cls.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(cls.jar))

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def _req(self, path, method="GET", body=None, opener=None, anon=False):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        op = urllib.request.urlopen if anon else (opener or self.opener).open
        try:
            with op(req, timeout=5) as r:
                return r.status, json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")

    def test_01_gate_before_setup(self):
        st, body = self._req("/api/auth/status")
        self.assertTrue(body["needs_setup"])
        # protected endpoints refused before auth
        st, _ = self._req("/api/fs/list?root=workspace", anon=True)
        self.assertEqual(st, 401)
        st, _ = self._req("/api/reindex", "POST", {}, anon=True)
        self.assertEqual(st, 401)

    def test_02_setup_then_authed(self):
        st, body = self._req("/api/auth/setup", "POST", {"password": "bothy-pass"})
        self.assertEqual(st, 200)
        self.assertTrue(body["ok"])
        # cookie jar now holds a session → protected endpoints work
        st, _ = self._req("/api/fs/list?root=workspace")
        self.assertEqual(st, 200)

    def test_03_setup_is_one_shot(self):
        st, _ = self._req("/api/auth/setup", "POST", {"password": "other"})
        self.assertEqual(st, 409)

    def test_04_login_wrong_then_right(self):
        import http.cookiejar
        jar = http.cookiejar.CookieJar()
        op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        st, _ = self._req("/api/auth/login", "POST", {"password": "nope"}, opener=op)
        self.assertEqual(st, 401)
        st, _ = self._req("/api/auth/login", "POST", {"password": "bothy-pass"}, opener=op)
        self.assertEqual(st, 200)
        st, _ = self._req("/api/fs/list?root=workspace", opener=op)
        self.assertEqual(st, 200)

    def test_05_fs_write_read_list_roundtrip(self):
        st, _ = self._req("/api/fs/write", "POST",
                          {"root": "workspace", "path": "sub/note.txt", "content": "hello fs"})
        self.assertEqual(st, 200)
        st, body = self._req("/api/fs/read?root=workspace&path=sub/note.txt")
        self.assertEqual(body["content"], "hello fs")
        st, body = self._req("/api/fs/list?root=workspace&path=sub")
        self.assertIn("note.txt", [e["name"] for e in body["entries"]])

    def test_06_fs_traversal_blocked(self):
        st, _ = self._req("/api/fs/read?root=workspace&path=../../etc/passwd")
        self.assertEqual(st, 403)

    def test_07_run_command_streams(self):
        # GET SSE: read the raw stream and assert our echo shows up + done
        req = urllib.request.Request(
            self.base + "/api/run?cmd=" + urllib.parse.quote("echo needfire-run-ok"))
        with self.opener.open(req, timeout=10) as r:
            text = r.read().decode()
        self.assertIn("needfire-run-ok", text)
        self.assertEqual(text.count("event: done"), 1,
                         "exactly one done event per run stream")

    def test_08_run_timeout_kills(self):
        import time
        req = urllib.request.Request(
            self.base + "/api/run?timeout=1&cmd=" + urllib.parse.quote("sleep 8"))
        start = time.time()
        with self.opener.open(req, timeout=10) as r:
            text = r.read().decode()
        self.assertLess(time.time() - start, 6)  # killed well before 8s
        self.assertIn("time limit", text)

    def test_09_models_shape_ollama_absent(self):
        st, body = self._req("/api/models")
        self.assertEqual(st, 200)
        self.assertIn("ollama_up", body)
        self.assertTrue(len(body["recommended"]) >= 5)
        self.assertIn("tiny", body["roles"])

    def test_10_content_url_rejects_bad_scheme(self):
        st, _ = self._req("/api/content/url", "POST",
                          {"id": "wikimed-en", "url": "file:///etc/passwd"})
        self.assertEqual(st, 400)

    def test_11_content_import_and_reindex(self):
        import tempfile
        p = os.path.join(tempfile.mkdtemp(), "imported.md")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write("---\ntitle: Imported Note\ndomain: reference\n---\n"
                     "# Imported Note\n\nThis was imported from disk for testing.")
        st, body = self._req("/api/content/import", "POST", {"path": p})
        self.assertEqual(st, 200)
        self.assertTrue(body["ok"])
        st, _ = self._req("/api/reindex", "POST", {})
        self.assertEqual(st, 200)
        # wait for the reindex job to finish
        import time
        for _ in range(60):
            _st, snap = self._req("/api/reindex/status")
            if snap.get("done"):
                break
            time.sleep(0.5)
        self.assertTrue(snap["done"])
        self.assertIsNone(snap["error"])


if __name__ == "__main__":
    unittest.main()
