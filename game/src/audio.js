// MERIDIAN RUN — sound. One job: synthesize every sound with WebAudio.
// No audio files, no network. Created lazily on the first user gesture
// (browser autoplay policy); every method is a safe no-op before that.

export function makeAudio() {
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
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.16, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {
      // Sound is garnish; a failure never breaks the game.
    }
  }

  return {
    unlock() { ensure(); },
    setMuted(m) { muted = m; if (engineGain) engineGain.gain.value = 0; },
    isMuted() { return muted; },
    // Engine hum follows the throttle; call once per frame.
    engine(throttle, speed) {
      if (!ensure() || muted || !ctx || !engineOsc) return;
      try {
        if (ctx.state === 'suspended') void ctx.resume();
        engineOsc.frequency.value = 42 + throttle * 58 + speed * 0.12;
        engineGain.gain.value = 0.018 + throttle * 0.035;
      } catch (e) {
        // Ignore.
      }
    },
    chime() {
      blip(880, 0.35, 'sine', 0.18);
      setTimeout(() => blip(1318, 0.4, 'sine', 0.14), 90);
    },
    thud() { blip(70, 0.25, 'triangle', 0.3); },
    stallHorn() { blip(220, 0.5, 'square', 0.08); },
  };
}
