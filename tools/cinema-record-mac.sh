#!/bin/zsh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT=8799
LOG=/tmp/retro-cinema.log
# Prefer Capture screen 0 (avfoundation index can drift — probe it)
SCREEN_IDX=$(ffmpeg -f avfoundation -list_devices true -i "" 2>&1 \
  | rg -o '\[([0-9]+)\] Capture screen 0' -r '$1' | head -1)
SCREEN_IDX=${SCREEN_IDX:-5}

lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
nohup node studio.js --port $PORT >"$LOG" 2>&1 &
sleep 1
URL="http://127.0.0.1:${PORT}/cinema.html?sec=7&swap=3.5"
open -a "Google Chrome" "$URL" 2>/dev/null || open -a Safari "$URL"
osascript <<OSA
tell application "Google Chrome" to activate
tell application "iTerm"
  activate
  try
    create window with profile "Cyberpunk Neon"
  on error
    create window with default profile
  end try
  tell current session of current window
    set name to "RA-CINEMA-TERM"
    write text "cd ~/Downloads/Work/code_repo/retro-arcade; /opt/homebrew/bin/fish -c 'echo ◆ CINEMA TERM; while true; clear; date; echo; node tests/run-headless.js 2>&1 | tail -28; echo; echo ── 18s cycle ──; sleep 18; end'"
  end tell
end tell
OSA
sleep 2
osascript -e 'tell application "Google Chrome" to activate' 2>/dev/null || true
OUT="$HOME/Desktop/retro-arcade-cinema-$(date +%H%M%S).mp4"
echo "Recording screen[$SCREEN_IDX] → $OUT (50s)  cinema=$URL"
ffmpeg -y -f avfoundation -capture_cursor 1 -framerate 30 -i "${SCREEN_IDX}:none" \
  -t 50 -pix_fmt uyvy422 -c:v libx264 -preset veryfast -crf 20 "$OUT" 2>/tmp/cinema-ffmpeg.log
ls -lh "$OUT"
grep -E 'frame=|error|Error|time=' /tmp/cinema-ffmpeg.log | tail -8 || true
echo "DONE $OUT"
