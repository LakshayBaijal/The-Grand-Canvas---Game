# The spots

Two cuts of the same six and a half seconds, both finished and ready to upload:

| file | size | for |
|---|---|---|
| `GrandCanvas-ad.mp4` | 1080x1920, 60fps | phones — Shorts, Reels, TikTok, the Play Store listing video |
| `GrandCanvas-ad-landscape.mp4` | 1920x1080, 60fps | laptops and TVs — YouTube, a website header, pre-roll |
| `GrandCanvas-ad.mp3` | 192kbps | the soundtrack alone, if you ever want to cut your own pictures to it |

Both are H.264 + AAC with `faststart`, about 2 MB each.

## What happens

```
0.0   the prompt lands on the paper
0.5   the invention draws itself, stroke by stroke, pencil at the tip
3.6   its name stamps in
4.1   the table's money lands, $200 a note, nine backers, coins climbing a
      semitone each
5.05  FUNDED! — stamp slam, screen shake, confetti, cash register
5.3   end card: icon, GRAND CANVAS, "Free on Google Play", WhoseGames
6.5   hold — cut here
```

The portrait cut is **the Pup-brella** — "Walking the dog always means dealing
with rain" → a dog in an umbrella hat. The landscape cut is **the Snooze-mitt**
— "Mornings would be so much easier without the alarm clock" → a boxing glove
on a spring that punches it for you.

The landscape one is rearranged, not letterboxed: the paper takes the left half
at nearly full height and the prompt, name and money stack down the right. A
9:16 video with bars on it reads as somebody else's phone footage.

Everything shown is a real mechanic. The prompts are two of the game's own
templates, the paper and pens are ported from `drawing_canvas.dart`, the money
and the FUNDED stamp are the reveal screen, and the music is the game's. The
hype is in the pacing. Ads that show gameplay a game doesn't have are the
fastest route to one-star reviews and an AdMob policy strike, so nothing here
is invented.

## Rebuilding

```bash
./ad/render-mp4.sh              # both
./ad/render-mp4.sh landscape    # just the 16:9 one
FPS=30 CRF=23 ./ad/render-mp4.sh   # smaller files
```

It drives one headless Chrome over the DevTools protocol — set the clock to
frame N, screenshot, repeat — then hands the PNG sequence to ffmpeg with the
soundtrack mixed under it. Because nothing depends on real-time playback the
capture can take as long as it likes and every frame is exact, and because the
hand-wobble comes from a seeded RNG two runs are identical.

Needs Chrome, node 18+, and ffmpeg (`brew install ffmpeg`).

## The sounds

The music and the two stings are the game's own. The money is not — it's
synthesised by `make-sfx.mjs`:

* `assets/sfx_coins.mp3` — nine coins, one per backer, each a semitone above
  the last, spaced to land exactly when the notes hit the paper. The pitch
  climbing *is* the money climbing.
* `assets/sfx_kaching.mp3` — a cash register: the drawer clacks, then two
  chimes a fifth apart. That gap between clack and chime is the whole
  "ka-CHING".

Written by hand rather than sampled — a real register sample is somebody else's
copyright, and a game whose whole look is hand-drawn shouldn't be paying licence
fees for a ding. Rebuild them with `node ad/make-sfx.mjs`; if you change the
note timings in `engine.js`, regenerate the coins so the run still lines up.

## Watching it live

Open `ad/index.html` or `ad/landscape.html` in **Chrome** and press space.
(Double-clicking in VS Code opens the source; and GitHub shows HTML files as
code, never running them. It has to be a browser.)

| key | does |
|---|---|
| space / click | play from the start |
| R | replay |
| M | mute |
| L | loop |

`?t=4.7` renders exactly the frame the video shows at 4.7s and holds it —
useful for checking layout, or for pulling a still for the store listing.

## Changing things

`engine.js` is everything both cuts share: paper, pens, money, stamp, end card,
timing, playback. The two HTML files are just a config each — the canvas size,
where things sit, the prompt, and the drawing as a list of strokes in 0..1
paper coordinates.

To write a new invention, add strokes to that page's `build()`. The helpers
(`line`, `arc`, `ellipse`, `curve`, `poly`, `coilBetween`) all take clean
geometry and add the same hand imperfections the server gives bot drawings.
Timing is derived from stroke length, so adding one just makes the others a
hair faster — you never have to touch the clock.
