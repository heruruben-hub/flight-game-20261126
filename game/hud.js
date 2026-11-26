// hud.js — everything drawn on top of the world: the instrument bar with
// altitude, speed and heading, fuel and damage gauges, the mission panel,
// message banners, and the title / pause / crash / win screens. Buttons are
// drawn here too, and their screen rectangles are returned for mouse clicks.

function fmtKnots(ms) { return Math.round(ms * 1.944); }
function fmtAlt(m) { return Math.round(m * 3.281) + ' ft'; }

function drawHud(ctx, w, h, S, time) {
  const p = S.plane;
  // Top instrument bar.
  ctx.fillStyle = 'rgba(10, 26, 40, 0.82)';
  ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = '#1d4258';
  ctx.fillRect(0, 64, w, 2);

  // Altitude.
  drawGauge(ctx, 24, 10, 'ALTITUDE', fmtAlt(Math.max(0, p.alt - groundHeight(p.x))), p.alt > 400 ? '#ff9d5c' : '#bfe6f2');
  // Speed.
  drawGauge(ctx, 208, 10, 'SPEED', fmtKnots(p.speed) + ' kt', p.speed < PLANE.stallSpeed && !p.onGround ? '#ff6b5e' : '#bfe6f2');
  // Heading (always east along the course, with a live compass strip).
  drawGauge(ctx, 392, 10, 'HEADING', '090° E', '#bfe6f2');
  drawCompass(ctx, 560, 32, p.heading, time);

  // Vertical speed needle.
  const vs = Math.round(p.vy * 196.85);
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText('VERT', 800, 18);
  ctx.fillStyle = vs >= 0 ? '#8be28b' : '#ff9d5c';
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.fillText((vs >= 0 ? '+' : '') + vs + ' fpm', 800, 40);
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText(p.vy >= 0 ? 'CLIMB' : 'SINK', 800, 56);

  // Fuel gauge.
  drawBarGauge(ctx, 920, 14, 90, 'FUEL', p.fuel / 100, p.fuel < 25 ? '#ff6b5e' : '#ffc93d');
  // Damage gauge.
  drawBarGauge(ctx, 920, 40, 90, 'DAMAGE', p.damage / 100, '#ff6b5e');
  // Score + clock.
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText('SCORE', 1080, 18);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.fillText(String(S.score), 1080, 40);
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText('TIME ' + fmtTime(S.time), 1080, 56);

  drawMissionPanel(ctx, w, h, S);
  drawThrottleBar(ctx, w, h, S);
  drawButtons(ctx, w, h, S);
  drawBanner(ctx, w, h, S, time);
}

function drawGauge(ctx, x, y, label, value, color) {
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText(label, x, y + 8);
  ctx.fillStyle = color;
  ctx.font = 'bold 20px Verdana, sans-serif';
  ctx.fillText(value, x, y + 34);
}

function drawBarGauge(ctx, x, y, width, label, frac, color) {
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText(label, x, y + 8);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 52, y, width, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x + 52, y, Math.max(0, Math.min(1, frac)) * width, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 52, y, width, 10);
}

function drawCompass(ctx, cx, cy, heading, time) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 90, cy - 20, 180, 40);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(cx - 90, cy - 20, 180, 40);
  const marks = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'], [360, 'N']];
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (const [deg, name] of marks) {
    let d = deg - heading;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    const x = cx + d * 1.1;
    if (x < cx - 100 || x > cx + 100) continue;
    ctx.fillStyle = deg === 90 ? '#ffd94d' : '#cfe6f2';
    ctx.fillText(name, x, cy + 5);
    ctx.fillRect(x - 1, cy - 18, 2, 6);
  }
  ctx.restore();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx - 5, cy - 30);
  ctx.lineTo(cx + 5, cy - 30);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
}

