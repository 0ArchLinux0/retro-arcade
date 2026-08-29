#Requires -Version 5.1
# Retro Arcade — headless test watch loop (window #1). Ctrl+C 로 중지.
# 맥 debug-watch.sh 의 Windows 포팅.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

function Banner($title) {
  Clear-Host
  Write-Host ("+" + ("=" * 46) + "+") -ForegroundColor Cyan
  Write-Host ("|  RETRO ARCADE · " + $title.PadRight(31) + "|") -ForegroundColor Cyan
  Write-Host ("|  " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss').PadRight(43) + "|") -ForegroundColor Cyan
  Write-Host ("+" + ("=" * 46) + "+") -ForegroundColor Cyan
}

while ($true) {
  Banner "DEBUG TEST WATCH"
  Write-Host ("  clock: " + (Get-Date -Format 'HH:mm:ss'))
  Write-Host ""

  Write-Host "-- syntax check --"
  $ok = $true
  foreach ($f in @(Get-ChildItem "js\*.js", "js\games\*.js" -ErrorAction SilentlyContinue)) {
    node --check $f.FullName 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host ("  x SYNTAX ERROR: " + $f.Name) -ForegroundColor Red; $ok = $false }
  }
  if ($ok) { Write-Host "  v all files OK" -ForegroundColor Green }
  Write-Host ""

  Write-Host "-- headless game sims --"
  node tests/run-headless.js 2>&1
  Write-Host ""

  Write-Host "-- race lap verification --"
  node tests/diag-race.js 2>&1 | Select-Object -Last 3
  Write-Host ""

  Write-Host "15초 후 재실행… (Ctrl+C로 중지)"
  Start-Sleep -Seconds 15
}
