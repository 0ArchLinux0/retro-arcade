#!/usr/bin/env zsh
# Retro Arcade — resource monitor (debugger CLI window #3)
# CPU/메모리/프로세스 상태를 2초마다 갱신. Ctrl+C 로 중지.
cd "$(dirname "$0")"

while true; do
  clear
  echo "╔══════════════════════════════════════════╗"
  echo "║  RETRO ARCADE · RESOURCE MONITOR         ║"
  echo "║  $(date '+%H:%M:%S')                              ║"
  echo "╚══════════════════════════════════════════╝"

  echo "── system load ──"
  uptime
  echo ""
  echo "── memory (pressure) ──"
  memory_pressure -Q 2>/dev/null | head -1 || vm_stat | head -4
  echo ""
  echo "── top CPU processes ──"
  ps -Ao pcpu,pmem,comm -r | head -6
  echo ""
  echo "── arcade dev processes ──"
  procs=$(ps -Ao pid,pcpu,time,command | rg -i "node.*(run-headless|verify|diag)|chrome.*retro|http-server|python.*http" | rg -v "rg -i" || true)
  if [ -n "$procs" ]; then
    echo "$procs"
  else
    echo "  (none running)"
  fi
  echo ""
  echo "── disk (project) ──"
  du -sh . 2>/dev/null
  echo ""
  echo "▶ 2초 후 갱신… (Ctrl+C 중지)"
  sleep 2
done
