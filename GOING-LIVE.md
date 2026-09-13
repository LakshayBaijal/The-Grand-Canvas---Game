# Going live — the manual steps, in plain words

The game is finished. What's left is the handful of things only you can do,
because they need your accounts and your passwords. The full walkthrough, with
tick-boxes and copy buttons, is the "Grand Canvas Launch Checklist" artifact;
this file is the same plan in short, so it lives with the code.

Monthly cost: **₹0**, using a US Always Free VM. One-time: **$25** for the
Play Store account.

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

## 1. A server: Google Cloud, free forever

Google Cloud's Always Free tier gives one small VM (`e2-micro`) for ₹0/month,
forever, but only in three regions: `us-west1`, `us-central1`, `us-east1`.
Outside those (Mumbai included) it's billed. The trade for free-forever is
latency: players in India see roughly 200-300ms extra round trip to a US
server, which doesn't matter for a game with no fast reflexes in it.

1. console.cloud.google.com → Compute Engine → VM instances → enable the
   API when it asks (~1 min) → **Create Instance**.
2. Name `grandcanvas`. Region **us-central1**. Machine: **E2** series →
   **e2-micro**.
3. Boot disk → Change → Ubuntu → **Ubuntu 24.04 LTS**, 10 GB (30 GB is the
   Always Free limit, so up to that is still free) → Select.
4. Firewall: tick **Allow HTTP traffic** and **Allow HTTPS traffic**.
5. Create. Copy the **External IP**.
6. Click the **SSH** button next to the instance in the console — it opens
   a browser terminal already logged in, no key to generate. That's enough
   to run the setup script below. (A local key, `ssh-keygen -t ed25519 -f
   $env:USERPROFILE\.ssh\grandcanvas` added under the VM's "Add SSH key",
   is only needed later for `scp`-ing backups from the laptop.)

`.env`: `VM_PUBLIC_IP`, `GOOGLE_CLOUD_PROJECT_ID`.

**The catch to know about:** Always Free also caps outbound data at 1 GB a
month from a US region. A drawing's data is tiny (vector strokes, not
images), so this comfortably covers casual play; if the game gets properly
popular, watch Billing → Reports for a network egress charge — small at
$0.12/GB — rather than being surprised by it later.

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
.\make-signing-key.ps1     # asks for a password, makes the key, writes key.properties
.ackup-secrets.ps1       # zips .env + the key + its password into ..\GrandCanvas Secrets```

Put that zip in **two** places that aren't this laptop (Google Drive and a
USB stick). Lose the key and the app can never be updated on the Play Store
again; there is no recovery. Both files are ignored by git. Re-run
`backup-secrets.ps1` whenever `.env` changes. Without `key.properties`,
release builds silently use the debug key: fine for installing by hand,
rejected by the Play Console.

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
