// MERIDIAN RUN — input. One job: turn keys and mouse into a control vector.
// The game reads input.read() every fixed step; nothing else touches the DOM.

const KEYS = new Set();

export function attachInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    KEYS.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => {
    KEYS.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => KEYS.clear());

  let mouseX = 0;
  let mouseY = 0;
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    mouseY = (e.clientY - rect.top) / rect.height - 0.5;
  });
  canvas.addEventListener('mouseleave', () => {
    mouseX = 0;
    mouseY = 0;
  });

  return { get mouse() { return { x: mouseX, y: mouseY }; } };
}

// Control vector for one step: pitch/roll in -1..1, throttleDelta in -1..1.
export function readControls(mouse) {
  let pitch = 0;
  let roll = 0;
  if (KEYS.has('arrowup') || KEYS.has('w')) pitch -= 1;
  if (KEYS.has('arrowdown') || KEYS.has('s')) pitch += 1;
  if (KEYS.has('arrowleft') || KEYS.has('a')) roll -= 1;
  if (KEYS.has('arrowright') || KEYS.has('d')) roll += 1;
  // Mouse steers gently: hold the pointer off-centre to bank or pitch.
  roll += clamp(mouse.x * 1.4, -0.6, 0.6);
  pitch += clamp(mouse.y * 1.2, -0.5, 0.5);

  let throttleDelta = 0;
  if (KEYS.has('shift')) throttleDelta += 1;
  if (KEYS.has('control')) throttleDelta -= 1;

  return {
    pitch: clamp(pitch, -1, 1),
    roll: clamp(roll, -1, 1),
    throttleDelta,
    brake: KEYS.has('b'),
  };
}

// One-shot keys, consumed by the game loop (menu, view, pause, drop, mute).
export function pressed(key) {
  const k = key.toLowerCase();
  if (KEYS.has(k)) {
    KEYS.delete(k);
    return true;
  }
  return false;
}

export function anyKey() {
  return KEYS.size > 0;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
