import {
  DEFAULT_BACKGROUND,
  DEFAULT_BEATS,
  DEFAULT_BLOCKS,
  DEFAULT_LOGFILE,
  DEFAULT_LOSES_TO,
  BASE_SPEED,
  MIN_SEP,
  MIN_WALL_BOUNCE_SPEED,
  RADIUS,
  UNIT_COLLIDE_DIST,
  WALL_BOUNCE,
} from "./constants.js";
import { pickContrastColor, pickContrastColorFromRgb } from "./color.js";
import { createRng } from "./random.js";
import { getSpawnTriangles, randomPointInTriangle } from "./spawn.js";

function distanceBetween(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

export class Emoji {
  constructor(kind, x, y, vx, vy) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }
}

export class RPSBattleRoyaleSimulator {
  constructor(options = {}) {
    const {
      width,
      height,
      unitsPerKind,
      delayMs,
      beats = DEFAULT_BEATS,
      losesTo = DEFAULT_LOSES_TO,
      fixedSeed = null,
      numGames = 0,
      logFilename = DEFAULT_LOGFILE,
      noLog = false,
      backgroundColor = DEFAULT_BACKGROUND,
      countdownS = 0,
      windowless = false,
      quiet = false,
      showstats = false,
      blocksMode = "none",
      blocksCount = 0,
      blocksJson = null,
      blocksJsonPath = null,
      rng: externalRng = null,
    } = options;

    this.windowless = windowless;
    this.quiet = quiet;
    this.showstats = showstats;

    this.width = Math.floor(width);
    this.height = Math.floor(height);
    this.bgSource = backgroundColor;

    this.beats = beats;
    this.losesTo = losesTo;
    this.kindsOrder = Object.keys(beats).sort();

    this.unitsPerKind = Math.max(1, Math.floor(unitsPerKind));
    this.numUnits = this.unitsPerKind * this.kindsOrder.length;

    this.delayMs = Math.max(1, Math.floor(delayMs));
    this.baseDelayMs = this.delayMs;

    this.countdownS = windowless ? 0 : Math.max(0, Math.floor(countdownS));
    this._inCountdown = false;
    this._countdownRemaining = 0;

    this.blocks = [];
    this.blocksMode = blocksMode;
    this.blocksCount = blocksCount;
    this.blocksJson = blocksJson;
    this.blocksJsonPath = blocksJsonPath;
    this.blockColor = "white";

    this.numGames = Math.max(0, Math.floor(numGames));
    this.gamesPlayed = 0;

    this.fixedSeed = fixedSeed;
    this.rng =
      externalRng ??
      createRng(
        fixedSeed == null
          ? null
          : fixedSeed
      );

    if (fixedSeed != null) {
      this.currentSeed = fixedSeed;
      this.rng.setSeed(this.currentSeed);
    } else if (this.rng.reseedRandom) {
      this.rng.reseedRandom();
      this.currentSeed = this.rng.seed;
    } else {
      this.currentSeed = 1 + Math.floor(Math.random() * 1_000_000);
    }

    this.noLog = noLog;
    this.logFilename = logFilename;
    this.logLines = [];
    this._writeLogHeader();

    this.uiTextColor = pickContrastColor(
      typeof backgroundColor === "string" ? backgroundColor : "white"
    );
    this.blockColor = this.uiTextColor;

    this.units = [];
    this.stepNum = 0;
    this.gameStartTime = Date.now();

    this.reset();
  }

  _generateBlocksRandom() {
    this.blocks = [];
    if (this.blocksMode !== "random" || this.blocksCount <= 0) return;

    const W = this.width;
    const H = this.height;
    const maxArea = 0.2 * W * H;
    const minW = Math.floor(0.08 * W);
    const maxW = Math.floor(0.4 * W);
    const minH = Math.floor(0.08 * H);
    const maxH = Math.floor(0.4 * H);

    let attempts = 0;
    const target = this.blocksCount;
    while (this.blocks.length < target && attempts < target * 30) {
      attempts += 1;
      let w = this.rng.randint(minW, maxW);
      let h = this.rng.randint(minH, maxH);
      if (w * h > maxArea) {
        h = Math.max(Math.floor(maxArea / Math.max(w, 1)), minH);
        if (h < minH) continue;
      }
      const x1 = this.rng.randint(
        RADIUS + 2,
        Math.max(RADIUS + 2, W - w - RADIUS - 2)
      );
      const y1 = this.rng.randint(
        RADIUS + 2,
        Math.max(RADIUS + 2, H - h - RADIUS - 2)
      );
      const x2 = x1 + w;
      const y2 = y1 + h;
      if (x2 - x1 >= 4 && y2 - y1 >= 4) {
        this.blocks.push({
          x1,
          y1,
          x2,
          y2,
          color: this.blockColor,
        });
      }
    }
  }

