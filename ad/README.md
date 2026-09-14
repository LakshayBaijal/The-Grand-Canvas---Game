# The videos

Three films, all finished and ready to upload. All H.264 + AAC with
`faststart`.

| file | | for |
|---|---|---|
| `GrandCanvas-store-10s.mp4` | 1920x1080, 10s | **the Play Store listing** — a tour of the game, quiet, captioned |
| `GrandCanvas-gallery-10s.mp4` | 1920x1080, 10s | ten drawings, ten cuts — fast, for a feed or a site header |
| `GrandCanvas-gallery-10s-portrait.mp4` | 1080x1920, 10s | the same montage for phones — Shorts, Reels, TikTok |
| `GrandCanvas-daily-10s.mp4` | 1920x1080, 10s | the Daily on its own — the reason to come back tomorrow |
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

# The store images

`ad/store/` — the listing graphics. Rebuild with `./ad/make-store-images.sh`.

| file | size | |
|---|---|---|
| `01-draw.png` | 1080x1920 | the hook — a prompt and the answer being drawn |
| `02-funded.png` | 1080x1920 | the payoff — money, the stamp, $1,800, trophies |
| `03-ten-people.png` | 1080x1920 | ten people, one prompt, all at once |
| `04-daily.png` | 1080x1920 | a new prompt every day |
| `feature.png` | 1024x500 | the banner across the top of the Play listing |
| `youtube-banner.png` | 2560x1440 | the YouTube channel banner |

Play wants at least 2 phone screenshots (it shows up to 8) and exactly one
feature graphic at 1024×500. Upload the numbered ones in order — **the first
two are all most people ever see**, so they carry the hook and the payoff.

The YouTube banner is cropped differently on every device: the full
2560×1440 canvas only ever shows on a TV. Desktop shows a 2560-wide strip
423px tall, centred vertically; mobile crops further, to a centred
**1546×423 "safe area."** The lockup — icon, wordmark, tagline, the
WhoseGames credit, the FREE badge — sits entirely inside that 1546×423 box,
and so do two of the six drawings, one in each of the box's side margins;
the other four sit further out, in the wider strip only desktop and the TV
view show. First pass put every drawing out in that wider strip, which meant
mobile — the tightest and most common crop — showed none of them at all, just
the lockup on bare violet. Upload the PNG as-is; YouTube does the cropping.

The WhoseGames mark only exists as an animated GIF with an opaque background
baked into every frame (no transparency to key out), so a single frame is
extracted once to `assets/wg-mark.png` and drawn as the same small rounded,
shadowed tile the ad videos use — never recoloured or stretched edge-to-edge.

These are posters and they shout: huge type on dark bands, rays, glow,
confetti, everything tilted and lit, a FREE sticker. What they don't do is show
gameplay that doesn't exist.

That isn't squeamishness, it's the cheapest way to lose a launch. Play's policy
requires store graphics to represent actual functionality, it's enforced hard
on games, and a rejection lands exactly when you're trying to go live. The
slower version is worse: faked screenshots buy installs and then collect
one-star "not what the pictures showed" reviews, and Play ranks on retention
and rating — so the spike sinks inside a fortnight.

So every drawing is from `drawings.js`, every screen is real UI, and every
number is the server's own: `$1,800` a round and a `$1,000` goal from
`rooms.ts`, `+30 TROPHIES` from `TROPHIES_BY_PLACE`, ten to a room from
`FRIENDLY_MAX_PLAYERS`, 405 daily prompts and 161 round prompts counted out of
`daily.ts` and `prompts.ts`. All the loudness is in the composition.

---

# The Daily

`GrandCanvas-daily-10s.mp4` — the one part of the game that gets people back
the next morning, so it is worth a film of its own.

```
0.00  the reminder    a notification, then today's prompt
1.70  you draw it     no timer, every colour and paper open
4.80  the wall        everyone else's answer, names hidden, hearts landing
7.20  midnight        the day closes and the names come out
8.50  the card        a new one tomorrow
```

The Daily is the **opposite** of a round, and the film is built to feel that
way. A round is a template with a blank in it, a 75-second clock, money,
trophies and a winner. The Daily is one whole sentence — the same one for every
player on earth that day — with no clock, nothing locked, nothing scored and
nobody judged. You draw it, you submit, and then you get to see what everyone
else made of the same idea. So the music has almost no drums in it and nothing
in the cut is in a hurry.

