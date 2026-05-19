/** Mulberry32 PRNG for deterministic runs when --seed is set. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(fixedSeed) {
  if (fixedSeed == null) {
    return {
      seed: null,
      random: () => Math.random(),
      randint: (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1)),
      uniform: (lo, hi) => lo + Math.random() * (hi - lo),
      setSeed: (s) => {},
    };
  }

  let current = fixedSeed >>> 0;
  let next = mulberry32(current);

  const api = {
    get seed() {
      return current;
    },
    random: () => next(),
    randint(lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    uniform(lo, hi) {
      return lo + next() * (hi - lo);
    },
    setSeed(s) {
      current = s >>> 0;
      next = mulberry32(current);
    },
    reseedRandom() {
      current = 1 + Math.floor(Math.random() * 1_000_000);
      next = mulberry32(current);
    },
  };
  return api;
}
