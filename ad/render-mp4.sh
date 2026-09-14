#!/bin/bash
# Renders index.html to GrandCanvas-ad.mp4 -- 1080x1920, 60fps, with the
# game's own music and stings mixed under it.
#
#   ./ad/render-mp4.sh          (run from the repo root, or anywhere)
#
# How it works: index.html?t=N draws exactly the frame the ad shows at N
# seconds and stops, so this drives one headless Chrome over the DevTools
# protocol -- set the clock, take the picture, repeat -- then hands the PNG
# sequence to ffmpeg. Nothing depends on real-time playback, so the capture
# can take as long as it needs and the result is frame-exact. That is also
# why it looks identical every run: the drawing's hand-wobble comes from a
# seeded RNG.
#
# Needs: Google Chrome, node 18+, ffmpeg (brew install ffmpeg).
set -euo pipefail

FPS=${FPS:-60}
END=${END:-6.5}
CRF=${CRF:-19}

AD="$(cd "$(dirname "$0")" && pwd)"
OUT="$AD/GrandCanvas-ad.mp4"
WORK="$(mktemp -d)"
PORT=9333
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || CHROME="$(command -v google-chrome || command -v chromium || true)"
[ -n "$CHROME" ] || { echo "Chrome not found"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not found -- brew install ffmpeg"; exit 1; }

cleanup() { kill %1 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT

# The studio mark is an animated GIF. A frame-by-frame capture would let it
# advance at wall-clock speed while the render crawls past, so its frames are
# pulled out here and stepped by hand, one per video frame.
echo "==> Extracting the studio mark's frames"
python3 - "$AD" "$WORK" <<'PY'
import json, sys
from PIL import Image
ad, work = sys.argv[1], sys.argv[2]
import os; os.makedirs(f"{work}/wg", exist_ok=True)
im = Image.open(f"{ad}/assets/whosegames.gif")
times, t = [], 0
for i in range(im.n_frames):
    im.seek(i)
    im.convert("RGBA").save(f"{work}/wg/{i:03d}.png")
    times.append(t); t += im.info.get("duration", 40)
json.dump({"times": times, "total": t}, open(f"{work}/wg/timing.json", "w"))
print(f"    {im.n_frames} frames, {t}ms loop")
PY

echo "==> Starting headless Chrome"
rm -rf "$WORK/profile"
"$CHROME" --headless=new --disable-gpu --disable-extensions --no-first-run --hide-scrollbars \
  --mute-audio --force-device-scale-factor=1 --remote-debugging-port=$PORT \
  --user-data-dir="$WORK/profile" "file://$AD/index.html?t=0" >"$WORK/chrome.log" 2>&1 &
sleep 4

# Pick the page target by URL. Taking the first one in the list is wrong --
# extensions and Chrome's own UI show up there too.
WS=$(curl -s "http://localhost:$PORT/json" | python3 -c "
import json,sys
pages = [t for t in json.load(sys.stdin) if t['type']=='page' and 'index.html' in t['url']]
print(pages[0]['webSocketDebuggerUrl'] if pages else '')
")
[ -n "$WS" ] || { echo "couldn't find the page in Chrome"; exit 1; }

echo "==> Rendering ${END}s at ${FPS}fps"
mkdir -p "$WORK/frames"
node "$AD/render-frames.mjs" "$WS" "" "$WORK/frames" "$WORK/wg" "$FPS" "$END"

echo "==> Encoding"
ffmpeg -y -hide_banner -loglevel error -stats \
  -framerate "$FPS" -i "$WORK/frames/f%05d.png" \
  -i "$AD/assets/drawing.ogg" -i "$AD/assets/sting_win.ogg" -i "$AD/assets/sting_launch.ogg" \
  -filter_complex "\
[1:a]atrim=0:$END,asetpts=PTS-STARTPTS,volume=0.50,afade=t=out:st=4.9:d=0.5[bed];\
[2:a]adelay=5050|5050,volume=0.85[win];\
[3:a]adelay=5350|5350,volume=0.80[launch];\
[bed][win][launch]amix=inputs=3:duration=longest:normalize=0,alimiter=limit=0.95,atrim=0:$END,asetpts=PTS-STARTPTS[a]" \
  -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
  "$OUT"

echo ""
echo "==> $OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 "$OUT"
