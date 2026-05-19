#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { RPSArena } from "./arena.js";
import { parseBlocksOption } from "./blocks.js";
import { parseArgs, printHelp } from "./args.js";

function main() {
  let opts;
  try {
    opts = parseArgs();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  if (opts.help) {
    printHelp();
    return;
  }

  if (!opts.windowless) {
    console.error(
      "Windowed mode uses the browser UI. Run: npm run web\n" +
        "Or use --windowless for headless simulation in Node."
    );
    process.exit(1);
  }

  let blocksConfig;
  try {
    blocksConfig = parseBlocksOption(opts.blocks, {
      readJsonFile(file) {
        const filePath = path.resolve(file);
        if (!fs.existsSync(filePath)) {
          throw new Error(
            `--blocks expects an integer or a JSON file path. Not found: ${file}`
          );
        }
        try {
          return JSON.parse(fs.readFileSync(filePath, "utf8"));
        } catch (e) {
          throw new Error(`Failed to read JSON file for --blocks: ${e.message}`);
        }
      },
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const arena = new RPSArena({
    width: opts.width,
    height: opts.height,
    unitsPerKind: opts.units,
    delayMs: opts.delayMs,
    fixedSeed: opts.seed,
    numGames: opts.numGames,
    logFilename: opts.logfile,
    noLog: opts.noLog,
    ffEnabled: !opts.noFf,
    backgroundColor: opts.bg,
    windowless: true,
    quiet: opts.quiet,
    ...blocksConfig,
  });

  if (!opts.noLog) {
    arena.setLogSink((msg) => {
      fs.appendFileSync(opts.logfile, msg + "\n", "utf8");
    });
  }

  arena.runWindowless();
}

main();
