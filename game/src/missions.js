// MERIDIAN RUN — missions. One job: objectives, scoring, timer, win/lose.
// Pure logic over the plane + valley; the renderer only reads the result.

import { MISSIONS, RINGS, VALLEY } from './config.js';

export function freshMission(missionId) {
  const def = MISSIONS[missionId];
  return {
    id: missionId,
    name: def.name,
    objective: def.blurb,
    timeLeft: def.timeLimitSec,
    score: 0,
    done: false,
    doneText: '',
    ringsHit: new Set(),
    nextRing: 0,
    dropped: false,
    dropResult: '',
  };
}

// One fixed step of mission logic. Returns nothing; mutates mission and plane.
export function missionStep(mission, plane, valley, dt, audio) {
  if (mission.done || plane.crashed) return;
  mission.timeLeft -= dt;
  if (mission.timeLeft <= 0) {
    mission.timeLeft = 0;
    if (mission.id === 'rings') {
      mission.done = true;
      mission.doneText = `TIME UP — ${mission.ringsHit.size} of 8 rings`;
    } else if (!plane.landed) {
      mission.done = true;
      mission.doneText = 'OUT OF TIME — the parcel never arrived';
    }
  }

  if (mission.id === 'rings') {
    const ring = RINGS[mission.nextRing];
    if (ring && plane.x >= ring.x) {
      const dz = plane.z - (valley.centreZ(ring.x) + ring.z);
      const da = plane.alt - ring.alt;
      const dist = Math.sqrt(dz * dz + da * da);
      if (dist < ring.r * 0.85) {
        mission.ringsHit.add(mission.nextRing);
        mission.score += 100;
        mission.timeLeft += 8;
        plane.message = `Ring ${mission.nextRing + 1} of 8 — +100, +8s`;
        if (audio) audio.chime();
      } else {
        plane.message = `Ring ${mission.nextRing + 1} missed — keep flying`;
      }
      mission.nextRing += 1;
      if (mission.nextRing >= RINGS.length) {
        mission.done = true;
        mission.doneText = `RING RUN COMPLETE — ${mission.ringsHit.size} of 8 rings`;
        mission.score += mission.ringsHit.size === 8 ? 250 : 0;
      }
    }
  }

  if (mission.id === 'courier') {
    if (plane.landed && valley.onStrip(plane.x, plane.z) === VALLEY.stripFar) {
      mission.done = true;
      mission.doneText = 'PARCEL DELIVERED — the far strip applauds';
      mission.score += 500 + Math.round(mission.timeLeft) * 2;
      if (audio) audio.chime();
    } else if (plane.landed) {
      plane.message = 'Landed — but this is not the far strip. Take off (R) and try again.';
      plane.landed = false;
      plane.onGround = false;
      plane.alt = 2;
      plane.speed = Math.max(plane.speed, 70);
    }
  }

  if (mission.id === 'drop') {
    const m = VALLEY.meadow;
    const dx = plane.x - m.x;
    const dz = plane.z - (valley.centreZ(m.x) + m.z);
    const over = Math.sqrt(dx * dx + dz * dz) < m.radius;
    if (over && plane.alt < 320 && !mission.dropped) {
      plane.message = 'Over the meadow — press SPACE to drop the bundle';
    }
  }
}

// The pilot pressed Space (supply drop only).
export function dropBundle(mission, plane, valley, audio) {
  if (mission.id !== 'drop' || mission.dropped || plane.crashed) return;
  mission.dropped = true;
  const m = VALLEY.meadow;
  const dx = plane.x - m.x;
  const dz = plane.z - (valley.centreZ(m.x) + m.z);
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < m.radius && plane.alt < 320) {
    mission.score += 400 + Math.round(mission.timeLeft);
    mission.done = true;
    mission.doneText = 'BUNDLE DELIVERED — the hiker waves from the meadow';
    if (audio) audio.chime();
  } else {
    mission.dropResult = 'Bundle missed the meadow — fly back around (R to restart)';
    plane.message = mission.dropResult;
    mission.dropped = false;
  }
}
