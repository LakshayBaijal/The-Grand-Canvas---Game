#!/bin/bash
# Mac/Linux twin of build-app.ps1: builds the phone app with the settings
# from .env, so the --dart-define flags never have to be remembered.
#
#   ./build-app.sh            -> GrandCanvas.apk in this folder (install directly)
#   ./build-app.sh --bundle   -> GrandCanvas.aab in this folder (Play Store)
#   ./build-app.sh --ios      -> GrandCanvas.ipa (App Store / TestFlight; needs Xcode)
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
for k in GOOGLE_SERVER_CLIENT_ID ADMOB_BANNER_ID ADMOB_REWARDED_ID ADMOB_BANNER_ID_IOS ADMOB_REWARDED_ID_IOS PASS_PRODUCT_ID; do
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
# iOS reads its Google and AdMob ids from the Xcode build, not from dart
# defines: Info.plist needs them as build settings. Written every time so a
# changed .env is never stale.
IOS_CID="$(setting GOOGLE_IOS_CLIENT_ID)"
IOS_REV="com.whosegames.grandcanvas.nosignin"
if [ -n "$IOS_CID" ]; then IOS_REV="com.googleusercontent.apps.${IOS_CID%%.apps.googleusercontent.com}"; fi
IOS_ADMOB="$(setting ADMOB_APP_ID_IOS)"; [ -n "$IOS_ADMOB" ] || IOS_ADMOB="ca-app-pub-3940256099942544~1458002511"
cat > ios/Flutter/Secrets.xcconfig <<XC
GOOGLE_IOS_CLIENT_ID = $IOS_CID
GOOGLE_IOS_REVERSED_CLIENT_ID = $IOS_REV
GOOGLE_SERVER_CLIENT_ID = $(setting GOOGLE_SERVER_CLIENT_ID)
ADMOB_APP_ID_IOS = $IOS_ADMOB
XC

if [ "${1:-}" = "--ios" ]; then
  command -v xcodebuild >/dev/null || { echo "Xcode is not installed (App Store -> Xcode), then: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer"; exit 1; }
  echo "iOS sign-in: $([ -n "$IOS_CID" ] && echo ON || echo OFF)"
  flutter build ipa --release "${defines[@]}"
  cp build/ios/ipa/*.ipa ../GrandCanvas.ipa 2>/dev/null && { echo; echo "Done: GrandCanvas.ipa (upload with Transporter, or Xcode -> Organizer)"; }
elif [ "${1:-}" = "--bundle" ]; then
  flutter build appbundle --release "${defines[@]}"
  cp build/app/outputs/bundle/release/app-release.aab ../GrandCanvas.aab
  echo; echo "Done: GrandCanvas.aab (upload this in the Play Console)"
else
  flutter build apk --release "${defines[@]}"
  cp build/app/outputs/flutter-apk/app-release.apk ../GrandCanvas.apk
  echo; echo "Done: GrandCanvas.apk"
  echo "Install:  adb install -r GrandCanvas.apk   (or copy the file to the phone and open it)"
fi
