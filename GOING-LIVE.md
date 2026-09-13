# Going live — the manual steps, in plain words

The game is finished. What's left is the handful of things only you can do,
because they need your accounts and your passwords. The full walkthrough, with
tick-boxes and copy buttons, is the "Grand Canvas Launch Checklist" artifact;
this file is the same plan in short, so it lives with the code.

Monthly cost: **~₹400** for one small server in Bangalore; nothing else
recurs. One-time: **$25** for the Play Store account.

Everything you fill in goes in one file, `.env`, at the top of the repo
(copy `.env.example` and fill it in; `.env` is ignored by git).

---

## 0. How it fits together

```
phone app ──wss──▶ grandcanvas.duckdns.org ──▶ Caddy (:443) ──▶ game server (:8090) ──▶ ~/data/leaderboard.db
             (free name, DuckDNS)      (free HTTPS)     (Node 24, a service)     (SQLite: the whole database)
```

There is no separate database service to pay for. The SQLite file is the
database; the server's disk is where it lives; `deploy/backup.sh` copies it
nightly.

## 1. A server: DigitalOcean, Bangalore, $4/month

Oracle's free VM rejected the cards (it does that to many Indian cards, and
it has cut its free tier once without warning). Google Cloud's free VM is
US-only. A plain rented Ubuntu server in India for ~₹400/month is the
simplest thing that works, and nothing about the game is tied to who rents
it: Vultr (Mumbai, from $2.50), Hostinger (takes UPI) or any Ubuntu 24.04
box work with the same scripts.

1. Sign up at digitalocean.com; card or PayPal.
2. Make an SSH key on the laptop:
   `ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\grandcanvas`, then
   `Get-Content $env:USERPROFILE\.ssh\grandcanvas.pub` and copy the line.
3. Create → Droplets: region **Bangalore**, image **Ubuntu 24.04**, size
   Basic / Regular / **$4** (512 MB is plenty; $6 for 1 GB if you like),
   authentication **SSH key** → paste the line, hostname `grandcanvas`.
4. Copy the IPv4 address. `ssh -i $env:USERPROFILE\.ssh\grandcanvas root@<ip>`
   works → done.

`.env`: `VM_PUBLIC_IP`, `SSH_KEY_PATH`.

## 2. A free name: DuckDNS

Sign in at duckdns.org, add `grandcanvas` (or another), set it to the server's
IP. `nslookup grandcanvas.duckdns.org` should print the IP.

`.env`: `SERVER=grandcanvas.duckdns.org`, `DUCKDNS_DOMAIN`, `DUCKDNS_TOKEN`.

## 3. Install the game server

Needs the latest code pushed to GitHub first. Then, on the server:

```
curl -fsSL https://raw.githubusercontent.com/LakshayBaijal/The-Grand-Canvas---Game/main/deploy/setup-vm.sh | bash -s -- grandcanvas.duckdns.org
```

Installs Node 24 and Caddy, runs the server as a service that restarts
itself, gets the HTTPS certificate, sets up nightly backups to `~/backups`.
Safe to re-run. Then `https://grandcanvas.duckdns.org` in a browser: a
padlock and "Upgrade Required" means it works (the server only speaks the
game's protocol).

Build the app against it: `.\build-app.ps1` → `GrandCanvas.apk`. Test from
two phones on different networks.

On the server, later: `sudo systemctl status grandcanvas`,
`journalctl -u grandcanvas -f`, `~/grandcanvas/deploy/update.sh`.

## 4. Google sign-in (optional; keeps trophies across phones)

1. console.cloud.google.com → new project "Grand Canvas".
2. OAuth consent screen: External, app name, your email. **Publish app**
   (basic profile needs no review; "Testing" caps sign-ins at 100 people).
3. Credentials → OAuth client ID → **Web application** → copy the client id.
   This one value goes in both `GOOGLE_CLIENT_ID` (server) and
   `GOOGLE_SERVER_CLIENT_ID` (app build).
4. Credentials → OAuth client ID → **Android**, package
   `com.whosegames.grandcanvas`, one per SHA-1: the debug key, the upload key
   (step 5), and Play's app-signing key (step 7). Get a SHA-1 with
   `keytool -list -v -keystore <file> -alias <alias> | Select-String SHA1`
   (debug: `%USERPROFILE%\.android\debug.keystore`, alias `androiddebugkey`,
   password `android`).
5. On the server: `nano ~/grandcanvas/.env`, set `GOOGLE_CLIENT_ID`, then
   `sudo systemctl restart grandcanvas`.
6. Rebuild the app; test "Link Google account".

## 5. A signing key (once, keep forever)

```
keytool -genkey -v -keystore app\android\upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
Copy-Item app\android\key.properties.example app\android\key.properties   # then fill in the passwords
```

Both files are ignored by git. Back up the `.jks` and its password to two
places that aren't this laptop; lose it and the app can never be updated.
Without `key.properties`, release builds silently use the debug key: fine for
installing by hand, rejected by the Play Console.

## 6. Build for the store

`.\build-app.ps1 -Bundle` → `GrandCanvas.aab`. Before each later release,
raise the `+N` in `version:` in `app/pubspec.yaml`.

## 7. Play Console ($25 once; new personal accounts wait 14 days)

1. play.google.com/console, personal account, pay, verify identity.
2. Privacy policy URL is required (Google sign-in). `docs/privacy.html` is
   ready; put your contact email in it, then GitHub → Settings → Pages →
   main, `/docs`.
3. Create app "Grand Canvas", Game, Free. Fill the Dashboard questionnaires
   (has ads; user-generated drawings shared with other users; 13+; data
   safety: nickname, user id, drawings; nothing shared; deletion on request).
4. Store listing: 512×512 icon, 1024×500 feature graphic, 2+ screenshots,
   descriptions. (Ask; I'll make these.)
5. App integrity → App signing → copy the **app signing key's SHA-1** → add an
   Android client for it in step 4. Skip this and sign-in fails only in the
   store build.
6. Closed testing: upload the `.aab`, 12 testers opted in for 14 continuous
   days (required for personal accounts created after Nov 2023).
7. Apply for production access, then promote to Production.

## 8. Routine

| When | What |
|---|---|
| Code changed | on the server: `~/grandcanvas/deploy/update.sh` |
| App changed | bump `+N`, `.\build-app.ps1 -Bundle`, upload |
| Monthly | `scp -i <key> ubuntu@<ip>:backups/*.db D:\backups\` |

## If something breaks

| You see | Do |
|---|---|
| "Can't reach the server" | `sudo systemctl status grandcanvas`; `journalctl -u grandcanvas -n 50`; check `SERVER=` |
| Certificate warning | name → this IP? `sudo journalctl -u caddy -n 30` |
| Sign-in fails only in store build | step 7.5 |
| Sign-in fails everywhere | `GOOGLE_CLIENT_ID` on server ≠ `GOOGLE_SERVER_CLIENT_ID` in build; restart after editing |
| Server IP changed | update DuckDNS |
| Play Console rejects bundle | signed with debug key: `app\android\key.properties` missing |

## Never share

The SSH private key, the keystore or its password, the DuckDNS token, any
account password. The DuckDNS name, the Web client id and the server's IP are
fine to share.
