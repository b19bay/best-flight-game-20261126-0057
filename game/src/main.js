// MERIDIAN RUN — boot and game loop. One job: own the frame.
// Fixed 60 Hz steps, deterministic shot states, menu / flying / paused / over.
// The simulation never reads the wall clock: steps advance only from the loop,
// so the same seed and the same inputs always play the same flight.

import { GAME, MISSIONS, SHOTS, VALLEY, RINGS } from './config.js';
import { makeValley } from './terrain.js';
import { freshPlane, flyStep } from './flight.js';
import { attachInput, readControls, pressed } from './input.js';
import { renderWorld, makeClouds } from './render.js';
import { drawHud } from './hud.js';
import { freshMission, missionStep, dropBundle } from './missions.js';
import { makeAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Surface runtime errors in the title so headless runs can report them.
window.addEventListener('error', (e) => {
  document.title = `ERR: ${e.message}`;
});
canvas.width = GAME.canvasWidth;
canvas.height = GAME.canvasHeight;

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || GAME.defaultSeed);
const shotName = params.get('shot');
const shot = shotName ? SHOTS[shotName] : null;

const valley = makeValley(seed);
const clouds = makeClouds(seed);
const audio = makeAudio();
const input = attachInput(canvas);

const ground = {
  heightAt: (x, z) => valley.groundHeight(x, z),
  onStrip: (x, z) => valley.onStrip(x, z),
};

let missionId = params.get('mission') || 'rings';
let mission = freshMission(missionId);
let plane = freshPlane(MISSIONS[missionId].start);
let view = 'chase';
let mode = shot ? 'flying' : 'menu';
let tick = 0;
let shotSteps = 0;
let windKt = 5;
let windDir = 300;
let lastStallHorn = -1000;

const SHOT_STEPS = { cover: 120, rings: 25, cockpit: 150, landing: 180 };

if (shot) {
  // Deterministic screenshot state: place the plane, pick the mission and view.
  missionId = shot.mission;
  mission = freshMission(missionId);
  plane = freshPlane({
    x: shot.x, z: valley.centreZ(shot.zRefX || shot.x) + shot.zOff, alt: shot.alt,
    heading: shot.heading, speed: shot.speed, throttle: shot.throttle,
  });
  plane.bank = shot.bank;
  plane.pitch = shot.pitch;
  view = shot.view;
  if (shotName === 'rings' || shotName === 'cockpit') {
    // Rings 1 and 2 are already behind the camera: mark them flown.
    mission.nextRing = 2;
    mission.ringsHit = new Set([0, 1]);
  }
  // Run the sim synchronously to its screenshot frame: the shot must not
  // depend on how the browser paces requestAnimationFrame.
  for (let i = 0; i < (SHOT_STEPS[shotName] || 150); i += 1) step();
  mode = 'held';
}

function autopilot() {
  // Gentle, lookahead-based steering: chase a point 600 ft ahead, never bank
  // hard — the autopilot only has to hold a photogenic line, not win a race.
  // Rings already behind the plane are never chased.
  let targetAlt = 450;
  let targetZ = valley.centreZ(plane.x + 600);
  let targetSpeed = 130;
  if (shotName === 'landing') {
    targetZ = valley.centreZ(plane.x + 600);
    targetAlt = 2;
    targetSpeed = 75;
  } else if (mission.id === 'rings') {
    let idx = mission.nextRing;
    while (idx < RINGS.length && RINGS[idx].x < plane.x + 100) idx += 1;
    if (idx < RINGS.length) {
      const ring = RINGS[idx];
      targetZ = valley.centreZ(ring.x) + ring.z;
      targetAlt = ring.alt;
      targetSpeed = 135;
    }
  } else if (mission.id === 'courier') {
    targetZ = valley.centreZ(plane.x + 600);
    targetAlt = plane.x > 9400 ? 110 : 450;
    targetSpeed = plane.x > 9400 ? 82 : 130;
  } else {
    targetZ = valley.centreZ(VALLEY.meadow.x) + VALLEY.meadow.z;
    targetAlt = 260;
    targetSpeed = 105;
  }
  const zErr = targetZ - plane.z;
  const altErr = targetAlt - plane.alt;
  return {
    pitch: clamp(altErr / 250, -1, 1) * 0.5,
    roll: clamp(clamp(zErr / 400, -1, 1) * 0.4 - (plane.bank / 60) * 0.6, -0.45, 0.45),
    throttleDelta: clamp((targetSpeed - plane.speed) / 80, -1, 1) * 0.6,
    brake: false,
  };
}

