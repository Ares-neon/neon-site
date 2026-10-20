#!/usr/bin/env bash
# Encodes deliverables from build/frames + build/sfx_master.wav into out/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out
X264="-c:v libx264 -preset slow -crf 18 -profile:v high -level 4.2 -pix_fmt yuv420p -tune grain -x264-params keyint=30:min-keyint=30 -movflags +faststart"
COLOR="-color_primaries bt709 -color_trc bt709 -colorspace bt709 -vf scale=out_color_matrix=bt709:out_range=tv"
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i build/frames/f%04d.png $COLOR $X264 -an -t 30 out/neon-gravidade_9x16_mudo.mp4
ffmpeg -y -hide_banner -loglevel error -i out/neon-gravidade_9x16_mudo.mp4 -i build/sfx_master.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -t 30 -movflags +faststart out/neon-gravidade_9x16_som.mp4
cp build/sfx_master.wav out/neon-gravidade_sfx.wav
# cover = held end card; 3:4 crop preview (1080×1440, centred)
cp build/frames/f0860.png out/neon-gravidade_capa.png
ffmpeg -y -hide_banner -loglevel error -i out/neon-gravidade_capa.png -vf crop=1080:1440:0:240 out/neon-gravidade_capa_3x4.png
# contact sheet: one frame per beat
montage $(for b in $(seq 0 59); do printf 'build/frames/f%04d.png ' $((b*15+7)); done) \
  -tile 10x -geometry 216x384+4+4 -background '#111' -fill '#bbb' -font DejaVu-Sans -pointsize 13 \
  -set label '%t' out/neon-gravidade_contact-sheet.jpg
echo ok
