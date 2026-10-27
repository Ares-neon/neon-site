#!/usr/bin/env bash
# Linear loudness normalisation of the synthesised mix (no dynamic processing):
# gain to -15 LUFS integrated, then verify true peak <= -1.5 dBTP.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=public/audio/signature_raw.wav
OUT=public/audio/signature.wav
TARGET_I=-15
read -r I TP < <(ffmpeg -hide_banner -nostats -i "$IN" -af "ebur128=peak=true:framelog=quiet" -f null - 2>&1 \
  | awk '/I:/ {i=$2} /Peak:/ {p=$2} END {print i, p}')
GAIN=$(python3 -c "print(round($TARGET_I - ($I), 2))")
NEW_TP=$(python3 -c "print(round($TP + $GAIN, 2))")
echo "measured I=$I LUFS TP=$TP dBTP -> gain $GAIN dB -> TP $NEW_TP dBTP"
python3 -c "import sys; sys.exit(0 if $NEW_TP <= -1.5 else 1)" || { echo "true peak would exceed -1.5 dBTP; lower the mix" >&2; exit 1; }
ffmpeg -hide_banner -nostats -y -i "$IN" -af "volume=${GAIN}dB" -ar 48000 -c:a pcm_s24le "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af "ebur128=peak=true:framelog=quiet" -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):"
