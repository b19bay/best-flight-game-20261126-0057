// MERIDIAN RUN — the flight model. One job: move the aircraft one fixed step.
// Pure functions over a plain state object; no DOM, no time source, no randomness
// except the seeded gust table passed in. Speeds in knots, angles in degrees.

import { FLIGHT, VALLEY } from './config.js';

const DEG = Math.PI / 180;

export function freshPlane(start) {
  return {
    x: start.x,
    z: start.z,
    alt: start.alt,
    heading: start.heading, // radians, 0 = along the valley (+x)
    pitch: 0, // degrees, positive = nose up
    bank: 0, // degrees, positive = right wing down
    speed: start.speed, // knots
    throttle: start.throttle, // 0..1
    fuel: FLIGHT.fuelCapacity,
    damage: 0,
    verticalSpeed: 0, // ft/s, positive = climbing
    onGround: start.alt <= 0.5,
    stalled: false,
    crashed: false,
    landed: false,
    message: '',
  };
}

// One fixed step (dt seconds). input: {pitch: -1..1, roll: -1..1,
// throttleDelta: -1..1, brake: bool}. ground: {heightAt(x, z), onStrip(x, z)}.
// gust: lateral wind in kt (seeded).
export function flyStep(p, input, dt, ground, gust) {
  const groundHeightAt = ground.heightAt.bind(ground);
  if (p.crashed || p.landed) return p;

  // --- throttle and fuel ---
  p.throttle = clamp(p.throttle + input.throttleDelta * dt * 0.9, 0, 1);
  const burn = FLIGHT.fuelBurnIdle + (FLIGHT.fuelBurnPerSec - FLIGHT.fuelBurnIdle) * p.throttle;
  p.fuel = Math.max(0, p.fuel - burn * dt);
  const thrust = p.fuel > 0 ? p.throttle : 0;

  // --- attitude: bank and pitch chase the stick, with authority that fades
  // near the stall and grows with speed. ---
  const authority = clamp(p.speed / 90, 0.35, 1);
  const targetBank = clamp(input.roll, -1, 1) * FLIGHT.maxBankDeg;
  const targetPitch = clamp(input.pitch, -1, 1) * FLIGHT.maxPitchDeg;
  p.bank += (targetBank - p.bank) * Math.min(1, dt * 3.2 * authority);
  p.pitch += (targetPitch - p.pitch) * Math.min(1, dt * 2.6 * authority);

  // --- speed: thrust minus drag, plus climb/descent exchange ---
  const drag = 0.00042 * p.speed * p.speed + (input.brake ? 0.9 : 0);
  const accel = thrust * 26 - drag - Math.sin(p.pitch * DEG) * 22;
  p.speed = clamp(p.speed + accel * dt, 0, FLIGHT.maxSpeed);

  // --- stall: below min speed the nose drops and the controls go mushy ---
  p.stalled = p.speed < FLIGHT.minSpeed && !p.onGround;
  if (p.stalled) {
    p.pitch += (0 - p.pitch) * Math.min(1, dt * 1.2) - 14 * dt;
    p.verticalSpeed -= 9 * dt;
  }

  // --- turn: heading follows bank; faster = wider turn ---
  const turnRate = Math.sin(p.bank * DEG) * (p.speed / 90) * 0.18; // rad/s
  p.heading += turnRate * dt;

  // --- vertical speed from pitch and climb power ---
  const climbTarget = Math.sin(p.pitch * DEG) * p.speed * 1.69 + thrust * FLIGHT.climbRate - 4;
  p.verticalSpeed += (climbTarget - p.verticalSpeed) * Math.min(1, dt * 1.8);
  p.alt += p.verticalSpeed * dt;

  // --- position: forward along heading, plus a gust push across the valley ---
  const feetPerSec = p.speed * 1.68781;
  p.x += Math.cos(p.heading) * feetPerSec * dt;
  p.z += Math.sin(p.heading) * feetPerSec * dt + gust * 1.68781 * dt * 0.12;

  // --- route bounds: the valley ends; turn the pilot around gently ---
  if (p.x > VALLEY.length - 200) {
    p.heading += (Math.PI - p.heading) * Math.min(1, dt * 0.8);
    p.message = 'End of the valley — turning back';
  }
  if (p.x < 100) {
    p.heading += (0 - p.heading) * Math.min(1, dt * 0.8);
  }
  p.z = clamp(p.z, -VALLEY.halfWidth * 1.6, VALLEY.halfWidth * 1.6);

  // --- ground contact ---
  const groundH = groundHeightAt(p.x, p.z);
  if (p.alt <= groundH) {
    p.alt = groundH;
    return touchDown(p, ground);
  }
  p.onGround = false;
  return p;
}

function touchDown(p, ground) {
  const groundHeightAt = ground.heightAt.bind(ground);
  const sinkFpm = -p.verticalSpeed * 60;
  const overStrip = ground.onStrip(p.x, p.z) !== null;
  const gentle = sinkFpm <= FLIGHT.landingMaxSinkFpm
    && Math.abs(p.bank) <= FLIGHT.landingMaxBankDeg
    && p.speed >= FLIGHT.landingSpeedMin
    && p.speed <= FLIGHT.landingSpeedMax;
  if (overStrip && gentle) {
    p.onGround = true;
    p.landed = true;
    p.verticalSpeed = 0;
    p.speed = Math.max(0, p.speed - 26 * (1 / 60));
    p.message = sinkFpm < 240 ? 'Smooth landing' : 'Firm landing — nicely done';
    return p;
  }
  if (overStrip && sinkFpm <= FLIGHT.landingMaxSinkFpm * 1.8 && Math.abs(p.bank) <= 30) {
    p.damage += FLIGHT.damagePerHardLanding;
    p.onGround = true;
    p.landed = true;
    p.verticalSpeed = 0;
    p.message = 'Hard landing — airframe damaged';
    if (p.damage >= 100) {
      p.crashed = true;
      p.message = 'Airframe gave out on touchdown';
    }
    return p;
  }
  p.damage += FLIGHT.damagePerStrike;
  p.crashed = p.damage >= 100;
  p.message = p.crashed ? 'Terrain strike — flight over' : 'Clipped the ground — check the airframe';
  p.verticalSpeed = 0;
  p.alt = groundHeightAt(p.x, p.z) + 2;
  return p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
