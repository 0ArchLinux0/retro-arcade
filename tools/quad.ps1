#Requires -Version 5.1
# Retro Arcade — 4분할 데스크 원클릭 런처 (Windows)
# 맥세션의 4분할(iTerm 3터미널+플레이창)을 Windows Terminal 스플릿으로 재현.
#
# 구성:
#   ┌──────────────┬──────────────┐
#   │ 1 debug-watch│ 2 debug-suite│
#   ├──────────────┼──────────────┤
#   │ 3 monitor    │ 4 플레이/녹화 │
#   └──────────────┴──────────────┘
#
# 사용: quad.ps1 [-NoRecord]   (녹화기 없이 게임만 열려면 -NoRecord)

param([switch]$NoRecord)

$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

# 정적 서버 기동 (기존에 떠 있으면 재사용)
$port = 8123
$up = $false
try {
  $c = New-Object Net.Sockets.TcpClient('127.0.0.1', $port); $c.Close(); $up = $true
} catch { }
if (-not $up) {
  Write-Host "[quad] 정적 서버 기동: http://localhost:$port"
  Start-Process -WindowStyle Hidden python -ArgumentList "-m", "http.server", $port, "--bind", "127.0.0.1" -WorkingDirectory $PSScriptRoot
  Start-Sleep -Seconds 2
} else {
  Write-Host "[quad] 서버 이미 실행 중 (포트 $port)"
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if ($wt) {
  # Windows Terminal 4분할
  $watch  = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\debug-watch.ps1`""
  $suite  = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\debug-suite.ps1`""
  $mon    = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\debug-monitor.ps1`""
  # 첫 창 = watch, 우측 분할 = suite, 아래 분할 = monitor, 마지막 분할 = 브라우저 포커스용
  Start-Process wt.exe -ArgumentList @(
    "nt", "--title", "watch", "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\debug-watch.ps1", ";",
    "sp", "-", "--title", "suite", "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\debug-suite.ps1", ";",
    "mf", "prev", ";",
    "sp", "-", "sp", "+", "--title", "monitor", "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\debug-monitor.ps1"
  )
  Write-Host "[quad] Windows Terminal 4분할 기동 완료"
} else {
  Write-Host "[quad] wt.exe 미발견 — 개별 창으로 기동합니다."
  Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\debug-watch.ps1"
  Start-Sleep 1
  Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\debug-suite.ps1"
  Start-Sleep 1
  Start-Process powershell -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\debug-monitor.ps1"
}

# 4번째 칸: 게임(자동실행) 또는 셀프 녹화기
$page = if ($NoRecord) { "../index.html?auto=pong" } else { "record.html" }
Start-Process "http://localhost:$port/tools/$page"
Write-Host "[quad] 브라우저: http://localhost:$port/$page"
Write-Host ""
Write-Host "종료: 각 터미널에서 Ctrl+C · 서버 중지는 Get-Process python | Stop-Process (주의: 다른 파이썬도 죽음)"
