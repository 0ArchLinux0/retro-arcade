#!/bin/zsh
# Retro Arcade — headless test watch loop (Ctrl+C 로 중지)
cd "$(dirname "$0")"

while true; do
  clear
  echo "╔══════════════════════════════════════════╗"
  echo "║   RETRO ARCADE · DEBUG TEST WATCH        ║"
  echo "╚══════════════════════════════════════════╝"
  echo "⏱  $(date '+%H:%M:%S')"
  echo ""

  echo "── syntax check ──"
  ok=1
  for f in js/core.js js/audio.js js/lobby.js js/games/*.js; do
    node --check "$f" 2>/dev/null || { echo "  ✘ SYNTAX ERROR: $f"; ok=0; }
  done
  [ $ok -eq 1 ] && echo "  ✔ all files OK"
  echo ""

  echo "── headless game sims ──"
  node tests/run-headless.js 2>&1
  echo ""

  echo "── race lap verification ──"
  node tests/diag-race.js 2>&1 | tail -3
  echo ""

  echo "──────────────────────────────────────────"
  echo " 15초 후 재실행… (Ctrl+C로 중지)"
  sleep 15
done
