#!/usr/bin/env bash
# Needfire — uninstall.sh. Removes services and the app; KEEPS data unless --purge.
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 2; }
PURGE=0
[[ "${1:-}" == "--purge" ]] && PURGE=1

systemctl disable --now needfire.service 2>/dev/null || true
systemctl disable --now needfire-ap.service 2>/dev/null || true
rm -f /etc/systemd/system/needfire.service /etc/systemd/system/needfire-ap.service
systemctl daemon-reload
rm -rf /opt/needfire /etc/needfire
rm -f /usr/local/sbin/needfire-airplane /etc/dnsmasq.d/needfire.conf

if [[ "$PURGE" -eq 1 ]]; then
  echo "Purging data at /var/lib/needfire and the 'needfire' user."
  rm -rf /var/lib/needfire
  userdel needfire 2>/dev/null || true
else
  echo "Kept data at /var/lib/needfire. Re-run with --purge to remove it."
fi
echo "Needfire uninstalled."
