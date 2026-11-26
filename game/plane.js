// plane.js — the courier plane: arcade flight physics and the vector drawing
// of the aircraft itself. No sprites: fuselage, wings, tail and propeller are
// all drawn with canvas paths, so the plane is crisp at any size.

function newPlane() {
  return {
    x: 60,            // metres along the course
    alt: 46,          // metres above sea level (on the ground at start)
    speed: 0,         // m/s forward
    vy: 0,            // m/s vertical
    pitch: 0,         // degrees, positive = nose up
    throttle: 0,      // 0..1
    fuel: 100,        // percent
    damage: 0,        // percent; 100 = wrecked
    gearDown: true,
    flaps: false,
    propAngle: 0,
    onGround: true,
    heading: 90,      // degrees, 90 = due east along the course
  };
}

const PLANE = {
  maxSpeed: 88,       // m/s at full throttle, clean
  stallSpeed: 26,     // below this the wing stops flying
  cruisePitch: 0,
};

// One physics step. `input` holds pitchUp/pitchDown/throttleUp/throttleDown
// booleans; `auto` (attract mode) supplies its own targets. Returns an event
// string ('landed' | 'crashed' | 'fuel-out' | null) when something decisive
// happens. `dt` is seconds, clamped by the caller.
function stepPlane(p, input, dt, mode) {
  const gentle = mode === 'attract';
  if (input.throttleUp) p.throttle = Math.min(1, p.throttle + dt * 0.55);
  if (input.throttleDown) p.throttle = Math.max(0, p.throttle - dt * 0.55);
  if (input.pitchUp) p.pitch = Math.min(24, p.pitch + dt * 34);
  if (input.pitchDown) p.pitch = Math.max(-22, p.pitch - dt * 34);
  if (!input.pitchUp && !input.pitchDown) {
    // Ease back toward level flight when the stick is centred.
    p.pitch += (0 - p.pitch) * Math.min(1, dt * 0.8);
  }
  if (input.flapsToggle) { p.flaps = !p.flaps; input.flapsToggle = false; }
  if (input.gearToggle) { p.gearDown = !p.gearDown; input.gearToggle = false; }

  const flapDrag = p.flaps ? 12 : 0;
  const gearDrag = p.gearDown ? 4 : 0;
  const targetSpeed = p.throttle * (PLANE.maxSpeed - flapDrag - gearDrag);
  const accel = p.onGround ? 2.2 : 0.9;
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * accel);

  // Lift: the wing flies when there is speed and a little pitch.
  const rad = (p.pitch * Math.PI) / 180;
  let liftVy = p.speed * Math.sin(rad) * 0.92;
  if (p.speed < PLANE.stallSpeed && !p.onGround) {
    // Stall: the nose drops and the plane sinks.
    liftVy -= (PLANE.stallSpeed - p.speed) * 0.9;
    p.pitch += ( -8 - p.pitch) * Math.min(1, dt * 0.7);
  }
  // Gentle sink when idling with no pitch.
  if (p.throttle < 0.15 && !p.onGround) liftVy -= 2.5 * dt * 10 * 0.1;
  p.vy += (liftVy - p.vy) * Math.min(1, dt * 3.2);

  p.x += p.speed * Math.cos(rad) * dt;
  p.alt += p.vy * dt;
  p.propAngle += dt * (6 + p.throttle * 42);

  // Fuel burn: mostly throttle, a little always.
  if (!gentle) {
    p.fuel -= dt * (0.10 + p.throttle * 0.5);
    if (p.fuel <= 0) {
      p.fuel = 0;
      p.throttle = 0;
      if (p.onGround && p.speed < 1) return 'fuel-out';
    }
  }

  // Overspeed shakes the airframe apart slowly.
  if (p.speed > 96 && !gentle) p.damage += dt * 3;

  // Ground contact.
  const g = groundHeight(p.x);
  if (p.alt <= g + 0.6) {
    p.alt = g + 0.6;
    const onRunway =
      Math.abs(p.x - WORLD.runwayX) <= WORLD.runwayLen / 2;
    const softTouch = p.vy > -3.2 && p.speed < 48 && p.gearDown;
    if (p.onGround && p.speed < 2 && p.throttle < 0.05) {
      p.vy = 0;
      return null;
    }
    if (gentle) {
      // Attract mode never crashes: bounce softly back into the air.
      p.vy = Math.abs(p.vy) * 0.4 + 4;
      p.onGround = false;
      return null;
    }
    if (onRunway && softTouch) {
      p.vy = 0;
      p.onGround = true;
      p.pitch = 0;
      return 'landed';
    }
    // A hard arrival: damage scales with how fast we hit.
    const hit = Math.abs(p.vy) * 9 + Math.max(0, p.speed - 55) * 0.8;
    p.damage += hit;
    p.vy = 0;
    p.speed *= 0.55;
    p.onGround = true;
    p.pitch = 0;
    if (p.damage >= 100) {
      p.damage = 100;
      return 'crashed';
    }
    return 'bump';
  }
  p.onGround = false;
  if (p.alt > 520) { p.alt = 520; p.vy = Math.min(p.vy, 0); }
  if (p.x > WORLD.endX + 200) { p.x = WORLD.endX + 200; p.speed *= 0.98; }
  if (p.x < 0) { p.x = 0; p.speed = Math.max(p.speed, 0); }
  return null;
}

