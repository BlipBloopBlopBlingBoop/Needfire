#!/usr/bin/env bash
# =============================================================================
# Needfire — x86 appliance image builder.
# Untested on real hardware — validate the image boots before relying on it.
# Builds a bootable Debian image with Needfire preinstalled using mkosi (preferred)
# or a debootstrap fallback. Run on a Linux host with root and ~10 GB free.
#
#   sudo bash build-iso.sh [--out bothy-x86.raw]
# =============================================================================
set -euo pipefail

OUT="bothy-x86.raw"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
while [[ $# -gt 0 ]]; do
  case "$1" in --out) OUT="$2"; shift 2 ;; *) echo "unknown: $1"; exit 2 ;; esac
done
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root." >&2; exit 2; }

if command -v mkosi >/dev/null; then
  echo "==> Building with mkosi"
  work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
  cat > "$work/mkosi.conf" <<EOF
[Distribution]
Distribution=debian
Release=bookworm
[Output]
Format=disk
Output=$OUT
[Content]
Packages=python3,systemd,systemd-boot,nftables,rsync,ca-certificates
Bootable=yes
EOF
  mkdir -p "$work/mkosi.extra/opt/needfire"
  cp -a "$REPO/needfire" "$REPO/web" "$REPO/seed-corpus" "$REPO/catalog" "$REPO/os" \
    "$REPO/PROJECT.md" "$REPO/README.md" "$REPO/QUICKSTART.md" "$REPO/SECURITY.md" \
    "$REPO/DISCLAIMER.md" "$REPO/LICENSE" "$work/mkosi.extra/opt/needfire/"
  # first-boot install unit
  mkdir -p "$work/mkosi.extra/etc/systemd/system/multi-user.target.wants"
  cat > "$work/mkosi.extra/etc/systemd/system/needfire-firstboot.service" <<'EOF'
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
    "$work/mkosi.extra/etc/systemd/system/multi-user.target.wants/needfire-firstboot.service"
  ( cd "$work" && mkosi --force )
  echo "==> Done: $OUT"
else
  echo "mkosi not found. Fallback outline (debootstrap):"
  cat <<'EOF'
  1. debootstrap bookworm /mnt/needfire http://deb.debian.org/debian
  2. mount --bind /dev /proc /sys, chroot, install: python3 systemd grub-pc nftables
  3. copy Needfire to /opt/needfire, enable needfire-firstboot.service
  4. install grub to the image's loop device, set fstab, unmount
  5. dd the image to a USB stick / disk
  Install mkosi (`apt install mkosi`) for the automated path above.
EOF
  exit 1
fi
echo "Flash with:  sudo dd if=$OUT of=/dev/sdX bs=4M status=progress"
