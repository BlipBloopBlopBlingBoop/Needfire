#!/usr/bin/env bash
# =============================================================================
# Needfire appliance-image builder — container entrypoint.
# Runs INSIDE the needfire-imgbuild container, where the repo is bind-mounted at
# /work. It selects the correct existing builder, ensures cross-arch emulation
# is live for Pi builds, runs the builder unmodified, and drops the resulting
# image into /work/dist/ so the host sees it.
#
# Usage:  entrypoint.sh <pi|x86> [extra args passed through to the builder]
# Must be run with `--privileged` so loop devices / partitions are available.
# =============================================================================
set -euo pipefail

TARGET="${1:-}"
case "$TARGET" in
  pi|x86) ;;
  ""|-h|--help)
    echo "Usage: entrypoint.sh <pi|x86> [extra args]" >&2
    exit 2
    ;;
  *)
    echo "error: unknown target '$TARGET' (expected 'pi' or 'x86')" >&2
    exit 2
    ;;
esac

REPO=/work
DIST="$REPO/dist"
mkdir -p "$DIST"

# The builders write their output relative to the current directory, so run them
# from dist/ to land the image there. (REPO paths inside the builders are derived
# from the script location, so cwd only affects the output file.)
cd "$DIST"

if [[ "$TARGET" == "pi" ]]; then
  # Pi base image is arm64: make sure aarch64 emulation is registered. The host
  # normally registers binfmt (docker run tonistiigi/binfmt / the kernel), but
  # enable it here too as a best-effort belt-and-braces step.
  update-binfmts --enable qemu-aarch64 2>/dev/null || true
  if [[ ! -e /proc/sys/fs/binfmt_misc/qemu-aarch64 ]]; then
    echo "  [warn] qemu-aarch64 binfmt not visible; cross-arch steps may fail." >&2
    echo "         Register it on the host, e.g.: docker run --privileged --rm tonistiigi/binfmt --install arm64" >&2
  fi
  echo "==> Building Raspberry Pi appliance image"
  bash "$REPO/os/image/raspberry-pi/build-image.sh" "${@:2}"
  IMAGE="$DIST/bothy-pi.img"
else
  echo "==> Building x86 appliance image"
  bash "$REPO/os/image/x86/build-iso.sh" "${@:2}"
  IMAGE="$DIST/bothy-x86.raw"
fi

# If the user passed a custom --out the default name won't match; find the
# newest image in dist/ as a fallback so we always report something useful.
if [[ ! -f "$IMAGE" ]]; then
  newest="$(ls -t "$DIST"/*.img "$DIST"/*.raw "$DIST"/*.iso 2>/dev/null | head -n1 || true)"
  [[ -n "$newest" ]] && IMAGE="$newest"
fi

echo ""
if [[ -f "$IMAGE" ]]; then
  echo "==> Image ready: ${IMAGE}"
  echo "    (on the host this is at: dist/$(basename "$IMAGE"))"
else
  echo "==> Build finished but no image was found in $DIST" >&2
  exit 1
fi
