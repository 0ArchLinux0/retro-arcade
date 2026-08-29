#Requires -Version 5.1
# Retro Arcade — dramatic 8-split desk (4 terminals + 6-game live wall)
param([switch]$WallOnly)

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

$up = $false
try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 8123); $c.Close(); $up = $true } catch { }
if (-not $up) {
  Start-Process -WindowStyle Hidden python -ArgumentList "-m", "http.server", "8123", "--bind", "127.0.0.1" -WorkingDirectory (Split-Path $PSScriptRoot)
  Start-Sleep 2
}

if (-not $WallOnly) {
  $watch = 'powershell -NoProfile -ExecutionPolicy Bypass -File "{0}\debug-watch.ps1"' -f $PSScriptRoot
  $suite = 'powershell -NoProfile -ExecutionPolicy Bypass -File "{0}\debug-suite.ps1"' -f $PSScriptRoot
  $mon   = 'powershell -NoProfile -ExecutionPolicy Bypass -File "{0}\debug-monitor.ps1"' -f $PSScriptRoot
  $orch  = "Set-Location 'C:\Users\J\Desktop\code_repo\Orch'; while(1){Clear-Host; node orch.mjs status; Start-Sleep 10}"

  wt nt --title TEST-WATCH powershell -NoProfile -Command $watch `
    ; sp - --size 0.5 --title SUITE powershell -NoProfile -Command $suite `
    ; mf prev ; sp + --size 0.5 --title MONITOR powershell -NoProfile -Command $mon `
    ; mf prev ; sp + --size 0.5 --title ORCH-STATUS powershell -NoProfile -Command $orch
  Write-Host "[TERM] 2x2 terminal grid launched"
}

Start-Sleep 1

$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
Start-Process $edge -ArgumentList "--app=http://localhost:8123/tools/wall.html", "--window-size=1020,1150", "--window-position=1030,0"
Write-Host "[WALL] 6-game live wall on right half"
Write-Host ""
Write-Host "Left : TEST WATCH | SUITE | MONITOR | ORCH STATUS"
Write-Host "Right: pong / snake / flappy / blockfall / brickbreak / runner"
