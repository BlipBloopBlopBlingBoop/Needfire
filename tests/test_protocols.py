"""Integrity tests for web/data/protocols.json — the emergency-mode data.

These can't check medical truth (a human review pass diffs each protocol
against its source document), but they guarantee the player can never hit a
dangling step, a missing source, or a malformed timer in the field.
"""
import json
import re
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

PROTOCOLS = REPO / "web" / "data" / "protocols.json"
SEED_DOCS = REPO / "seed-corpus" / "documents"
ICONS_JS = REPO / "web" / "assets" / "icons.js"
SW_JS = REPO / "web" / "sw.js"
WEB = REPO / "web"

DISCLAIMER = ("If you can call your local emergency number (911 / 112), do it "
              "now. General reference only, not a substitute for trained "
              "medical care — hand over to a trained responder as soon as "
              "one is available.")


def load():
    return json.loads(PROTOCOLS.read_text(encoding="utf-8"))


class TestProtocolData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load()
        cls.protocols = cls.data["protocols"]

    def test_version_and_count(self):
        self.assertEqual(self.data["version"], 1)
        self.assertGreaterEqual(len(self.protocols), 12)

    def test_ids_unique_and_slugs(self):
        ids = [p["id"] for p in self.protocols]
        self.assertEqual(len(ids), len(set(ids)))
        for i in ids:
            self.assertRegex(i, r"^[a-z][a-z0-9-]*$")

    def test_required_fields(self):
        for p in self.protocols:
            for key in ("id", "title", "short", "icon", "severity", "keywords",
                        "source_doc", "disclaimer", "start", "steps"):
                self.assertIn(key, p, f"{p.get('id')} missing {key}")
            self.assertEqual(p["disclaimer"], DISCLAIMER, p["id"])
            self.assertLessEqual(len(p["short"]), 12, p["id"])
            self.assertIn(p["severity"], ("life-threat", "urgent", "serious"))
            self.assertGreaterEqual(len(p["keywords"]), 3, p["id"])

    def test_graph_integrity(self):
        for p in self.protocols:
            steps = {s["id"]: s for s in p["steps"]}
            self.assertEqual(len(steps), len(p["steps"]), f"{p['id']}: dup step ids")
            self.assertIn(p["start"], steps, p["id"])

            def targets(step):
                out = []
                if step.get("next"):
                    out.append(step["next"])
                for o in step.get("options", []):
                    out.append(o["goto"])
                if step.get("loop"):
                    out.append(step["loop"]["back_to"])
                return out

            order = [s["id"] for s in p["steps"]]
            for s in p["steps"]:
                for t in targets(s):
                    self.assertTrue(t == "END" or t in steps,
                                    f"{p['id']}.{s['id']} -> dangling '{t}'")
                if s["type"] == "decision":
                    self.assertTrue(2 <= len(s.get("options", [])) <= 4,
                                    f"{p['id']}.{s['id']}: decisions need 2-4 options")
                else:
                    self.assertNotIn("options", s, f"{p['id']}.{s['id']}")
                if s["type"] == "loop":
                    self.assertIn("loop", s, f"{p['id']}.{s['id']}")

            # BFS from start must reach every step (implicit next = array order)
            seen, queue = set(), [p["start"]]
            while queue:
                sid = queue.pop()
                if sid in seen or sid == "END":
                    continue
                seen.add(sid)
                step = steps[sid]
                nxt = targets(step)
                if not step.get("next") and step["type"] != "decision":
                    i = order.index(sid)
                    if i + 1 < len(order):
                        nxt.append(order[i + 1])
                queue.extend(nxt)
            unreachable = set(steps) - seen
            self.assertFalse(unreachable, f"{p['id']}: unreachable {unreachable}")

    def test_timers_well_formed(self):
        for p in self.protocols:
            for s in p["steps"]:
                t = s.get("timer")
                if not t:
                    continue
                where = f"{p['id']}.{s['id']}"
                self.assertIn(t["kind"], ("metronome", "countdown", "stamp"), where)
                if t["kind"] == "metronome":
                    self.assertTrue(100 <= t["bpm"] <= 120, where)
                    self.assertFalse(t.get("auto"), where + ": metronomes never auto (iOS)")
                if t["kind"] == "countdown":
                    self.assertGreater(t["seconds"], 0, where)
                if t["kind"] == "stamp":
                    self.assertIsInstance(t.get("persist", False), bool, where)

    def test_source_docs_exist(self):
        from needfire import config
        manifest = json.loads((config.SEED_DIR / "seed-manifest.json").read_text(encoding="utf-8"))
        manifest_files = {d["file"] for d in manifest["documents"]}
        for p in self.protocols:
            self.assertTrue((SEED_DOCS / p["source_doc"]).exists(),
                            f"{p['id']}: missing {p['source_doc']}")
            self.assertIn(p["source_doc"], manifest_files, p["id"])

    def test_icons_exist_in_sprite(self):
        sprite = ICONS_JS.read_text(encoding="utf-8")
        icon_ids = set(re.findall(r"^\s{4}([a-z][\w-]*):\s*'", sprite, re.M))
        for p in self.protocols:
            self.assertIn(p["icon"], icon_ids, f"{p['id']}: icon '{p['icon']}' not in sprite")

    def test_sw_shell_files_exist(self):
        m = re.search(r"const SHELL = \[(.*?)\];", SW_JS.read_text(encoding="utf-8"), re.S)
        self.assertIsNotNone(m)
        for url in re.findall(r"'(/[^']*)'", m.group(1)):
            if url == "/":
                continue
            self.assertTrue((WEB / url.lstrip("/")).is_file(),
                            f"sw.js precaches missing file {url}")


class TestProtocolsServed(unittest.TestCase):
    def test_served_as_json(self):
        import os
        import tempfile
        import threading
        import urllib.request
        os.environ.setdefault("NEEDFIRE_HOME", tempfile.mkdtemp(prefix="needfire-test-"))
        from http.server import ThreadingHTTPServer
        from needfire import config, db, server
        config.ensure_dirs()  # standalone runs start from an empty home
        conn = db.connect(); db.init_schema(conn); conn.close()
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.NeedfireHandler)
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/data/protocols.json", timeout=5) as r:
                self.assertEqual(r.status, 200)
                self.assertIn("json", r.headers.get("Content-Type", ""))
                json.load(r)
        finally:
            httpd.shutdown()


if __name__ == "__main__":
    unittest.main()
