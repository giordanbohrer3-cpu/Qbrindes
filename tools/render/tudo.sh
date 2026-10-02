#!/usr/bin/env bash
# Renderiza e codifica todos os vídeos do site (hero + vitrine). Leva ~1h20 numa CPU de 4 núcleos (SwiftShader).
# Os mezaninos sem perdas ficam em $MEZ, fora do repositório; só os arquivos finais vão para assets/video.
set -euo pipefail
cd "$(dirname "$0")/../.."
MEZ="${MEZ:-/tmp/qb-mezanino}"; mkdir -p "$MEZ" assets/video
SO="${1:-tudo}"
if [ "$SO" = tudo ] || [ "$SO" = hero ]; then
  node tools/render/render.mjs --cena hero --w 1920 --h 1080 --saida "$MEZ/hero-d.mkv"
  tools/render/encode.sh "$MEZ/hero-d.mkv" assets/video/hero-d 22 35
  node tools/render/render.mjs --cena hero --w 1080 --h 1350 --saida "$MEZ/hero-m.mkv"
  tools/render/encode.sh "$MEZ/hero-m.mkv" assets/video/hero-m 22 35
  cp "$MEZ/hero-d.json" assets/video/hero.json
fi
if [ "$SO" = tudo ] || [ "$SO" = vitrine ]; then
  for p in copo caneta chaveiro garrafa taca; do
    node tools/render/render.mjs --cena vit --produto "$p" --w 1080 --h 1080 --saida "$MEZ/vit-$p.mkv"
    tools/render/encode.sh "$MEZ/vit-$p.mkv" "assets/video/vit-$p" 23 36
    tools/render/encode.sh "$MEZ/vit-$p.mkv" "assets/video/vit-$p-720" 24 37 720
    cp "$MEZ/vit-$p.json" "assets/video/vit-$p.json"
  done
fi
echo FIM
