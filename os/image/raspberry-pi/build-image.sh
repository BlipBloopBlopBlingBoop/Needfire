#!/usr/bin/env bash
# =============================================================================
# Needfire — Raspberry Pi appliance image builder (verified-by-inspection).
# Customizes Raspberry Pi OS Lite (64-bit) to ship Needfire and auto-install on
# first boot. Run on a Linux host with root, qemu-user-static, and ~10 GB free.
#
#   sudo bash build-image.sh [--out bothy-pi.img]
#
# Approach: download the base image, expand it, mount it, copy the app in, drop a
# oneshot first-boot service that runs os/install.sh, then unmount. This avoids a
# full pi-gen build while producing a flashable image.
# =============================================================================
set -euo pipefail

OUT="bothy-pi.img"
BASE_URL="https://downloads.raspberrypi.com/raspios_lite_arm64_latest"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"   # offline-survival-computer

while [[ $# -gt 0 ]]; do
  case "$1" in --out) OUT="$2"; shift 2 ;; *) echo "unknown: $1"; exit 2 ;; esac
done
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root." >&2; exit 2; }
# base image is arm64, so aarch64 emulation is the one that matters
for t in xz losetup mount parted resize2fs qemu-aarch64-static; do
  command -v "$t" >/dev/null || echo "  [warn] missing tool: $t (install before running for real)"
done

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
echo "==> Downloading base image"
curl -fL "$BASE_URL" -o "$work/base.img.xz"
xz -dk "$work/base.img.xz"
cp "$work/base.img" "$OUT"

echo "==> Expanding image by 2 GB for the app + seed corpus"
truncate -s +2G "$OUT"

echo "==> Growing the root partition + filesystem into the new space"
loop="$(losetup --show -fP "$OUT")"
parted -s "$OUT" resizepart 2 100%
losetup -d "$loop"; loop="$(losetup --show -fP "$OUT")"   # re-read partition table
e2fsck -pf "${loop}p2"
resize2fs "${loop}p2"

echo "==> Mounting and injecting Needfire"
mnt="$work/mnt"; mkdir -p "$mnt"
mount "${loop}p2" "$mnt"                       # root partition
mkdir -p "$mnt/opt/needfire"
cp -a "$REPO/needfire" "$REPO/web" "$REPO/seed-corpus" "$REPO/catalog" "$REPO/os" "$mnt/opt/needfire/"

echo "==> First-boot install service"
cat > "$mnt/etc/systemd/system/needfire-firstboot.service" <<'EOF'
[Unit]
Description=Needfire first-boot installer
After=multi-user.target
ConditionPathExists=!/var/lib/needfire/.installed
[Service]
Type=oneshot
ExecStart=/bin/bash /opt/needfire/os/install.sh
ExecStartPost=/bin/sh -c 'mkdir -p /var/lib/needfire && touch /var/lib/needfire/.installed'
[Install]
WantedBy=multi-user.target
EOF
ln -sf /etc/systemd/system/needfire-firstboot.service \
  "$mnt/etc/systemd/system/multi-user.target.wants/needfire-firstboot.service"

umount "$mnt"; losetup -d "$loop"
echo "==> Done: $OUT"
echo "Flash with Raspberry Pi Imager or:  sudo dd if=$OUT of=/dev/sdX bs=4M status=progress"
