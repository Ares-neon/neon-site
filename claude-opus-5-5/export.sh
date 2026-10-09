#!/usr/bin/env bash
# Full export: timeline cues → frames → sound design → MP4 (H.264 1080×1920 60 fps + AAC).
#   ./export.sh              render with 3 parallel browser pages
#   WORKERS=4 ./export.sh    more pages (each frame is independent and deterministic)
# Requires: node + playwright (Chromium), python3 + numpy, ffmpeg with libx264.
set -euo pipefail
cd "$(dirname "$0")"

OUT=claude-opus-5-5.mp4

echo "› timeline check + audio cues"
node render.mjs check

echo "› frames (resumes if interrupted)"
node render.mjs frames frames "${WORKERS:-3}"
test "$(ls frames/f*.png | wc -l)" -eq 1800 || { echo "expected 1800 frames"; exit 1; }

echo "› sound design"
python3 sfx.py
# master: +8 dB into a limiter at −2 dBFS → ≈ −15 LUFS integrated, true peak ≈ −2 dBTP
ffmpeg -v error -y -i audio/claude-opus-5-5-sfx.raw.wav \
  -af "volume=8dB,alimiter=limit=0.79:attack=4:release=140:level=disabled" \
  -c:a pcm_s24le audio/claude-opus-5-5-sfx.wav

echo "› encode"
ffmpeg -v error -stats -y \
  -framerate 60 -i frames/f%05d.png \
  -i audio/claude-opus-5-5-sfx.wav \
  -map 0:v:0 -map 1:a:0 \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 15 -tune film -profile:v high -level:v 4.2 \
  -x264-params "keyint=120:min-keyint=60:aq-mode=3:vbv-maxrate=40000:vbv-bufsize=60000" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart -shortest "$OUT"

echo "› verify"
ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,nb_frames,sample_rate,channels:format=duration,size,bit_rate \
  -of default=nw=1 "$OUT"
