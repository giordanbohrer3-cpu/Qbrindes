#!/usr/bin/env bash
# Codifica um mezanino (FFV1 RGB 16 bits) para o site: H.264 (MP4) + VP9 (WebM) + pôsteres do 1º e do último quadro.
# Uso: tools/render/encode.sh mezanino.mkv assets/video/hero-d [crf264] [crf_vp9] [largura_opcional]
# A conversão para YUV 4:2:0 BT.709 usa difusão de erro a partir de 16 bits (sem faixas no degradê escuro).
set -euo pipefail
ENT="$1"; SAI="$2"; CRF="${3:-21}"; CRF9="${4:-34}"; LARG="${5:-}"
mkdir -p "$(dirname "$SAI")"
ESC=""
[ -n "$LARG" ] && ESC="zscale=w=${LARG}:h=-2:filter=bicubic:param_a=0.3333:param_b=0.3333,"
VF="format=gbrpf32le,${ESC}zscale=m=709:r=limited:filter=spline36:dither=error_diffusion,format=yuv420p"
COR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)

ffmpeg -hide_banner -loglevel error -y -i "$ENT" -vf "$VF" -c:v libx264 -preset veryslow -crf "$CRF" \
  -profile:v high -level:v 4.2 -pix_fmt yuv420p -g 120 -keyint_min 60 -bf 3 \
  -x264-params "aq-mode=3:aq-strength=0.85:deblock=-1,-1:psy-rd=0.8,0.1:rc-lookahead=60" \
  "${COR[@]}" -movflags +faststart -an "$SAI.mp4"

ffmpeg -hide_banner -loglevel error -y -i "$ENT" -vf "$VF" -c:v libvpx-vp9 -b:v 0 -crf "$CRF9" -pass 1 -row-mt 1 \
  -tile-columns 2 -deadline good -cpu-used 4 -g 120 "${COR[@]}" -an -passlogfile "$SAI.vp9log" -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -i "$ENT" -vf "$VF" -c:v libvpx-vp9 -b:v 0 -crf "$CRF9" -pass 2 -row-mt 1 \
  -tile-columns 2 -deadline good -cpu-used 1 -auto-alt-ref 1 -lag-in-frames 25 -g 120 "${COR[@]}" -an -passlogfile "$SAI.vp9log" "$SAI.webm"
rm -f "$SAI.vp9log"*

# Pôsteres tirados do próprio MP4 (iguais ao 1º e ao último quadro decodificados, sem salto na troca)
PVF="zscale=matrixin=709:rangein=limited:transferin=709:primariesin=709,format=bgra"
ffmpeg -hide_banner -loglevel error -y -i "$SAI.mp4" -frames:v 1 -vf "$PVF" -c:v libwebp -quality 88 "$SAI-ini.webp"
ffmpeg -hide_banner -loglevel error -y -sseof -0.1 -i "$SAI.mp4" -update 1 -vf "$PVF" -c:v libwebp -quality 88 "$SAI-fim.webp"
ls -la "$SAI".mp4 "$SAI".webm "$SAI"-ini.webp "$SAI"-fim.webp
