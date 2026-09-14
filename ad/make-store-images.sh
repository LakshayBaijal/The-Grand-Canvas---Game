#!/bin/bash
# Renders the Play Store listing images from store-images.html into ad/store/.
#
#   ./ad/make-store-images.sh
#
#   01-draw.png       1080x1920   phone screenshot
#   02-funded.png     1080x1920
#   03-ten-people.png 1080x1920
#   04-daily.png      1080x1920
#   feature.png       1024x500    the banner across the top of the listing
#
# Play wants at least 2 phone screenshots (it shows up to 8) and exactly one
# feature graphic at 1024x500. Upload the four numbered ones in order -- the
# first two are what people actually see before they scroll.
set -euo pipefail

AD="$(cd "$(dirname "$0")" && pwd)"
OUT="$AD/store"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "Chrome not found"; exit 1; }
mkdir -p "$OUT"

shot () {   # number, width, height, filename
  "$CHROME" --headless=new --disable-gpu --disable-extensions --no-first-run \
    --hide-scrollbars --mute-audio --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=4000 \
    --screenshot="$OUT/$4" "file://$AD/store-images.html?shot=$1" >/dev/null 2>&1
  printf "  %-20s %s\n" "$4" "$(du -h "$OUT/$4" | cut -f1)"
}

echo "==> Rendering into $OUT"
shot 1 1080 1920 01-draw.png
shot 2 1080 1920 02-funded.png
shot 3 1080 1920 03-ten-people.png
shot 4 1080 1920 04-daily.png
shot 5 1024 500  feature.png
echo "==> Done"
