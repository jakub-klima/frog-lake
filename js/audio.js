/* Žabí jezero – zvukové efekty a podkladová hudba
 *
 * Všechno se syntetizuje přímo ve Web Audio API, takže hra nepotřebuje
 * žádné zvukové soubory a funguje i offline. Prohlížeče pustí zvuk až
 * po první interakci uživatele – proto unlock() při kliknutí / klávese.
 */
(function () {
  const FL = (globalThis.FL = globalThis.FL || {});
  let ctx = null, master = null, musicGain = null, musicTimer = null;
  const state = { sfx: true, music: false };

  try {
    const saved = JSON.parse(localStorage.getItem('fl-audio') || 'null');
    if (saved) Object.assign(state, saved);
  } catch (e) { /* soukromé okno apod. */ }
  const save = () => { try { localStorage.setItem('fl-audio', JSON.stringify(state)); } catch (e) { /* nic */ } };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(master);
    return ctx;
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (state.music && !musicTimer) startMusic();
  }

  // ---------- stavebnice zvuků ----------
  function tone(freq, t0, dur, opt) {
    const o = opt || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const v = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(t0, dur, opt) {
    const o = opt || {};
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    dice(t) { for (let i = 0; i < 6; i++) noise(t + i * 0.055 + Math.random() * 0.02, 0.05, { freq: 2500 + Math.random() * 1500, q: 4, vol: 0.35 }); },
    hop(t) { tone(330, t, 0.16, { to: 720, type: 'triangle', vol: 0.22 }); },
    gain(t) { tone(988, t, 0.09, { type: 'square', vol: 0.07 }); tone(1319, t + 0.08, 0.16, { type: 'square', vol: 0.07 }); },
    bug(t) { [1568, 1976, 2349].forEach((f, i) => tone(f, t + i * 0.06, 0.18, { vol: 0.12 })); },
    magic(t) { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, t + i * 0.07, 0.4, { vol: 0.12 })); },
    spell(t) { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.05, 0.45, { type: 'triangle', vol: 0.13 })); noise(t, 0.5, { freq: 6000, q: 0.7, vol: 0.06 }); },
    zap(t) { tone(1800, t, 0.25, { to: 300, type: 'sawtooth', vol: 0.1 }); tone(2400, t + 0.05, 0.2, { to: 900, vol: 0.1 }); },
    splash(t) { noise(t, 0.6, { freq: 900, to: 200, q: 0.8, vol: 0.45, filter: 'lowpass' }); tone(500, t, 0.25, { to: 120, vol: 0.15 }); },
    mud(t) { tone(110, t, 0.35, { to: 60, type: 'sawtooth', vol: 0.15 }); noise(t + 0.05, 0.4, { freq: 300, q: 2, vol: 0.25, filter: 'lowpass' }); },
    bonk(t) { tone(220, t, 0.12, { to: 110, type: 'square', vol: 0.15 }); tone(660, t + 0.02, 0.08, { vol: 0.1 }); },
    whirl(t) { tone(300, t, 0.7, { to: 900, type: 'triangle', vol: 0.1 }); noise(t, 0.7, { freq: 400, to: 2400, q: 3, vol: 0.12 }); },
    boing(t) { tone(150, t, 0.4, { to: 600, type: 'triangle', vol: 0.22 }); tone(600, t + 0.15, 0.3, { to: 300, vol: 0.1 }); },
    whoosh(t) { noise(t, 0.4, { freq: 300, to: 3000, q: 1.5, vol: 0.2 }); },
    card(t) { noise(t, 0.12, { freq: 3500, q: 1, vol: 0.18 }); tone(880, t + 0.08, 0.2, { vol: 0.1 }); },
    vodnik(t) { tone(98, t, 0.9, { to: 147, type: 'sawtooth', vol: 0.12 }); [392, 466, 587].forEach((f, i) => tone(f, t + 0.25 + i * 0.12, 0.5, { vol: 0.1 })); noise(t, 0.8, { freq: 500, to: 150, vol: 0.2, filter: 'lowpass' }); },
    attack(t) { tone(140, t, 0.5, { to: 50, type: 'sawtooth', vol: 0.2 }); noise(t, 0.5, { freq: 600, to: 100, vol: 0.3, filter: 'lowpass' }); },
    leap(t) { tone(262, t, 1.0, { to: 1047, type: 'triangle', vol: 0.2 }); },
    win(t) { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.13, i === 6 ? 0.9 : 0.22, { type: 'triangle', vol: 0.2 })); },
    click(t) { tone(1200, t, 0.04, { vol: 0.06 }); },
    tick(t) { tone(1500, t, 0.05, { type: 'square', vol: 0.05 }); }
  };

  function play(name) {
    if (!state.sfx || !SFX[name]) return;
    if (!ensure() || ctx.state !== 'running') return;
    SFX[name](ctx.currentTime + 0.01);
  }

  // ---------- podkladová hudba: klidná pentatonika nad jezerem ----------
  const SCALE = [196, 220, 262, 294, 330, 392, 440, 523, 587, 659];
  const CHORDS = [[98, 147, 196], [87, 131, 175], [110, 165, 220], [82, 123, 165]];
  let beat = 0;

  function musicStep() {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    if (beat % 16 === 0) {
      CHORDS[(beat / 16) % CHORDS.length].forEach(f => tone(f, t, 3.6, { attack: 0.8, vol: 0.05, dest: musicGain }));
    }
    if (Math.random() < 0.55) {
      const f = SCALE[Math.floor(Math.random() * SCALE.length)];
      tone(f * 2, t, 0.9, { type: 'triangle', vol: 0.06, dest: musicGain });
    }
    if (beat % 8 === 6 && Math.random() < 0.5) tone(1800 + Math.random() * 600, t, 0.12, { vol: 0.02, dest: musicGain }); // cvrček
    beat++;
  }

  function startMusic() {
    if (!ensure()) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
    if (!musicTimer) musicTimer = setInterval(musicStep, 240);
  }

  function stopMusic() {
    if (!ctx) return;
    musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    clearInterval(musicTimer);
    musicTimer = null;
  }

  FL.Audio = {
    unlock,
    play,
    get sfx() { return state.sfx; },
    get music() { return state.music; },
    toggleSfx() { state.sfx = !state.sfx; save(); if (state.sfx) { unlock(); play('click'); } return state.sfx; },
    toggleMusic() {
      state.music = !state.music; save();
      if (state.music) { unlock(); startMusic(); } else stopMusic();
      return state.music;
    }
  };
})();
