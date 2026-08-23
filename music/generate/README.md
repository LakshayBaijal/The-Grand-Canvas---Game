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
- `score.mjs` — the 10 screen loops (title through leaderboard), each written
  as a short arrangement spec, plus `renderScore()`/`saveScore()`.
- `songs3.mjs` — the UI stingers (win, lose, correct, round-start, trophy).
- `launch.mjs` — the one-shot launch signature: a pencil stroke, then the
  motif. Plays once at app boot.
- `render_score.mjs`, `render_stingers.mjs`, `render_launch.mjs` — driver
  scripts. Each writes WAVs to `../v5_wav` (created if missing) and is
  runnable directly with `node`, no build step, no dependencies.

## Regenerating

```bash
cd music/generate
node render_score.mjs       # the 10 screen loops -> ../v5_wav
node render_stingers.mjs    # the 5 UI stingers    -> ../v5_wav
node render_launch.mjs      # the launch signature  -> ../v5_wav
```

Then encode to MP3 and copy into the app:

```bash
FFMPEG=/path/to/ffmpeg   # this repo used D:\dev\ffmpeg\...\bin\ffmpeg.exe

for f in ../v5_wav/*.wav; do
  name=$(basename "$f" .wav)
  "$FFMPEG" -y -i "$f" -codec:a libmp3lame -b:a 128k -write_xing 1 "../v5_mp3/${name}.mp3"
done
```

Then copy the relevant files from `music/v5_mp3/` into `app/assets/audio/`,
renaming to match the `Music`/`Sfx` enums in
`app/lib/services/audio_service.dart` (e.g. `s05_drawing.mp3` ->
`drawing.mp3`).

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
