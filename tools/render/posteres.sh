#!/usr/bin/env bash
# Pôster "meio" de cada capítulo da vitrine (produto à mostra), tirado do próprio MP4 codificado.
set -euo pipefail
cd "$(dirname "$0")/../.."
declare -A T=([copo]=3.1 [caneta]=4.4 [chaveiro]=2.9 [garrafa]=3.4 [taca]=1.05)
for p in copo caneta chaveiro garrafa taca; do
  ffmpeg -hide_banner -loglevel error -y -ss "${T[$p]}" -i "assets/video/vit-$p.mp4" -frames:v 1 \
    -vf "zscale=matrixin=709:rangein=limited:transferin=709:primariesin=709,format=bgra" -c:v libwebp -quality 84 "assets/video/vit-$p-meio.webp"
done
ls -la assets/video/*-meio.webp
