#!/usr/bin/env bash
# Contact sheet straight from a rendered video (no re-render):
#   scripts/video_sheet.sh out/neon-brand-film.mp4 sheet.png 0.5 1.5 2.9 ...
# Each argument after the output is a timestamp in seconds.
set -euo pipefail
video="$1"; out="$2"; shift 2
tmp="$(mktemp -d)"
i=0
for t in "$@"; do
	ffmpeg -v error -ss "$t" -i "$video" -frames:v 1 -vf "scale=240:-1" "$tmp/$(printf '%03d' "$i")_${t}s.png"
	i=$((i + 1))
done
python3 "$(dirname "$0")/contact_sheet.py" "$out" "$tmp"/*.png --w 240 --cols "${COLS:-8}"
rm -rf "$tmp"
