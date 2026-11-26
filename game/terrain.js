// terrain.js — the world Skyline Courier flies over: rolling hills, a river,
// a little airfield with a runway, ring gates for the course, and drifting clouds.
// All shapes are drawn from numbers, no image files. Terrain height is a fixed
// sum of sines, so the same course is there every time you play.

const WORLD = {
  startX: 0,
  endX: 6200,          // metres of flyable course
  runwayX: 5400,       // runway centre
  runwayLen: 420,
  seaLevel: 0,
};

// Gentle deterministic hills: base height plus three sine waves.
function terrainHeight(x) {
  if (x < 0) x = 0;
  const h =
    46
    + 26 * Math.sin(x * 0.0016 + 1.2)
    + 14 * Math.sin(x * 0.0041 + 0.4)
    + 7 * Math.sin(x * 0.011 + 2.1);
  return h;
}

// The runway sits on a flattened pad so landings are fair.
function groundHeight(x) {
  const r0 = WORLD.runwayX - WORLD.runwayLen / 2 - 60;
  const r1 = WORLD.runwayX + WORLD.runwayLen / 2 + 60;
  if (x >= r0 && x <= r1) {
    const t = (x - r0) / (r1 - r0);
    const edge = Math.min(1, Math.min(t, 1 - t) * 6);
    return terrainHeight(x) * (1 - edge) + 46 * edge;
  }
  return terrainHeight(x);
}

// Ring gates for Mission 1. Each ring: x position, centre altitude, radius.
const RINGS = [
  { x: 700,  alt: 210, r: 34 },
  { x: 1250, alt: 260, r: 30 },
  { x: 1800, alt: 190, r: 30 },
  { x: 2350, alt: 300, r: 28 },
  { x: 2950, alt: 230, r: 30 },
  { x: 3500, alt: 320, r: 28 },
  { x: 4100, alt: 240, r: 30 },
  { x: 4700, alt: 280, r: 32 },
];

// Clouds: fixed set, parallax factor 0.35, wrap across the course.
const CLOUDS = [];
for (let i = 0; i < 26; i++) {
  CLOUDS.push({
    x: (i * 397 + 120) % 6400,
    alt: 330 + ((i * 137) % 180),
    s: 46 + ((i * 53) % 70),
    drift: 1.5 + ((i * 7) % 4),
  });
}