// Draw the plane at screen position (sx, sy), pointing right, pitched by
// `pitchDeg`. `bank` tilts it slightly for life. Size is in pixels.
function drawPlane(ctx, sx, sy, pitchDeg, bank, throttle, propAngle, gearDown, time) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate((-pitchDeg * Math.PI) / 180 + bank * 0.06);
  ctx.scale(1.35, 1.35);

  // Shadow of the wing on the fuselage side.
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(2, 12, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail fin and stabiliser.
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.moveTo(-30, -2);
  ctx.lineTo(-42, -20);
  ctx.lineTo(-34, -20);
  ctx.lineTo(-22, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8f2a20';
  ctx.beginPath();
  ctx.moveTo(-30, 2);
  ctx.lineTo(-44, 8);
  ctx.lineTo(-30, 8);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a cheerful courier yellow with a red cheatline.
  const body = ctx.createLinearGradient(0, -12, 0, 10);
  body.addColorStop(0, '#ffd94d');
  body.addColorStop(0.55, '#f5b81e');
  body.addColorStop(1, '#d18f0e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.quadraticCurveTo(-30, -11, -6, -11);
  ctx.quadraticCurveTo(22, -11, 34, -3);
  ctx.quadraticCurveTo(40, 0, 34, 3);
  ctx.quadraticCurveTo(20, 10, -8, 10);
  ctx.quadraticCurveTo(-30, 10, -34, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a5c00';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cheatline.
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(-28, 1, 58, 3);

  // Cockpit windows, lit warm.
  ctx.fillStyle = '#bfe6f2';
  ctx.beginPath();
  ctx.moveTo(8, -9);
  ctx.lineTo(20, -9);
  ctx.lineTo(26, -3);
  ctx.lineTo(8, -3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a6b75';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wing (high wing, courier style).
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.moveTo(-12, -10);
  ctx.lineTo(6, -10);
  ctx.lineTo(2, -30);
  ctx.lineTo(-18, -30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#9aa7ad';
  ctx.stroke();
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(-18, -30, 20, 3);

  // Landing gear.
  if (gearDown) {
    ctx.strokeStyle = '#3c3c3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.lineTo(-8, 20);
    ctx.moveTo(12, 9);
    ctx.lineTo(14, 20);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-8, 22, 5, 0, Math.PI * 2);
    ctx.arc(14, 22, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spinning propeller at the nose.
  const px = 38, py = 0;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(propAngle);
  ctx.fillStyle = 'rgba(60, 60, 60, 0.75)';
  ctx.beginPath();
  ctx.ellipse(0, -13, 3, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 13, 3, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  // Navigation lights blink.
  const blink = Math.sin(time * 5) > 0;
  if (blink) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-34, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#37e05a';
    ctx.beginPath();
    ctx.arc(30, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Courier satchel logo on the tail.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SC', -30, -8);
  ctx.textAlign = 'left';
  ctx.restore();
}
