# Best-effort LAN IPv4 address for a phone on the same Wi-Fi to connect to.
# Used by start-server.bat -- kept as its own file so that script doesn't have
# to fight cmd.exe's quoting rules to embed this logic inline.
$candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback' }

$ip = $candidates |
    Sort-Object -Property @{Expression = { $_.InterfaceAlias -match 'Wi-Fi' }; Descending = $true } |
    Select-Object -First 1 -ExpandProperty IPAddress

if ($ip) { Write-Output $ip } else { Write-Output '<no wifi found>' }
