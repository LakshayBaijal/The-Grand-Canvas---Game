# 🖼 The Grand Canvas

A Jackbox-style party drawing game for **3–5 players**, built for Android and iOS.
Everyone plays on their own phone — no shared TV screen needed.

## Two modes

The game splits into a competitive ladder and a casual one, deliberately kept
apart so the leaderboard means something.

| | **Ranked** | **Play with friends** |
| --- | --- | --- |
| Who you play | Matchmade with up to 4 strangers | Whoever you send the 4-letter code to |
| Filling empty seats | Automatic, after a short wait | Host taps **Add Player** |
| Voting | Spread **$1800** across the drawings | Pick a **1st / 2nd / 3rd** (3 / 2 / 1 points) |
| Penalties | Unspent money comes out of your winnings | None |
| Trophies | **Yes** — moves the global leaderboard | **No** — nothing counts |
| Rematch | Queue again | Host taps **Play Again** |

Friendly games award nothing on purpose: you choose the opponents and you can
stack the room with bots, so any trophies from them would be free.

## How a game plays

Same structure as Jackbox's **Patently Stupid**: one round per human player,
everyone draws a solution to the same problem, then backs their favourites.

1. **Get into a game** — **Ranked** drops you in a queue; **Play with friends** opens a private room others join by code. Either way you watch the [idle canvas](#the-idle-canvas) while you wait.
2. **Invent a problem** — one player each round gets a Mad-Libs-style sentence with a blank (e.g. *"Every office has an ongoing problem with ___."*) and fills it in. Only real players get writer turns — this is the creative half of the game.
3. **Draw** — that completed sentence goes to **everyone** (including the writer), who all draw a solution, then name their homework in a popup. 75 seconds.
4. **Present** — every drawing is shown one at a time, image first, then its title.
5. **Vote** — invest money (ranked) or pick a podium (friendly).
6. **Reveal** — see what each piece of homework pulled in, who backed it, and the score breakdown.
7. Repeat until every human player has had one turn writing the blank, then final scores.

### Scoring

**Ranked** — per round, your score changes by
**`money raised + placement bonus − unspent money`**:

| | |
| --- | --- |
| Money your drawing attracts | **+$1 per $1** |
| 1st / 2nd / 3rd most-funded | **+$500 / +$300 / +$100** |
| Budget you failed to spend | **−$1 per $1** |

Each player starts a round with $2000 and pays a $200 entry fee, leaving
**$1800** to invest. Note the entry fees don't exactly fund the $900 of
placement bonuses except at 5 players — they're two independent rules rather
than a closed economy. Tunable via `INVESTMENT_BUDGET`, `INVESTMENT_STEP` and
`PLACEMENT_BONUSES` in `server/src/rooms.ts`.

**Friendly** — every voter awards a 1st, 2nd and 3rd, worth **3 / 2 / 1**
points. No budget, no bonuses, nothing to lose. `RANKING_POINTS` in the same
file.

## Profiles, trophies and the leaderboard

Your account lives on the device. The first launch generates a permanent id and
asks for a name once; after that the name is never asked for again, and it
follows you across games, networks and app restarts. Deleting the app is the
only thing that clears it. Renaming keeps the same account and the same
trophies — the id is the identity, the name is just a label.

There are **three separate numbers**, each doing one job, because one number
can't do all three without being bad at all of them:

| | what it means | moves |
| --- | --- | --- |
| **Rating** | current skill — what the leaderboard sorts by | **up and down** |
| **League** | the band your rating sits in, and your identity on the ladder | up freely, down only to the floor |
| **Trophies** | career total, a record of everything you've played | **only up, ever** |

**Why not just trophies.** They only ever accumulated, and even last place paid
out — which makes a fine career counter and a terrible leaderboard: it ranks
*time played*, not skill. Someone winning 90% of 50 games sat below someone
winning 10% of 500, and the top of the board just meant "played the most".

**Why not just Elo.** Placement here is decided by other people voting on
drawings. It's genuinely high-variance, and a prompt that doesn't suit you is
nobody's fault. A ladder where every loss bites hard would punish players for
luck and make a party game stressful.

So rating is Elo-style (`server/src/ranking.ts`) — free-for-all, every player
scored against every other as a pairwise match, averaged. Coming exactly where
your rating predicted barely moves you, which is what makes the number mean
something. A normal game is worth about **±12**; an upset is worth **±23**.

**Leagues, and the floor that makes this safe.** Scribbles → Doodler → Sketcher
→ Illustrator → Curator → Old Master → Grand Canvas. Reach a league once in a
season and you **cannot fall out of it** — within your league the rating moves
freely, so the top of the board stays honest, but a promotion you already earned
survives a bad night. This is the one rule that lets a real ladder sit inside a
party game.

**Bots are worth almost nothing.** They're included as opponents but weighted at
15%, so beating a full bot backfill moves you **+2** against **+12** for four
humans. Queueing alone to farm the ladder isn't a strategy.

**Placements.** Your first 5 ranked games each season count triple and are held
off the public board, so you land near your real level in an evening instead of
grinding up from zero.

**Seasons** run 28 days. At rollover everyone is pulled halfway back toward the
Sketcher line — strong players still start ahead and re-climb fast, but the top
is contestable again. Trophies are untouched by this; they're yours forever.

> **On upgrading:** existing profiles keep every trophy, and everyone starts the
> new ladder at the same rating. Seeding rating from banked trophies would import
> exactly the play-time bias the rating exists to remove.

Trophies themselves still pay out by placement, scaled by the human share of the
lobby, minimum 1 — `TROPHIES_BY_PLACE` in `server/src/rooms.ts`. Ladder constants
live in `server/src/ranking.ts`; `npm test` in `server/` covers the maths.

Profiles live in SQLite (`server/src/store.ts`, via node's built-in
`node:sqlite` — no dependency, no native build) at `data/leaderboard.db`, or
wherever `DB_PATH` points. Unlike lobbies, which are deliberately in-memory and
disposable, this survives restarts: a leaderboard that resets on deploy would
be worthless.

> **Two honest limits.** (1) An *unlinked* identity is self-asserted — the
> device sends its own id, and nothing stops a modified client claiming another
> one. Linking a Google account fixes this for that player, because the server
> verifies Google's signature instead of taking the client's word; unlinked
> play is still on trust. (2) "Global" means *global to one server*. Until
> `server/` is deployed somewhere public (see
> [Before shipping](#before-shipping-to-the-play-store)), each machine running
> it has its own separate leaderboard.

### Linking a Google account

Optional, and off unless configured. A device account is fine until the phone
is lost or the app is reinstalled — at which point the trophies are gone, since
the id lived only on that device. Linking makes the profile follow the player.

What happens when someone signs in, in the order the cases actually come up:

| situation | result |
| --- | --- |
| account not seen before | the current profile becomes that account. Nothing moves. |
| same account, same profile | nothing. Signing in twice is harmless. |
| account already owns a profile | **that** profile wins — it is the one that exists on their other devices. Career totals from this device (trophies, games, wins, best score) are folded in, and the throwaway device profile is deleted. |

**Rating is deliberately not merged.** Trophies are a career total and adding
them up is correct; rating measures current skill, so summing two of them would
hand out free ladder position for reinstalling the app.

Signing out unlinks the account and leaves every trophy where it is — it is not
a punishment, just a disconnection.

#### Turning it on

It needs credentials from Google, and it stays hidden until it has them —
neither the server nor the app will offer a button that could only fail.

1. In the [Google Cloud console](https://console.cloud.google.com/), create a
   project and configure the OAuth consent screen.
2. Create **two** OAuth client IDs:
   - **Android**, with your package name and the SHA-1 of your signing key.
     Debug and release builds have *different* keys, so add both or sign-in
     will work in development and fail in the APK. Get them with
     `keytool -list -v -keystore <path-to-keystore>`.
   - **Web**. This one is the "server client id" — despite the name, it is what
     an Android app passes and what the server verifies the token against.
3. Give the **Web** client id to both sides:

   ```bash
   # server
   GOOGLE_CLIENT_ID=<web-client-id> npm run dev

   # app
   flutter build apk --release --dart-define=GOOGLE_SERVER_CLIENT_ID=<web-client-id>
   ```

Leave either unset and the game runs exactly as before, on device accounts.
That is the intended state for a LAN game: Google sign-in needs internet and
Play Services, and this server is built to run on a laptop on someone's home
Wi-Fi with neither.

## Finding a friendly game

Friendly games used to be reachable only by reading a four-letter code aloud,
which works in a room together and nowhere else. There is now a **lobby
browser**: open games on the server are listed with their host, how many people
are in them, and how many of those are bots.

- **New rooms are listed by default.** A room nobody can find is the problem
  the browser exists to solve. The host can switch a room to **code only** when
  creating it, or from inside the lobby.
- **Hiding a room never revokes its code.** "Code only" removes it from the
  list; anyone already given the code still walks straight in. This is worth
  being precise about, because the opposite is what people assume.
- **Rooms drop off the list when they are full or have started**, rather than
  offering a join that would then be refused — and reappear if a seat opens up.
- **Bots are counted separately.** "4 playing" reads very differently when
  three of them are bots, so the row says both.
- The list is **pushed, not polled**: the server keeps browsers up to date as
  lobbies change, so a new room appears the moment it opens.

Ranked lobbies are never listed. They are built complete by matchmaking, and a
game that could be gate-crashed mid-round would not be ranked for long.

There is also an **invite** button in the lobby, which hands the code to
whatever the phone uses to message people. Copying a code still leaves someone
to go and find their messaging app; this does not.

## Matchmaking

Ranked players go into one global queue. A game starts the instant 5 are
waiting; otherwise the longest-waiting player's clock runs out and bots fill
the rest of the lobby.

`BOT_FILL_SECONDS` in `server/src/matchmaking.ts` controls that wait — **two
minutes**, roughly what other matchmade games hold out for before they stop
waiting for a perfect lobby.

**Players are never told which seats were filled.** The queue shows a plain
countdown, filled seats look identical to people, and nothing in the UI says
"bot". A lobby you believe is full of people is more fun than one labelled as
padding, and the drawing engine is good enough to carry it.

Ranked lobbies are built in one shot and are never joinable afterwards, so a
game in progress can't be gate-crashed, and they start themselves — there's no
host, because nobody there chose anybody.

## Motion and feedback

Results are the payoff of a whole game, so they animate rather than just
appearing: the winner's trophy lands with a bounce, scores and trophies count
up, score rows and reveal cards cascade in, and a win gets a confetti burst
(only for the player who actually won). Phases cross-fade instead of cutting,
the matchmaking seats light up as people arrive, and the "waiting for the
others" screen has a progress bar so it reads as progress rather than a stall.

All of it is drawn procedurally in `app/lib/widgets/celebration.dart` — no GIF
or image assets. A few KB of code instead of megabytes of frames, sharp at any
screen density, and it uses the game's own palette rather than fighting it.

> One gotcha worth knowing if you add more: build `AnimationController`s in
> `initState`, not as a lazily-initialised `late final` field. A controller
> nothing touches gets constructed by `dispose()` instead, and building a
> ticker while unmounting throws.

## Money

One thing is paid for, and it's decoration.

**Free forever:** every mode, every prompt, the whole canvas, the leaderboard,
and the black pen, the yellow pen and the eraser. Between those three you can
draw anything a prompt asks for.

**Paid:** the other seven colours, plus paper and pen styles.

| | colours | paper & pens |
| --- | --- | --- |
| Watch one rewarded video | **24 hours** (stacks if you watch again) | no |
| One-off purchase | **forever** | **forever** |

Styles are never given away for an ad view, deliberately. If watching a video
unlocked everything, the purchase would have nothing left to offer — the paid
tier has to be worth more than the free route or it isn't a product. Colour is
what people miss first, so colour is what earns the ad view.

Paper and pen **travel with the drawing** (`paper` on the entry, `style` on
each stroke) so your entries look like yours when they come up in everyone
else's presentation. That visibility is the entire reason anyone buys a
cosmetic. Both are passed through the server untouched — it never interprets
them, and an unknown value just falls back to the free one, so old clients and
bot drawings render fine.

Papers are all light on purpose: a dark sheet would make the free black pen
invisible, which would turn a cosmetic into a trap.

The rule that makes this safe: **paying can never buy a better score.** Colour
is not worth points, the drawings are judged by other players, and a two-colour
drawing competes on equal terms. A competitive ladder where money buys an
advantage is a dead ladder.

**There are no interstitials, no banners, and nothing that interrupts a round.**
The only ad in the game is one the player chose to watch, from a sheet they
opened themselves — by tapping a locked colour, or one of the two small chips
in the corner of the drawing screen (`🎨` colours, `✨` paper & pens). The
colours chip disappears once unlocked; there's nothing left to sell, so it
stops asking.

`app/lib/services/entitlements.dart` owns what's unlocked and persists it.
`app/lib/services/store.dart` is the seam where the SDKs plug in — nothing else
in the app talks to an ad or billing library, so the two integrations can be
done independently.

### Testing the unlocks

A normal release build gets `UnavailableStore`: the buttons are there, and
every purchase politely fails. To build an APK where they actually grant what
they promise:

```bash
flutter build apk --release --dart-define=DEV_UNLOCKS=true
```

That build shows a green **TEST BUILD — nothing is charged and no ad plays**
line in the unlock sheet, so a test APK can't be mistaken for a real one.

The flag has to be explicit rather than an `assert`, because **asserts are
stripped from release builds** — an assertion guarding this would have done
nothing in the one build where it mattered, and free purchases would have
shipped.

> **Before release:** replace `DebugStore` with `google_mobile_ads` (a rewarded
> unit, the app id in the manifest and plist, and preloading so "watch" doesn't
> sit on a spinner) and `in_app_purchase` (a non-consumable in the Play
> Console, receipt verification, and a real `restorePurchases`). The price must
> come from the store at runtime — Play requires the localized price, and the
> hardcoded `₹99` is only a placeholder.

## The idle canvas

The home screen and the lobby both show a sheet of paper with a bot drawing on
it, line by line, in real time — a random problem appears, the drawing is
solved in front of you, its title lands, and the next one starts. Waiting for
friends to join is the dullest moment in a party game, so this fills it with
the thing the game is actually about.

How it works: nothing is streamed point by point. The server sends one whole
drawing (`request_doodle` → `doodle`), and because the doodle engine emits
strokes **in the order a hand would draw them**, the client just replays that
order on a clock — see `app/lib/widgets/live_doodle.dart`. Pen lifts between
strokes are charged time too, so it reads as separate pen strokes rather than
one long scribble. A typical drawing takes 10-15 seconds.

- The sentences come from `DEMO_PROMPTS` in `server/src/prompts.ts` — these
  ship **pre-filled**, unlike the round templates, because there's no player
  around to fill in a blank yet. They lean on words the doodle engine can
  depict (coffee, dogs, traffic) so the drawing matches the sentence.
- `request_doodle` deliberately requires no lobby and no phase, so the home
  screen can show one before anybody has joined anything.
- The home screen opens a **separate** WebSocket for this rather than sharing
  the game connection — joining a game reconnects that one, and a close/reopen
  mid-handshake would look like a dropped connection. It's closed while you're
  in a game and reopened when you come back.
- If no server is reachable, the card simply doesn't appear. Nothing else on
  the screen changes.

## Bots

Empty seats can be filled so a game works with fewer people. They use ordinary
first names, are never labelled in the UI, and are ordinary lobby members
server-side — every phase check treats them exactly like humans, so there's no
separate bot code path through the game.

What they do:

- **Draw** — a procedural doodle engine (`server/src/doodle/`) works out *what*
  to draw, then picks a **page layout** to stage it in.

  **What** comes from three tiers, most specific first. `WORD_SHAPES` in
  `doodle/compose.ts` maps ~180 concrete words to one specific drawing —
  *coffee* → a mug, *alarm* → an alarm clock, *tangled cables* → a cable knot.
  It's checked against **the blank the player filled in** before the rest of
  the sentence, because the answer is the only part anyone chose; the template
  around it is the same boilerplate every round. Failing that, topics are
  *scored* (answer words count 4×) and the best one picks from a small set of
  subjects. Failing that, a contraption — which fits every prompt in this game
  by definition.

  **How** is the layout: a centred hero, a tall stack, a wide production bench,
  a machine with eyes and limbs, a handheld gadget mid-use, someone wearing it,
  a machine facing the person it's for, a before/after pair of panels,
  something mounted overhead, the object itself with the homework bolted on, a
  patent sheet with callout bubbles, a heap of the same thing, an absurdly
  oversized version beside a normal person, one sitting on a table or shelf,
  three panels in sequence, or the thing ringed by the mess it deals with. When
  the subject is known, only layouts that actually stage it are eligible —
  knowing the prompt says "alarm" and then burying a clock under a generic
  contraption was the whole failure mode.

  **Watch the frequencies.** The idle canvas means people see a lot of these
  back to back, so anything that shows up in a third of drawings stops reading
  as detail and starts reading as "the same picture again". There's a
  measurement recipe in [Tests](#tests).

  The subtler trap is the **layout** distribution, which cost far more than any
  single part ever did. `NAMED_LAYOUTS` was `showcase`×5 plus three others,
  which looks balanced until you notice most answers people type *do* hit
  `WORD_SHAPES` — so that tiny pool is where nearly every drawing comes from,
  and `showcase` alone was 52% of all output while `tower`, `bench`, `creature`
  and `handheld` sat at ~1% each. Widening that pool to every layout that can
  stage a subject is the single biggest variety win available:

  | | share of drawings |
  | --- | --- |
  | most common layout | 18% (was 52%) |
  | generic contraption body | 34% (was 57%) |
  | distinct parts in a 600-drawing sample | 66 (was 51) |

  If you add parts, add a **layout** now and then too — arrangement varies the
  look far more than detailing does, and a layout only belongs in
  `NAMED_LAYOUTS` if it calls `chassis` or draws `ctx.subjects` itself. When
  adding a fitting, put it in the `details` pool rather than calling it directly
  from a layout, or it stacks on top of the pool's own odds. And watch the
  **stroke count**: a layout that repeats its subject (`pileUp`) can run to 140
  strokes if the subject is itself a composite, so it budgets by what the first
  copy actually cost.
- **Look hand-drawn** — `pen.ts` simulates an unsteady hand: lines bow slightly
  off-target, high-frequency tremor, circles that don't quite close, corner
  overshoot, jittered endpoints. Nothing is geometrically perfect.
- **Name their homework** — titles are built from a keyword mined out of the
  prompt, e.g. *"Trips-o-Matic 2.0"* for a road-trip prompt.
- **Invest** — they always spend their entire budget (leaving money unspent is
  strictly penalized), weighted randomly so they have favourites.
- **Take their time** — every action is delayed to 25–70% of the phase clock so
  the "3/5 submitted" counter creeps up like it would with real players.

They deliberately **do not** write the fill-in-the-blank prompts — that stays
with real players.

> **Honest limitation:** bots can't actually interpret a prompt the way a person
> can. There's no AI image model here; relevance comes from keyword matching
> against a fixed topic list in `doodle/compose.ts`. Prompts outside that list
> still get a generic (but convincing) contraption.

## Project layout

```
Game/
├── server/          Node.js + TypeScript WebSocket game server
│   └── src/
│       ├── index.ts       connection handling + phase orchestration
│       ├── rooms.ts        lobby state machine, both scoring modes, trophies
│       ├── matchmaking.ts  the ranked queue + bot backfill
│       ├── store.ts        SQLite profiles, trophies, leaderboard
│   └── test/e2e.mjs      full ranked + friendly run against a live server
│       ├── prompts.ts    fill-in-the-blank templates + idle-canvas sentences
│       ├── bots.ts       bot names, titles, investing behaviour, pacing
│       ├── doodle/       procedural hand-drawn doodle engine
│       │   ├── pen.ts      seeded RNG + wobbly line/ellipse/arc primitives
│       │   ├── parts.ts    reusable doodle parts (dials, wheels, flames…)
│       │   └── compose.ts  keyword matching + assembling a full drawing
│       └── types.ts      the wire protocol shared with the app
└── app/             Flutter app (Android + iOS)
    └── lib/
        ├── main.dart
        ├── theme.dart            colours & component styling in one place
        ├── models/               protocol data classes
        ├── services/             WebSocket connection, device identity
        ├── screens/              home, queue, leaderboard, and the
        │                         phase-driven game screen
        ├── views/                one view per game phase
        └── widgets/              drawing canvas, countdown timer,
                                  live_doodle.dart + doodle_stage.dart
                                  (the idle canvas), celebration.dart
                                  (confetti, count-ups, cascades)
```

## Playing on your phone (day-to-day, no rebuild needed)

The app is already installed on your phone as a normal app icon — you don't
need this computer's Terminal, `adb`, or Claude to "launch" it each time.

1. Start the server:
   - On a Mac: `./start-server.sh`
   - On Windows: double-click `start-server.bat`, or run it from a terminal.

   Both print the address to enter on your phone.
2. On your phone, open **The Grand Canvas** and tap **RANKED** or
   **PLAY WITH FRIENDS**.

That's it — the app looks for the server automatically on whatever Wi-Fi
network it's on (via mDNS/Bonjour, the same mechanism AirPlay uses), so
switching between home and office Wi-Fi doesn't need any manual address
entry. A small 🛜 icon next to "Server settings" confirms it found one.

If auto-discovery doesn't work (some office/corporate Wi-Fi blocks the
multicast traffic it relies on — usually called "client isolation" or "AP
isolation"), fall back to typing it manually: `start-server.sh` prints the
address to enter, tap **Server settings** to paste it in, and it's saved on
the phone from then on for that network.

You only need a computer-side rebuild (the `flutter run`/`adb` steps below)
when the app's *code* changes, not when your Wi-Fi changes.

## Running it (development)

### 1. Start the server

```bash
cd server
npm install       # first time only
npm run dev        # or use ./start-server.sh from the project root
```

It listens on `ws://0.0.0.0:8090`.

### 2. Run the app

**On the Android emulator:**

```bash
cd app
flutter run -d emulator-5554
```

The emulator reaches your Mac's server through a port bridge — run this once
while the emulator is up:

```bash
adb reverse tcp:8090 tcp:8090
```

**In a browser (fastest way to test with several players):**

```bash
cd app
flutter run -d chrome --web-port=5050
```

Open `http://localhost:5050` in three tabs — create a lobby in one, join with
the code in the others.

**On a real phone (same Wi-Fi as your Mac):**

1. Find your Mac's LAN IP: `ipconfig getifaddr en0`
2. In the app, tap **Server settings** and enter `<that-ip>:8090`.

### Environment setup (already done on this machine)

Node, Flutter, Java (OpenJDK), and the Android SDK are installed and on your
`PATH` via `~/.bash_profile`. Verify anytime with `flutter doctor`.

> **iOS still needs Xcode.** Install it from the Mac App Store, then run:
> ```bash
> sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
> sudo xcodebuild -runFirstLaunch
> sudo gem install cocoapods
> ```
> After that, `flutter run -d <ios-device>` will work. Everything in the app is
> cross-platform already — no code changes needed.

## Tests

```bash
cd app && flutter analyze && flutter test
cd server && npx tsc --noEmit -p .
```

The interesting behaviour is in the server's state machine, which unit tests
don't reach — so there's a full end-to-end run that drives real WebSocket
clients through a complete ranked game and a complete friendly game:

```bash
cd server
npm run dev          # in one terminal
npm run test:e2e     # in another
```

It covers identity persistence and rename, the ranked queue filling with bots,
a ranked game starting itself, trophies scaling with the human share, the
leaderboard excluding bots, and friendly games leaving the ladder untouched.
It takes a few minutes on purpose: bots deliberately use most of the phase
clock, and the run waits them out rather than faking the timings.

**Looking at the drawings** is the only way to check the doodle engine — the
useful questions ("does this read as a key?", "is the same mark in every
picture?") aren't assertable. Two throwaway techniques worth reusing:

- *Contact sheet.* Render a grid of drawings to SVG (one `<path>` per stroke),
  rasterise, and look at it. This is what caught a `keys()` that was
  geometrically a keyring and visually a stick figure, every time. On a Mac,
  `qlmanage -t`; on Windows there's no equivalent, so write the grid to an HTML
  file and screenshot it instead:

  ```bash
  chrome --headless --disable-gpu --screenshot=sheet.png \
         --window-size=1500,1180 --hide-scrollbars sheet.html
  ```
- *Frequency count.* Copy `doodle/{compose,parts,pen}.ts` to a scratch
  directory, swap `import * as parts` for a counting `Proxy`, and run a few
  hundred drawings. Counting each part once per drawing gives "share of
  drawings containing it", which is the number that matters for repetition.
  Doing this against `git show HEAD:...` too gives an honest before/after.

## Making it your own

- **Prompt templates** — edit `PROMPT_TEMPLATES` in `server/src/prompts.ts`.
  Each is a sentence with one `___` marking the blank a player fills in.
  `DEMO_PROMPTS` in the same file feeds the idle canvas and is already
  complete — no `___` in those.
- **Name and mark** — the logo is drawn in code (`app/lib/widgets/logo.dart`):
  a hand-drawn gallery frame with one stroke inside it, which is the game in
  one image. It draws itself on the title screen, the same trick the idle
  canvas uses. No image assets, so it stays sharp at every density and the
  launcher icon can be generated from it later.

  Renaming touches more than the display name: `android:label`, the iOS
  `CFBundle*` keys and usage string, and **both halves of the mDNS service
  name** (`SERVICE_TYPE` in `server/src/discovery.ts` and `_serviceName` in
  `app/lib/services/server_discovery.dart`) — change one without the other and
  auto-discovery silently stops working. The Dart package is still
  `bad_mental_canvas`; it's internal and renaming it would touch every import
  for no user-visible gain.
- **Look and feel** — `app/lib/theme.dart` holds everything: the palette, the
  lit `AppBackground` every screen sits on, `GameDecor.panel()` for cards, and
  the button surfaces.

  Buttons get their gradient, gloss and halo from `ButtonStyle.backgroundBuilder`
  in the theme rather than from a custom button widget, so every `FilledButton`
  and `OutlinedButton` already in the app inherits the look and there's one
  place to retune it. Panels use `GameDecor.panel(accent: …)` for the same
  reason — pass an accent colour for the thing the eye should land on, leave it
  null for everything else.
- **Timings** — the phase clocks are constants at the top of `server/src/rooms.ts`
  (`PROMPT_SECONDS`, `DRAW_SECONDS`, `INVEST_SECONDS`, `REVEAL_SECONDS`). If you
  change them, update the matching constants in the corresponding view files so
  the progress bars stay accurate.
- **How long ranked players wait for a match** — `BOT_FILL_SECONDS` in
  `server/src/matchmaking.ts`. See [Matchmaking](#matchmaking) before changing it.
- **Trophy payouts** — `TROPHIES_BY_PLACE` in `server/src/rooms.ts`. Friendly
  vote points are `RANKING_POINTS` in the same file.
- **Investment budget** — `INVESTMENT_BUDGET`, `INVESTMENT_STEP` and
  `PLACEMENT_BONUSES` in `server/src/rooms.ts`. The step is sent to the app at
  runtime, so only change it here. **Keep the step dividing the budget exactly**
  — otherwise players can't spend their full budget and always eat the
  unspent-money penalty.
- **Bot names** — `BOT_NAMES` in `server/src/bots.ts`.
- **What gets drawn** — add a shape to `server/src/doodle/parts.ts`, then wire
  it into `doodle/compose.ts`. For accuracy, the highest-leverage place is
  `WORD_SHAPES`: map the words people actually write straight to the shape.
  Otherwise the `details` pool (machine fittings), `TOPIC_SUBJECTS` (topical
  silhouettes) or `topicAccents` (garnish). A new topic needs keywords in
  `TOPIC_WORDS` plus one of those.

  **New page layouts** go in the same file — write one returning its focus
  `Box`, add it to `GENERAL_LAYOUTS`, and to `NAMED_LAYOUTS` too if it stages
  its subject rather than a machine. `MIN_STROKES` is the floor that stops a
  thin layout from looking abandoned.

  Worth knowing: shapes are judged by silhouette, not by how correct the
  geometry is. The first `keys()` hung two blades off a ring and every single
  one read as a stick figure; drawn side-on with a bow and teeth it's instantly
  a key. Render a contact sheet and look at it before trusting a new shape.
- **Custom art** — drop images into `app/assets/`, register them in
  `pubspec.yaml`, and reference them from the views. The game logic doesn't need
  to change.

## Before shipping to the Play Store

The game is fully playable, but these are needed for a public release:

1. **Host the server publicly — now required, not optional.** Ranked mode and
   the leaderboard only make sense against one shared server; right now each
   machine running `server/` has its own separate ladder, and matchmaking can
   only pair people on the same Wi-Fi. Deploy `server/` to something like
   Fly.io or Railway (cheap or free at this scale), then set the app's default
   server address — `_defaultServer` in `app/lib/screens/home_screen.dart` — to
   that host, and switch `ws://` to `wss://` in
   `app/lib/services/game_connection.dart` once you have TLS. Once there's a
   fixed public address, the mDNS auto-discovery (which only works on a local
   network) stops being necessary.

   **Give it a persistent disk** and point `DB_PATH` at it — on most hosts the
   filesystem is wiped on every deploy, which would reset the leaderboard.
2. **Application ID.** Currently `com.drawandfool.draw_and_fool` in
   `app/android/app/build.gradle.kts` (left over from before the rename — it's
   just an internal identifier, invisible to players). Change it to a domain
   you own before release — it can never be changed after your first Play
   Store upload.
3. **Signing key.** Create an upload keystore and wire it into a release
   `signingConfig`; the release build currently uses debug signing.
4. **App icon and name.** Replace the default Flutter launcher icons and set the
   display name in `AndroidManifest.xml`.
5. **Build the bundle:** `flutter build appbundle --release`
6. **Store listing.** Play requires a privacy policy, screenshots, a feature
   graphic, and a content rating questionnaire.

### Known considerations

- Games are held in memory, so restarting the server drops in-progress lobbies.
  That's fine for a party game. Profiles and trophies are *not* in memory — see
  [Profiles, trophies and the leaderboard](#profiles-trophies-and-the-leaderboard).
- There's no reconnect-into-a-running-game yet. If a player's phone drops, the
  round continues without them and the remaining players aren't blocked.
- **`MIN_PLAYERS_TO_START` is currently `1`** (in `server/src/rooms.ts`, mirrored
  by `_minPlayers` in `app/lib/views/lobby_view.dart`) so you can test a friendly
  game solo. Ranked games ignore it — they always fill to 5. Playing truly alone means nobody invests in your drawing,
  so it always raises $0 — add a couple of bots instead, which gives a real game
  loop with one person. Consider setting both back to `3` before release.
- Since only humans get writer turns, a lobby of 1 human + 2 bots is a
  **one-round** game. More humans means more rounds.