function drawMissionPanel(ctx, w, h, S) {
  const x = 16, y = h - 118, pw = 300, ph = 102;
  ctx.fillStyle = 'rgba(10, 26, 40, 0.78)';
  ctx.fillRect(x, y, pw, ph);
  ctx.strokeStyle = '#2b5a72';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, pw, ph);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.fillText(S.mission === 1 ? 'MISSION 1 — RING RUN' : 'MISSION 2 — BRING HER HOME', x + 12, y + 20);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '12px Verdana, sans-serif';
  if (S.mission === 1) {
    const done = S.rings.filter(r => r.done).length;
    ctx.fillText('Fly through all 8 golden rings.', x + 12, y + 42);
    ctx.fillText('Rings: ' + done + ' / 8', x + 12, y + 62);
    ctx.fillStyle = '#8be28b';
    ctx.fillText('Gentle turns save fuel. Mind the hills.', x + 12, y + 84);
  } else {
    ctx.fillText('Land on runway 27: gear down,', x + 12, y + 42);
    ctx.fillText('slow under 48 m/s, sink gently.', x + 12, y + 62);
    ctx.fillStyle = S.plane.gearDown ? '#8be28b' : '#ff9d5c';
    ctx.fillText('Gear: ' + (S.plane.gearDown ? 'DOWN' : 'UP — press G') + '   Flaps: ' + (S.plane.flaps ? 'ON' : 'OFF'), x + 12, y + 84);
  }
}

