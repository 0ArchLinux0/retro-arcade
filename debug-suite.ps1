#Requires -Version 5.1
# Retro Arcade — full test suite cycler (window #2). Ctrl+C 로 중지.
# 맥 debug-suite.sh 의 Windows 포팅.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

function Banner($title) {
  Clear-Host
  Write-Host ("+" + ("=" * 46) + "+") -ForegroundColor Cyan
  Write-Host ("|  RETRO ARCADE · " + $title.PadRight(31) + "|") -ForegroundColor Cyan
  Write-Host ("|  " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss').PadRight(43) + "|") -ForegroundColor Cyan
  Write-Host ("+" + ("=" * 46) + "+") -ForegroundColor Cyan
}

function Run([string]$title, [string]$cmd) {
  Write-Host ("+--[$title]" + ("-" * 20)) -ForegroundColor DarkCyan
  $out = cmd /c $cmd 2>&1
  if ($LASTEXITCODE -eq 0) {
    $out | Select-Object -Last 4 | ForEach-Object { Write-Host "  $_" }
    Write-Host "L-- PASS" -ForegroundColor Green
  } else {
    $out | Select-Object -Last 12 | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Write-Host "L-- FAIL" -ForegroundColor Red
  }
}

while ($true) {
  Banner "TEST SUITE CYCLER"

  Run "syntax" "node --check js/core.js && node --check js/audio.js && node --check js/lobby.js"
  Run "headless suite (15 games)" "node tests/run-headless.js"
  Run "verify: blockfall" "node tests/verify-blockfall.js"
  Run "verify: brickbreak" "node tests/verify-brickbreak.js"
  Run "verify: pong" "node tests/verify-pong.js"
  Run "verify: racing laps" "node tests/verify-race.js"
  Run "verify: cave" "node tests/verify-cave.js"

  Write-Host ""
  Write-Host "다음 사이클까지 20초… (Ctrl+C 중지)"
  Start-Sleep -Seconds 20
}
