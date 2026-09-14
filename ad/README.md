# The videos

Three films, all finished and ready to upload. All H.264 + AAC with
`faststart`.

| file | | for |
|---|---|---|
| `GrandCanvas-store-10s.mp4` | 1920x1080, 10s | **the Play Store listing** — a tour of the game, quiet, captioned |
| `GrandCanvas-ad.mp4` | 1080x1920, 6.5s | phones — Shorts, Reels, TikTok |
| `GrandCanvas-ad-landscape.mp4` | 1920x1080, 6.5s | laptops and TVs — YouTube, a site header, pre-roll |
| `GrandCanvas-ad.mp3` | 192kbps | the ads' soundtrack alone, if you ever cut your own pictures to it |

---

# The store video

`GrandCanvas-store-10s.mp4` — a different job from the ads, so a different
film. An ad interrupts somebody and has to earn three more seconds. This one
plays to a person already on the listing with their thumb near Install: it
doesn't need to hook them, it needs to answer *what is this and who do I play
it with* before they scroll, then say Install.

```
0.00  the prompt        one sentence with a hole in it
1.40  four people draw  four answers to one prompt, all at once — the game in one shot
5.00  the pitch         the table's money going onto somebody's answer
6.40  funded            the payoff, and the trophies
7.60  the league        a reason to come back tomorrow
8.60  the card          name, what's in it, INSTALL — IT'S FREE
```

Two things it does deliberately:

**It is quiet.** −19 LUFS, about 6 dB under the ad spots. Somebody browsing a
store listing is usually in public with the volume wherever they last left it,
and a video that shouts is a video they mute.

**It is captioned.** A line along the bottom names each beat, because store
videos are watched muted more often than not — the sound is a bonus, never the
explanation.

## Getting it onto the listing

The Play Console's promo video field takes a **YouTube URL, not a file**. So:
upload `GrandCanvas-store-10s.mp4` to YouTube (unlisted is fine), then paste
that link into the Console. The video must not be age-restricted and must not
have ads enabled, or the Console rejects it.

Worth knowing before you commit to ten seconds: Google's own guidance suggests
**30 seconds to 2 minutes**. Ten works and short is honest, but if you want to
follow the recommendation, the structure here extends cleanly — give each beat
longer and add a room-and-friends scene. Check the current specs in the
Console, since Play changes them.

---

# The ad spots

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
./ad/render-mp4.sh              # the two ad cuts
./ad/render-mp4.sh promo        # just the store video
./ad/render-mp4.sh all          # all three
FPS=30 CRF=23 ./ad/render-mp4.sh   # smaller files
```

It drives one headless Chrome over the DevTools protocol — set the clock to
frame N, screenshot, repeat — then hands the PNG sequence to ffmpeg with the
soundtrack mixed under it. Because nothing depends on real-time playback the
capture can take as long as it likes and every frame is exact, and because the
hand-wobble comes from a seeded RNG two runs are identical.

Needs Chrome, node 18+, and ffmpeg (`brew install ffmpeg`).

## The sounds

The ads use the game's own music and stings. The store video uses its own bed,
`assets/promo_bed.mp3`, from `make-music.mjs`: a soft kick, a brushed hat and a
four-note pluck walking Am → F → G → C, with the chord turning on each cut
rather than on a metronome, so it reads as scored rather than stuck under.
Rebuild it with `node ad/make-music.mjs`.

The money is synthesised too, by `make-sfx.mjs`, and both films use it:

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

Open `ad/index.html`, `ad/landscape.html` or `ad/promo.html` in **Chrome** and
press space.
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

`engine.js` is everything the films share: paper, pens, money, the FUNDED
stamp, the end card, timing, playback. `index.html` and `landscape.html` are a
config each — canvas size, where things sit, the prompt, and the drawing as a
list of strokes in 0..1 paper coordinates. `promo.html` is different: it uses
the same furniture but draws its own scenes, since a tour isn't one round.

To write a new invention, add strokes to that page's `build()`. The helpers
(`line`, `arc`, `ellipse`, `curve`, `poly`, `coilBetween`) all take clean
geometry and add the same hand imperfections the server gives bot drawings.
Timing is derived from stroke length, so adding one just makes the others a
hair faster — you never have to touch the clock.
