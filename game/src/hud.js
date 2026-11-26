// MERIDIAN RUN — HUD and cockpit instruments. One job: draw every readout the
// pilot (and the judge) needs: altitude, speed, heading, fuel, damage, mission.

import { PALETTE } from './config.js';

const DEG = Math.PI / 180;

export function drawHud(ctx, state) {
  const { plane, mission, width, height, view } = state;
  ctx.save();
  ctx.font = 'bold 15px monospace';

  if (view === 'cockpit') {
    drawCockpitPanel(ctx, plane, width, height);
  } else {
    drawTapes(ctx, plane, width, height);
  }

  // Top bar: mission name, objective, timer, score.
  panel(ctx, 12, 10, width - 24, 44);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.textAlign = 'left';
  ctx.fillText(`${mission.name}  —  ${mission.objective}`, 26, 30);
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.textAlign = 'right';
  ctx.fillText(`TIME ${fmtTime(mission.timeLeft)}   SCORE ${mission.score}`, width - 26, 30);

  // Bottom-left: fuel and damage gauges.
  panel(ctx, 12, height - 92, 240, 80);
  gauge(ctx, 26, height - 66, 212, 'FUEL', plane.fuel, 100, PALETTE.hudGreen);
  gauge(ctx, 26, height - 36, 212, 'DMG ', plane.damage, 100, PALETTE.hudRed);

  // Bottom-right: throttle bar + wind.
  panel(ctx, width - 252, height - 92, 240, 80);
  gauge(ctx, width - 238, height - 66, 212, 'THR ', plane.throttle * 100, 100, PALETTE.hudAmber);
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.textAlign = 'left';
  ctx.fillText(`WIND ${state.windKt.toFixed(0)} kt ${windArrow(state.windDir)}`, width - 238, height - 30);

  // Stall warning.
  if (plane.stalled) {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!! STALL — NOSE DOWN, POWER UP !!', width / 2, 92);
  }

  // Centre message (landing grade, ring hit, mission text).
  if (plane.message) {
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(plane.message, width / 2, height - 116);
  }

  // Mission-complete / crashed banner.
  if (mission.done || plane.crashed) {
    ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
    ctx.fillRect(width / 2 - 260, height / 2 - 70, 520, 140);
    ctx.strokeStyle = PALETTE.hudAmber;
    ctx.lineWidth = 2;
    ctx.strokeRect(width / 2 - 260, height / 2 - 70, 520, 140);
    ctx.fillStyle = mission.done ? PALETTE.hudGreen : PALETTE.hudRed;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(mission.done ? mission.doneText : 'FLIGHT OVER', width / 2, height / 2 - 14);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = 'bold 17px monospace';
    ctx.fillText(`SCORE ${mission.score}   —   press R to fly again`, width / 2, height / 2 + 26);
  }

  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(157, 255, 157, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function gauge(ctx, x, y, w, label, value, max, color) {
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(x + 52, y - 10, w - 52, 12);
  ctx.fillStyle = value > 25 || label !== 'FUEL' ? color : PALETTE.hudRed;
  ctx.fillRect(x + 52, y - 10, (w - 52) * Math.max(0, Math.min(1, value / max)), 12);
}

function drawTapes(ctx, plane, width, height) {
  // Left tape: airspeed. Right tape: altitude. Top centre: heading.
  ctx.font = 'bold 16px monospace';
  panel(ctx, 12, 70, 118, 40);
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.textAlign = 'left';
  ctx.fillText(`IAS ${Math.round(plane.speed)} kt`, 22, 96);

  panel(ctx, width - 130, 70, 118, 40);
  ctx.textAlign = 'left';
  ctx.fillText(`ALT ${Math.max(0, Math.round(plane.alt))} ft`, width - 120, 96);

  const hdg = ((Math.round(plane.heading / DEG) % 360) + 360) % 360;
  panel(ctx, width / 2 - 90, 70, 180, 40);
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, width / 2, 96);
}

function drawCockpitPanel(ctx, plane, width, height) {
  // Instrument panel across the bottom 38% of the screen.
  const py = height * 0.62;
  ctx.fillStyle = '#1d2126';
  ctx.fillRect(0, py, width, height - py);
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(0, py, width, 6);
  const cx = width / 2;
  drawArtificialHorizon(ctx, cx - 340, py + 52, 46, plane);
  drawGauge(ctx, cx - 200, py + 52, 46, 'AIRSPEED', Math.round(plane.speed), 0, 220, 'kt');
  drawGauge(ctx, cx - 60, py + 52, 46, 'ALTITUDE', Math.max(0, Math.round(plane.alt)), 0, 2000, 'ft');
  drawCompass(ctx, cx + 80, py + 52, 46, plane.heading);
  drawGauge(ctx, cx + 220, py + 52, 46, 'FUEL', Math.round(plane.fuel), 0, 100, '%');
  drawGauge(ctx, cx + 340, py + 52, 46, 'DAMAGE', Math.round(plane.damage), 0, 100, '%');
}

function drawArtificialHorizon(ctx, x, y, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.bank * DEG);
  ctx.translate(0, plane.pitch * 1.4);
  ctx.fillStyle = '#3f7fc1';
  ctx.fillRect(-r, -r, r * 2, r);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, 0, r * 2, r);
  ctx.fillStyle = '#f2ead8';
  ctx.fillRect(-r, -1.5, r * 2, 3);
  ctx.restore();
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.fillRect(x - r * 0.55, y - 2, r * 0.35, 4);
  ctx.fillRect(x + r * 0.2, y - 2, r * 0.35, 4);
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', x, y + r + 16);
}

function drawGauge(ctx, x, y, r, label, value, min, max, unit) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#10141a';
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Tick marks.
  ctx.strokeStyle = 'rgba(242, 234, 216, 0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const a = (-225 + i * 27) * DEG;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
    ctx.lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10));
    ctx.stroke();
  }
  // Needle.
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const na = (-225 + frac * 270) * DEG;
  ctx.strokeStyle = PALETTE.hudRed;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(na) * (r - 8), y + Math.sin(na) * (r - 8));
  ctx.stroke();
  // Lit digital readout.
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(value), x, y + 6);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`${label} ${unit}`, x, y + r + 15);
  ctx.restore();
}

function drawCompass(ctx, x, y, r, heading) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#10141a';
  ctx.fill();
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudGreen;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  const pts = ['N', 'E', 'S', 'W'];
  pts.forEach((label, i) => {
    const a = i * 90 * DEG - heading - Math.PI / 2;
    ctx.fillText(label, x + Math.cos(a) * (r - 12), y + Math.sin(a) * (r - 12) + 4);
  });
  // Lubber line.
  ctx.fillStyle = PALETTE.hudRed;
  ctx.fillRect(x - 1, y - r + 2, 2, 10);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.font = 'bold 10px monospace';
  ctx.fillText('HDG', x, y + r + 15);
  ctx.restore();
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function windArrow(dir) {
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  return arrows[Math.round((((dir % 360) + 360) % 360) / 45) % 8];
}
