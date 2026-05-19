export const DEFAULT_WIDTH = 1000;
export const DEFAULT_HEIGHT = 1000;
export const DEFAULT_UNITS_PER_KIND = 11;
export const DEFAULT_DELAY_MS = 30;
export const DEFAULT_BACKGROUND = "lightgreen";
export const DEFAULT_BLOCKS = "0";
export const DEFAULT_LOGFILE = "rps_battle_royale_log.txt";

export const RADIUS = 24;
export const MIN_SEP = RADIUS * 2 + 6;

export const BASE_SPEED = 4.5;
export const WALL_BOUNCE = 1;
/** Minimum outward speed after hitting an arena wall (prevents sticking). */
export const MIN_WALL_BOUNCE_SPEED = BASE_SPEED * 0.85;
/** Center-to-center distance at which two units collide. */
export const UNIT_COLLIDE_DIST = RADIUS * 2;

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
