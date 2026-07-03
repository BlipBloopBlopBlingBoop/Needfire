#!/usr/bin/env python3
"""Wait for Needfire to answer on localhost, then open the browser.

Spawned in the background by the Start-Needfire launchers so the browser opens
itself once the server is up (the FIRST start builds the library index, which
can take a minute). Never fails loudly: on a headless machine webbrowser.open
simply returns False, and this script always exits 0.
"""
import sys
import time
import urllib.request
import webbrowser

port = sys.argv[1] if len(sys.argv) > 1 else "8848"
deadline = time.time() + 180
while time.time() < deadline:
    try:
        # read the body and close cleanly — aborting mid-response makes the
        # server log connection errors on Windows
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health",
                                    timeout=3) as r:
            r.read()
        break
    except Exception:
        time.sleep(0.5)
try:
    webbrowser.open(f"http://localhost:{port}/")
except Exception:
    pass
sys.exit(0)
