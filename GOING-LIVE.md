# Going live — the manual steps, in plain words

The game is finished. What's left is the handful of things only you can do,
because they need your accounts and your passwords. Do them in this order; each
one is short. Budget an evening for all of it.

Everything here assumes the code is pushed to your GitHub repo
(`LakshayBaijal/The-Grand-Canvas---Game`).

---

## 1. Put the server on the internet

Right now the server runs on your laptop, and phones can only reach it on the
same Wi-Fi. For strangers to play Ranked, for the leaderboard to be one
leaderboard, and for the Daily to be *global*, the server has to live on a
computer that is always on and reachable from anywhere. You rent one.

**Use Railway** (railway.app). It is the least fiddly option: it reads your
repo, builds it, gives you a URL, and costs about $5 a month at this size.

1. Go to railway.app and sign up with your GitHub account.
2. **New Project → Deploy from GitHub repo** → pick the game's repo.
3. It will try to build the whole repo. Tell it the server is in a folder:
   open the service → **Settings** → **Root Directory** → type `server`.
4. Still in Settings, check **Build** shows `npm install` and **Start** shows
   `npm start`. If Start is empty, type `npm start`. (`server/package.json`
   already tells it to build with `tsc` first and which Node version to use —
   it needs Node 22 or newer, and that's pinned in the file.)
5. **Give it a disk that survives restarts.** This is the step people miss.
   Without it, every time Railway redeploys, the database is wiped: every
   profile, every trophy, every Hall of Fame entry — gone.
   - Right-click the service → **Add Volume**. Mount path: `/data`.
   - Open **Variables** and add: `DB_PATH` = `/data/leaderboard.db`.
6. Open **Settings → Networking → Generate Domain**. You get something like
   `grandcanvas-production.up.railway.app`. **Copy it.** That's your server's
   address from now on.
7. Click **Deploy**. Wait for the log to say
   `Grand Canvas server listening on ws://0.0.0.0:...`.

That's it. The server is live. (Fly.io and Render work too, the steps are the
same shape: root directory `server`, a persistent volume at `/data`, `DB_PATH`
pointing into it.)

**Two things to know about this server:**
- Games in progress live in memory. When you redeploy, running games end.
  Deploy at a quiet hour.
- Profiles, trophies, drawings and the Hall of Fame live on the disk from
  step 5. **Back it up** now and then: in Railway, open the volume and use
  **Download**, or run `railway volume`… honestly, downloading the
  `leaderboard.db` file once a week is enough. It's a single file.

---

## 2. Point the app at it

No code to edit. The app's default server address is baked in at build time
from a `SERVER` value, so you pass the domain you copied when you build — just
the hostname, no `https://`, no port:

```
flutter build appbundle --release --dart-define=SERVER=grandcanvas-production.up.railway.app
```

(Same for an APK for friends: `flutter build apk --release --dart-define=SERVER=…`.
Without `--dart-define` it defaults to `localhost:8090`, which is only right on
an emulator. Put the full command in `commands.txt` once and copy it from there.)

The app works out on its own that a hostname needs a secure connection
(`wss://`) while a Wi-Fi address (`192.168…`) uses a plain one — see
`serverUri()` in `game_connection.dart`. Players can still type a different
address in the advanced box if they ever want to run their own.

---

## 3. Google sign-in (optional, but do it)

Without this, a player who loses their phone loses their trophies. With it,
signing in on a new phone brings everything back. It takes ten minutes.

1. Go to console.cloud.google.com → create a project called *Grand Canvas*.
2. **APIs & Services → OAuth consent screen** → External → fill in the app
   name, your email, and save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   twice:
   - Type **Web application**. Copy the **Client ID** it gives you. This is
     the one the server checks tokens against.
   - Type **Android**. Package name: `com.whosegames.grandcanvas`.
     SHA-1: the fingerprint of your **signing key** from section 4 — get it
     with the `keytool -list` command there. (Do section 4 first, then come
     back for this one.)
4. Give the server the Web client ID: in Railway → **Variables** → add
   `GOOGLE_CLIENT_ID` = the ID from step 3. Redeploy.

If you skip this, nothing breaks — the sign-in button simply doesn't appear.

---

## 4. A signing key (do this once, keep it forever)

Android apps are signed with a key. The Play Store ties your app to that key
**permanently**: lose it and you can never update the app again. So: make it
once, back it up in two places, never regenerate it.

In a terminal:

