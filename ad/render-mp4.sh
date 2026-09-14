#!/bin/bash
# Renders the spots to MP4 (and the soundtrack to MP3), from the pages
# themselves.
#
#   ./ad/render-mp4.sh                 both cuts
#   ./ad/render-mp4.sh portrait        1080x1920, for phones and Shorts
#   ./ad/render-mp4.sh landscape       1920x1080, for YouTube and laptops
#
# How it works: index.html?t=N draws exactly the frame the ad shows at N
# seconds and stops, so this drives one headless Chrome over the DevTools
# protocol -- set the clock, take the picture, repeat -- then hands the PNG
# sequence to ffmpeg with the music and the money sounds mixed under it.
# Nothing depends on real-time playback, so the capture can take as long as it
# needs and the result is frame-exact; and because the drawing's hand-wobble
# comes from a seeded RNG, two runs are identical.
#
# Needs: Google Chrome, node 18+, ffmpeg (brew install ffmpeg).
set -euo pipefail

FPS=${FPS:-60}
END=${END:-6.5}
CRF=${CRF:-19}

AD="$(cd "$(dirname "$0")" && pwd)"
WHICH="${1:-both}"
PORT=9333
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "Chrome not found"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not found -- brew install ffmpeg"; exit 1; }

WORK="$(mktemp -d)"
cleanup() { pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT

# The studio mark is an animated GIF. A frame-by-frame capture would let it
# advance at wall-clock speed while the render crawls past, so its frames are
# pulled out here and stepped by hand, one per video frame.
echo "==> Extracting the studio mark's frames"
python3 - "$AD" "$WORK" <<'PY'
import json, os, sys
from PIL import Image
ad, work = sys.argv[1], sys.argv[2]
os.makedirs(f"{work}/wg", exist_ok=True)
im = Image.open(f"{ad}/assets/whosegames.gif")
times, t = [], 0
for i in range(im.n_frames):
    im.seek(i)
    im.convert("RGBA").save(f"{work}/wg/{i:03d}.png")
    times.append(t); t += im.info.get("duration", 40)
json.dump({"times": times, "total": t}, open(f"{work}/wg/timing.json", "w"))
print(f"    {im.n_frames} frames, {t}ms loop")
PY

render_one () {
  local page="$1" out="$2" label="$3"
  echo ""
  echo "=================  $label  ================="

  pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
  sleep 1
  rm -rf "$WORK/profile" "$WORK/frames"
  mkdir -p "$WORK/frames"

  "$CHROME" --headless=new --disable-gpu --disable-extensions --no-first-run --hide-scrollbars \
    --mute-audio --force-device-scale-factor=1 --remote-debugging-port=$PORT \
    --user-data-dir="$WORK/profile" "file://$AD/$page?t=0" >"$WORK/chrome.log" 2>&1 &
  sleep 4

  # Pick the page target by URL. Taking the first one in the list is wrong --
  # extensions and Chrome's own UI show up there too, and connecting to one of
  # those leaves the render hanging with nothing to screenshot.
  local ws
  ws=$(curl -s "http://localhost:$PORT/json" | python3 -c "
import json,sys
pages = [t for t in json.load(sys.stdin) if t['type']=='page' and '$page' in t['url']]
print(pages[0]['webSocketDebuggerUrl'] if pages else '')
")
  [ -n "$ws" ] || { echo "couldn't find $page in Chrome"; exit 1; }

  echo "==> Rendering ${END}s at ${FPS}fps"
  node "$AD/render-frames.mjs" "$ws" "" "$WORK/frames" "$WORK/wg" "$FPS" "$END"
  pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true

  # The soundtrack, laid out to match engine.js's SOUNDS table:
  #   the drawing loop from 0, ducking out under the stamp
  #   nine coins from 4.40, one per backer landing
  #   the register at 5.02, just before the stamp lands
  #   the win sting at 5.05, the launch sting on the logo at 5.35
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" \
    -i "$AD/assets/drawing.ogg" -i "$AD/assets/sfx_coins.mp3" -i "$AD/assets/sfx_kaching.mp3" \
    -i "$AD/assets/sting_win.ogg" -i "$AD/assets/sting_launch.ogg" \
    -filter_complex "\
[1:a]atrim=0:$END,asetpts=PTS-STARTPTS,volume=0.50,afade=t=out:st=4.9:d=0.5[bed];\
[2:a]adelay=4400|4400,volume=0.85[coins];\
[3:a]adelay=5020|5020,volume=0.85[kach];\
[4:a]adelay=5050|5050,volume=0.70[wins];\
[5:a]adelay=5350|5350,volume=0.80[lnch];\
[bed][coins][kach][wins][lnch]amix=inputs=5:duration=longest:normalize=0,\
alimiter=limit=0.95,atrim=0:$END,asetpts=PTS-STARTPTS[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/$out"

  echo "==> $AD/$out"
  ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate \
    -of default=noprint_wrappers=1 "$AD/$out"
}

case "$WHICH" in
  portrait)  render_one index.html     GrandCanvas-ad.mp4           "PORTRAIT  1080x1920" ;;
  landscape) render_one landscape.html GrandCanvas-ad-landscape.mp4 "LANDSCAPE 1920x1080" ;;
  both)
    render_one index.html     GrandCanvas-ad.mp4           "PORTRAIT  1080x1920"
    render_one landscape.html GrandCanvas-ad-landscape.mp4 "LANDSCAPE 1920x1080"
    ;;
  *) echo "usage: render-mp4.sh [portrait|landscape|both]"; exit 1 ;;
esac

# The soundtrack on its own, for anyone who wants to cut their own pictures to
# it. Both spots share it, so it only needs writing once.
echo ""
echo "==> Soundtrack"
SRC="$AD/GrandCanvas-ad.mp4"; [ -f "$SRC" ] || SRC="$AD/GrandCanvas-ad-landscape.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$SRC" -vn -c:a libmp3lame -b:a 192k "$AD/GrandCanvas-ad.mp3"
echo "    $AD/GrandCanvas-ad.mp3"
