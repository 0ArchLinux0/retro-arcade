# Cinema Dual + Clear Tour — debug notes (2026-08-26)

## What we built
- `cinema.html` — dual pane **GAME ⇄ TERMINAL** with timed focus swap (cinematic recording)
- `studio.js` serves cinema by default; `/studio` for 4-quad; `/api/tour-verify` per-game syntax check
- Tour cycles all **21** games via `?auto=<id>`

## Bugs found & fixed
| Issue | Fix |
|---|---|
| Headless expected **15** lobby cards, lobby has **21** | `run-headless.js` now asserts `GAMES.length` |
| New games not loaded in headless | Added loads + drive sims for cave/lander/astro/memory/mole/ghostmaze |
| ALL-ROUNDER still “13종” / threshold 13 | Updated to **21** in `js/meta.js` (+ www mirror) |
| `memory.js` EXIT button `onClick =>` (syntax crash) | Fixed to `onClick: () =>` |
| `memory.js` / `mole.js` used `input` without destructuring | Added `input` from `RA` |

## Stage-clear semantics
| Game type | Clear meaning in tour |
|---|---|
| brickbreak | 5 stages |
| rpg | 5 floors |
| racing | 3 laps |
| shooter | wave clears |
| endless | timed survival + score progress |
| memory/mole | round complete via taps |

## Record
```bash
./tools/cinema-record-mac.sh
```

## Follow-ups
- [ ] Bot drivers for brickbreak stages 1–5 in browser `?demo=1`
- [ ] Refresh LAUNCH.md / README “13종” → “21종”
- [ ] `./make-www.sh` after meta change
