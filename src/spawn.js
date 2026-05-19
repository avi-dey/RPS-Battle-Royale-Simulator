import { RADIUS } from "./constants.js";

/**
 * Triangular spawn regions: rock (north), paper (south-east), scissors (south-west).
 * Each zone is a triangle with one vertex at its corner of the arena.
 */
export function getSpawnTriangles(width, height) {
  const m = RADIUS + 2;
  return {
    rock: [
      { x: width / 2, y: m },
      { x: width * 0.12, y: height * 0.52 },
      { x: width * 0.88, y: height * 0.52 },
    ],
    paper: [
      { x: width - m, y: height - m },
      { x: width * 0.88, y: height * 0.52 },
      { x: width * 0.5, y: height * 0.62 },
    ],
    scissors: [
      { x: m, y: height - m },
      { x: width * 0.12, y: height * 0.52 },
      { x: width * 0.5, y: height * 0.62 },
    ],
  };
}

export function randomPointInTriangle(rng, v0, v1, v2) {
  let u = rng.random();
  let v = rng.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  return {
    x: v0.x + u * (v1.x - v0.x) + v * (v2.x - v0.x),
    y: v0.y + u * (v1.y - v0.y) + v * (v2.y - v0.y),
  };
}