```
keytool -genkey -v -keystore grandcanvas-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

It asks for a password (choose one, write it down) and some name fields (put
anything sensible). You get a file `grandcanvas-upload.jks`. **Copy it
somewhere safe — a password manager, a USB stick, your email to yourself.**
Do not commit it to git.

Then tell the build about it. Create `app/android/key.properties`:

```
storePassword=THE_PASSWORD_YOU_CHOSE
keyPassword=THE_PASSWORD_YOU_CHOSE
keyAlias=upload
storeFile=C:/path/to/grandcanvas-upload.jks
```

And in `app/android/app/build.gradle.kts`, replace the release block that
currently says `signingConfig = signingConfigs.getByName("debug")` with a real
one — the Flutter docs page "Build and release an Android app" has the exact
twelve lines under *Configure signing in gradle*; paste them in. (I left the
debug signing in place deliberately: a signing config needs *your* key file,
and I can't make that for you.)

To get the SHA-1 for Google sign-in (section 3):

```
keytool -list -v -keystore grandcanvas-upload.jks -alias upload
```

Add `key.properties` and `*.jks` to `.gitignore` if they aren't already.

---

## 5. Build the thing you upload

Play wants an **app bundle** (`.aab`), not an APK. From the repo root:

```
cd app
flutter build appbundle --release
```

The file is at `app/build/app/outputs/bundle/release/app-release.aab`.

(APKs are still what you hand to friends directly — `commands.txt` has that
command. Both come from the same code.)

---

## 6. The Play Console

play.google.com/console. There is a **one-time $25 fee** for a developer
account. Then:

1. **Create app** → name *Grand Canvas*, free, game.
2. It gives you a checklist called **Set up your app**. Work down it; the
   ones that need actual thought are:
   - **Privacy policy.** You need a public web page with one. Write it
     plainly: the app stores a name and an id on the device; drawings people
     make and the prompts they write are stored on the server and shown to
     other players; the Daily's drawings are public to everyone who took
     part; hearts are public; if you plan to use drawings for anything else
     (you mentioned training), say so here. Host it anywhere — a GitHub
     Pages page is free.
   - **Data safety.** It asks what you collect. Be honest: user-generated
     content (drawings, text), a device id, optionally a Google account id.
     Not sold, not shared with third parties.
   - **Content rating.** A questionnaire. Answer it straight; it's a drawing
     game, you'll land on Everyone or Teen depending on the UGC answers.
   - **Store listing.** Icon (512×512 — render `icon_full.png` from
     `app/assets/icon/` at that size), a feature graphic (1024×500 — the
     brand kit's lockup works), at least two phone screenshots (take them on
     your phone), and a short description. "Draw badly. Win anyway." is the
     tagline.
3. **Release → Testing → Internal testing** first. Upload the `.aab`, add
   your own email as a tester, install it from the link it gives you, and
   play a full game against the internet server. Only then:
4. **Release → Production → Create release**, upload the same `.aab`, and
   send it for review. First review takes a few days; updates are usually
   hours.

---

## 7. After launch — the routine

- **Updating the game:** change code → push to GitHub. Railway redeploys the
  server by itself. For the app, bump `version:` in `app/pubspec.yaml` (the
  number after `+` must go up every upload), build the `.aab`, upload a new
  release. Players get it from the store.
- **The database** is the one thing to protect. Download `leaderboard.db`
  from the Railway volume weekly. That file *is* the game's memory.
- **The Daily** runs itself: prompts are scheduled for over a year, old
  galleries are pruned after 30 days, the Hall of Fame is frozen and paid at
  midnight UTC automatically. Nothing to do.
- **Logs:** Railway → your service → Logs. A line starting `[stall]` or
  `[fatal-averted]` is worth reading; everything else is normal chatter.
- **Costs:** Railway ~$5/month, Play $25 once, a domain (optional) ~$10/year.

---

## If something goes wrong

| Symptom | Almost always |
| --- | --- |
| App says "Can't reach the server" | `_defaultServer` still points at the Wi-Fi address, or the Railway service is asleep/crashed — check its Logs. |
| Leaderboard reset to nothing after a deploy | No volume, or `DB_PATH` not pointing into it (section 1, step 5). |
| Google sign-in button missing | `GOOGLE_CLIENT_ID` not set on the server. |
| Google sign-in fails on the phone | The Android OAuth client's SHA-1 doesn't match the key that signed the build. |
| Play rejects the upload | Version code not bumped, or the bundle was signed with a different key than last time. |

You built the game. This list is just the paperwork.
