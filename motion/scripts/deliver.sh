#!/usr/bin/env bash
# Codifica as entregas finais a partir dos quadros renderizados (work/frames-<fmt>) + master de áudio.
# H.264 High, yuv420p, BT.709 (faixa limitada), 30 fps, 15,000 s; AAC 320 kbps 48 kHz.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=entregas
AUD=public/audio/neon-sfx-master.wav
mkdir -p "$OUT"
VF="scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p"
X264=(-c:v libx264 -preset slow -crf 14 -profile:v high -level:v 4.2 -g 60 -bf 2 -x264-params aq-mode=3
      -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -movflags +faststart)
for fmt in ${1:-16x9 9x16}; do
  F="work/frames-$fmt"
  [ -f "$F/f0449.png" ] || { echo "faltam quadros em $F"; exit 1; }
  ffmpeg -hide_banner -v error -y -framerate 30 -i "$F/f%04d.png" -i "$AUD" -map 0:v -map 1:a -vf "$VF" "${X264[@]}" \
    -c:a aac -b:a 320k -ar 48000 -t 15 "$OUT/NEON_Filme_15s_${fmt}_SFX.mp4"
  ffmpeg -hide_banner -v error -y -framerate 30 -i "$F/f%04d.png" -map 0:v -vf "$VF" "${X264[@]}" -an -t 15 \
    "$OUT/NEON_Filme_15s_${fmt}_SemAudio.mp4"
  python3 scripts/contact-sheet.py "$fmt" "$F" "$OUT/NEON_ContactSheet_${fmt}.png"
  echo "ok $fmt"
done
cp "$AUD" "$OUT/NEON_SFX_Master_-14LUFS_-1dBTP_48k24.wav"