Everything shown is real, from `server/src/daily.ts`: the prompt is one of the
405 in the list, the gallery really is blind while the day is open (the server
strips the names and the counts), a heart really is one per drawing and can
never be taken back, the day really does roll over at midnight UTC everywhere
at once, and the Daily really does unlock every colour, paper and pen for
nothing.

The prompt on screen — *"What lives under the sofa."* — is one of the plainest
in the list, and it was picked for one reason: the honest answers to it are
nine completely different objects. A sock, a dust bunny with opinions, the
remote, a toy car, some coins, half a biscuit, a sandwich from some time ago, a
spider, the missing jigsaw piece. A prompt whose answers all look alike gives
you a wall of one drawing repeated, which argues *against* the mode instead of
for it — the wall is the whole case for the Daily, so the prompt has to be one
that scatters.

---

# The gallery

`GrandCanvas-gallery-10s.mp4` — ten people, ten drawings, ten cuts, ten
seconds, no let-up.

Every shot drops in on somebody already a third of the way through their
drawing and races them to the finish, then cuts. You never watch a line start;
you watch ten of them land. That's what a full table actually feels like from
the inside — everyone drawing at once, and you only ever catch the ends — and
it's the one thing the slower films can't show.

The strip along the bottom fills in as each drawing is finished, so the canvas
is visibly filling the whole way through. At 8.2s it opens out into the wall of
all ten, which is the name of the game.

The cuts are locked to the music rather than the other way round: 146bpm, two
beats a drawing, so every finished line lands on a kick and a pen-swish. If you
change the cut rhythm, rebuild `rapid_bed.mp3` to match — the swishes are baked
in at the cut times so the edit and the music can't drift.

**Two shapes, one film.** `gallery.html` is landscape by default and
`?v=portrait` gives 9:16. The portrait cut isn't the landscape one with bars
on it: the paper grows to nearly the full width, the title gets bigger, and the
wall at the end stacks **3-2-3-2** instead of 5×2 — which is what ten pinned
drawings actually look like on a phone. The end lockup is kept inside the
middle of the frame, clear of the bottom ~450px where Reels and TikTok put
their own caption and buttons.

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
./ad/render-mp4.sh gallery      # just the ten-cut gallery
./ad/render-mp4.sh gallery-9x16 # the same montage, 1080x1920
./ad/render-mp4.sh daily        # just the Daily
./ad/render-mp4.sh all          # all six
FPS=30 CRF=23 ./ad/render-mp4.sh   # smaller files
```

It drives one headless Chrome over the DevTools protocol — set the clock to
frame N, screenshot, repeat — then hands the PNG sequence to ffmpeg with the
soundtrack mixed under it. Because nothing depends on real-time playback the
capture can take as long as it likes and every frame is exact, and because the
hand-wobble comes from a seeded RNG two runs are identical.

Needs Chrome, node 18+, and ffmpeg (`brew install ffmpeg`).

## The sounds

The ads use the game's own music and stings. The two ten-second films have
their own beds, both from `node ad/make-music.mjs`:

* `assets/promo_bed.mp3` — 110bpm, quiet, a soft kick and a four-note pluck
  walking Am → F → G → C, with the chord turning on each of the film's cuts
  rather than on a metronome, so it reads as scored rather than stuck under.
* `assets/rapid_bed.mp3` — 146bpm, four-on-the-floor, a clap on two and four,
  a bass walking a bar per pair of drawings, and a pen-swish on every cut.
* `assets/daily_bed.mp3` — 92bpm, warm, almost drumless, with the notification
  chime and the hearts baked in at the times the film uses them. The Daily has
  no competition in it, so it shouldn't sound like a race.

Everything is synthesised, and the noise is seeded, so two runs give the same
file.

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
stamp, the end card, timing, playback. `drawings.js` is every invention any of
them draws — a prompt, somebody's answer, and a dozen-odd strokes in 0..1 paper
coordinates, each with its own seed so the same drawing is identical in every
film it appears in. `index.html` and `landscape.html` are a config each;
`promo.html` and `gallery.html` use the same furniture but draw their own
scenes, since a tour and a montage aren't one round.

To write a new invention, add an entry to `drawings.js` and put its key in
`GALLERY_ORDER`. The helpers
(`line`, `arc`, `ellipse`, `curve`, `poly`, `coilBetween`) all take clean
geometry and add the same hand imperfections the server gives bot drawings.
Timing is derived from stroke length, so adding one just makes the others a
hair faster — you never have to touch the clock.
