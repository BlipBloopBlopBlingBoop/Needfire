#!/bin/bash
# ============================================================================
# Needfire launcher for Linux.
#
# Run it from a terminal:        bash Start-Needfire-Linux.sh
# Or double-click it in your file manager and choose "Run in Terminal".
# ============================================================================
cd "$(dirname "$0")"
export PYTHONUTF8=1
PORT="${NEEDFIRE_PORT:-8848}"

if ! command -v python3 >/dev/null 2>&1 ||
   ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)' 2>/dev/null; then
  cat <<'MSG'
  ==========================================================
   Python 3.8+ is needed (free, one command):

     Debian / Ubuntu / Mint:   sudo apt install python3
     Fedora:                   sudo dnf install python3
     Arch:                     sudo pacman -S python

   Then run this file again.
  ==========================================================
MSG
  exit 1
fi

# Already running? Just open the browser (the helper tolerates headless).
if python3 -c "import urllib.request as u; u.urlopen('http://127.0.0.1:$PORT/api/health', timeout=1)" 2>/dev/null; then
  echo "Needfire is already running - opening your browser."
  python3 scripts/open-when-ready.py "$PORT"
  exit 0
fi

# Port taken by something else?
if ! python3 -c "import socket; s=socket.socket(); s.bind(('0.0.0.0', $PORT)); s.close()" 2>/dev/null; then
  echo "Another program is already using port $PORT."
  echo "Close it, or run:  NEEDFIRE_PORT=8899 bash Start-Needfire-Linux.sh"
  echo "See QUICKSTART.md > Troubleshooting."
  exit 1
fi

echo "=========================================================="
echo " Starting Needfire. The FIRST start builds its library"
echo " index - give it a minute. Your browser will open by"
echo " itself when it is ready:  http://localhost:$PORT"
echo ""
echo " KEEP THIS TERMINAL OPEN - closing it stops Needfire."
echo " (Press Ctrl+C to stop.)"
echo "=========================================================="
python3 scripts/open-when-ready.py "$PORT" &
exec python3 -m needfire serve
