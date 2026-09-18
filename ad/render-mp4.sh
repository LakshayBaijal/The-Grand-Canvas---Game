#!/bin/bash
# Renders the spots to MP4 (and the soundtrack to MP3), from the pages
# themselves.
#
#   ./ad/render-mp4.sh                 the two ad cuts
#   ./ad/render-mp4.sh portrait        1080x1920, for phones and Shorts
#   ./ad/render-mp4.sh landscape       1920x1080, for YouTube and laptops
#   ./ad/render-mp4.sh promo           1920x1080, 10s, for the Play listing
#   ./ad/render-mp4.sh gallery         1920x1080, 10s, ten drawings, ten cuts
#   ./ad/render-mp4.sh gallery-9x16    1080x1920, the same montage for phones
#   ./ad/render-mp4.sh daily           1920x1080, 10s, the Daily
#   ./ad/render-mp4.sh all             all five
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

capture () {   # page, label, seconds, [extra query] -> frames in $WORK/frames
  local page="$1" label="$2" secs="$3" extra="${4:-}"
  echo ""
  echo "=================  $label  ================="

  pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
  sleep 1
  rm -rf "$WORK/profile" "$WORK/frames"
  mkdir -p "$WORK/frames"

  "$CHROME" --headless=new --disable-gpu --disable-extensions --no-first-run --hide-scrollbars \
    --mute-audio --force-device-scale-factor=1 --remote-debugging-port=$PORT \
    --user-data-dir="$WORK/profile" "file://$AD/$page?t=0$extra" >"$WORK/chrome.log" 2>&1 &
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

  echo "==> Rendering ${secs}s at ${FPS}fps"
  node "$AD/render-frames.mjs" "$ws" "" "$WORK/frames" "$WORK/wg" "$FPS" "$secs"
  pkill -f "remote-debugging-port=$PORT" 2>/dev/null || true
}

show () {
  echo "==> $AD/$1"
  ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate \
    -of default=noprint_wrappers=1 "$AD/$1"
}

render_ad () {
  local page="$1" out="$2" label="$3"
  capture "$page" "$label" "$END"

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
  show "$out"
}

