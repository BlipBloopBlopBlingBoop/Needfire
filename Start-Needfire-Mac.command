#!/bin/bash
# ============================================================================
# Needfire launcher for macOS.
#
# FIRST TIME after downloading: macOS blocks double-clicked downloads.
#   RIGHT-CLICK (or Control-click) this file, choose "Open",
#   then click "Open" in the warning dialog. Only needed once.
# ============================================================================
cd "$(dirname "$0")"
export PYTHONUTF8=1
PORT="${NEEDFIRE_PORT:-8848}"

if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)' 2>/dev/null; then
  cat <<'MSG'
  ==========================================================
   macOS needs its free developer tools to provide Python.

   A dialog should appear now - click "Install" and wait for
   it to finish (a few minutes), then double-click this file
   again.

   If no dialog appears, install Python directly from
   https://www.python.org/downloads/ instead.
  ==========================================================
MSG
  xcode-select --install 2>/dev/null
  read -r -p "Press Return to close this window. "
  exit 1
fi

# Already running? Just open the browser.
if python3 -c "import urllib.request as u; u.urlopen('http://127.0.0.1:$PORT/api/health', timeout=1)" 2>/dev/null; then
  echo "Needfire is already running - opening your browser."
  open "http://localhost:$PORT/"
  exit 0
fi

# Port taken by something else?
if ! python3 -c "import socket; s=socket.socket(); s.bind(('0.0.0.0', $PORT)); s.close()" 2>/dev/null; then
  echo "Another program is already using port $PORT."
  echo "Close it, or run:  NEEDFIRE_PORT=8899 bash Start-Needfire-Mac.command"
  echo "See QUICKSTART.md > Troubleshooting."
  read -r -p "Press Return to close. "
  exit 1
fi

echo "=========================================================="
echo " Starting Needfire. The FIRST start builds its library"
echo " index - give it a minute. Your browser will open by"
echo " itself when it is ready:  http://localhost:$PORT"
echo ""
echo " KEEP THIS WINDOW OPEN - closing it stops Needfire."
echo " (Press Ctrl+C to stop.)"
echo "=========================================================="
python3 scripts/open-when-ready.py "$PORT" &
exec python3 -m needfire serve
