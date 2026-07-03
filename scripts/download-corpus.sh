#!/usr/bin/env bash
# =============================================================================
# Needfire — download-corpus.sh
# Wrapper around `python3 -m needfire download` so shell workflows have a stable
# entrypoint. Downloads catalog sources (catalog/catalog.json) into NEEDFIRE_HOME,
# resumable, SHA-256-hashed into NEEDFIRE_HOME/manifest.json. Network is required
# ONLY for this step — everything else about Needfire is offline.
#
# Edit catalog/catalog.json first: replace the <PLACEHOLDER> URLs with the
# current filenames from https://download.kiwix.org/zim/ (placeholders are
# skipped with a notice). Then:
#
#   bash download-corpus.sh --tier C1              # survival-critical first
#   bash download-corpus.sh --id wikipedia-en-maxi # a single source
#   bash download-corpus.sh --home /var/lib/needfire --tier C1 --tier C2
#
# After downloading, verify:  bash verify-integrity.sh
# =============================================================================
set -euo pipefail

ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --home) export NEEDFIRE_HOME="$2"; shift 2 ;;
    --tier|--id) ARGS+=("$1" "$2"); shift 2 ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

exec python3 -m needfire download "${ARGS[@]}"
