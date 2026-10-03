#!/usr/bin/env bash
# Baixa a Switzer (fonte display do site NEON) do CDN da Fontshare — mesmas URLs de ../project/switzer.css.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/fonts
i=0
for w in 400 500 600 700 800; do
  i=$((i+1))
  url=$(grep -o "url('[^']*')" ../project/switzer.css | sed -n "${i}p" | sed "s/url('//;s/')//")
  curl -sS --retry 4 -o "public/fonts/Switzer-$w.woff2" "$url"
done
ls -la public/fonts
