import {
  DEFAULT_BACKGROUND,
  DEFAULT_BLOCKS,
  DEFAULT_DELAY_MS,
  DEFAULT_HEIGHT,
  DEFAULT_LOGFILE,
  DEFAULT_UNITS_PER_KIND,
  DEFAULT_WIDTH,
  POSTGAME_DELAY_MS,
} from "./constants.js";
import { RPSBattleRoyaleSimulator, pickContrastColorFromRgb } from "./arena.js";
import { ICON_DRAW_SIZE, loadIcons } from "./icons.js";
import {
  averageRgbFromImageData,
  pickContrastColor,
  rgbFromNameOrHex,
} from "./color.js";
import { createRng } from "./random.js";
import { parseBlocksFromJson, parseBlocksOption } from "./blocks.js";

function paramsFromUrl() {
  const p = new URLSearchParams(location.search);
  return {
    width: parseInt(p.get("w") ?? p.get("width"), 10) || DEFAULT_WIDTH,
    height: parseInt(p.get("h") ?? p.get("height"), 10) || DEFAULT_HEIGHT,
    units: parseInt(p.get("u") ?? p.get("units"), 10) || DEFAULT_UNITS_PER_KIND,
    delay:
      parseInt(p.get("d") ?? p.get("delay"), 10) ||
      (p.has("d") || p.has("delay") ? 1 : DEFAULT_DELAY_MS),
    seed: p.has("seed") ? parseInt(p.get("seed"), 10) : null,
    numGames: parseInt(p.get("n") ?? p.get("num-games"), 10) || 0,
    bg: p.get("bg") ?? DEFAULT_BACKGROUND,
    countdown: parseInt(p.get("countdown"), 10) || 0,
    showstats: p.has("showstats"),
    blocks: p.get("blocks") ?? DEFAULT_BLOCKS,
    quiet: p.has("quiet"),
    noLog: p.has("no-log"),
  };
}

class CanvasApp {
  constructor(canvas, opts, blocksConfig, icons) {
    this.icons = icons;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;
    this.postgameTimer = null;
    this.countdownTimer = null;
    this.bgImage = null;
    this.uiTextColor = "white";

    canvas.width = opts.width;
    canvas.height = opts.height;

    const rng =
      opts.seed != null ? createRng(opts.seed) : createRng(null);

    this.arena = new RPSBattleRoyaleSimulator({
      width: opts.width,
      height: opts.height,
      unitsPerKind: opts.units,
      delayMs: opts.delayMs,
      fixedSeed: opts.seed,
      numGames: opts.numGames,
      noLog: true,
      backgroundColor: opts.bg,
      countdownS: opts.countdown,
      windowless: false,
      quiet: opts.quiet,
      showstats: opts.showstats,
      rng,
      ...blocksConfig,
    });

    if (!opts.noLog) {
      this.arena.setLogSink((msg) => this._downloadLogAppend(msg));
    }

    this._pendingLog = [];
    this._initBackground().then(() => {
      this.arena.uiTextColor = this.uiTextColor;
      this.arena.blockColor = this.uiTextColor;
      this.arena.reset();
      this._draw();
      if (opts.countdown > 0) {
        this.arena.startCountdown();
        this._runCountdown();
      } else {
        this._loop();
      }
    });
  }

  _downloadLogAppend(msg) {
    this._pendingLog.push(msg);
  }

