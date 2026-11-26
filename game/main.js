// main.js — Skyline Courier's game loop: states, keyboard and mouse input,
// the autopilot that flies the attract screen, ring checks, and missions.
// Missions: 1) thread all 8 golden rings along the valley, 2) land on
// runway 27. Fuel and damage force real decisions: full throttle everywhere
// burns the tank, and a hard arrival wrecks the airframe.

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const params = new URLSearchParams(location.search);
  const scene = params.get('scene') || 'attract';

  const input = {
    throttleUp: false, throttleDown: false,
    pitchUp: false, pitchDown: false,
    flapsToggle: false, gearToggle: false,
  };

  function freshState() {
    return {
      state: 'attract',       // attract | playing | paused | crashed | landed-mid | win | fuel-out
      plane: newPlane(),
      rings: RINGS.map(function (r, i) {
        return { x: r.x, alt: r.alt, r: r.r, num: i + 1, done: false };
      }),
      mission: 1,
      score: 0,
      time: 0,
      camX: 0,
      camAlt: 46,
      banner: '',
      bannerUntil: 0,
      bannerColor: '#ffd94d',
      crashReason: '',
      throttleRect: null,
      buttonRects: [],
      draggingThrottle: false,
      auto: { targetAlt: 220 },
    };
  }

  const S = freshState();

  function showBanner(text, seconds, color) {
    S.banner = text;
    S.bannerUntil = S.time + seconds;
    S.bannerColor = color || '#ffd94d';
  }

  // ---- scene presets (?scene=takeoff|rims|landing|cruise) -------------------
  // Each one drops the plane into a photogenic moment so screenshots show a
  // different part of the flight. All of them start in attract flight so the
  // scene is alive on load; pressing ENTER starts playing from there.
  function applyScene() {
    const p = S.plane;
    if (scene === 'takeoff') {
      p.x = WORLD.runwayX - WORLD.runwayLen / 2 + 30;
      p.alt = 46.6;
      p.speed = 24;
      p.throttle = 0.85;
      p.pitch = 3;
      p.onGround = true;
      S.camX = p.x;
      S.camAlt = 46;
      S.state = 'attract';
    } else if (scene === 'rings') {
      p.x = 1560;
      p.alt = 235;
      p.speed = 62;
      p.throttle = 0.7;
      p.pitch = 4;
      p.onGround = false;
      S.rings[0].done = true;
      S.rings[1].done = true;
      S.score = 200;
      S.camX = p.x;
      S.camAlt = 200;
      S.state = 'attract';
    } else if (scene === 'landing') {
      p.x = WORLD.runwayX - 380;
      p.alt = 118;
      p.speed = 44;
      p.throttle = 0.35;
      p.pitch = -3;
      p.gearDown = true;
      p.flaps = true;
      p.onGround = false;
      S.mission = 2;
      S.rings.forEach(function (r) { r.done = true; });
      S.score = 800;
      S.camX = p.x;
      S.camAlt = 90;
      S.state = 'attract';
    } else {
      // cruise / default attract: airborne over the valley, mid-course.
      p.x = 900;
      p.alt = 240;
      p.speed = 58;
      p.throttle = 0.65;
      p.pitch = 2;
      p.onGround = false;
      S.camX = p.x;
      S.camAlt = 200;
      S.state = 'attract';
    }
  }

  function startPlaying() {
    if (S.state === 'attract' || S.state === 'title') {
      // Keep the scene's position: the player takes over mid-flight.
      S.state = 'playing';
      S.time = 0;
      showBanner(S.mission === 1 ? 'MISSION 1 — THREAD THE RINGS' : 'MISSION 2 — LAND ON RUNWAY 27', 3);
      Sound.unlock();
    } else if (S.state === 'paused') {
      S.state = 'playing';
    } else if (S.state === 'landed-mid') {
      S.mission = 2;
      S.state = 'playing';
      showBanner('MISSION 2 — LAND ON RUNWAY 27', 3);
    }
  }

  function restart() {
    const keepScene = scene;
    const fresh = freshState();
    Object.keys(fresh).forEach(function (k) { S[k] = fresh[k]; });
    applyScene();
    if (keepScene === 'attract' || keepScene === 'cruise') S.state = 'attract';
    S.time = 0;
  }

  // ---- autopilot (attract mode): gentle, safe, flies through the rings ----
  function autopilot(dt) {
    const p = S.plane;
    // Target altitude: follow the next undone ring, else cruise above terrain.
    let target = 230;
    const next = S.rings.find(function (r) { return !r.done; });
    if (next) {
      const dist = next.x - p.x;
      if (dist > -40 && dist < 700) target = next.alt;
    } else {
      target = groundHeight(p.x + 260) + 170;
    }
    S.auto.targetAlt = target;
    const err = target - p.alt;
    const wantPitch = Math.max(-8, Math.min(10, err * 0.06 - p.vy * 0.25));
    p.pitch += (wantPitch - p.pitch) * Math.min(1, dt * 2);
    p.throttle += ((p.speed < 52 ? 0.72 : 0.55) - p.throttle) * Math.min(1, dt * 1.5);
    p.throttle = Math.max(0.35, Math.min(0.85, p.throttle));
    if (p.alt < groundHeight(p.x) + 60) {
      p.pitch = Math.max(p.pitch, 8);
      p.throttle = 0.85;
    }
    const ev = stepPlane(p, { throttleUp: false, throttleDown: false, pitchUp: false, pitchDown: false, flapsToggle: false, gearToggle: false }, dt, 'attract');
    if (ev === 'landed') {
      // In attract mode a touchdown just lifts off again for the next loop.
      p.throttle = 0.9;
      p.pitch = 8;
    }
    checkRings(true);
    // Loop the course so the attract screen never ends.
    if (p.x > WORLD.endX - 100) {
      p.x = 60;
      p.alt = 240;
      p.speed = 58;
      S.rings.forEach(function (r) { r.done = false; });
      S.score = 0;
      S.mission = 1;
    }
  }

  function checkRings(silent) {
    const p = S.plane;
    for (const ring of S.rings) {
      if (ring.done) continue;
      if (Math.abs(p.x - ring.x) < 7 && Math.abs(p.alt - ring.alt) < ring.r) {
        ring.done = true;
        S.score += 100;
        if (!silent) {
          showBanner('RING ' + ring.num + ' — +100', 1.6, '#8be28b');
          Sound.ring();
        }
        if (S.rings.every(function (r) { return r.done; }) && S.mission === 1 && !silent) {
          S.mission = 2;
          showBanner('ALL RINGS! NOW LAND ON RUNWAY 27', 3.5, '#8be28b');
        }
      }
    }
  }

  // ---- input ---------------------------------------------------------------
  const KEYMAP = {
    ArrowUp: 'throttleUp', KeyW: 'throttleUp',
    ArrowDown: 'throttleDown', KeyS: 'throttleDown',
    ArrowLeft: 'pitchDown', KeyA: 'pitchDown',
    ArrowRight: 'pitchUp', KeyD: 'pitchUp',
  };

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Enter' || e.code === 'Space') {
      if (S.state === 'attract' || S.state === 'title' || S.state === 'paused' || S.state === 'landed-mid') {
        startPlaying();
      }
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyR') { restart(); return; }
    if (e.code === 'KeyP') {
      if (S.state === 'playing') S.state = 'paused';
      else if (S.state === 'paused') S.state = 'playing';
      return;
    }
    if (e.code === 'KeyM') { Sound.toggleMute(); return; }
    if (e.code === 'KeyG' && !e.repeat) { input.gearToggle = true; return; }
    if (e.code === 'KeyF' && !e.repeat) { input.flapsToggle = true; return; }
    const name = KEYMAP[e.code];
    if (name) { input[name] = true; Sound.unlock(); e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) {
    const name = KEYMAP[e.code];
    if (name) input[name] = false;
  });

  function canvasPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (W / r.width),
      y: (e.clientY - r.top) * (H / r.height),
    };
  }

  canvas.addEventListener('mousedown', function (e) {
    Sound.unlock();
    const pos = canvasPos(e);
    if (S.throttleRect && pos.x >= S.throttleRect.x && pos.x <= S.throttleRect.x + S.throttleRect.w &&
        pos.y >= S.throttleRect.y - 8 && pos.y <= S.throttleRect.y + S.throttleRect.h + 8) {
      S.draggingThrottle = true;
      setThrottleFromMouse(pos.x);
      return;
    }
    for (const b of S.buttonRects || []) {
      if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
        if (b.action === 'start') startPlaying();
        else if (b.action === 'pause') S.state = 'paused';
        else if (b.action === 'restart') restart();
        return;
      }
    }
  });
  canvas.addEventListener('mousemove', function (e) {
    if (S.draggingThrottle) setThrottleFromMouse(canvasPos(e).x);
  });
  window.addEventListener('mouseup', function () { S.draggingThrottle = false; });

  function setThrottleFromMouse(mx) {
    const r = S.throttleRect;
    if (!r) return;
    S.plane.throttle = Math.max(0, Math.min(1, (mx - r.x) / r.w));
  }

  // ---- main loop -----------------------------------------------------------
  let last = performance.now();
  let simTime = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    simTime += dt;

    if (S.state === 'attract' || S.state === 'title') {
      autopilot(dt);
    } else if (S.state === 'playing') {
      S.time += dt;
      const ev = stepPlane(S.plane, input, dt, 'playing');
      checkRings(false);
      if (ev === 'crashed') {
        S.state = 'crashed';
        S.crashReason = S.plane.damage >= 100 ? 'The airframe gave out on a hard arrival.' : 'Down in the hills.';
        Sound.crash();
      } else if (ev === 'landed') {
        Sound.land();
        if (S.mission === 2) {
          const fuelBonus = Math.round(S.plane.fuel * 5);
          S.score += 500 + fuelBonus;
          S.state = 'win';
        } else {
          S.state = 'landed-mid';
        }
      } else if (ev === 'fuel-out') {
        S.state = 'fuel-out';
      } else if (ev === 'bump') {
        showBanner('HARD TOUCH — DAMAGE ' + Math.round(S.plane.damage) + '%', 1.8, '#ff9d5c');
      }
      if (S.plane.damage >= 100 && S.state === 'playing') {
        S.state = 'crashed';
        S.crashReason = 'The airframe gave out.';
        Sound.crash();
      }
      // Low fuel warning.
      if (S.plane.fuel < 20 && S.plane.fuel > 0 && Math.floor(S.time * 2) % 2 === 0) {
        showBanner('LOW FUEL — ' + Math.round(S.plane.fuel) + '%', 0.6, '#ff6b5e');
      }
      // Mission 1 done but still flying: nudge toward the runway.
      if (S.mission === 2 && S.plane.x > WORLD.runwayX - 900 && S.plane.x < WORLD.runwayX - 850) {
        showBanner('RUNWAY 27 AHEAD — GEAR DOWN, SLOW DOWN', 2.5);
      }
    }

    // Camera follows the plane smoothly.
    const targetCamX = S.plane.x;
    const targetCamAlt = Math.max(46, S.plane.alt - 120);
    S.camX += (targetCamX - S.camX) * Math.min(1, dt * 3);
    S.camAlt += (targetCamAlt - S.camAlt) * Math.min(1, dt * 2);

    Sound.engine(S.plane.throttle, S.state === 'playing' || S.state === 'attract');

    // ---- draw --------------------------------------------------------------
    drawSky(ctx, W, H, S.camX, S.camAlt, simTime);
    const P = drawTerrain(ctx, W, H, S.camX, S.camAlt);
    drawRings(ctx, P, S.rings, simTime);
    const px = P.X(S.plane.x);
    const py = P.Y(S.plane.alt);
    // Soft ground shadow under the plane.
    const gy = P.Y(groundHeight(S.plane.x));
    if (py < gy && gy - py < 260) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.22 * (1 - (gy - py) / 260)) + ')';
      ctx.beginPath();
      ctx.ellipse(px, gy + 2, 30, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawPlane(ctx, px, py, S.plane.pitch, 0, S.plane.throttle, S.plane.propAngle, S.plane.gearDown, simTime);
    drawHud(ctx, W, H, S, S.time);
    drawOverlay(ctx, W, H, S, simTime);

    requestAnimationFrame(frame);
  }

  applyScene();
  requestAnimationFrame(frame);
})();
