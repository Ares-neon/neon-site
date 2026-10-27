#!/usr/bin/env bash
# Final masters + last-frame stills for both formats. Optional: REMOTION_BROWSER=/path/to/chrome-headless-shell
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
for fmt in 9x16 1x1; do
	npx remotion render "SilvaBueno-$fmt" "out/silva-bueno-$fmt.mp4" --concurrency=4 --gl=swangle
	npx remotion still "SilvaBueno-$fmt" "out/silva-bueno-$fmt-last-frame.png" --frame=899 --gl=swangle
done
