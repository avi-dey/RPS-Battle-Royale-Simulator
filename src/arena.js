import {
  DEFAULT_BACKGROUND,
  DEFAULT_BEATS,
  DEFAULT_BLOCKS,
  DEFAULT_LOGFILE,
  DEFAULT_LOSES_TO,
  ALLY_REPEL,
  ATTRACTION,
  BASE_SPEED,
  BOUNCE_JITTER,
  JITTER,
  STEER_WOBBLE,
  WANDER,
  MIN_SEP,
  MIN_WALL_BOUNCE_SPEED,
  RADIUS,
  REPULSION,
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

function normalize(dx, dy) {
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return [0, 0];
  return [dx / mag, dy / mag];
}

function capSpeed(vx, vy, cap) {
  const s = Math.hypot(vx, vy);
  if (s > cap && s > 0) {
    const scale = cap / s;
    return [vx * scale, vy * scale];
  }
  return [vx, vy];
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
      ffEnabled = true,
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

    this.ffEnabled = ffEnabled;
    this.ffActive = false;

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
      `fast_forward=${this.ffEnabled ? "on" : "off"}`,
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
    this.ffActive = false;
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

        const angle = this.rng.uniform(0, 2 * Math.PI);
        const speed = this.rng.uniform(BASE_SPEED * 0.5, BASE_SPEED);
        return new Emoji(
          kind,
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed
        );
      }
    }

    const x = this.rng.uniform(pad, this.width - pad);
    const y = this.rng.uniform(pad, this.height - pad);
    const angle = this.rng.uniform(0, 2 * Math.PI);
    const speed = this.rng.uniform(BASE_SPEED * 0.5, BASE_SPEED);
    return new Emoji(
      kind,
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  }

  getStatsText() {
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    const counts = this._countsByKind();
    const parts = this.kindsOrder.map((k) => `${k}:${counts[k] ?? 0}`);
    return `t=${elapsed.toFixed(1)}s step=${this.stepNum} ${parts.join(" ")}`;
  }

  _forceClosestChoice(me) {
    const preyKind = this.beats[me.kind];
    const predatorKind = this.losesTo[me.kind];

    let closestPrey = null;
    let closestPred = null;
    let bestPreyD2 = Infinity;
    let bestPredD2 = Infinity;

    for (const u of this.units) {
      if (u === me) continue;
      const d2 = distanceBetween(me.x, me.y, u.x, u.y);
      if (u.kind === preyKind && d2 < bestPreyD2) {
        bestPreyD2 = d2;
        closestPrey = u;
      } else if (u.kind === predatorKind && d2 < bestPredD2) {
        bestPredD2 = d2;
        closestPred = u;
      }
    }

    let fx = 0;
    let fy = 0;
    if (closestPrey && closestPred) {
      if (bestPreyD2 <= bestPredD2) {
        const [dx, dy] = normalize(
          closestPrey.x - me.x,
          closestPrey.y - me.y
        );
        fx += dx * ATTRACTION;
        fy += dy * ATTRACTION;
      } else {
        const [dx, dy] = normalize(
          me.x - closestPred.x,
          me.y - closestPred.y
        );
        fx += dx * REPULSION;
        fy += dy * REPULSION;
      }
    } else if (closestPrey) {
      const [dx, dy] = normalize(closestPrey.x - me.x, closestPrey.y - me.y);
      fx += dx * ATTRACTION;
      fy += dy * ATTRACTION;
    } else if (closestPred) {
      const [dx, dy] = normalize(me.x - closestPred.x, me.y - closestPred.y);
      fx += dx * REPULSION;
      fy += dy * REPULSION;
    } else {
      const angle = this.rng.uniform(0, 2 * Math.PI);
      fx += Math.cos(angle) * WANDER;
      fy += Math.sin(angle) * WANDER;
    }

    for (const u of this.units) {
      if (u === me || u.kind !== me.kind) continue;
      const d2 = distanceBetween(me.x, me.y, u.x, u.y);
      if (d2 < MIN_SEP * MIN_SEP) {
        const [dx, dy] = normalize(me.x - u.x, me.y - u.y);
        const denom = Math.max(Math.sqrt(d2), 1);
        const strength = ALLY_REPEL * (MIN_SEP / denom);
        fx += dx * strength;
        fy += dy * strength;
      }
    }

    fx += this.rng.uniform(-JITTER, JITTER);
    fy += this.rng.uniform(-JITTER, JITTER);
    return [fx, fy];
  }

  _clampForcesAtWalls(u, fx, fy) {
    const edge = 2;
    if (u.x <= RADIUS + edge && fx < 0) fx = 0;
    if (u.x >= this.width - RADIUS - edge && fx > 0) fx = 0;
    if (u.y <= RADIUS + edge && fy < 0) fy = 0;
    if (u.y >= this.height - RADIUS - edge && fy > 0) fy = 0;
    return [fx, fy];
  }

  _outwardWallSpeed(component, outwardSign) {
    const speed = Math.max(Math.abs(component), MIN_WALL_BOUNCE_SPEED) * WALL_BOUNCE;
    return outwardSign * speed;
  }

  _applyForces(u) {
    let [fx, fy] = this._forceClosestChoice(u);
    [fx, fy] = this._clampForcesAtWalls(u, fx, fy);
    u.vx += fx;
    u.vy += fy;

    const turn = this.rng.uniform(-STEER_WOBBLE, STEER_WOBBLE);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const vx = u.vx * cos - u.vy * sin;
    const vy = u.vx * sin + u.vy * cos;
    u.vx = vx;
    u.vy = vy;

    [u.vx, u.vy] = this._clampVelocityAtWalls(u, u.vx, u.vy);
    [u.vx, u.vy] = capSpeed(u.vx, u.vy, BASE_SPEED);
  }

  _clampVelocityAtWalls(u, vx, vy) {
    const edge = 1;
    if (u.x <= RADIUS + edge && vx < 0) vx = 0;
    if (u.x >= this.width - RADIUS - edge && vx > 0) vx = 0;
    if (u.y <= RADIUS + edge && vy < 0) vy = 0;
    if (u.y >= this.height - RADIUS - edge && vy > 0) vy = 0;
    return [vx, vy];
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

    if (blockBounced) {
      u.vx += this.rng.uniform(-BOUNCE_JITTER, BOUNCE_JITTER);
      u.vy += this.rng.uniform(-BOUNCE_JITTER, BOUNCE_JITTER);
    }

    if (wallHit.bounced || blockBounced) {
      [u.vx, u.vy] = capSpeed(u.vx, u.vy, BASE_SPEED);
    }

    u.x = nx;
    u.y = ny;
  }

  _handleCollisionsAndConversions() {
    const r2 = (RADIUS * 1.1) ** 2;
    const n = this.units.length;
    let converted = false;
    for (let i = 0; i < n; i++) {
      const a = this.units[i];
      for (let j = i + 1; j < n; j++) {
        const b = this.units[j];
        if (a.kind === b.kind) continue;
        if (distanceBetween(a.x, a.y, b.x, b.y) > r2) continue;
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

  _maybeFastForward() {
    if (!this.ffEnabled || this.ffActive) return;
    const kindsPresent = new Set(this.units.map((u) => u.kind));
    if (kindsPresent.size !== 2) return;
    const [a, b] = [...kindsPresent];
    if (this.beats[a] === b || this.beats[b] === a) {
      if (this.delayMs > 1) {
        this.delayMs = 1;
        this.ffActive = true;
      }
    }
  }

  /** One simulation tick. Returns true if the current game ended. */
  tick() {
    if (this._inCountdown) return false;

    this.stepNum += 1;
    for (const u of this.units) this._applyForces(u);
    for (const u of this.units) this._move(u);
    const converted = this._handleCollisionsAndConversions();
    this._logCountsIfNeeded(converted);
    this._maybeFastForward();

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
      this.ffActive = false;
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
