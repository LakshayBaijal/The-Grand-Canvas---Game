# Music generation

The Grand Canvas's music is generated, not sourced — every track is a
variation on one four-note motif, built up from small synthesized instrument
voices (`acoustic.mjs`, `acoustic2.mjs`) over a shared low-level synth engine
(`engine.mjs`). No external samples, no license concerns, no asset hunting.

## Layout

- `engine.mjs` — the synth core: oscillators, envelopes, reverb/chorus,
  mastering (peak-normalises every track to the same ceiling — see the note
  below), WAV writer, scales/chords.
- `acoustic.mjs`, `acoustic2.mjs` — instrument voices built on the engine:
  marimba, kalimba, upright bass, brushes, bowed strings, triangle, etc.
- `cinematic.mjs` — the big voices the reveal and leaderboard lean on: string
  ensemble, felt piano, choir pad, sub bass, timpani, taiko, swell, impact.
- `score.mjs` — the 11 screen loops (the theme through final results), each
  written as a short arrangement spec, plus `renderScore()`/`saveScore()`.
  Two things every track shares: a `swing` amount (off-beat eighths land
  late), and an optional `sticks` layer (woodblock — `true` for a straight
  count, `"clave"` for son clave, `"busy"` for eighths) that sits on top of
  whatever `perc` kit is playing rather than replacing it.
- `songs3.mjs` — the UI stingers (win, lose, correct, round-start, trophy).
- `launch.mjs` — the one-shot launch signature: a pencil stroke, then the
  motif. Plays once at app boot.
- `render_score.mjs`, `render_stingers.mjs`, `render_launch.mjs` — driver
  scripts. Each writes WAVs to `../v5_wav` (created if missing) and is
  runnable directly with `node`, no build step, no dependencies.

## Regenerating

```bash
cd music/generate
node render_score.mjs       # the 11 screen loops -> ../v5_wav
node render_stingers.mjs    # the 5 UI stingers    -> ../v5_wav
node render_launch.mjs      # the launch signature  -> ../v5_wav
```

Then encode to **OGG Vorbis** and copy into the app:

```bash
FFMPEG=/path/to/ffmpeg   # this repo used D:\dev\ffmpeg\...\bin\ffmpeg.exe

for f in ../v5_wav/*.wav; do
  name=$(basename "$f" .wav)
  "$FFMPEG" -y -i "$f" -c:a libvorbis -q:a 5 "../v6_ogg/${name}.ogg"
done
```

**Vorbis, not MP3, and it is not a taste call.** Every screen track is a
seamless loop — `renderScore` folds the reverb tail back over the opening so
the seam is sample-exact in the WAV. MP3 then throws that away: the format
pads both ends of a file with encoder silence (~50ms), and Android's player
does not trim it on the loop path, so each time round there was a click of
nothing at the seam. That was "the music breaks in between". Vorbis has no
padding; the decoded OGG has exactly the WAV's sample count.

Then copy the relevant files from `music/v6_ogg/` into `app/assets/audio/`,
renaming to match the `Music`/`Sfx` enums in
`app/lib/services/audio_service.dart` (e.g. `s05_drawing.ogg` ->
`drawing.ogg`). One exception to the one-to-one mapping: `s01_title` is
installed as `theme.ogg`, and **both** `Music.title` and `Music.menu` point at
it. Boot is over in a couple of seconds and the theme is a 65-second piece
with a shape, so sharing the file is what lets `AudioService.play` carry one
continuous performance from launch into the menu instead of restarting it.

## The drums were silent for three weeks

Worth knowing so nobody re-lives it. `percEnv` in `engine.mjs` starts its
1.5ms attack ramp at exactly zero, and every drum and plucked-bass voice ends
its render loop early with `if (env < tiny) break;` — which was true on the
very first sample. So kick, snare, hats, crash, the woodblock, the toms, the
timpani, the taiko **and the upright bass** rendered nothing at all, from the
day the music was committed until someone asked where the beats were. Only
voices without that early exit (brush, clap, tambourine, triangle) ever
sounded. The ramp now starts at 0.2% instead of 0, which is inaudible on a
drum hit. If you add a percussive voice, either use `percEnv` or don't put a
`break` on the first sample.

Two things followed from being able to hear the kit. It gets its own **dry
bus** (`D`/`E` in `renderScore`): the chorus, delay and room reverb that make
the pads sit back never touch a transient — the delay in particular is timed
at six sixteenths, which put a ghost of every kick on the "and" of the bar.
Measured as the 30ms RMS on each downbeat over the 30ms one sixteenth later,
the theme went from 1.09 (barely there) to 2.42 with the bus. And there are
three real kit patterns now — `halfbeat`, `beat`, `beatfull` — built from the
engine's kick/snare/hat/clap, with a `fill: "roll"` and `crash: true` for
section changes.

## The one thing that trips people up

**`master()` in `engine.mjs` peak-normalises every track to the same
ceiling.** A track written to be quiet or sparse still comes out at full
volume after mastering — the `level` values inside a `score.mjs` entry only
balance sections *within* that track against each other.

Per-track loudness therefore does **not** live here. It lives in the app, as
the `gain` field on the `Music` enum in `audio_service.dart`. If a track needs
to sit quieter (the drawing-screen loop is deliberately soft, for example),
change `gain` there — changing anything in this pipeline won't do it.

## Adding a new track

1. Add an entry to `SCORE` in `score.mjs` (or `STINGERS` in `songs3.mjs` for a
   one-shot). Follow the shape of an existing entry — `bpm`, `root`, `prog`,
   and a `sections` list, each section picking a `motif` transform (`full`,
   `stretch`, `fragment`, `invert`, `sparse`, `tail`, or an array to vary
   section-to-section) and a `voice`.
2. Render it, listen to the WAV.
3. Encode and drop it into `app/assets/audio/`, add it to the `Music`/`Sfx`
   enum in `audio_service.dart` with whatever `gain` sounds right next to the
   other tracks.

## What's not in this folder

Intermediate/exploratory renders (older `v2`–`v4` passes, raw WAV duplicates
of the shipped MP3s) aren't tracked in git — they were stepping stones, not
things anyone needs to regenerate the current tracks from. If you have them
locally from an earlier session, they're safe to delete; nothing here depends
on them. `music/v5_mp3/` holds the current finished masters.
