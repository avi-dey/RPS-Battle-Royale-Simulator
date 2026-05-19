export const DEFAULT_WIDTH = 1000;
export const DEFAULT_HEIGHT = 1000;
export const DEFAULT_UNITS_PER_KIND = 11;
export const DEFAULT_DELAY_MS = 30;
export const DEFAULT_BACKGROUND = "white";
export const DEFAULT_BLOCKS = "0";
export const DEFAULT_LOGFILE = "rps_battle_royale_log.txt";

export const RADIUS = 24;
export const MIN_SEP = RADIUS * 2 + 6;

export const BASE_SPEED = 4.5;
export const ATTRACTION = 2.2;
export const REPULSION = 2.4;
export const ALLY_REPEL = 1.3;
export const WALL_BOUNCE = 1;
/** Minimum outward speed after hitting an arena wall (prevents sticking). */
export const MIN_WALL_BOUNCE_SPEED = BASE_SPEED * 0.85;
export const JITTER = 0.85;
export const WANDER = 0.65;
export const STEER_WOBBLE = 0.22;
export const BOUNCE_JITTER = 0.65;

export const POSTGAME_DELAY_MS = 5000;

export const DEFAULT_BEATS = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export const DEFAULT_LOSES_TO = {
  rock: "paper",
  paper: "scissors",
  scissors: "rock",
};
