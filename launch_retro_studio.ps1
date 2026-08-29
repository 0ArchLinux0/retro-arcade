#Requires -Version 5.1
$ErrorActionPreference = 'Continue'
$Root = 'C:\Users\J\Desktop\code_repo\retro-arcade'
Set-Location $Root

# Kill prior studio/http on known ports
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -match 'studio\.js|http\.server 8123'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# Start studio server (4-quad web) in background
$studioLog = Join-Path $env:TEMP 'retro-studio.log'
Start-Process -FilePath 'node' -ArgumentList @('studio.js','--port','8788','--game','cave') `
  -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $studioLog -RedirectStandardError $studioLog
Start-Sleep -Seconds 1

# Also plain player server on 8123
Start-Process -FilePath 'python' -ArgumentList @('-m','http.server','8123') `
  -WorkingDirectory $Root -WindowStyle Hidden
Start-Sleep -Seconds 1

# 4-pane Windows Terminal:
# 1 watch (hot reload / tests)
# 2 suite (debugger cycler)
# 3 monitor (resource)
# 4 player logs / studio SSE curl-ish tail
$wt = "$env:LOCALAPPDATA\Microsoft\WindowsApps\wt.exe"
if (-not (Test-Path $wt)) { $wt = 'wt.exe' }

$p1 = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\debug-watch.ps1`""
$p2 = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\debug-suite.ps1`""
$p3 = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\debug-monitor.ps1`""
$p4 = "powershell -NoProfile -Command `"Set-Location '$Root'; Write-Host 'Q4 PLAYER / LOGS' -ForegroundColor Magenta; Write-Host 'studio http://127.0.0.1:8788'; Write-Host 'player http://127.0.0.1:8123/?auto=cave'; Get-Content -Wait -Tail 40 '$env:TEMP\retro-studio.log'`""

# 2x2 grid
& $wt -w 0 nt --title "RA-WATCH" cmd /c $p1 `; `
  split-pane -V --title "RA-SUITE" cmd /c $p2 `; `
  move-focus left `; `
  split-pane -H --title "RA-MONITOR" cmd /c $p3 `; `
  move-focus right `; `
  split-pane -H --title "RA-PLAYER-LOG" cmd /c $p4

Start-Sleep -Seconds 2

# Open real playing scene (studio 4-split + dedicated player)
Start-Process 'http://127.0.0.1:8788/'
Start-Sleep -Milliseconds 800
Start-Process 'http://127.0.0.1:8123/?auto=cave'
Start-Process 'http://127.0.0.1:8123/studio.html'

Write-Host "LAUNCHED studio=:8788 player=:8123/?auto=cave wt=4panes"
