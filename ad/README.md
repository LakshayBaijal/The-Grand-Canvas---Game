# The 6.5-second spot

**`GrandCanvas-ad.mp4`** is the finished thing — 1080x1920, 60fps, 6.5s, with
sound. Upload it as-is. Everything else here is what made it.

One scripted round of the real game, then the logo.

```
0.0  prompt lands on the paper       "Walking the dog always means dealing with rain."
0.5  the invention is drawn           a dog in an umbrella hat, pencil at the tip, ~3s
3.6  its name stamps in               THE PUP-BRELLA
4.1  the table's money lands          nine $200 notes, counter to $1,800, goal bar
5.05 FUNDED!                          stamp slam, shake, confetti, win sting
5.3  end card                         icon, GRAND CANVAS, "Free on Google Play", WhoseGames
6.5  hold                             cut here
```

Everything in it is a real mechanic. The prompt is one of the game's own
templates, the paper and pens are ported from `drawing_canvas.dart`, the money
and the FUNDED stamp are the reveal screen, and the sounds are the game's. The
hype is in the pacing. Ads that show gameplay a game doesn't have are the
fastest route to one-star reviews and an AdMob policy strike, so nothing here
is invented.

## Rebuilding the video

After changing anything in `index.html`:

```bash
./ad/render-mp4.sh
```

It drives one headless Chrome over the DevTools protocol — set the clock to
frame N, screenshot, repeat — then hands the PNG sequence to ffmpeg with the
game's music and stings mixed under it. Because nothing depends on real-time
playback, the capture can take as long as it likes and every frame is exact;
and because the hand-wobble comes from a seeded RNG, two runs are identical.

Needs Chrome, node 18+, and ffmpeg (`brew install ffmpeg`). Knobs:
`FPS=30 CRF=23 ./ad/render-mp4.sh` for a smaller file.

## Watching it live, or recording it by hand

1. Open `ad/index.html` in Chrome (double-click the file).
2. Press **⌘⇧F** / F11 for full screen — the stage scales to fit and letterboxes
   in black, so a 16:9 monitor shows a 9:16 phone frame in the middle.
3. Start recording:
   - **Mac:** QuickTime → File → New Screen Recording → drag a box around the
     phone frame → Record. Or ⌘⇧5.
   - **Windows:** Win+G (Xbox Game Bar) → Capture → Record. Or OBS.
4. Press **space**. The overlay disappears and the spot plays once with sound.
5. Stop at the end card. Trim the front to the frame the paper lands, and the
   back to 6.5s. That's it.

For a clean 1080×1920 with no letterboxing, make the Chrome window exactly
that size first (DevTools → device toolbar → Responsive, 1080 × 1920, zoom
100%) and record the tab.

Keys while it's open:

| key   | does                                   |
|-------|----------------------------------------|
| space / click | play from the start               |
| R     | replay                                 |
| M     | mute (record sound separately if you'd rather) |
| L     | loop, for checking it against itself   |

## Checking a single frame

`index.html?t=4.7` renders exactly the frame a recording shows at 4.7s, and
holds it. Useful for checking layout, or for pulling a still for the store
listing. `?t=6.5` is the end card.

## Changing it

The drawing is a list of strokes in `DOG` near the top of the script — plain
shapes (`ellipse`, `arc`, `line`, `curve`) in 0..1 paper coordinates, each
given the same hand wobble the server gives bot drawings. Timing is derived
from stroke length, so adding a stroke just makes the others a hair faster.

The prompt, the invention's name, and the end-card copy are all string
literals; search for `PUP-BRELLA`.

The assets in `assets/` are copies of the app's own (icon, studio mark, three
sounds), so the folder works on its own.
