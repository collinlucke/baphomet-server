#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${BAPHOMET_UI_DIST:-$ROOT/../baphomet-ui/dist}"
DEST="$ROOT/public"

if [ ! -f "$SRC/index.html" ]; then
  echo "UI build not found at $SRC/index.html"
  echo "Build baphomet-ui first, then re-run this script."
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC"/. "$DEST"/
rm -f "$DEST/_redirects" "$DEST/CNAME"

echo "Copied UI from $SRC to $DEST"
ls -la "$DEST" | head
