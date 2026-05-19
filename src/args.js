import {
  DEFAULT_BACKGROUND,
  DEFAULT_BLOCKS,
  DEFAULT_DELAY_MS,
  DEFAULT_HEIGHT,
  DEFAULT_LOGFILE,
  DEFAULT_UNITS_PER_KIND,
  DEFAULT_WIDTH,
} from "./constants.js";

export function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    units: DEFAULT_UNITS_PER_KIND,
    delay: DEFAULT_DELAY_MS,
    seed: null,
    numGames: 0,
    noFf: false,
    bg: DEFAULT_BACKGROUND,
    countdown: 0,
    windowless: false,
    quiet: false,
    showstats: false,
    blocks: DEFAULT_BLOCKS,
    noLog: false,
    logfile: DEFAULT_LOGFILE,
    help: false,
  };

  const args = [...argv];
  while (args.length > 0) {
    const a = args.shift();
    switch (a) {
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "-s":
      case "--size": {
        const w = parseInt(args.shift(), 10);
        const h = parseInt(args.shift(), 10);
        if (!Number.isFinite(w) || !Number.isFinite(h)) {
          throw new Error("--size requires WIDTH HEIGHT");
        }
        opts.width = w;
        opts.height = h;
        break;
      }
      case "-u":
      case "--units":
        opts.units = parseInt(args.shift(), 10);
        break;
      case "-d":
      case "--delay":
        opts.delay = parseInt(args.shift(), 10);
        break;
      case "--seed":
        opts.seed = parseInt(args.shift(), 10);
        break;
      case "-n":
      case "--num-games":
        opts.numGames = parseInt(args.shift(), 10);
        break;
      case "--no-ff":
        opts.noFf = true;
        break;
      case "--bg":
        opts.bg = args.shift();
        break;
      case "--countdown":
        opts.countdown = parseInt(args.shift(), 10);
        break;
      case "--windowless":
        opts.windowless = true;
        break;
      case "-q":
      case "--quiet":
        opts.quiet = true;
        break;
      case "--showstats":
        opts.showstats = true;
        break;
      case "--blocks":
        opts.blocks = args.shift();
        break;
      case "--no-log":
        opts.noLog = true;
        break;
      case "--logfile":
        opts.logfile = args.shift();
        break;
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (opts.windowless && opts.numGames === 0) {
    opts.numGames = 1;
  }
  opts.delayMs = opts.delay > 0 ? opts.delay : 1;
  return opts;
}

export function printHelp() {
  console.log(`RPS Arena

usage: rpsarena [options]

options:
  -h, --help            show this help message and exit
  -s, --size WIDTH HEIGHT
                        Window size (default ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT})
  -u, --units N         Units per emoji kind (default ${DEFAULT_UNITS_PER_KIND})
  -d, --delay MS        Tick delay in ms (default ${DEFAULT_DELAY_MS})
  --seed INT            Random seed for first game; then seed+1, seed+2, ...
  -n, --num-games N     Number of games (0=unlimited)
  --no-ff               Disable fast-forward when one kind wins
  --bg COLOR|FILE       Background color or image path (windowed / web)
  --countdown SEC       Pause after placement (windowed / web)
  --windowless          Run without GUI (Node only)
  -q, --quiet           Suppress stdout logging
  --showstats           Show stats overlay (windowed / web)
  --blocks N|FILE.json  Random block count or JSON obstacles
  --no-log              Disable log file
  --logfile FILE        Log file (default ${DEFAULT_LOGFILE})
`);
}