  _applyBlocksFromJson() {
    this.blocks = [];
    if (this.blocksMode !== "json" || !this.blocksJson) return;
    for (const b of this.blocksJson) {
      const color =
        b.color ??
        (this.windowless ? "white" : this.uiTextColor);
      this.blocks.push({
        x1: b.x1,
        y1: b.y1,
        x2: b.x2,
        y2: b.y2,
        color,
      });
    }
  }

  _pointInAnyBlock(x, y, margin = 0) {
    for (const b of this.blocks) {
      if (
        x >= b.x1 - margin &&
        x <= b.x2 + margin &&
        y >= b.y1 - margin &&
        y <= b.y2 + margin
      ) {
        return true;
      }
    }
    return false;
  }

  _collidingBlock(x, y, margin = 0) {
    for (const b of this.blocks) {
      if (
        x >= b.x1 - margin &&
        x <= b.x2 + margin &&
        y >= b.y1 - margin &&
        y <= b.y2 + margin
      ) {
        return b;
      }
    }
    return null;
  }

  _log(msg) {
    if (!this.noLog) {
      this.logLines.push(msg);
      if (this._logSink) {
        this._logSink(msg);
      }
    }
    if (!this.quiet && typeof console !== "undefined") {
      console.log(msg);
    }
  }

  setLogSink(sink) {
    this._logSink = sink;
  }

  _writeLogHeader() {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    let blocksDesc = this.blocksMode;
    if (this.blocksMode === "json") {
      blocksDesc = `json:${this.blocksJsonPath}`;
    } else if (this.blocksMode === "random") {
      blocksDesc += `(${this.blocksCount})`;
    }
    const settings = [
      `start=${now}`,
      `size=${this.width}x${this.height}`,
      `units_per_kind=${this.unitsPerKind}`,
      `total_units=${this.numUnits}`,
      `delay_ms=${this.delayMs}`,
      `seed=${this.fixedSeed != null ? this.currentSeed : "random"}`,
      `kinds=${this.kindsOrder.join(",")}`,
      `num_games=${this.numGames}`,
      `blocks=${blocksDesc}`,
      `file_logging=${this.noLog ? "off" : "on"}`,
      `logfile=${this.noLog ? "" : this.logFilename}`,
    ].join(" | ");
    this._log(settings);
    const header = ["STEP", ...this.kindsOrder];
    this._log(header.join(","));
  }

  _logCountsIfNeeded(converted) {
    if (!converted) return;
    const counts = this._countsByKind();
    const row = [String(this.stepNum)];
    for (const k of this.kindsOrder) {
      row.push(String(counts[k] ?? 0));
    }
    this._log(row.join(","));
  }

  _logGameEnd() {
    const endTs = new Date().toISOString().replace("T", " ").slice(0, 19);
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    this._log(
      `game_end at ${endTs}; elapsed=${elapsed.toFixed(3)}s; steps=${this.stepNum}`
    );
  }

  _countsByKind() {
    const counts = {};
    for (const u of this.units) {
      counts[u.kind] = (counts[u.kind] ?? 0) + 1;
    }
    return counts;
  }