  async _initBackground() {
    const src = this.opts.bg;
    const rgb = rgbFromNameOrHex(src);
    if (rgb) {
      this.uiTextColor = pickContrastColor(src);
      this._bgMode = "color";
      this._bgColor = src;
      return;
    }

    try {
      const img = await this._loadImage(src);
      this.bgImage = img;
      const off = document.createElement("canvas");
      off.width = this.opts.width;
      off.height = this.opts.height;
      const octx = off.getContext("2d");
      octx.drawImage(img, 0, 0, this.opts.width, this.opts.height);
      const data = octx.getImageData(0, 0, off.width, off.height);
      this.uiTextColor = pickContrastColorFromRgb(averageRgbFromImageData(data));
      this._bgMode = "image";
    } catch {
      this.uiTextColor = pickContrastColor("white");
      this._bgMode = "color";
      this._bgColor = "white";
      if (!this.opts.quiet) {
        console.warn(`Could not load background '${src}', using white.`);
      }
    }
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load failed"));
      img.src = src;
    });
  }

  _drawBackground() {
    const { ctx } = this;
    const { width, height } = this.canvas;
    if (this._bgMode === "image" && this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = this._bgColor ?? "white";
      ctx.fillRect(0, 0, width, height);
    }
  }

  _draw() {
    const { ctx, arena } = this;
    this._drawBackground();

    for (const b of arena.blocks) {
      ctx.fillStyle = b.color ?? arena.uiTextColor;
      ctx.fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
    }

    const half = ICON_DRAW_SIZE / 2;
    for (const u of arena.units) {
      const img = this.icons.get(u.kind);
      if (img) {
        ctx.drawImage(img, u.x - half, u.y - half, ICON_DRAW_SIZE, ICON_DRAW_SIZE);
      }
    }

    if (this.opts.showstats) {
      ctx.font = "10px Helvetica, Arial, sans-serif";
      ctx.fillStyle = this.uiTextColor;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        arena.getStatsText(),
        this.canvas.width - 5,
        this.canvas.height - 5
      );
    }

    const cd = arena.countdownDisplay;
    if (cd != null) {
      const size = Math.max(
        48,
        Math.min(Math.floor(Math.min(arena.width, arena.height) * 0.25), 220)
      );
      ctx.font = `bold ${size}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = this.uiTextColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cd), arena.width / 2, arena.height / 2);
    }
  }

  _runCountdown() {
    this._draw();
    if (!this.arena._inCountdown) {
      this._loop();
      return;
    }
    this.countdownTimer = setTimeout(() => {
      this.arena.tickCountdownSecond();
      if (this.arena._inCountdown) {
        this._runCountdown();
      } else {
        this._loop();
      }
    }, 1000);
  }

  _loop() {
    if (this.postgameTimer != null) return;

    const ended = this.arena.tick();
    this._draw();

    if (ended) {
      if (this.opts.numGames > 0 && this.arena.gamesPlayed >= this.opts.numGames) {
        this._flushLogDownload();
        return;
      }
      this.postgameTimer = setTimeout(() => {
        this.postgameTimer = null;
        this.arena.advanceSeedForNextGame();
        this.arena.reset();
        this._draw();
        if (this.opts.countdown > 0) {
          this.arena.startCountdown();
          this._runCountdown();
        } else {
          this._loop();
        }
      }, POSTGAME_DELAY_MS);
      return;
    }

    setTimeout(() => this._loop(), this.arena.delayMs);
  }

  _flushLogDownload() {
    if (this._pendingLog.length === 0) return;
    const blob = new Blob([this._pendingLog.join("\n") + "\n"], {
      type: "text/plain",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = DEFAULT_LOGFILE;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

async function main() {
  const opts = paramsFromUrl();
  opts.delayMs = opts.delay > 0 ? opts.delay : 1;

  let blocksConfig;
  const blocksParam = opts.blocks;
  if (/^\d+$/.test(String(blocksParam).trim())) {
    blocksConfig = parseBlocksOption(blocksParam);
  } else if (String(blocksParam).trim() !== "0") {
    try {
      const res = await fetch(blocksParam);
      const data = await res.json();
      blocksConfig = parseBlocksFromJson(data, blocksParam);
    } catch (e) {
      console.error(`Failed to load blocks JSON: ${e.message}`);
      blocksConfig = parseBlocksOption("0");
    }
  } else {
    blocksConfig = parseBlocksOption("0");
  }

  const icons = await loadIcons();
  const canvas = document.getElementById("arena");
  new CanvasApp(canvas, opts, blocksConfig, icons);
}

main();
