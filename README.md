[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/gunawanp-ux/best-flight-game-20261126/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/gunawanp-ux/best-flight-game-20261126/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# Awan Courier — Island Run

A complete, original 3D flight game that plays offline in a desktop browser. You fly **Si Kancil**, a little teal-and-orange mail plane, over three procedurally built islands: thread every golden ring, dodge storm cells and mountain peaks, and bring her down on the runway before the clock runs out.

Built for the [make.fun "Make the best flight game" bounty](https://make.fun/c/best-flight-game-20261126-0057).

## How to play

Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network request — every file the game loads lives under `game/` (Three.js is vendored as `game/vendor/three.module.min.js`).

| Control | Action |
| --- | --- |
| ← → or A / D | Bank and turn |
| ↑ ↓ or W / S | Climb and dive (mouse steers too) |
| SHIFT | Throttle up |
| Hold CLICK | Boost |
| P | Pause |
| R | Restart the level |
| ENTER / CLICK | Start, continue, retry |

## The run

- **3 islands, 3 levels** — Pulau Hijau (green, calm), Pulau Badai (storm cells), Puncak Salju (snowy peaks, thin air). Each level has its own ring course, timer and difficulty.
- **Rings** — fly through a golden ring for +100 × combo and +3 seconds. A beacon beam and the HUD arrow point at the next one.
- **Hazards** — storm clouds chew the hull, mountains and water end the run. Hull damage is shown on the HUD; three hard hits and the mail doesn't get through.
- **Landing** — once every ring is flown, line up slow and level on the runway strip. Land clean for a time bonus, then on to the next island. Finish all three for the mission-complete screen.

## Instruments

Chase view over the island with a lit HUD: compass strip with heading, speed and altitude tapes, an attitude indicator, throttle and hull bars, ring counter, combo, countdown timer, and a steering arrow with distance to the next ring (or the runway).

## Screenshots

`1-start.jpg` title screen on the runway · `2-play.jpg` mid-course through the rings · `3-landing.jpg` final approach · `4-end.jpg` mission complete. All are real renders of this game's own code, taken in headless Chromium (see `shots.json` for the exact URLs).

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the kit's vendored `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE). All art, names and code are original.
