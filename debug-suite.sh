#!/bin/zsh
# Retro Arcade — debugger CLI window #1: full test suite cycler
# Runs the headless suite + all targeted verifiers on a loop with a big
# PASS/FAIL banner. Ctrl+C 로 중지.
cd "$(dirname "$0")"

run() { # $1=title, rest=cmd — prints ✔/✘ banner per step
  echo "┌─[$1]──────────────────────────────"
  if out=$("$@" 2>&1); then
    echo "$out" | tail -4
    echo "└─ ✔ PASS"
  else
    echo "$out" | tail -12
    echo "└─ ✘ FAIL"
  fi
}

while true; do
  clear
  echo "╔══════════════════════════════════════════╗"
  echo "║  RETRO ARCADE · TEST SUITE CYCLER        ║"
  echo "║  $(date '+%Y-%m-%d %H:%M:%S')                      ║"
  echo "╚══════════════════════════════════════════╝"

  run "syntax" zsh -c 'for f in js/core.js js/audio.js js/lobby.js js/games/*.js; do node --check "$f" || exit 1; done && echo "all files OK"'
  run "headless suite (12 games)" node tests/run-headless.js
  run "verify: blockfall" node tests/verify-blockfall.js
  run "verify: brickbreak" node tests/verify-brickbreak.js
  run "verify: pong" node tests/verify-pong.js
  run "verify: racing laps" node tests/verify-race.js

  echo ""
  echo "▶ 다음 사이클까지 20초… (Ctrl+C 중지)"
  sleep 20
done
