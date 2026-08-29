#Requires -Version 5.1
$ErrorActionPreference = 'Continue'
$Root = 'C:\Users\J\Desktop\code_repo\retro-arcade'
Set-Location $Root

# Ensure studio files
if (-not (Test-Path "$Root\studio.js")) { Write-Host 'MISSING studio.js'; exit 1 }

Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='python.exe'" | Where-Object {
  $_.CommandLine -match 'studio\.js|http\.server 8123'
} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$studioLog = Join-Path $env:TEMP 'retro-studio.log'
Start-Process -FilePath 'node' -ArgumentList @('studio.js','--port','8788','--game','cave') `
  -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $studioLog -RedirectStandardError $studioLog
Start-Process -FilePath 'python' -ArgumentList @('-m','http.server','8123') `
  -WorkingDirectory $Root -WindowStyle Hidden
Start-Sleep -Seconds 1

# Refresh WSL fish config from temp
wsl -d Ubuntu -u j -- bash -lc "mkdir -p ~/.config/fish && cp /mnt/c/Users/J/AppData/Local/Temp/fish_config.fish ~/.config/fish/config.fish && sed -i 's|/opt/homebrew/bin||g; s|~/Downloads/Work/code_repo|/mnt/c/Users/J/Desktop/code_repo|g' ~/.config/fish/config.fish"

$wt = "$env:LOCALAPPDATA\Microsoft\WindowsApps\wt.exe"
# 4 panes: watch / suite / monitor / player-log — each in WSL fish where possible
# watch/suite/monitor are PowerShell scripts; wrap with fish banner via wsl for player, and Cyberpunk WT scheme
$p1 = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\debug-watch.ps1`""
$p2 = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\debug-suite.ps1`""
$p3 = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$Root\debug-monitor.ps1`""
$p4 = "wsl -d Ubuntu -u j -- fish -c `"echo '◆ WIN STUDIO'; echo studio http://127.0.0.1:8788; echo player http://127.0.0.1:8123/?auto=cave; echo; nvim --version | head -1; echo; tail -f /mnt/c/Users/J/AppData/Local/Temp/retro-studio.log`""

& $wt -w 0 nt --title "RA-WATCH" --colorScheme "Cyberpunk Neon" cmd /c $p1 `; `
  split-pane -V --title "RA-SUITE" --colorScheme "Cyberpunk Neon" cmd /c $p2 `; `
  move-focus left `; `
  split-pane -H --title "RA-MONITOR" --colorScheme "Cyberpunk Neon" cmd /c $p3 `; `
  move-focus right `; `
  split-pane -H --title "RA-FISH-LOG" --colorScheme "Cyberpunk Neon" cmd /c $p4

Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:8788/'
Start-Process 'http://127.0.0.1:8123/?auto=cave'
# open nvim in a floating WSL fish window for cyberpunk edit
Start-Process $wt -ArgumentList @('-w','0','nt','--title','RA-NVIM','--colorScheme','Cyberpunk Neon','wsl','-d','Ubuntu','-u','j','--','fish','-c','cd /mnt/c/Users/J/Desktop/code_repo/retro-arcade; nvim studio.js')
Write-Host 'WIN fish/cyberpunk studio relaunched'
