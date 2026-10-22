#!/usr/bin/env bash
# Delivery encode of the rendered film.
#
# Remotion writes the H.264 stream as full-range BT.601 (it encodes from JPEG
# frames). Many platforms and players assume limited-range BT.709 for HD
# video and shift the blacks and greens. This re-encodes to limited-range
# BT.709 with correct tags, takes the audio straight from the master WAV (one
# AAC generation instead of two) and trims the container to exactly 60.000 s.
#
# Usage: scripts/deliver.sh [rendered.mp4] [output.mp4]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IN="${1:-$ROOT/out/neon-brand-film.mp4}"
OUT="${2:-$ROOT/out/NEON-BrandFilm-1080x1920-60fps.mp4}"
ffmpeg -v error -y -i "$IN" -i "$ROOT/public/audio/neon-score.wav" -map 0:v:0 -map 1:a:0 \
	-vf "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p" \
	-c:v libx264 -preset slow -crf 17 -profile:v high -level:v 4.2 \
	-x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709:fullrange=off" \
	-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
	-c:a aac -b:a 320k -ar 48000 -t 60 -movflags +faststart \
	"$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,color_space,r_frame_rate,nb_frames,duration -of compact "$OUT"
