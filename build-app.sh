#!/bin/bash
# Mac/Linux twin of build-app.ps1: builds the phone app with the settings
# from .env, so the --dart-define flags never have to be remembered.
#
#   ./build-app.sh            -> GrandCanvas.apk in this folder (install directly)
#   ./build-app.sh --bundle   -> GrandCanvas.aab in this folder (Play Store)
#
# Reads SERVER, GOOGLE_SERVER_CLIENT_ID, ADMOB_BANNER_ID, ADMOB_REWARDED_ID
# and PASS_PRODUCT_ID from .env. Refuses to build with SERVER empty: an APK
# pointing at localhost looks exactly like a working one until it's on a
# phone, and that has cost an afternoon already.
#
# Signing: a release build is signed with app/android/key.properties if it
# exists, otherwise with the debug key. Android will not install a
# debug-signed build over an upload-signed one (or the reverse) -- it says
# "App not installed" and changes nothing. Build on whichever machine holds
# the keystore, or uninstall first (which loses the device account).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "No .env next to this script. Copy .env.example to .env and set SERVER=grandcanvas.duckdns.org"; exit 1
fi
# One value from .env, by key. (macOS bash is 3.x: no associative arrays.)
setting() { { grep -E "^[[:space:]]*$1=" .env || true; } | tail -1 | sed 's/^[^=]*=//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'; }

SERVER="$(setting SERVER)"
[ -n "$SERVER" ] || { echo "SERVER is empty in .env -- the app would connect to localhost. Set it and rerun."; exit 1; }

defines=(--dart-define=SERVER="$SERVER")
for k in GOOGLE_SERVER_CLIENT_ID ADMOB_BANNER_ID ADMOB_REWARDED_ID PASS_PRODUCT_ID; do
  v="$(setting "$k")"
  [ -n "$v" ] && defines+=(--dart-define="$k=$v")
done

signing="DEBUG key (won't install over a Play/upload-signed build)"
[ -f app/android/key.properties ] && signing="upload key"
echo "Server:  $SERVER"
echo "Google:  $([ -n "$(setting GOOGLE_SERVER_CLIENT_ID)" ] && echo ON || echo OFF)"
echo "Signing: $signing"
echo "Commit:  $(git log --oneline -1)"
echo

cd app
if [ "${1:-}" = "--bundle" ]; then
  flutter build appbundle --release "${defines[@]}"
  cp build/app/outputs/bundle/release/app-release.aab ../GrandCanvas.aab
  echo; echo "Done: GrandCanvas.aab (upload this in the Play Console)"
else
  flutter build apk --release "${defines[@]}"
  cp build/app/outputs/flutter-apk/app-release.apk ../GrandCanvas.apk
  echo; echo "Done: GrandCanvas.apk"
  echo "Install:  adb install -r GrandCanvas.apk   (or copy the file to the phone and open it)"
fi
