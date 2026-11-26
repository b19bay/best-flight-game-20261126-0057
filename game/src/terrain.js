// MERIDIAN RUN — the valley: centreline, heights, ridges, river, road, strips.
// One job: answer "what is the ground here?" and "what does the valley look like?"
// Everything derives from the seed, so the same seed builds the same valley.

import { VALLEY, RINGS } from './config.js';
import { makeNoise, seedTable } from './random.js';

// The valley centreline wanders gently: two slow sines with seeded phase.
export function makeValley(seed) {
  const wander = makeNoise(seed + 11, 24, -1, 1);
  const bump = makeNoise(seed + 23, 24, -1, 1);

  // Centreline lateral offset (feet) at distance x along the route.
  // Gentle bends only: a courier plane at 130 kt must be able to track it.
  function centreZ(x) {
    return 140 * wander(x / 16000) + 60 * bump(x / 7000);
  }

  // Floor height (feet) at (x, z): gentle undulation, rising at the edges.
  function floorHeight(x, z) {
    const rel = z - centreZ(x);
    const across = Math.abs(rel) / VALLEY.halfWidth;
    const roll = 26 * bump(x / 700 + 5) * Math.min(1, across);
    const rise = across > 1 ? (across - 1) * (across - 1) * 1400 : 0;
    return roll + rise;
  }

  // Ridge silhouettes: three layers, each a seeded skyline across the screen.
  const ridges = [0, 1, 2].map((layer) => {
    const peaks = seedTable(seed + 100 + layer * 7, 28, 0.35, 1);
    return { layer, peaks };
  });

  // A strip is flat ground: inside its x-range and near its centreline, height 0.
  function onStrip(x, z) {
    for (const strip of [VALLEY.stripNear, VALLEY.stripFar]) {
      if (x >= strip.x0 && x <= strip.x1 && Math.abs(z - centreZ(x) - strip.z) < 70) {
        return strip;
      }
    }
    return null;
  }

  function groundHeight(x, z) {
    if (onStrip(x, z)) return 0;
    return floorHeight(x, z);
  }

  return { centreZ, floorHeight, groundHeight, onStrip, ridges, rings: RINGS };
}

// Project a world point into screen space (pseudo-3D chase projection).
// cam: {x, z, alt, heading} sits behind the aircraft. (wx, wz, wy) is the
// world point in feet. Returns {sx, sy, scale} or null when behind the camera.
export function projectPoint(cam, wx, wz, wy, focal, horizonY, cx) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  const cos = Math.cos(cam.heading);
  const sin = Math.sin(cam.heading);
  const d = dx * cos + dz * sin;
  if (d < 8) return null;
  const lat = -dx * sin + dz * cos;
  const scale = focal / d;
  return {
    sx: cx + lat * scale,
    sy: horizonY - (wy - cam.alt) * scale,
    scale,
  };
}
