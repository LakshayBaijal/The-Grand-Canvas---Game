# Bundles the three files that cannot be recreated if this laptop dies:
#
#   .env                              every id and address the game uses
#   app\android\upload-keystore.jks   the Play Store signing key
#   app\android\key.properties        its password
#
# into one dated zip in the folder above the repo, then tells you where to
# put it. Run it after any of those change. Takes two seconds.
#
#   .\backup-secrets.ps1
#
# Lose the keystore and the app can never be updated on the Play Store again
# (you'd be publishing a new app, with a new name, from zero installs). The
# zip is small; keep one copy in Google Drive and one on a USB stick, and
# never email it or put it in git.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @(
    (Join-Path $root ".env"),
    (Join-Path $root "app\android\upload-keystore.jks"),
    (Join-Path $root "app\android\key.properties")
)
$present = @($files | Where-Object { Test-Path $_ })
$missing = @($files | Where-Object { -not (Test-Path $_) })

if ($present.Count -eq 0) {
    Write-Host "Nothing to back up yet: no .env and no signing key. Run .\make-signing-key.ps1 first."
    exit 1
}

$stamp = Get-Date -Format "yyyy-MM-dd"
$outDir = Join-Path (Split-Path -Parent $root) "GrandCanvas Secrets"
New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir "grandcanvas-secrets-$stamp.zip"
if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path $present -DestinationPath $out -CompressionLevel Optimal

Write-Host ""
Write-Host "Backed up:"
foreach ($f in $present) { Write-Host "  + $f" }
foreach ($f in $missing) { Write-Host "  - (not there yet) $f" }
Write-Host ""
Write-Host "Into:  $out"
Write-Host ""
Write-Host "Now put a copy of that zip in TWO places that aren't this laptop:"
Write-Host "  1. Google Drive (a private folder)"
Write-Host "  2. A USB stick, or a second computer"
Write-Host "Never email it, never put it in git. If you ever need it back, unzip"
Write-Host "the files to the same paths and the builds sign again."
Write-Host ""
if ($missing.Count -gt 0) {
    Write-Host "Reminder: the signing key isn't made yet. Run .\make-signing-key.ps1 then this again."
}
Start-Process explorer.exe $outDir
