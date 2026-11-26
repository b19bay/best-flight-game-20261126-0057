// MERIDIAN RUN — constants, mission definitions, palette.
// One job: every tunable number in one place. No logic lives here.

export const GAME = {
  title: 'MERIDIAN RUN',
  subtitle: 'fly the alpine courier route',
  canvasWidth: 1280,
  canvasHeight: 720,
  stepDt: 1 / 60,
  defaultSeed: 1,
};

// Flight envelope (speeds in knots, altitudes in feet, distances in feet).
export const FLIGHT = {
  minSpeed: 55, // stall speed
  maxSpeed: 210,
  cruiseSpeed: 130,
  climbRate: 18, // ft/s at full throttle, level
  gravity: 32,
  maxBankDeg: 60,
  maxPitchDeg: 25,
  fuelCapacity: 100,
  fuelBurnPerSec: 0.055, // at full throttle; idle burns 0.012
  fuelBurnIdle: 0.012,
  damagePerHardLanding: 35,
  damagePerStrike: 45,
  landingMaxSinkFpm: 600, // vertical speed limit for a graded landing
  landingMaxBankDeg: 15,
  landingSpeedMin: 60,
  landingSpeedMax: 120,
};

// The valley. x runs along the route, z across it, y is altitude.
export const VALLEY = {
  length: 12000, // feet of flyable route
  halfWidth: 900, // valley floor half-width in feet
  ridgeHeight: 2600, // mountain tops above the floor
  riverOffset: -260, // river centreline offset from valley centre
  roadOffset: 180, // road centreline offset from valley centre
  stripNear: { x0: 300, x1: 1500, z: 0 }, // home strip
  stripFar: { x0: 10200, x1: 11400, z: 0 }, // far strip
  meadow: { x: 6200, z: 320, radius: 220 }, // hiker meadow (supply drop)
};

// Ring Run: 8 gates strung down the valley.
export const RINGS = [
  { x: 1800, z: -120, alt: 420, r: 90 },
  { x: 2800, z: 180, alt: 520, r: 90 },
  { x: 3800, z: -40, alt: 380, r: 80 },
  { x: 4800, z: 260, alt: 560, r: 90 },
  { x: 5800, z: -180, alt: 440, r: 80 },
  { x: 6900, z: 120, alt: 600, r: 90 },
  { x: 8000, z: -220, alt: 480, r: 80 },
  { x: 9100, z: 60, alt: 540, r: 90 },
];

export const MISSIONS = {
  rings: {
    id: 'rings',
    name: 'RING RUN',
    blurb: 'Thread all 8 rings down the valley before the clock runs out.',
    timeLimitSec: 150,
    start: { x: 600, z: 0, alt: 350, heading: 0, speed: 120, throttle: 0.7 },
  },
  courier: {
    id: 'courier',
    name: 'COURIER',
    blurb: 'Carry the parcel to the far strip and land it gentle.',
    timeLimitSec: 300,
    start: { x: 500, z: 0, alt: 0, heading: 0, speed: 0, throttle: 0 },
  },
  drop: {
    id: 'drop',
    name: 'SUPPLY DROP',
    blurb: 'Fly low over the high meadow and drop the bundle in the circle.',
    timeLimitSec: 240,
    start: { x: 600, z: 0, alt: 350, heading: 0, speed: 120, throttle: 0.7 },
  },
};

// Golden-hour alpine palette — one style for sky, terrain, aircraft.
export const PALETTE = {
  skyTop: '#2e4a6b',
  skyMid: '#c97a5e',
  skyHorizon: '#f7c873',
  sun: '#ffd98a',
  ridgeFar: '#8a6f8f',
  ridgeMid: '#63517a',
  ridgeNear: '#4a3d63',
  grassA: '#77854e',
  grassB: '#6b7a45',
  river: '#5f8fa8',
  road: '#8a7d68',
  runway: '#5d6167',
  runwayMark: '#f2ead8',
  ring: '#ffd76a',
  ringGlow: '#ff9d4d',
  aircraftCream: '#f2e6c9',
  aircraftRed: '#b23a2e',
  aircraftDark: '#2b2620',
  hudGreen: '#9dff9d',
  hudAmber: '#ffd76a',
  hudRed: '#ff6b5e',
  hudPanel: 'rgba(12, 16, 24, 0.62)',
};

// Screenshot states: deterministic setups for the four dossier shots.
// zOff is the lateral offset from the valley centreline at the shot's x.
export const SHOTS = {
  cover: { mission: 'courier', x: 9400, zOff: -40, alt: 300, heading: 0, speed: 105, throttle: 0.55, bank: 0, pitch: -2, view: 'chase' },
  rings: { mission: 'rings', x: 3400, zRefX: 3800, zOff: -40, alt: 380, heading: 0, speed: 135, throttle: 0.7, bank: 0, pitch: 0, view: 'chase' },
  cockpit: { mission: 'courier', x: 5200, zOff: 80, alt: 520, heading: 0, speed: 130, throttle: 0.7, bank: 0, pitch: 0, view: 'cockpit' },
  landing: { mission: 'courier', x: 10600, zRefX: 11000, zOff: 0, alt: 10, heading: 0, speed: 78, throttle: 0.3, bank: 0, pitch: -1, view: 'chase' },
};
