#!/usr/bin/env bash
# Final render: 1080x1920, 60 fps, H.264 + AAC, settings from remotion.config.ts.
# Usage: scripts/render_final.sh [output.mp4]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/out/neon-brand-film.mp4}"
LOG="$ROOT/out/final-render.log"
mkdir -p "$ROOT/out"
cd "$ROOT"
npx remotion render NeonBrandFilm "$OUT" --concurrency="${CONCURRENCY:-4}" --log=info > "$LOG" 2>&1
code=$?
echo "EXIT $code" >> "$LOG"
exit $code
