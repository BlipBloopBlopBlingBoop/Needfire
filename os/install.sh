#!/usr/bin/env bash
# =============================================================================
# Needfire — install.sh
# Provision a fresh Debian/Ubuntu (x86 or Raspberry Pi / ARM) into the appliance:
# install the app to /opt/needfire, create a service user, lay down systemd units,
# optionally set up a Wi-Fi access point, and apply an airplane-mode firewall.
#
# Idempotent: safe to re-run. Requires root. The ONLY hard dependency is python3
# (installed via apt if missing) — the app itself needs no pip packages.
#
# Usage:
#   sudo bash os/install.sh [--ap] [--no-firewall] [--port 8848]
# =============================================================================
set -euo pipefail

AP=0
FIREWALL=1
PORT=8848
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"     # repo root (Needfire)
APP_DIR=/opt/needfire
NEEDFIRE_USER=needfire
NEEDFIRE_HOME=/var/lib/needfire

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ap) AP=1; shift ;;
    --no-firewall) FIREWALL=0; shift ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 2; }

echo "==> 1/6  Dependencies"
export DEBIAN_FRONTEND=noninteractive
if ! command -v python3 >/dev/null; then
  apt-get update && apt-get install -y python3
fi
# Optional but recommended runtime helpers (kiwix, AP, firewall). Best-effort.
apt-get install -y --no-install-recommends rsync ca-certificates >/dev/null 2>&1 || true
[[ "$AP" -eq 1 ]] && apt-get install -y hostapd dnsmasq >/dev/null 2>&1 || true
[[ "$FIREWALL" -eq 1 ]] && apt-get install -y nftables >/dev/null 2>&1 || true

echo "==> 2/6  Service user + directories"
id "$NEEDFIRE_USER" >/dev/null 2>&1 || useradd --system --home "$NEEDFIRE_HOME" --shell /usr/sbin/nologin "$NEEDFIRE_USER"
mkdir -p "$NEEDFIRE_HOME"
chown -R "$NEEDFIRE_USER:$NEEDFIRE_USER" "$NEEDFIRE_HOME"

echo "==> 3/6  Install application to $APP_DIR"
mkdir -p "$APP_DIR"
# copy the app, web UI, seed corpus, and catalog (everything the runtime needs),
# plus the docs the systemd unit and on-box users reference
rsync -a --delete \
  --exclude '.needfire-home' --exclude '__pycache__' --exclude '.git' \
  "$SRC_DIR/needfire" "$SRC_DIR/web" "$SRC_DIR/seed-corpus" "$SRC_DIR/catalog" \
  "$SRC_DIR/PROJECT.md" "$SRC_DIR/README.md" "$SRC_DIR/QUICKSTART.md" \
  "$SRC_DIR/SECURITY.md" "$SRC_DIR/LICENSE" \
  "$APP_DIR/"
chown -R root:root "$APP_DIR"

echo "==> 4/6  Environment file"
mkdir -p /etc/needfire
cat > /etc/needfire/needfire.env <<EOF
NEEDFIRE_HOME=$NEEDFIRE_HOME
NEEDFIRE_WEB_DIR=$APP_DIR/web
NEEDFIRE_SEED_DIR=$APP_DIR/seed-corpus
NEEDFIRE_CATALOG=$APP_DIR/catalog/catalog.json
NEEDFIRE_HOST=0.0.0.0
NEEDFIRE_PORT=$PORT
# Point this at an Ollama instance if you run local models:
NEEDFIRE_OLLAMA_URL=http://127.0.0.1:11434
EOF

echo "==> 5/6  systemd service + initial index"
install -m 0644 "$SRC_DIR/os/systemd/needfire.service" /etc/systemd/system/needfire.service
# Build the seed index once at install so the box answers immediately.
# (subshell: source the env file safely — no word-splitting of values)
( cd "$APP_DIR" && sudo -u "$NEEDFIRE_USER" bash -c \
    'set -a; . /etc/needfire/needfire.env; set +a; exec python3 -m needfire index' ) \
  || echo "  (index build will run on first boot)"
systemctl daemon-reload
systemctl enable --now needfire.service

if [[ "$AP" -eq 1 ]]; then
  echo "==> 5b   Wi-Fi access point (review configs before relying on them!)"
  install -m 0644 "$SRC_DIR/os/network/hostapd-needfire.conf.example" /etc/hostapd/hostapd.conf
  install -m 0644 "$SRC_DIR/os/network/dnsmasq-needfire.conf.example" /etc/dnsmasq.d/needfire.conf
  [[ -f /etc/needfire/ap.env ]] || install -m 0644 "$SRC_DIR/os/network/ap.env.example" /etc/needfire/ap.env
  install -m 0644 "$SRC_DIR/os/systemd/needfire-ap.service" /etc/systemd/system/needfire-ap.service
  systemctl daemon-reload
  # Debian ships hostapd masked; dnsmasq provides DHCP/DNS for AP clients.
  systemctl unmask hostapd >/dev/null 2>&1 || true
  systemctl disable --now hostapd >/dev/null 2>&1 || true   # needfire-ap starts it itself
  systemctl enable dnsmasq >/dev/null 2>&1 || true
  echo "  Edit /etc/hostapd/hostapd.conf (SSID, passphrase, interface, country)"
  echo "  and /etc/needfire/ap.env (wireless interface), then:"
  echo "    systemctl enable --now needfire-ap.service"
fi

if [[ "$FIREWALL" -eq 1 ]]; then
  echo "==> 6/6  Airplane-mode firewall"
  # Template the server port into the ruleset so --port and the firewall agree.
  sed -E "s/^define NF_PORT = .*/define NF_PORT = $PORT/" \
    "$SRC_DIR/os/firewall/needfire-airplane.nft" > /usr/local/sbin/needfire-airplane
  chmod 0755 /usr/local/sbin/needfire-airplane
  /usr/local/sbin/needfire-airplane || echo "  (firewall apply skipped — review the script)"
else
  echo "==> 6/6  Firewall skipped (--no-firewall)"
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "================================================================"
echo " Needfire is installed and running."
echo "   Service:  systemctl status needfire"
echo "   Open:     http://${IP:-<this-host>}:$PORT/"
echo "   Data:     $NEEDFIRE_HOME    App: $APP_DIR"
echo " Next: download the corpus from the Corpus tab, or:"
echo "   sudo -u $NEEDFIRE_USER bash -c 'set -a; . /etc/needfire/needfire.env; set +a; python3 -m needfire download --tier C1'"
echo "================================================================"
