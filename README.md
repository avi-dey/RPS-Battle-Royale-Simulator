# RPS Battle Royale Simulator

A simulation of Rock Paper Scissors units chasing each other. Highly configurable.

- Each unit chases the nearest unit it can defeat, or flees the nearest unit that can defeat it — whichever is closer.
- On contact, the loser converts to the winner's kind.
- When only one kind remains, the game ends; either exits (if a seed was specified) or restarts with a fresh random seed.

## Requirements

Node.js 18+

## Browser GUI

```bash
npm run web
```

Open http://localhost:8080/ — optional query params: `?u=50&d=30&seed=123&showstats&blocks=5&bg=#222`

## Headless (Node)

```bash
node src/cli.js --windowless --seed 42 -u 50
# or
npm run headless -- --seed 42 -u 50
```

Run `node src/cli.js --help` for all options (`-s`, `-u`, `-d`, `--seed`, `-n`, `--no-ff`, `--blocks`, `--no-log`, etc.).

## Source layout

- `src/arena.js` — simulation core (shared)
- `src/browser.js` + `index.html` — canvas UI
- `src/cli.js` — Node headless runner

## Features

- **Fast Forward:** When only two kinds remain and one beats the other (eventual victory), delay auto-switches to 1 ms to speed up the finish. Enabled by default; disable with `--no-ff`.
- **Deterministic runs:** `--seed` fixes the RNG seed (plays a single game and exits).
- **Logging:** `rps_battle_royale_log.txt` records settings, a header row, conversion snapshots, and an end-of-game summary including elapsed time and total simulation step count.

## Command-line options

* `-u N`, `--units N`
  Number of units per emoji kind (default `50`).
  With 3 kinds, total units = `N * 3`.

* `-d MS`, `--delay MS`
  Tick delay in milliseconds (default `30`). Minimum is 1.

* `--seed INT`
  Use a fixed random seed. If multiple games are run, the first game uses this seed, then increments sequentially (`seed+1`, `seed+2`, ...).

* `-n N`, `--num-games N`
  Number of games to run. `0` = unlimited (default).
  In headless mode, the process exits after the last game.

* `--no-ff`
  Disable fast-forward. Normally, if only two kinds remain and one beats the other, the simulation speeds up by setting delay to 1ms.

## Logging

* `--logfile FILE`
  Log file name (default `rps_battle_royale_log.txt`).

* `--no-log`
  Disable writing to the log file (stdout logs still shown unless `--quiet`).

* `-q`, `--quiet`
  Suppress stdout logging.
  Combine with `--no-log` for a fully silent run.

Example log file:

```
start=2025-08-23 12:34:56 | size=1000x700 | units=150 | delay_ms=30 | seed=987654 | kinds=paper,rock,scissors | fast_forward=on
step,📄,🪨,✂️
42,60,55,35
57,65,50,35
--snip--
game_end at 2025-08-23 12:35:49; elapsed=53.123s; steps=172
```

### Blocks / Obstacles

* `--blocks N`
  Place `N` random rectangular blocks that units cannot enter. Blocks are regenerated on each reset.
  Each block is ≤ 20% of arena area. Overlap is allowed.

* `--blocks FILE.json`
  Use fixed blocks from JSON file.
  Format:

  ```json
  {
    "blocks": [
      {"top": 0, "left": 0, "width": 100, "height": 100, "color": "green"},
      {"top": 200, "left": 150, "width": 150, "height": 80}
    ]
  }
  ```

  * `color` is optional (auto-contrasts with background if missing).
  * JSON blocks are reused on each reset.

### Windowless mode

* `--windowless`
  Run without the browser UI.

  * Defaults to 1 game unless `-n` is specified.
  * No rendering; runs as fast as possible.
  * Logs are printed to stdout unless `--quiet` is set, and optionally to file unless `--no-log` is set.
