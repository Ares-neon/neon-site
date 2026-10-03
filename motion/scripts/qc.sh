#!/usr/bin/env bash
# Controle de qualidade técnico das entregas.
set -uo pipefail
cd "${OUT:-$(dirname "$0")/../entregas}"
for f in NEON_Filme_15s_*.mp4; do
  echo "== $f"
  ffprobe -v error -select_streams v:0 -count_frames \
    -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames,color_space,color_primaries,color_transfer,color_range \
    -of default=nw=1 "$f" | tr '\n' ' '; echo
  ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$f" | tr '\n' ' '; echo
  if ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$f" | grep -q .; then
    ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration -of default=nw=1 "$f" | tr '\n' ' '; echo
    ffmpeg -hide_banner -nostats -i "$f" -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I|Peak):' | tr -s ' ' | tr '\n' ' '; echo
  else
    echo "sem faixa de áudio"
  fi
done
echo "== master wav"
ffmpeg -hide_banner -nostats -i NEON_SFX_Master_-14LUFS_-1dBTP_48k24.wav -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+(I|Peak):' | tr -s ' ' | tr '\n' ' '; echo
ffprobe -v error -show_entries stream=sample_rate,channels,bits_per_sample,duration -of default=nw=1 NEON_SFX_Master_-14LUFS_-1dBTP_48k24.wav | tr '\n' ' '; echo
