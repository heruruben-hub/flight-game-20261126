// audio.js — tiny synthesised sound: an engine hum whose pitch follows the
// throttle, plus a ring chime and a crash thud. Everything is generated with
// the Web Audio API, so there are no sound files and no network requests.
// Audio only starts after the player's first gesture (browser rule); the
// game plays fine with sound off or unavailable.

const Sound = (function () {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(low);
      low.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(function () {});
  }

  function engine(throttle, flying) {
    if (!ctx || muted || !engineOsc) return;
    const target = flying ? 0.05 + throttle * 0.075 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
    engineOsc.frequency.setTargetAtTime(52 + throttle * 68, ctx.currentTime, 0.12);
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (e) { /* sound is optional */ }
  }

  function ring() {
    blip(880, 0.35, 'sine', 0.22);
    setTimeout(function () { blip(1318, 0.4, 'sine', 0.18); }, 90);
  }

  function crash() {
    blip(70, 0.5, 'square', 0.25);
    blip(45, 0.7, 'triangle', 0.2);
  }

  function land() {
    blip(523, 0.25, 'sine', 0.2);
    setTimeout(function () { blip(784, 0.35, 'sine', 0.2); }, 120);
  }

  function toggleMute() {
    muted = !muted;
    if (engineGain) engineGain.gain.value = 0;
    return muted;
  }

  return { unlock, engine, ring, crash, land, toggleMute };
})();
