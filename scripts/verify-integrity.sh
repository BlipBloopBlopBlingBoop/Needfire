#!/usr/bin/env bash
# =============================================================================
# Needfire — verify-integrity.sh
# Wrapper around `python3 -m needfire verify` so shell workflows and cron jobs have
# a stable entrypoint. Re-hashes every artifact in NEEDFIRE_HOME/manifest.json and
# reports ok / changed / missing. Run after the initial download, after any
# transport, and on the monthly schedule (06-BUILD-RUNBOOK.md) to catch bad
# transfers, tampering, and silent bit-rot BEFORE you depend on the data.
#
# Usage:   bash verify-integrity.sh [--home /var/lib/needfire] [--seed]
#            --home   data root (sets NEEDFIRE_HOME; default: the needfire CLI's default)
#            --seed  verify the bundled seed corpus instead of downloads
# Exit:    0 = all OK; 1 = problems found; 2 = usage/setup error.
# =============================================================================
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SEED=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --home) export NEEDFIRE_HOME="$2"; shift 2 ;;
    --seed) SEED="--seed"; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# If the manifest is GPG-signed, check the signature first: a bad signature
# means the manifest itself can't be trusted, so hash checks are meaningless.
MANIFEST="${NEEDFIRE_HOME:-$REPO/.needfire-home}/manifest.json"
if [[ -z "$SEED" && -f "$MANIFEST.sig" ]] && command -v gpg >/dev/null; then
  if gpg --verify "$MANIFEST.sig" "$MANIFEST" >/dev/null 2>&1; then
    echo "manifest signature: OK"
  else
    echo "manifest signature: FAILED — manifest may be tampered/corrupt" >&2
    exit 1
  fi
fi

exec python3 -m needfire verify $SEED
