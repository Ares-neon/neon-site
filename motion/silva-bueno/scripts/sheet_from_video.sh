#!/usr/bin/env bash
# Contact sheet straight from a rendered MP4: one frame every N frames, labelled with frame/time.
# Usage: scripts/sheet_from_video.sh <video.mp4> <out.jpg> [every=30] [width=270] [cols=6]
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO=$1 OUT=$2 EVERY=${3:-30} W=${4:-270} COLS=${5:-6}
TMP=$(mktemp -d cache/sheet.XXXX)
ffmpeg -v error -i "$VIDEO" -vf "select=not(mod(n\,$EVERY)),scale=$W:-2:flags=lanczos" -vsync vfr -q:v 2 "$TMP/s%04d.jpg"
i=0
for f in $(ls "$TMP"/s*.jpg | sort); do
	mv "$f" "$TMP/$(printf 'f%04d.jpg' $((i * EVERY)))"
	i=$((i + 1))
done
python3 scripts/contact_sheet.py "$TMP" "$OUT" "$COLS"
rm -rf "$TMP"