# The store video is a quieter mix on a different bed: no stings, and the
# money only just peeks over the music. Somebody on a listing is usually in
# public with the volume wherever they last left it, and a video that shouts
# is a video they mute -- a muted video sells nothing.
render_promo () {
  capture promo.html "PROMO  1920x1080 - 10s" 10.0
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" \
    -i "$AD/assets/promo_bed.mp3" -i "$AD/assets/sfx_coins.mp3" -i "$AD/assets/sfx_kaching.mp3" \
    -filter_complex "\
[1:a]atrim=0:10,asetpts=PTS-STARTPTS,volume=0.85,afade=t=out:st=9.5:d=0.5[bed];\
[2:a]adelay=5460|5460,volume=0.55[coins];\
[3:a]adelay=6380|6380,volume=0.55[kach];\
[bed][coins][kach]amix=inputs=3:duration=longest:normalize=0,\
alimiter=limit=0.95,atrim=0:10,asetpts=PTS-STARTPTS[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/GrandCanvas-store-10s.mp4"
  show GrandCanvas-store-10s.mp4
}

# The gallery is one bed and nothing else: the pen-swishes that land each cut
# are baked into it at the exact cut times, so the edit and the music can't
# drift apart. Change the cut rhythm and rebuild the bed to match.
render_gallery () {
  local out="${1:-GrandCanvas-gallery-10s.mp4}" extra="${2:-}" label="${3:-GALLERY  1920x1080 - 10s}"
  capture gallery.html "$label" 10.0 "$extra"
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$AD/assets/rapid_bed.mp3" \
    -filter_complex "[1:a]atrim=0:10,asetpts=PTS-STARTPTS,volume=1.25,\
afade=t=out:st=9.4:d=0.6,alimiter=limit=0.95[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/$out"
  show "$out"
}

# The Daily's bed carries its own chime and hearts, baked in at the times
# daily.html uses, so this is one track and nothing else.
render_daily () {
  capture daily.html "DAILY  1920x1080 - 10s" 10.0
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$AD/assets/daily_bed.mp3" \
    -filter_complex "[1:a]atrim=0:10,asetpts=PTS-STARTPTS,volume=1.05,\
afade=t=out:st=9.3:d=0.7,alimiter=limit=0.95[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/GrandCanvas-daily-10s.mp4"
  show GrandCanvas-daily-10s.mp4
}

# The pass film: one bed with its hits baked in at the scene cuts, and the
# register once, under the price.
render_pass () {
  local page="${1:-pass.html}" out="${2:-GrandCanvas-pass-28s.mp4}" label="${3:-GRAND PASS  1080x1920 - 28s}"
  capture "$page" "$label" 28.0
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$AD/assets/pass_bed.mp3" -i "$AD/assets/sfx_kaching.mp3" \
    -filter_complex "\
[1:a]atrim=0:28,asetpts=PTS-STARTPTS,volume=1.0,afade=t=out:st=27.2:d=0.8[bed];\
[2:a]adelay=23850|23850,volume=0.5[kach];\
[bed][kach]amix=inputs=2:duration=longest:normalize=0,\
alimiter=limit=0.95,atrim=0:28,asetpts=PTS-STARTPTS[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/$out"
  show "$out"
}

# The concept trailer: one bed with everything baked in at life.html's times.
render_life () {
  capture life.html "LIFE  1920x1080 - 16s" 16.0
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$AD/assets/life_bed.mp3" \
    -filter_complex "[1:a]atrim=0:16,asetpts=PTS-STARTPTS,volume=1.0,afade=t=out:st=15.2:d=0.8,alimiter=limit=0.95[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/GrandCanvas-life-16s.mp4"
  show GrandCanvas-life-16s.mp4
}

render_mosquito () {
  capture mosquito.html "MOSQUITO  1920x1080 - 18s" 18.0
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$AD/assets/mosquito_bed.mp3" \
    -filter_complex "[1:a]atrim=0:18,asetpts=PTS-STARTPTS,volume=1.0,afade=t=out:st=17.2:d=0.8,alimiter=limit=0.95[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/GrandCanvas-mosquito-18s.mp4"
  show GrandCanvas-mosquito-18s.mp4
}

render_knights () {
  capture knights.html "KNIGHTS  1920x1080 - 20s" 20.0
  echo "==> Encoding"
  ffmpeg -y -hide_banner -loglevel error -stats \
    -framerate "$FPS" -i "$WORK/frames/f%05d.png" -i "$AD/assets/knights_bed.mp3" \
    -filter_complex "[1:a]atrim=0:20,asetpts=PTS-STARTPTS,volume=1.0,afade=t=out:st=19.2:d=0.8,alimiter=limit=0.95[a]" \
    -map 0:v -map "[a]" \
    -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -profile:v high -level 4.2 \
    -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest \
    "$AD/GrandCanvas-knights-20s.mp4"
  show GrandCanvas-knights-20s.mp4
}

case "$WHICH" in
  portrait)  render_ad index.html     GrandCanvas-ad.mp4           "PORTRAIT  1080x1920" ;;
  landscape) render_ad landscape.html GrandCanvas-ad-landscape.mp4 "LANDSCAPE 1920x1080" ;;
  promo)     render_promo ;;
  gallery)   render_gallery ;;
  gallery-9x16) render_gallery GrandCanvas-gallery-10s-portrait.mp4 "&v=portrait" "GALLERY  1080x1920 - 10s" ;;
  daily)     render_daily ;;
  pass)      render_pass ;;
  life)      render_life ;;
  mosquito)  render_mosquito ;;
  knights)   render_knights ;;
  pass-16x9) render_pass pass-landscape.html GrandCanvas-pass-28s-landscape.mp4 "GRAND PASS  1920x1080 - 28s" ;;
  both)
    render_ad index.html     GrandCanvas-ad.mp4           "PORTRAIT  1080x1920"
    render_ad landscape.html GrandCanvas-ad-landscape.mp4 "LANDSCAPE 1920x1080"
    ;;
  all)
    render_ad index.html     GrandCanvas-ad.mp4           "PORTRAIT  1080x1920"
    render_ad landscape.html GrandCanvas-ad-landscape.mp4 "LANDSCAPE 1920x1080"
    render_promo
    render_gallery
    render_gallery GrandCanvas-gallery-10s-portrait.mp4 "&v=portrait" "GALLERY  1080x1920 - 10s"
    render_daily
    render_pass
    render_pass pass-landscape.html GrandCanvas-pass-28s-landscape.mp4 "GRAND PASS  1920x1080 - 28s"
    render_life
    render_mosquito
    render_knights
    ;;
  *) echo "usage: render-mp4.sh [portrait|landscape|promo|gallery|gallery-9x16|daily|pass|pass-16x9|life|mosquito|knights|both|all]"; exit 1 ;;
esac

# The soundtrack on its own, for anyone who wants to cut their own pictures to
# it. Both spots share it, so it only needs writing once.
echo ""
echo "==> Soundtrack"
case "$WHICH" in promo|gallery|gallery-9x16|daily|pass|pass-16x9|life|mosquito|knights) SKIP_MP3=1 ;; *) SKIP_MP3=0 ;; esac
if [ "$SKIP_MP3" = "0" ] && [ -f "$AD/GrandCanvas-ad.mp4" ]; then
  ffmpeg -y -hide_banner -loglevel error -i "$AD/GrandCanvas-ad.mp4" -vn -c:a libmp3lame -b:a 192k "$AD/GrandCanvas-ad.mp3"
  echo "    $AD/GrandCanvas-ad.mp3"
fi
