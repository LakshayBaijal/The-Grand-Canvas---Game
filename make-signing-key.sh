#!/bin/bash
# Mac/Linux twin of make-signing-key.ps1: makes the upload key the Play Store
# will know this app by, once, and writes app/android/key.properties so
# release builds sign with it.
#
#   ./make-signing-key.sh
#
# Run it once in your life for this app. It refuses to overwrite an existing
# key: the Play Store only accepts updates signed with the key of the first
# upload, so replacing it would make the app impossible to update. The
# password is generated and written into key.properties; back that file and
# the .jks up together, in two places that are not this machine.
set -euo pipefail
cd "$(dirname "$0")"
KS="app/android/upload-keystore.jks"; PROPS="app/android/key.properties"
if [ -f "$KS" ]; then echo "A signing key already exists at $KS. Not touching it."; exit 1; fi
command -v keytool >/dev/null || { echo "keytool not found (install a JDK, or Android Studio)"; exit 1; }
PASS="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-28)"
keytool -genkeypair -v -keystore "$KS" -alias upload -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Grand Canvas, O=Whose?Games, C=IN" >/dev/null 2>&1
cat > "$PROPS" <<P
storePassword=$PASS
keyPassword=$PASS
keyAlias=upload
storeFile=../upload-keystore.jks
P
chmod 600 "$PROPS" "$KS"
echo "Made $KS and $PROPS."
echo
echo "SHA-1 of the upload key (for the Android OAuth client in Google Cloud):"
keytool -list -v -keystore "$KS" -alias upload -storepass "$PASS" 2>/dev/null | grep -E "SHA1:" | sed 's/^\s*//'
echo
echo "BACK UP NOW: copy app/android/upload-keystore.jks and app/android/key.properties"
echo "to two places that are not this computer. Lose them and the app can never be updated."