  reset() {
    if (this.blocksMode === "random") {
      this._generateBlocksRandom();
    } else if (this.blocksMode === "json") {
      this._applyBlocksFromJson();
    } else {
      this.blocks = [];
    }

    this.units = [];
    this.stepNum = 0;
    this.gameStartTime = Date.now();
    this._inCountdown = false;
    this.delayMs = this.baseDelayMs;

    const spawnZones = getSpawnTriangles(this.width, this.height);
    const pad = RADIUS + 2;

    for (const kind of this.kindsOrder) {
      const triangle = spawnZones[kind];
      for (let i = 0; i < this.unitsPerKind; i++) {
        const unit = this._placeUnitInZone(kind, triangle, pad);
        if (unit) this.units.push(unit);
      }
    }
  }

  _placeUnitInZone(kind, triangle, pad) {
    const samplers = [];
    if (triangle) {
      const [v0, v1, v2] = triangle;
      samplers.push(() => randomPointInTriangle(this.rng, v0, v1, v2));
    }
    samplers.push(() => ({
      x: this.rng.uniform(pad, this.width - pad),
      y: this.rng.uniform(pad, this.height - pad),
    }));

    for (const samplePoint of samplers) {
      for (let attempts = 0; attempts < 500; attempts++) {
        const { x, y } = samplePoint();
        if (x < pad || x > this.width - pad || y < pad || y > this.height - pad) {
          continue;
        }
        if (this._pointInAnyBlock(x, y, RADIUS)) continue;
        let tooClose = false;
        for (const u of this.units) {
          if (distanceBetween(x, y, u.x, u.y) < MIN_SEP * MIN_SEP) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        const [vx, vy] = this._randomVelocity();
        return new Emoji(kind, x, y, vx, vy);
      }
    }

    const x = this.rng.uniform(pad, this.width - pad);
    const y = this.rng.uniform(pad, this.height - pad);
    const [vx, vy] = this._randomVelocity();
    return new Emoji(kind, x, y, vx, vy);
  }

  _randomVelocity() {
    const angle = this.rng.uniform(0, 2 * Math.PI);
    return [Math.cos(angle) * BASE_SPEED, Math.sin(angle) * BASE_SPEED];
  }

  _normalizeSpeed(u) {
    const s = Math.hypot(u.vx, u.vy);
    if (s < 1e-6) {
      [u.vx, u.vy] = this._randomVelocity();
      return;
    }
    u.vx = (u.vx / s) * BASE_SPEED;
    u.vy = (u.vy / s) * BASE_SPEED;
  }

  getStatsText() {
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    const counts = this._countsByKind();
    const parts = this.kindsOrder.map((k) => `${k}:${counts[k] ?? 0}`);
    return `t=${elapsed.toFixed(1)}s step=${this.stepNum} ${parts.join(" ")}`;
  }

  _outwardWallSpeed(component, outwardSign) {
    const speed = Math.max(Math.abs(component), MIN_WALL_BOUNCE_SPEED) * WALL_BOUNCE;
    return outwardSign * speed;
  }

  _bounceOffWalls(nx, ny, u) {
    const minX = RADIUS;
    const maxX = this.width - RADIUS;
    const minY = RADIUS;
    const maxY = this.height - RADIUS;
    let bounced = false;

    if (nx < minX) {
      nx = minX;
      u.vx = this._outwardWallSpeed(u.vx, 1);
      bounced = true;
    } else if (nx > maxX) {
      nx = maxX;
      u.vx = this._outwardWallSpeed(u.vx, -1);
      bounced = true;
    }

    if (ny < minY) {
      ny = minY;
      u.vy = this._outwardWallSpeed(u.vy, 1);
      bounced = true;
    } else if (ny > maxY) {
      ny = maxY;
      u.vy = this._outwardWallSpeed(u.vy, -1);
      bounced = true;
    }

    return { nx, ny, bounced };
  }

  _move(u) {
    let nx = u.x + u.vx;
    let ny = u.y + u.vy;

    const wallHit = this._bounceOffWalls(nx, ny, u);
    nx = wallHit.nx;
    ny = wallHit.ny;
    let blockBounced = false;

    for (let iter = 0; iter < 2; iter++) {
      const b = this._collidingBlock(nx, ny, RADIUS);
      if (!b) break;
      const left = b.x1 - RADIUS;
      const right = b.x2 + RADIUS;
      const top = b.y1 - RADIUS;
      const bottom = b.y2 + RADIUS;

      const dxLeft = Math.abs(nx - left);
      const dxRight = Math.abs(nx - right);
      const dyTop = Math.abs(ny - top);
      const dyBottom = Math.abs(ny - bottom);

      const m = Math.min(dxLeft, dxRight, dyTop, dyBottom);
      if (m === dxLeft) {
        nx = left;
        u.vx = this._outwardWallSpeed(u.vx, -1);
      } else if (m === dxRight) {
        nx = right;
        u.vx = this._outwardWallSpeed(u.vx, 1);
      } else if (m === dyTop) {
        ny = top;
        u.vy = this._outwardWallSpeed(u.vy, -1);
      } else {
        ny = bottom;
        u.vy = this._outwardWallSpeed(u.vy, 1);
      }
      blockBounced = true;
    }

    if (wallHit.bounced || blockBounced) {
      this._normalizeSpeed(u);
    }

    u.x = nx;
    u.y = ny;
  }

  _bouncePair(a, b) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let distSq = dx * dx + dy * dy;
    if (distSq < 1e-6) {
      const angle = this.rng.uniform(0, 2 * Math.PI);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      distSq = 1;
    }
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = UNIT_COLLIDE_DIST - dist;
    if (overlap > 0) {
      const sep = overlap / 2 + 0.5;
      a.x -= nx * sep;
      a.y -= ny * sep;
      b.x += nx * sep;
      b.y += ny * sep;
    }

    const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (vn >= 0) return;

    const impulse = vn;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;

    this._normalizeSpeed(a);
    this._normalizeSpeed(b);
  }

