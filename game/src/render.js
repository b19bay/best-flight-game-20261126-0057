// MERIDIAN RUN — rendering. One job: draw one frame of the world on the canvas.
// Canvas 2D, golden-hour alpine valley, pseudo-3D chase projection. No assets:
// every pixel is drawn from the seeded terrain and the plane state.

import { PALETTE, VALLEY } from './config.js';
import { projectPoint } from './terrain.js';

const DEG = Math.PI / 180;

// Clouds: seeded once per game, drift with the sim tick and the heading.
export function makeClouds(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: 9 }, () => ({
    x: next(), y: 0.05 + next() * 0.22, w: 90 + next() * 160, drift: 0.00002 + next() * 0.00005,
  }));
}

export function renderWorld(ctx, state) {
  const { plane, valley, view, tick, width, height } = state;
  const cx = width / 2;
  const focal = height * 1.05;
  const horizonY = height * 0.42 + plane.pitch * 5;

  // Base coat: the valley floor colour everywhere, so no gap between the
  // nearest drawn slice and the bottom of the screen ever shows through.
  ctx.fillStyle = PALETTE.grassB;
  ctx.fillRect(0, 0, width, height);

  // Camera sits behind the aircraft (chase) or at its nose (cockpit).
  const back = view === 'cockpit' ? 2 : 34;
  const cam = {
    x: plane.x - back * Math.cos(plane.heading),
    z: plane.z - back * Math.sin(plane.heading),
    alt: plane.alt + (view === 'cockpit' ? 2 : 9),
    heading: plane.heading,
  };

  ctx.save();
  // The world tilts a little with the bank; the aircraft banks more (drawn later).
  ctx.translate(cx, horizonY);
  ctx.rotate(-plane.bank * DEG * 0.22);
  ctx.translate(-cx, -horizonY);

  drawSky(ctx, width, height, horizonY, state.clouds, plane.heading, tick);
  drawRidges(ctx, valley, width, height, horizonY, plane.heading);
  drawValleyFloor(ctx, valley, cam, plane, focal, horizonY, cx, width, height);
  drawRings(ctx, valley, cam, plane, focal, horizonY, cx, state.ringsHit);
  if (state.missionId === 'drop') drawMeadow(ctx, valley, cam, focal, horizonY, cx);
  ctx.restore();

  if (view === 'chase') drawAircraft(ctx, plane, width, height, tick);
}