function step() {
  tick += 1;
  // Seeded gusts: gentle, slow, always the same for a given seed.
  windKt = 5 + 3 * Math.sin(tick * 0.008 + seed);
  const gust = windKt * Math.sin(tick * 0.01 + seed * 2);

  const controls = shot ? autopilot() : readControls(input.mouse);
  flyStep(plane, controls, GAME.stepDt, ground, gust);
  missionStep(mission, plane, valley, GAME.stepDt, audio);

  if (plane.stalled && tick - lastStallHorn > 120) {
    lastStallHorn = tick;
    audio.stallHorn();
  }
  if (plane.landed && plane.speed < 5 && !plane.crashed) audio.thud();
  audio.engine(plane.throttle, plane.speed);

  if (shot) {
    shotSteps += 1;
    if (shotSteps >= (SHOT_STEPS[shotName] || 150)) {
      mode = 'held'; // freeze: the screenshot frame is now stable.
    }
  }
}

function drawMenu() {
  ctx.fillStyle = '#1d2f47';
  ctx.fillRect(0, 0, GAME.canvasWidth, GAME.canvasHeight);
  ctx.fillStyle = '#f7c873';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MERIDIAN RUN', GAME.canvasWidth / 2, 150);
  ctx.fillStyle = '#f2e6c9';
  ctx.font = '20px monospace';
  ctx.fillText('fly the alpine courier route — golden hour over the Sawtooth valley', GAME.canvasWidth / 2, 195);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#9dff9d';
  const lines = [
    ['1', 'RING RUN — thread 8 rings down the valley against the clock'],
    ['2', 'COURIER — carry the parcel to the far strip and land it gentle'],
    ['3', 'SUPPLY DROP — drop the bundle in the high meadow circle'],
  ];
  lines.forEach(([key, text], i) => {
    ctx.fillText(`${key}   ${text}`, GAME.canvasWidth / 2, 300 + i * 46);
  });
  ctx.fillStyle = '#f2e6c9';
  ctx.font = '17px monospace';
  ctx.fillText('Arrows / WASD fly  ·  Shift / Ctrl throttle  ·  Mouse steers gently', GAME.canvasWidth / 2, 480);
  ctx.fillText('C cockpit view  ·  Space drop  ·  P pause  ·  R restart  ·  M mute', GAME.canvasWidth / 2, 512);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('press 1, 2 or 3 to fly', GAME.canvasWidth / 2, 580);
}

function draw() {
  if (mode === 'menu') {
    drawMenu();
    return;
  }
  renderWorld(ctx, {
    plane, valley, view, tick, clouds,
    width: GAME.canvasWidth, height: GAME.canvasHeight,
    missionId, ringsHit: mission.ringsHit,
  });
  drawHud(ctx, {
    plane, mission, view, windKt, windDir,
    width: GAME.canvasWidth, height: GAME.canvasHeight,
  });
}

function handleKeys() {
  if (pressed('m')) audio.setMuted(!audio.isMuted());
  if (mode === 'menu') {
    if (pressed('1')) startMission('rings');
    if (pressed('2')) startMission('courier');
    if (pressed('3')) startMission('drop');
    return;
  }
  if (pressed('p')) {
    mode = mode === 'paused' ? 'flying' : 'paused';
    return;
  }
  if (mode === 'paused') return;
  if (pressed('c')) view = view === 'chase' ? 'cockpit' : 'chase';
  if (pressed(' ')) {
    audio.unlock();
    dropBundle(mission, plane, valley, audio);
  }
  if (pressed('r')) startMission(missionId);
  if (pressed('1')) startMission('rings');
  if (pressed('2')) startMission('courier');
  if (pressed('3')) startMission('drop');
}

function startMission(id) {
  missionId = id;
  mission = freshMission(id);
  plane = freshPlane(MISSIONS[id].start);
  mode = 'flying';
  audio.unlock();
}

let last = 0;
let acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  let dt = (ts - last) / 1000;
  last = ts;
  if (dt > 0.25) dt = 0.25;
  handleKeys();
  if (mode === 'flying') {
    acc += dt;
    let guard = 0;
    while (acc >= GAME.stepDt && guard < 5) {
      step();
      acc -= GAME.stepDt;
      guard += 1;
      if (mode === 'held') { acc = 0; break; }
    }
  }
  draw();
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

requestAnimationFrame(frame);
