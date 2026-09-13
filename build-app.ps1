# Builds the phone app with the settings from .env, so you never have to
# remember the --dart-define flags.
#
#   .\build-app.ps1            -> GrandCanvas.apk in this folder (for installing directly)
#   .\build-app.ps1 -Bundle    -> GrandCanvas.aab in this folder (for the Play Store)
#
# Reads SERVER and GOOGLE_SERVER_CLIENT_ID from .env (copy .env.example to
# .env and fill it in). With SERVER empty the app connects to localhost:8090,
# which is only useful for playing on your own Wi-Fi.
param([switch]$Bundle)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root ".env"
$settings = @{}
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        $t = $line.Trim()
        if ($t -eq "" -or $t.StartsWith("#")) { continue }
        $i = $t.IndexOf("=")
        if ($i -lt 1) { continue }
        $settings[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
} else {
    Write-Host "No .env file found next to this script; building with defaults (localhost server, no Google sign-in)."
    Write-Host "Copy .env.example to .env and fill it in for a real build."
}

$defines = @()
if ($settings["SERVER"]) { $defines += "--dart-define=SERVER=$($settings['SERVER'])" }
if ($settings["GOOGLE_SERVER_CLIENT_ID"]) { $defines += "--dart-define=GOOGLE_SERVER_CLIENT_ID=$($settings['GOOGLE_SERVER_CLIENT_ID'])" }

$serverShown = "localhost:8090 (default)"
if ($settings["SERVER"]) { $serverShown = $settings["SERVER"] }
$googleShown = "OFF"
if ($settings["GOOGLE_SERVER_CLIENT_ID"]) { $googleShown = "ON" }
Write-Host ""
Write-Host "Server the app will connect to: $serverShown"
Write-Host "Google sign-in: $googleShown"
Write-Host ""

Push-Location (Join-Path $root "app")
try {
    if ($Bundle) {
        & flutter build appbundle --release @defines
        if ($LASTEXITCODE -ne 0) { throw "flutter build failed" }
        Copy-Item "build\app\outputs\bundle\release\app-release.aab" (Join-Path $root "GrandCanvas.aab") -Force
        Write-Host ""
        Write-Host "Done: GrandCanvas.aab (upload this in the Play Console)"
    } else {
        & flutter build apk --release @defines
        if ($LASTEXITCODE -ne 0) { throw "flutter build failed" }
        Copy-Item "build\app\outputs\flutter-apk\app-release.apk" (Join-Path $root "GrandCanvas.apk") -Force
        Write-Host ""
        Write-Host "Done: GrandCanvas.apk (copy to a phone and install)"
    }
} finally {
    Pop-Location
}
