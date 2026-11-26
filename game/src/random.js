// MERIDIAN RUN — seeded random numbers (mulberry32).
// One job: deterministic randomness. No Math.random anywhere in the game.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a small deterministic table of values from a seed.
export function seedTable(seed, count, min, max) {
  const rand = mulberry32(seed);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(min + rand() * (max - min));
  }
  return out;
}

// Deterministic 1-D value noise: smooth bumps from a seeded table.
export function makeNoise(seed, count, min, max) {
  const table = seedTable(seed, count, min, max);
  return function noiseAt(t) {
    const scaled = ((t % 1) + 1) % 1 * count;
    const i0 = Math.floor(scaled) % count;
    const i1 = (i0 + 1) % count;
    const f = scaled - Math.floor(scaled);
    const smooth = f * f * (3 - 2 * f);
    return table[i0] + (table[i1] - table[i0]) * smooth;
  };
}