  _handleUnitCollisions() {
    const r2 = UNIT_COLLIDE_DIST * UNIT_COLLIDE_DIST;
    const n = this.units.length;
    let converted = false;

    for (let i = 0; i < n; i++) {
      const a = this.units[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.units[j];
        if (distanceBetween(a.x, a.y, b.x, b.y) > r2) continue;

        this._bouncePair(a, b);

        if (a.kind === b.kind) continue;

        if (this.beats[a.kind] === b.kind) {
          b.kind = a.kind;
          converted = true;
        } else if (this.beats[b.kind] === a.kind) {
          a.kind = b.kind;
          converted = true;
        }
      }
    }
    return converted;
  }

  /** One simulation tick. Returns true if the current game ended. */
  tick() {
    if (this._inCountdown) return false;

    this.stepNum += 1;
    for (const u of this.units) this._move(u);
    const converted = this._handleUnitCollisions();
    this._logCountsIfNeeded(converted);

    const kinds = new Set(this.units.map((u) => u.kind));
    if (kinds.size === 1) {
      this._logGameEnd();
      this.gamesPlayed += 1;
      return true;
    }
    return false;
  }

  advanceSeedForNextGame() {
    if (this.fixedSeed != null) {
      this.currentSeed += 1;
      this.rng.setSeed(this.currentSeed);
    } else if (this.rng.reseedRandom) {
      this.rng.reseedRandom();
      this.currentSeed = this.rng.seed;
    } else {
      this.currentSeed = 1 + Math.floor(Math.random() * 1_000_000);
    }
  }

  runWindowless() {
    while (true) {
      this.stepNum = 0;
      this.gameStartTime = Date.now();
      while (true) {
        if (this.tick()) break;
      }
      if (this.numGames > 0 && this.gamesPlayed >= this.numGames) break;
      this.advanceSeedForNextGame();
      this.reset();
    }
  }

  startCountdown() {
    if (this.countdownS <= 0) {
      this._inCountdown = false;
      return;
    }
    this._inCountdown = true;
    this._countdownRemaining = this.countdownS;
  }

  tickCountdownSecond() {
    if (!this._inCountdown) return false;
    if (this._countdownRemaining <= 0) {
      this._inCountdown = false;
      return false;
    }
    this._countdownRemaining -= 1;
    if (this._countdownRemaining <= 0) {
      this._inCountdown = false;
    }
    return this._inCountdown;
  }

  get countdownDisplay() {
    if (!this._inCountdown) return null;
    return this._countdownRemaining;
  }
}

export { pickContrastColorFromRgb };
