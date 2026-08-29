#Requires -Version 5.1
# Retro Arcade — resource monitor (window #3). Ctrl+C 로 중지.
# 맥 debug-monitor.sh 의 Windows 포팅.
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

function Banner($title) {
  Clear-Host
  Write-Host ("+" + ("=" * 46) + "+") -ForegroundColor Cyan
  Write-Host ("|  RETRO ARCADE · " + $title.PadRight(31) + "|") -ForegroundColor Cyan
  Write-Host ("|  " + (Get-Date -Format 'HH:mm:ss').PadRight(43) + "|") -ForegroundColor Cyan
  Write-Host ("+" + ("=" * 46) + "+") -ForegroundColor Cyan
}

while ($true) {
  Banner "RESOURCE MONITOR"

  Write-Host "-- system load --"
  $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  Write-Host ("  CPU: " + [math]::Round($cpu, 1) + "%")
  Write-Host ""

  Write-Host "-- memory --"
  $os = Get-CimInstance Win32_OperatingSystem
  $totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
  $freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  $usedPct = [math]::Round((($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize) * 100, 1)
  Write-Host ("  RAM: " + $freeGB + "GB free / " + $totalGB + "GB (" + $usedPct + "% used)")
  Write-Host ""

  Write-Host "-- top CPU processes --"
  Get-Process | Sort-Object CPU -Descending | Select-Object -First 6 |
    ForEach-Object { Write-Host ("  {0,-28} cpu={1,8:N1}s mem={2,6:N0}MB" -f $_.ProcessName.Substring(0, [Math]::Min(28, $_.ProcessName.Length)), $_.CPU, ($_.WorkingSet64 / 1MB)) }
  Write-Host ""

  Write-Host "-- arcade dev processes --"
  $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='python.exe'" |
    Where-Object { $_.CommandLine -match 'http\.server|run-headless|verify-|retro' } |
    Select-Object ProcessId, CommandLine
  if ($procs) {
    foreach ($p in $procs) {
      $cl = if ($p.CommandLine.Length -gt 70) { $p.CommandLine.Substring(0, 70) + "..." } else { $p.CommandLine }
      Write-Host ("  PID " + $p.ProcessId + "  " + $cl)
    }
  } else {
    Write-Host "  (none running)"
  }
  Write-Host ""

  Write-Host "-- disk (project) --"
  $sz = (Get-ChildItem . -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  Write-Host ("  project size: " + [math]::Round($sz / 1MB, 1) + "MB")
  Write-Host ""
  Write-Host "2초 후 갱신… (Ctrl+C 중지)"
  Start-Sleep -Seconds 2
}
