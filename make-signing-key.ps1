# Makes the upload key the Play Store will know this app by, once, and
# writes android/key.properties so builds sign with it.
#
#   .\make-signing-key.ps1
#
# Run it once in your life for this app. It refuses to overwrite an existing
# key on purpose: the Play Store only accepts updates signed with the key of
# the first upload, so replacing it would make the app impossible to update.
# After this, run .\backup-secrets.ps1 and put the file it makes somewhere
# safe. Two somewheres.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$keystore = Join-Path $root "app\android\upload-keystore.jks"
$props = Join-Path $root "app\android\key.properties"

$keytool = "keytool"
foreach ($candidate in @("D:\dev\jdk17\bin\keytool.exe", "D:\dev\jdk21\bin\keytool.exe")) {
    if (Test-Path $candidate) { $keytool = $candidate; break }
}

if (Test-Path $keystore) {
    Write-Host ""
    Write-Host "A signing key already exists at:"
    Write-Host "  $keystore"
    Write-Host "Not touching it. If you really mean to start over (you almost never do),"
    Write-Host "move that file away first."
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Choose a password for the key. Write it in a password manager NOW;"
Write-Host "there is no way to recover it, and without it the app can never be updated."
Write-Host ""
$p1 = Read-Host "Password (at least 8 characters)" -AsSecureString
$p2 = Read-Host "Same password again" -AsSecureString
$plain1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
$plain2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
if ($plain1 -ne $plain2) { Write-Host "They don't match. Run it again."; exit 1 }
if ($plain1.Length -lt 8) { Write-Host "Too short. Run it again."; exit 1 }

& $keytool -genkeypair -v `
    -keystore $keystore -storetype PKCS12 `
    -alias upload -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $plain1 -keypass $plain1 `
    -dname "CN=Whose?Games, OU=Grand Canvas, O=Whose?Games, L=Delhi, C=IN"
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $keystore)) { Write-Host "keytool failed; see above."; exit 1 }

@"
storePassword=$plain1
keyPassword=$plain1
keyAlias=upload
storeFile=../upload-keystore.jks
"@ | Set-Content -Path $props -Encoding ASCII

Write-Host ""
Write-Host "Made:"
Write-Host "  $keystore"
Write-Host "  $props   (holds the password; both files are ignored by git)"
Write-Host ""
Write-Host "The key's SHA-1 (you'll paste this into Google Cloud for sign-in):"
& $keytool -list -v -keystore $keystore -alias upload -storepass $plain1 | Select-String "SHA1:"
Write-Host ""
Write-Host "NOW run:  .\backup-secrets.ps1"