function drawThrottleBar(ctx, w, h, S) {
  const x = w - 316, y = h - 118, bw = 300, bh = 102;
  ctx.fillStyle = 'rgba(10, 26, 40, 0.78)';
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = '#2b5a72';
  ctx.strokeRect(x, y, bw, bh);
  ctx.fillStyle = '#8fb8cc';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText('THROTTLE — drag, or W / S', x + 12, y + 20);
  // Track.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 12, y + 40, bw - 24, 14);
  const frac = S.plane.throttle;
  const grad = ctx.createLinearGradient(x + 12, 0, x + bw - 12, 0);
  grad.addColorStop(0, '#3fa7d6');
  grad.addColorStop(1, '#ff8c1a');
  ctx.fillStyle = grad;
  ctx.fillRect(x + 12, y + 40, (bw - 24) * frac, 14);
  // Knob.
  const kx = x + 12 + (bw - 24) * frac;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(kx, y + 47, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(kx, y + 47, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillText(Math.round(frac * 100) + '%  ·  ' + (S.plane.flaps ? 'FLAPS ' : '') + (S.plane.gearDown ? 'GEAR DOWN' : 'GEAR UP'), x + 12, y + 82);
  S.throttleRect = { x: x + 12, y: y + 40, w: bw - 24, h: 14 };
}

function drawButtons(ctx, w, h, S) {
  const labels = S.state === 'playing'
    ? [['PAUSE', 'pause'], ['RESTART', 'restart']]
    : [['FLY!', 'start'], ['RESTART', 'restart']];
  S.buttonRects = [];
  let bx = w / 2 - 110;
  const by = h - 56;
  for (const [label, action] of labels) {
    ctx.fillStyle = action === 'start' ? '#e8a91c' : 'rgba(10, 26, 40, 0.82)';
    ctx.fillRect(bx, by, 100, 38);
    ctx.strokeStyle = action === 'start' ? '#7a5200' : '#2b5a72';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, 100, 38);
    ctx.fillStyle = action === 'start' ? '#231a00' : '#cfe6f2';
    ctx.font = 'bold 14px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + 50, by + 25);
    ctx.textAlign = 'left';
    S.buttonRects.push({ x: bx, y: by, w: 100, h: 38, action });
    bx += 120;
  }
}

function drawBanner(ctx, w, h, S, time) {
  if (!S.banner || time > S.bannerUntil) return;
  const alpha = Math.min(1, (S.bannerUntil - time) * 1.5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 26px Verdana, sans-serif';
  const tw = ctx.measureText(S.banner).width;
  ctx.fillStyle = 'rgba(10, 26, 40, 0.8)';
  ctx.fillRect(w / 2 - tw / 2 - 18, 84, tw + 36, 44);
  ctx.fillStyle = S.bannerColor || '#ffd94d';
  ctx.textAlign = 'center';
  ctx.fillText(S.banner, w / 2, 114);
  ctx.textAlign = 'left';
  ctx.restore();
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function drawOverlay(ctx, w, h, S, time) {
  if (S.state === 'attract') {
    // Attract mode: the scene stays fully visible — just a compact title
    // band and the prompt, so the first thing anyone sees is the flight.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8, 20, 32, 0.55)';
    ctx.fillRect(w / 2 - 330, 92, 660, 108);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 46px Verdana, sans-serif';
    ctx.fillText('SKYLINE COURIER', w / 2, 138);
    ctx.fillStyle = '#fff';
    ctx.font = '16px Verdana, sans-serif';
    ctx.fillText('Thread the rings, then land on runway 27  ·  W/S throttle · A/D pitch · G gear · F flaps', w / 2, 168);
    const pulse = 0.65 + 0.35 * Math.sin(time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 18px Verdana, sans-serif';
    ctx.fillText('— press ENTER or click FLY! —', w / 2, 192);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  } else if (S.state === 'title') {
    ctx.fillStyle = 'rgba(8, 20, 32, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 64px Verdana, sans-serif';
    ctx.fillText('SKYLINE COURIER', w / 2, h * 0.30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Verdana, sans-serif';
    ctx.fillText('A little flight game: rings, fuel, and one runway home', w / 2, h * 0.30 + 40);
    ctx.fillStyle = '#cfe6f2';
    ctx.font = '16px Verdana, sans-serif';
    ctx.fillText('Fly the course, thread all 8 golden rings, then land on runway 27.', w / 2, h * 0.30 + 76);
    ctx.fillText('W/S throttle · A/D pitch · G gear · F flaps · P pause', w / 2, h * 0.30 + 102);
    const pulse = 0.65 + 0.35 * Math.sin(time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px Verdana, sans-serif';
    ctx.fillText('— press ENTER or click FLY! —', w / 2, h * 0.30 + 146);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  } else if (S.state === 'paused') {
    dim(ctx, w, h);
    centerText(ctx, w, h, 'PAUSED', 'Press P or click FLY! to keep flying', '#ffd94d');
  } else if (S.state === 'crashed') {
    dim(ctx, w, h);
    centerText(ctx, w, h, 'CRASHED', S.crashReason + '  ·  Score ' + S.score + '  ·  press R to try again', '#ff6b5e');
  } else if (S.state === 'landed-mid') {
    dim(ctx, w, h);
    centerText(ctx, w, h, 'TOUCHDOWN!', 'Mission 1 complete — nice flying. Mission 2 is the landing itself; press ENTER to keep going.', '#8be28b');
  } else if (S.state === 'win') {
    dim(ctx, w, h);
    centerText(ctx, w, h, 'COURIER COMPLETE!', 'All 8 rings and a safe landing on runway 27. Final score ' + S.score + ' — press R to fly again.', '#8be28b');
  } else if (S.state === 'fuel-out') {
    dim(ctx, w, h);
    centerText(ctx, w, h, 'OUT OF FUEL', 'The tank ran dry. Glide home next time — press R to refuel and retry.', '#ff9d5c');
  }
}

function dim(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 20, 32, 0.55)';
  ctx.fillRect(0, 0, w, h);
}

function centerText(ctx, w, h, big, small, color) {
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 52px Verdana, sans-serif';
  ctx.fillText(big, w / 2, h * 0.42);
  ctx.fillStyle = '#fff';
  ctx.font = '18px Verdana, sans-serif';
  ctx.fillText(small, w / 2, h * 0.42 + 40);
  ctx.textAlign = 'left';
}