// A few trees and houses dotted along the hills, placed by a fixed hash.
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function drawSky(ctx, w, h, camX, camAlt, time) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3f7fb8');
  g.addColorStop(0.45, '#7fb2d9');
  g.addColorStop(0.75, '#bcd9e8');
  g.addColorStop(1, '#e8f2f5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Sun, top right, fixed on screen.
  const sx = w - 150, sy = 92;
  const sg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 90);
  sg.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
  sg.addColorStop(0.35, 'rgba(255, 226, 130, 0.55)');
  sg.addColorStop(1, 'rgba(255, 226, 130, 0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 100, sy - 100, 200, 200);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(sx, sy, 30, 0, Math.PI * 2);
  ctx.fill();

  // Distant mountain ridge (parallax 0.25).
  ctx.fillStyle = '#6d93b5';
  ctx.beginPath();
  ctx.moveTo(0, h);
  const off = camX * 0.25;
  for (let sxp = 0; sxp <= w; sxp += 16) {
    const wx = sxp + off;
    const my = h * 0.62 - (Math.sin(wx * 0.0011) * 60 + Math.sin(wx * 0.0033 + 2) * 26);
    ctx.lineTo(sxp, my);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Clouds drift slowly.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  for (const c of CLOUDS) {
    const cx = (((c.x + time * c.drift - camX * 0.35) % 6800) + 6800) % 6800 - 300;
    if (cx < -220 || cx > w + 220) continue;
    const cy = h * 0.30 - (c.alt - camAlt) * 0.55 - 40;
    if (cy < -80 || cy > h) continue;
    ctx.beginPath();
    ctx.ellipse(cx, cy, c.s, c.s * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - c.s * 0.55, cy + 6, c.s * 0.6, c.s * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + c.s * 0.55, cy + 6, c.s * 0.62, c.s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Convert world (x metres, altitude metres) to screen pixels.
// Horizontal and vertical scales differ: the course is long, so metres
// stretch wider than they stretch tall, keeping hills and runway in frame.
function makeProjector(w, h, camX, camAlt) {
  const scale = 1.7; // pixels per metre, horizontal
  const scaleY = 1.0; // pixels per metre, vertical
  return {
    X(x) { return (x - camX) * scale + w * 0.32; },
    Y(alt) { return h * 0.80 - (alt - camAlt) * scaleY; },
    scale,
    scaleY,
  };
}

function drawTerrain(ctx, w, h, camX, camAlt) {
  const P = makeProjector(w, h, camX, camAlt);
  const x0 = camX - w * 0.32 / P.scale - 40;
  const x1 = camX + (w * 0.68) / P.scale + 40;

  // Grassy hills.
  ctx.beginPath();
  ctx.moveTo(P.X(x0), h + 10);
  for (let x = x0; x <= x1; x += 12) {
    ctx.lineTo(P.X(x), P.Y(groundHeight(x)));
  }
  ctx.lineTo(P.X(x1), h + 10);
  ctx.closePath();
  const gg = ctx.createLinearGradient(0, P.Y(220), 0, h);
  gg.addColorStop(0, '#5da24a');
  gg.addColorStop(0.5, '#4a8a3c');
  gg.addColorStop(1, '#2f5d28');
  ctx.fillStyle = gg;
  ctx.fill();

  // A river winding through the valley around x 1500-2600.
  ctx.strokeStyle = '#5fa8c9';
  ctx.lineWidth = 10;
  ctx.beginPath();
  let started = false;
  for (let x = 1450; x <= 2650; x += 12) {
    const y = P.Y(groundHeight(x) + 1);
    if (!started) { ctx.moveTo(P.X(x), y); started = true; }
    else ctx.lineTo(P.X(x), y);
  }
  ctx.stroke();

  // Trees and houses.
  for (let x = Math.floor(x0 / 90) * 90; x <= x1; x += 90) {
    const hv = hash(x);
    const gy = P.Y(groundHeight(x));
    const sx = P.X(x);
    if (hv < 0.45) {
      // Pine tree.
      ctx.fillStyle = '#2c6b34';
      ctx.beginPath();
      ctx.moveTo(sx, gy - 26);
      ctx.lineTo(sx - 10, gy - 2);
      ctx.lineTo(sx + 10, gy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(sx - 2, gy - 4, 4, 6);
    } else if (hv < 0.62) {
      // Little house with a red roof.
      ctx.fillStyle = '#f2e6c8';
      ctx.fillRect(sx - 12, gy - 14, 24, 14);
      ctx.fillStyle = '#b0492f';
      ctx.beginPath();
      ctx.moveTo(sx - 15, gy - 14);
      ctx.lineTo(sx, gy - 26);
      ctx.lineTo(sx + 15, gy - 14);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRunway(ctx, P, camX, w, h);
  return P;
}

function drawRunway(ctx, P, camX, w, h) {
  const r0 = WORLD.runwayX - WORLD.runwayLen / 2;
  const r1 = WORLD.runwayX + WORLD.runwayLen / 2;
  if (P.X(r1) < -50 || P.X(r0) > w + 50) return;
  const gy = P.Y(46);
  // Asphalt strip.
  ctx.fillStyle = '#3a3f45';
  ctx.fillRect(P.X(r0), gy - 7, (r1 - r0) * P.scale, 9);
  // Centre dashes.
  ctx.fillStyle = '#f5f5f5';
  for (let x = r0 + 14; x < r1 - 10; x += 42) {
    ctx.fillRect(P.X(x), gy - 4, 20 * P.scale * 0.55, 3);
  }
  // Threshold bars and numbers.
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(P.X(r0) + 6, gy - 6, 26, 2);
  ctx.fillRect(P.X(r1) - 32, gy - 6, 26, 2);
  // Windsock beside the runway.
  const wx = P.X(WORLD.runwayX + WORLD.runwayLen / 2 + 46);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wx, gy);
  ctx.lineTo(wx, gy - 34);
  ctx.stroke();
  ctx.fillStyle = '#ff7f2a';
  ctx.beginPath();
  ctx.moveTo(wx, gy - 34);
  ctx.lineTo(wx + 22, gy - 28);
  ctx.lineTo(wx, gy - 22);
  ctx.closePath();
  ctx.fill();
  // "27" runway label.
  ctx.fillStyle = '#f5f5f5';
  ctx.font = 'bold 15px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('27', P.X(WORLD.runwayX), gy - 14);
  ctx.textAlign = 'left';
}

function drawRings(ctx, P, rings, time) {
  for (const ring of rings) {
    const cx = P.X(ring.x);
    if (cx < -120 || cx > 1400) continue;
    const cy = P.Y(ring.alt);
    const rr = ring.r * P.scale;
    if (ring.done) {
      // Collected: faint green ghost.
      ctx.strokeStyle = 'rgba(90, 200, 110, 0.35)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    // Pulsing golden ring with a chevron pointing through it.
    const pulse = 1 + 0.05 * Math.sin(time * 3 + ring.x);
    ctx.strokeStyle = '#ffcf3d';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff8c1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rr * pulse - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 207, 61, 0.9)';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 26);
    ctx.lineTo(cx + 8, cy - 26);
    ctx.lineTo(cx, cy - 12);
    ctx.closePath();
    ctx.fill();
    // Ring number tag.
    ctx.fillStyle = '#5a3d00';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(ring.num), cx, cy - rr - 8);
    ctx.textAlign = 'left';
  }
}