function drawSky(ctx, width, height, horizonY, clouds, heading, tick) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY * 1.15);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, horizonY * 1.15 + 2);

  // Low golden sun, left of centre, with a soft glow.
  const sunX = width * 0.2 - heading * width * 0.25;
  const sunY = height * 0.17;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, 'rgba(255, 217, 138, 0.9)');
  glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // Clouds: warm lit ellipses drifting slowly across the sky.
  ctx.fillStyle = 'rgba(255, 236, 205, 0.75)';
  for (const c of clouds) {
    const x = (((c.x + tick * c.drift - heading * 0.22) % 1.2) + 1.2) % 1.2 * width - width * 0.1;
    const y = c.y * height;
    ctx.beginPath();
    ctx.ellipse(x, y, c.w, c.w * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(x + c.w * 0.5, y + 6, c.w * 0.6, c.w * 0.16, 0, 0, Math.PI * 2);
    ctx.ellipse(x - c.w * 0.5, y + 8, c.w * 0.55, c.w * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRidges(ctx, valley, width, height, horizonY, heading) {
  const colors = [PALETTE.ridgeFar, PALETTE.ridgeMid, PALETTE.ridgeNear];
  const bases = [70, 130, 210];
  valley.ridges.forEach((ridge, layer) => {
    const shift = -heading * width * 0.35 * (layer + 1);
    ctx.fillStyle = colors[layer];
    ctx.beginPath();
    ctx.moveTo(-4, horizonY + 2);
    const step = width / 26;
    for (let i = 0; i <= 26; i += 1) {
      const peak = ridge.peaks[(i + Math.floor(shift / step) + 56) % 28];
      const x = i * step + (shift % step);
      const y = horizonY - peak * bases[layer] - layer * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width + 4, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  });
}

function drawValleyFloor(ctx, valley, cam, plane, focal, horizonY, cx, width, height) {
  // Slices from near to far, then painted far-to-near.
  const slices = [];
  let d = 30;
  for (let i = 0; i < 46; i += 1) {
    slices.push(d);
    d *= 1.13;
  }
  const pts = slices.map((dist) => {
    const wx = cam.x + dist * Math.cos(cam.heading);
    const centre = valley.centreZ(wx);
    const left = projectPoint(cam, wx, centre - VALLEY.halfWidth, valley.floorHeight(wx, centre - VALLEY.halfWidth), focal, horizonY, cx);
    const mid = projectPoint(cam, wx, centre, valley.floorHeight(wx, centre), focal, horizonY, cx);
    const right = projectPoint(cam, wx, centre + VALLEY.halfWidth, valley.floorHeight(wx, centre + VALLEY.halfWidth), focal, horizonY, cx);
    const riverC = projectPoint(cam, wx, centre + VALLEY.riverOffset, valley.floorHeight(wx, centre + VALLEY.riverOffset), focal, horizonY, cx);
    const roadC = projectPoint(cam, wx, centre + VALLEY.roadOffset, valley.floorHeight(wx, centre + VALLEY.roadOffset), focal, horizonY, cx);
    return { wx, dist, left, mid, right, riverC, roadC, centre };
  });

  for (let i = pts.length - 1; i > 0; i -= 1) {
    const far = pts[i];
    const near = pts[i - 1];
    if (!far.left || !near.left) continue;
    const shade = i % 2 === 0 ? PALETTE.grassA : PALETTE.grassB;
    // Left half of the floor.
    quad(ctx, far.left, near.left, near.mid, far.mid, shade);
    // Right half.
    quad(ctx, far.mid, near.mid, near.right, far.right, shade);
    // Ribbons fan out absurdly wide when their slice is right under the
    // camera, so they only draw once the slice is 120 ft ahead.
    if (far.dist >= 120) {
      // River ribbon.
      if (far.riverC && near.riverC) {
        ribbon(ctx, far, near, VALLEY.riverOffset, 46, PALETTE.river, cam, focal, horizonY, cx, valley);
      }
      // Road ribbon.
      if (far.roadC && near.roadC) {
        ribbon(ctx, far, near, VALLEY.roadOffset, 15, PALETTE.road, cam, focal, horizonY, cx, valley);
      }
      // Runway strip, when this slice crosses one.
      const strip = valley.onStrip(far.wx, far.centre);
      if (strip) {
        runwayQuad(ctx, far, near, cam, focal, horizonY, cx, valley, i);
      }
    }
  }
}

function ribbon(ctx, far, near, offset, halfW, color, cam, focal, horizonY, cx, valley) {
  const f1 = projectPoint(cam, far.wx, far.centre + offset - halfW, valley.floorHeight(far.wx, far.centre + offset - halfW), focal, horizonY, cx);
  const f2 = projectPoint(cam, far.wx, far.centre + offset + halfW, valley.floorHeight(far.wx, far.centre + offset + halfW), focal, horizonY, cx);
  const n1 = projectPoint(cam, near.wx, near.centre + offset - halfW, valley.floorHeight(near.wx, near.centre + offset - halfW), focal, horizonY, cx);
  const n2 = projectPoint(cam, near.wx, near.centre + offset + halfW, valley.floorHeight(near.wx, near.centre + offset + halfW), focal, horizonY, cx);
  if (!f1 || !f2 || !n1 || !n2) return;
  quad(ctx, f1, n1, n2, f2, color);
}

function runwayQuad(ctx, far, near, cam, focal, horizonY, cx, valley, i) {
  const halfW = 70;
  const f1 = projectPoint(cam, far.wx, far.centre - halfW, 0, focal, horizonY, cx);
  const f2 = projectPoint(cam, far.wx, far.centre + halfW, 0, focal, horizonY, cx);
  const n1 = projectPoint(cam, near.wx, near.centre - halfW, 0, focal, horizonY, cx);
  const n2 = projectPoint(cam, near.wx, near.centre + halfW, 0, focal, horizonY, cx);
  if (!f1 || !f2 || !n1 || !n2) return;
  quad(ctx, f1, n1, n2, f2, PALETTE.runway);
  // Centreline dashes on alternating slices.
  if (i % 2 === 0) {
    const c1 = projectPoint(cam, far.wx, far.centre, 0.5, focal, horizonY, cx);
    const c2 = projectPoint(cam, near.wx, near.centre, 0.5, focal, horizonY, cx);
    if (c1 && c2) {
      ctx.strokeStyle = PALETTE.runwayMark;
      ctx.lineWidth = Math.max(1, c1.scale * 2);
      ctx.beginPath();
      ctx.moveTo(c1.sx, c1.sy);
      ctx.lineTo(c2.sx, c2.sy);
      ctx.stroke();
    }
  }
}

function drawRings(ctx, valley, cam, plane, focal, horizonY, cx, ringsHit) {
  valley.rings.forEach((ring, idx) => {
    const p = projectPoint(cam, ring.x, valley.centreZ(ring.x) + ring.z, ring.alt, focal, horizonY, cx);
    if (!p) return;
    const rx = ring.r * p.scale;
    const ry = rx * 0.92;
    if (rx < 2 || rx > 900) return;
    const hit = ringsHit && ringsHit.has(idx);
    ctx.save();
    ctx.globalAlpha = hit ? 0.35 : 0.95;
    ctx.strokeStyle = hit ? '#7dff9d' : PALETTE.ring;
    ctx.lineWidth = Math.max(2, rx * 0.09);
    ctx.shadowColor = PALETTE.ringGlow;
    ctx.shadowBlur = hit ? 0 : 18;
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawMeadow(ctx, valley, cam, focal, horizonY, cx) {
  const m = VALLEY.meadow;
  const p = projectPoint(cam, m.x, valley.centreZ(m.x) + m.z, valley.floorHeight(m.x, valley.centreZ(m.x) + m.z), focal, horizonY, cx);
  if (!p || p.scale <= 0) return;
  const r = m.radius * p.scale;
  if (r < 3 || r > 800) return;
  ctx.save();
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, r, r * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function quad(ctx, a, b, c, d, color) {
  // Any corner can fall behind the camera (null projection): skip the quad.
  if (!a || !b || !c || !d) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
  ctx.fill();
}

// The aircraft, chase view: a built-looking courier plane seen from behind and
// slightly above, banking with the stick, prop spinning, nav lights blinking.
function drawAircraft(ctx, plane, width, height, tick) {
  const cx = width / 2;
  const cy = height * 0.60 + plane.pitch * 1.5;
  const s = 1.0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * DEG * 0.9);
  ctx.scale(s, s);

  // Prop blur at the nose (far end, top of the sprite).
  ctx.fillStyle = 'rgba(220, 225, 230, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, -78, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main wings: cream with red tips, slight dihedral.
  ctx.fillStyle = PALETTE.aircraftCream;
  ctx.strokeStyle = PALETTE.aircraftDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-88, 6);
  ctx.lineTo(-14, -8);
  ctx.lineTo(14, -8);
  ctx.lineTo(88, 6);
  ctx.lineTo(80, 16);
  ctx.lineTo(0, 4);
  ctx.lineTo(-80, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Red wingtips.
  ctx.fillStyle = PALETTE.aircraftRed;
  ctx.beginPath();
  ctx.moveTo(-88, 6); ctx.lineTo(-70, 2); ctx.lineTo(-66, 12); ctx.lineTo(-80, 16);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(88, 6); ctx.lineTo(70, 2); ctx.lineTo(66, 12); ctx.lineTo(80, 16);
  ctx.closePath(); ctx.fill();

  // Fuselage: tapering from the tail (near, bottom) to the nose (far, top).
  ctx.fillStyle = PALETTE.aircraftCream;
  ctx.beginPath();
  ctx.moveTo(-13, 52);
  ctx.quadraticCurveTo(-16, -10, -7, -72);
  ctx.quadraticCurveTo(0, -80, 7, -72);
  ctx.quadraticCurveTo(16, -10, 13, 52);
  ctx.quadraticCurveTo(0, 60, -13, 52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Red cheatline along the fuselage.
  ctx.fillStyle = PALETTE.aircraftRed;
  ctx.fillRect(-13, -6, 26, 7);
  // Cabin windows.
  ctx.fillStyle = '#24384a';
  ctx.beginPath();
  ctx.ellipse(0, -42, 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail: vertical fin and horizontal stabilisers.
  ctx.fillStyle = PALETTE.aircraftRed;
  ctx.beginPath();
  ctx.moveTo(-4, 48);
  ctx.lineTo(-10, 74);
  ctx.lineTo(10, 74);
  ctx.lineTo(4, 48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.aircraftCream;
  ctx.beginPath();
  ctx.moveTo(-34, 56); ctx.lineTo(34, 56); ctx.lineTo(28, 64); ctx.lineTo(-28, 64);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Registration on the fin.
  ctx.fillStyle = '#f2e6c9';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('M-7', 0, 66);

  // Nav lights: left red, right green, blinking with the tick.
  const blink = Math.floor(tick / 30) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath(); ctx.arc(-88, 10, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4aff7a';
    ctx.beginPath(); ctx.arc(88, 10, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
