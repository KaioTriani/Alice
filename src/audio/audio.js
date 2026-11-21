// Motor de áudio procedural (Web Audio API). Nenhum arquivo de som externo:
// tudo é sintetizado, posicionado em 3D (HRTF) e filtrado por oclusão.
import * as THREE from 'three';

const VOICE_PRESETS = {
  alice:  { pitch: 1.0, rate: 0.95, label: 'Alice' },
  daniel: { pitch: 0.55, rate: 0.85, label: 'Daniel' },
  emily:  { pitch: 1.75, rate: 1.0, label: 'Emily' },
  thomas: { pitch: 2.0, rate: 1.08, label: 'Thomas' },
  entity: { pitch: 0.25, rate: 0.72, label: '???' },
  nurse:  { pitch: 1.15, rate: 0.95, label: 'Enfermeira' },
  doctor: { pitch: 0.8, rate: 0.9, label: 'Médico' },
  radio:  { pitch: 1.0, rate: 1.0, label: 'Rádio' },
};

// Melodia original da caixinha de música (MIDI). Composta para ALICE.
const MELODY = [
  [76, 1], [72, 1], [69, 1], [72, 1], [76, 1], [79, 2], [77, 1],
  [76, 1], [74, 1], [71, 1], [67, 1], [71, 1], [74, 2], [72, 2],
  [69, 1], [72, 1], [76, 1], [81, 2], [79, 1], [77, 1], [76, 1],
  [74, 1], [72, 1], [71, 1], [69, 3], [0, 1],
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.loops = new Set();
    this.spatial = new Set();
    this.settings = null;
    this.onSubtitle = null;
    this.voices = [];
    this.occlusionFn = null;
    this.ttsQueue = Promise.resolve();
  }

  init(settings) {
    if (this.ctx) { this.ctx.resume(); return; }
    this.settings = settings;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.comp.connect(this.master);
    this.buses = {};
    for (const b of ['sfx', 'voice', 'music', 'amb']) { const g = ctx.createGain(); g.connect(this.comp); this.buses[b] = g; }
    // reverb
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(1.8, 2.6);
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.22;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.comp);
    // buffers de ruído
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brownBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.applyVolumes();
    if ('speechSynthesis' in window) {
      const load = () => { this.voices = speechSynthesis.getVoices(); };
      load(); speechSynthesis.onvoiceschanged = load;
    }
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    this.master.gain.value = s.master;
    this.buses.sfx.gain.value = s.sfx; this.buses.amb.gain.value = s.sfx * 0.9;
    this.buses.voice.gain.value = s.voice; this.buses.music.gain.value = s.music;
  }
  setReverb(wet) { if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.5); }
  pause(on) { if (!this.ctx) return; if (on) this.ctx.suspend(); else this.ctx.resume(); if ('speechSynthesis' in window) { if (on) speechSynthesis.pause(); else speechSynthesis.resume(); } }

  updateListener(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.getWorldPosition(new THREE.Vector3());
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const t = this.ctx.currentTime;
    if (![p.x, p.y, p.z, f.x, f.y, f.z].every(Number.isFinite)) return;
    if (L.positionX) {
      L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    this.listenerPos = p;
  }

  // Cria a saída (espacial ou não) para um som
  out(opts = {}) {
    const ctx = this.ctx;
    const bus = this.buses[opts.bus || 'sfx'];
    const gain = ctx.createGain(); gain.gain.value = opts.vol ?? 1;
    if (opts.pos) {
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 20000;
      const pan = ctx.createPanner();
      pan.panningModel = 'HRTF'; pan.distanceModel = 'inverse';
      pan.refDistance = opts.ref || 1.2; pan.rolloffFactor = opts.rolloff || 1.3; pan.maxDistance = 60;
      const p = opts.pos;
      if (pan.positionX) { pan.positionX.value = p.x; pan.positionY.value = p.y ?? 1.2; pan.positionZ.value = p.z; } else pan.setPosition(p.x, p.y ?? 1.2, p.z);
      gain.connect(filt); filt.connect(pan); pan.connect(bus);
      const send = ctx.createGain(); send.gain.value = 0.6; pan.connect(send); send.connect(this.reverb);
      const node = { gain, filt, pan, pos: new THREE.Vector3(p.x, p.y ?? 1.2, p.z), occl: opts.occl !== false };
      this.spatial.add(node);
      if (this.occlusionFn && node.occl) this.applyOcclusion(node);
      node.dispose = () => this.spatial.delete(node);
      return node;
    }
    gain.connect(bus);
    if (opts.reverb) { const send = ctx.createGain(); send.gain.value = opts.reverb; gain.connect(send); send.connect(this.reverb); }
    return { gain, dispose() {} };
  }
  movePos(node, p) {
    if (!node.pan) return;
    node.pos.set(p.x, p.y ?? 1.2, p.z);
    const t = this.ctx.currentTime;
    if (node.pan.positionX) { node.pan.positionX.setTargetAtTime(p.x, t, 0.05); node.pan.positionY.setTargetAtTime(p.y ?? 1.2, t, 0.05); node.pan.positionZ.setTargetAtTime(p.z, t, 0.05); }
    else node.pan.setPosition(p.x, p.y ?? 1.2, p.z);
  }
  applyOcclusion(node) {
    const occ = this.occlusionFn(node.pos); // 0..n paredes
    const f = occ <= 0 ? 20000 : occ === 1 ? 1400 : 600;
    node.filt.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.1);
  }
  updateOcclusion() {
    if (!this.ctx || !this.occlusionFn) return;
    for (const n of this.spatial) if (n.occl) this.applyOcclusion(n);
  }

  noise(brown = false, loop = false) {
    const s = this.ctx.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = loop;
    s.loopStart = Math.random(); s.loopEnd = s.loopStart + 0.9;
    return s;
  }
  env(g, t, a, peak, dcy, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + dcy);
  }
  bp(type, freq, q = 1) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  osc(type, freq) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; }
  // fonte de ruído curta com envelope
  burst(dest, t, dur, filterType, freq, q, peak, offset = 0) {
    const s = this.noise(); const f = this.bp(filterType, freq, q); const g = this.ctx.createGain();
    s.connect(f); f.connect(g); g.connect(dest);
    this.env(g, t, 0.004, peak, dur);
    s.start(t, offset || Math.random()); s.stop(t + dur + 0.05);
  }
  tone(dest, t, type, freq, dur, peak, a = 0.005, freqEnd = null) {
    const o = this.osc(type, freq); const g = this.ctx.createGain();
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    o.connect(g); g.connect(dest); this.env(g, t, a, peak, dur); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }

  // ------------------------------ Sons únicos ------------------------------
  play(name, opts = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + (opts.delay || 0);
    const o = this.out(opts), d = o.gain;
    let dur = 1.5;
    const r = opts.rate || 1;
    switch (name) {
      case 'step': {
        const s = opts.surface || 'wood';
        const cfg = { wood: [700, 0.5, 0.09, 90], tile: [2600, 0.9, 0.06, 0], carpet: [420, 0.3, 0.07, 0], concrete: [1500, 0.7, 0.07, 0], vinyl: [2000, 0.8, 0.05, 0], grass: [520, 0.32, 0.12, 0] }[s] || [700, 0.5, 0.09, 90];
        this.burst(d, t, cfg[2], 'bandpass', cfg[0] * (0.85 + Math.random() * 0.3), 1.2, cfg[1]);
        if (cfg[3]) this.tone(d, t, 'sine', cfg[3], 0.08, 0.4);
        if (s === 'wood' && Math.random() < 0.12) this.creakShort(d, t + 0.03);
        dur = 0.3; break;
      }
      case 'creak': {
        const o1 = this.osc('sawtooth', 170 * r), f = this.bp('bandpass', 900, 6), g = ctx.createGain();
        o1.frequency.setValueAtTime(170 * r, t); o1.frequency.linearRampToValueAtTime(115 * r, t + 0.9);
        const lfo = this.osc('sine', 23), lg = ctx.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o1.frequency);
        o1.connect(f); f.connect(g); g.connect(d);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 0.95);
        o1.start(t); lfo.start(t); o1.stop(t + 1); lfo.stop(t + 1); dur = 1.1; break;
      }
      case 'doorClose': this.burst(d, t, 0.18, 'lowpass', 380, 0.7, 1.0); this.tone(d, t, 'sine', 62, 0.2, 0.8); this.burst(d, t + 0.02, 0.05, 'highpass', 3000, 1, 0.2); dur = 0.5; break;
      case 'slam': this.burst(d, t, 0.35, 'lowpass', 500, 0.7, 1.6); this.tone(d, t, 'sine', 48, 0.4, 1.4); for (let i = 0; i < 5; i++) this.burst(d, t + 0.05 + i * 0.04, 0.03, 'bandpass', 2200, 2, 0.3); dur = 0.8; break;
      case 'locked': for (let i = 0; i < 3; i++) { this.burst(d, t + i * 0.09, 0.05, 'bandpass', 1800, 3, 0.5); this.tone(d, t + i * 0.09, 'square', 220, 0.03, 0.05); } dur = 0.5; break;
      case 'unlock': this.burst(d, t, 0.05, 'bandpass', 2500, 4, 0.6); this.burst(d, t + 0.12, 0.08, 'bandpass', 1600, 3, 0.7); dur = 0.4; break;
      case 'drawer': { const s = this.noise(), f = this.bp('bandpass', 1100, 1.5), g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.35); s.start(t, Math.random()); s.stop(t + 0.4); this.burst(d, t + 0.33, 0.06, 'lowpass', 600, 1, 0.5); dur = 0.5; break; }
      case 'pickup': this.burst(d, t, 0.04, 'bandpass', 3000, 2, 0.3); this.tone(d, t + 0.02, 'triangle', 660, 0.15, 0.06); dur = 0.3; break;
      case 'click': this.burst(d, t, 0.02, 'highpass', 2500, 1, 0.5); this.tone(d, t, 'square', 1200, 0.015, 0.08); dur = 0.1; break;
      case 'paper': for (let i = 0; i < 4; i++) this.burst(d, t + i * 0.05, 0.06, 'highpass', 3500, 0.8, 0.25); dur = 0.4; break;
      case 'knock': { const n = opts.count || 3; for (let i = 0; i < n; i++) { const tt = t + i * (opts.gap || 0.42); this.burst(d, tt, 0.12, 'lowpass', 420, 1, 1.4); this.tone(d, tt, 'sine', 95, 0.12, 1.0); } dur = n * 0.45 + 0.5; break; }
      case 'thump': this.burst(d, t, 0.25, 'lowpass', 260, 1, 1.2); this.tone(d, t, 'sine', 55, 0.3, 1.0); dur = 0.5; break;
      case 'gasp': { const s = this.noise(), f = this.bp('bandpass', 1300, 1.2), g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(d); f.frequency.linearRampToValueAtTime(2200, t + 0.25); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); s.start(t, Math.random()); s.stop(t + 0.5); dur = 0.6; break; }
      case 'whisper': {
        const len = opts.len || 1.6;
        for (let k = 0; k < 2; k++) {
          const s = this.noise(), f = this.bp('bandpass', 1500, 3), f2 = this.bp('bandpass', 3200, 4), g = ctx.createGain();
          s.connect(f); s.connect(f2); f.connect(g); f2.connect(g); g.connect(d);
          for (let i = 0; i < len * 7; i++) { const tt = t + i / 7; f.frequency.setValueAtTime(700 + Math.random() * 1600, tt); g.gain.setValueAtTime(Math.random() < 0.3 ? 0.02 : 0.25 + Math.random() * 0.3, tt); }
          g.gain.setValueAtTime(0.0001, t + len);
          s.start(t + k * 0.11, Math.random()); s.stop(t + len + 0.2);
        }
        dur = len + 0.3; break;
      }
      case 'stinger': {
        const base = opts.base || 98;
        [1, 1.06, 1.414, 1.5, 2.12].forEach((m, i) => {
          const os = this.osc('sawtooth', base * m), f = this.bp('lowpass', 300, 1), g = ctx.createGain();
          f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.6);
          os.detune.value = (Math.random() - 0.5) * 30;
          os.connect(f); f.connect(g); g.connect(d);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08 + i * 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
          os.start(t); os.stop(t + 2.5);
        });
        this.burst(d, t, 0.6, 'lowpass', 900, 0.7, 0.9);
        dur = 2.6; break;
      }
      case 'swell': {
        [55, 58.3, 82.4].forEach((fq) => {
          const os = this.osc('sawtooth', fq), f = this.bp('lowpass', 200, 2), g = ctx.createGain();
          os.connect(f); f.connect(g); g.connect(d); f.frequency.linearRampToValueAtTime(1200, t + 3);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 3); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
          os.start(t); os.stop(t + 3.7);
        });
        dur = 3.8; break;
      }
      case 'cutlery': for (let i = 0; i < 6; i++) this.tone(d, t + Math.random() * 1.6, 'sine', 2800 + Math.random() * 2400, 0.12, 0.08); dur = 2; break;
      case 'chairDrag': { const s = this.noise(), f = this.bp('bandpass', 380, 2), g = ctx.createGain(), lfo = this.osc('square', 32), lg = ctx.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain); s.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(0.3, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.7); s.start(t); lfo.start(t); s.stop(t + 0.75); lfo.stop(t + 0.75); dur = 0.8; break; }
      case 'laugh': {
        const base = opts.pitch || 520;
        for (let i = 0; i < 5; i++) {
          const tt = t + i * 0.16 + Math.random() * 0.03;
          const os = this.osc('triangle', base * (1 - i * 0.04)), f = this.bp('bandpass', 1400, 2), g = ctx.createGain();
          os.frequency.linearRampToValueAtTime(base * 0.85, tt + 0.1);
          os.connect(f); f.connect(g); g.connect(d); this.env(g, tt, 0.01, 0.12, 0.1); os.start(tt); os.stop(tt + 0.15);
          this.burst(d, tt, 0.06, 'bandpass', 2400, 1, 0.08);
        }
        dur = 1.2; break;
      }
      case 'sob': {
        for (let i = 0; i < 3; i++) {
          const tt = t + i * 0.7; const os = this.osc('triangle', (opts.pitch || 420)), f = this.bp('bandpass', 1100, 3), g = ctx.createGain();
          os.frequency.setValueAtTime((opts.pitch || 420) * 1.1, tt); os.frequency.linearRampToValueAtTime((opts.pitch || 420) * 0.75, tt + 0.5);
          const vib = this.osc('sine', 7), vg = ctx.createGain(); vg.gain.value = 18; vib.connect(vg); vg.connect(os.frequency);
          os.connect(f); f.connect(g); g.connect(d); this.env(g, tt, 0.08, 0.09, 0.5); os.start(tt); vib.start(tt); os.stop(tt + 0.7); vib.stop(tt + 0.7);
          this.burst(d, tt + 0.55, 0.12, 'bandpass', 1500, 1, 0.12);
        }
        dur = 2.3; break;
      }
      case 'kidsRun': {
        const n = opts.count || 10;
        for (let i = 0; i < n; i++) { const tt = t + i * 0.17; this.burst(d, tt, 0.05, 'bandpass', 900 + Math.random() * 300, 1, 0.45); this.tone(d, tt, 'sine', 120, 0.05, 0.2); }
        dur = n * 0.17 + 0.3; break;
      }
      case 'water': { const s = this.noise(), f = this.bp('bandpass', 1800, 0.6), g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.2); g.gain.setValueAtTime(0.35, t + (opts.len || 2)); g.gain.linearRampToValueAtTime(0.0001, t + (opts.len || 2) + 0.3); s.start(t); s.stop(t + (opts.len || 2) + 0.4); dur = (opts.len || 2) + 0.5; break; }
      case 'coffee': for (let i = 0; i < 18; i++) this.burst(d, t + i * 0.16 + Math.random() * 0.08, 0.09, 'lowpass', 500 + Math.random() * 400, 3, 0.45); dur = 3.2; break;
      case 'sizzle': { const s = this.noise(), f = this.bp('highpass', 3000, 0.5), g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.3); g.gain.linearRampToValueAtTime(0.0001, t + (opts.len || 3)); s.start(t); s.stop(t + (opts.len || 3) + 0.1); dur = (opts.len || 3) + 0.2; break; }
      case 'beep': this.tone(d, t, 'sine', 1000, 0.12, 0.18); dur = 0.2; break;
      case 'bell': [1, 2.4, 3.9].forEach((m, i) => this.tone(d, t, 'sine', 660 * m, 2.5 - i * 0.6, 0.12 / (i + 1))); dur = 2.6; break;
      case 'glitch': for (let i = 0; i < 8; i++) { this.burst(d, t + i * 0.04, 0.03, 'bandpass', 400 + Math.random() * 4000, 2, 0.5); } this.tone(d, t, 'square', 60, 0.3, 0.15); dur = 0.5; break;
      case 'tvOn': this.burst(d, t, 0.08, 'highpass', 1500, 1, 0.6); this.tone(d, t, 'sine', 15000, 0.5, 0.02); dur = 0.6; break;
      case 'vhsInsert': this.burst(d, t, 0.15, 'lowpass', 900, 1, 0.8); this.burst(d, t + 0.4, 0.1, 'bandpass', 1500, 2, 0.5); this.tone(d, t + 0.5, 'sawtooth', 90, 0.8, 0.05, 140); dur = 1.4; break;
      case 'crash': {
        this.burst(d, t, 2.5, 'lowpass', 900, 0.5, 2.0); this.tone(d, t, 'sine', 40, 2.2, 2.0, 0.01, 22);
        for (let i = 0; i < 14; i++) this.burst(d, t + Math.random() * 1.5, 0.15, 'bandpass', 500 + Math.random() * 3000, 1, 0.8);
        dur = 3; break;
      }
      case 'alarm': for (let i = 0; i < 6; i++) { this.tone(d, t + i * 0.5, 'square', 880, 0.2, 0.08); this.tone(d, t + i * 0.5 + 0.25, 'square', 660, 0.2, 0.08); } dur = 3.1; break;
      case 'heartbeatOne': this.tone(d, t, 'sine', 58, 0.12, 0.9); this.tone(d, t + 0.18, 'sine', 50, 0.15, 0.7); dur = 0.5; break;
      case 'breathOne': {
        const s = this.noise(), f = this.bp('bandpass', 700, 0.8), g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(d);
        const len = opts.len || 1.1;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(opts.peak || 0.25, t + len * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + len);
        f.frequency.linearRampToValueAtTime(1100, t + len * 0.4); f.frequency.linearRampToValueAtTime(600, t + len);
        s.start(t, Math.random()); s.stop(t + len + 0.1); dur = len + 0.2; break;
      }
      case 'phoneRingOnce': {
        for (const off of [0, 0.6]) {
          const tt = t + off;
          const a = this.osc('sine', 440), b = this.osc('sine', 480), g = ctx.createGain(), am = this.osc('square', 20), ag = ctx.createGain();
          ag.gain.value = 0.12; am.connect(ag); ag.connect(g.gain);
          a.connect(g); b.connect(g); g.connect(d); g.gain.setValueAtTime(0.12, tt); g.gain.setValueAtTime(0, tt + 0.4);
          [a, b, am].forEach((x) => { x.start(tt); x.stop(tt + 0.42); });
        }
        dur = 1.2; break;
      }
      case 'musicNote': {
        const f0 = opts.freq || 880, g = ctx.createGain();
        [1, 2, 3.01, 4.2].forEach((m, i) => { const os = this.osc('sine', f0 * m); os.detune.value = opts.detune || 0; const gg = ctx.createGain(); os.connect(gg); gg.connect(g); this.env(gg, t, 0.002, 0.18 / (i + 1) ** 1.4, 1.6 / (i + 1)); os.start(t); os.stop(t + 1.8); });
        g.connect(d); dur = 1.9; break;
      }
      default: dur = 0.1;
    }
    if (o.dispose) setTimeout(() => o.dispose(), (dur + 0.5) * 1000 + (opts.delay || 0) * 1000);
    return dur;
  }
  creakShort(d, t) {
    const o1 = this.osc('sawtooth', 210 + Math.random() * 60), f = this.bp('bandpass', 1000, 8), g = this.ctx.createGain();
    o1.frequency.linearRampToValueAtTime(150, t + 0.3); o1.connect(f); f.connect(g); g.connect(d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    o1.start(t); o1.stop(t + 0.4);
  }

  // ------------------------------ Loops ------------------------------
  // Retorna handle {stop(fade), setVol(v), setPos(p)}
  loop(name, opts = {}) {
    if (!this.ctx) return { stop() {}, setVol() {}, setPos() {}, set() {} };
    const ctx = this.ctx, o = this.out({ ...opts, bus: opts.bus || 'amb' }), d = o.gain, t = ctx.currentTime;
    const nodes = []; let tick = null; const state = { next: t + 0.05, i: 0, rate: opts.rate || 1, detune: opts.detune || 0, vol: opts.vol ?? 1 };
    const start = (n) => { n.start(t); nodes.push(n); };
    switch (name) {
      case 'static': { const s = this.noise(false, true), f = this.bp('bandpass', 3200, 0.5), g = ctx.createGain(); g.gain.value = 0.22; s.connect(f); f.connect(g); g.connect(d); start(s); break; }
      case 'hum': { const a = this.osc('sine', opts.freq || 55), b = this.osc('sine', (opts.freq || 55) * 2), g = ctx.createGain(); g.gain.value = 0.12; a.connect(g); b.connect(g); g.connect(d); start(a); start(b); const s = this.noise(true, true), gg = ctx.createGain(); gg.gain.value = 0.06; s.connect(gg); gg.connect(d); start(s); break; }
      case 'fluor': { const a = this.osc('sawtooth', 120), f = this.bp('lowpass', 900, 1), g = ctx.createGain(); g.gain.value = 0.05; a.connect(f); f.connect(g); g.connect(d); start(a); const s = this.noise(false, true), f2 = this.bp('highpass', 6000, 0.5), g2 = ctx.createGain(); g2.gain.value = 0.02; s.connect(f2); f2.connect(g2); g2.connect(d); start(s); break; }
      case 'room': { const s = this.noise(true, true), f = this.bp('lowpass', 260, 0.5), g = ctx.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(d); start(s); break; }
      case 'wind': { const s = this.noise(false, true), f = this.bp('bandpass', 500, 0.8), g = ctx.createGain(); g.gain.value = 0.12; const lfo = this.osc('sine', 0.12), lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency); s.connect(f); f.connect(g); g.connect(d); start(s); start(lfo); break; }
      case 'drone': { [41.2, 43.6, 61.7].forEach((fq) => { const a = this.osc('sawtooth', fq), f = this.bp('lowpass', 180, 3), g = ctx.createGain(); g.gain.value = 0.05; const lfo = this.osc('sine', 0.07 + Math.random() * 0.05), lg = ctx.createGain(); lg.gain.value = 80; lfo.connect(lg); lg.connect(f.frequency); a.connect(f); f.connect(g); g.connect(d); start(a); start(lfo); }); break; }
      case 'cabin': { const s = this.noise(true, true), f = this.bp('lowpass', 400, 0.5), g = ctx.createGain(); g.gain.value = 0.5; s.connect(f); f.connect(g); g.connect(d); start(s); const a = this.osc('sawtooth', 118), f2 = this.bp('lowpass', 300, 1), g2 = ctx.createGain(); g2.gain.value = 0.04; a.connect(f2); f2.connect(g2); g2.connect(d); start(a); break; }
      case 'washer': { const s = this.noise(true, true), f = this.bp('lowpass', 300, 1), g = ctx.createGain(); g.gain.value = 0.3; const lfo = this.osc('sine', 1.4), lg = ctx.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain); s.connect(f); f.connect(g); g.connect(d); start(s); start(lfo); break; }
      case 'phone': tick = (now) => { while (state.next < now + 0.2) { const off = state.next - ctx.currentTime; this.play('phoneRingOnce', { ...opts, vol: (opts.vol ?? 1), delay: Math.max(0, off), bus: 'sfx' }); state.next += 3.0; } }; break;
      case 'clock': tick = (now) => { while (state.next < now + 0.2) { const tt = state.next; this.burst(d, tt, 0.02, 'bandpass', state.i % 2 ? 3200 : 2600, 6, 0.35); state.i++; state.next += 1.0; } }; break;
      case 'heartbeat': tick = (now) => { while (state.next < now + 0.2) { const tt = state.next; this.tone(d, tt, 'sine', 58, 0.12, 0.9); this.tone(d, tt + 0.2, 'sine', 50, 0.15, 0.65); state.next += 60 / (60 + 90 * state.rate); } }; break;
      case 'breath': tick = (now) => { while (state.next < now + 0.2) { const tt = state.next, len = 1.4 - 0.8 * state.rate; this.breathAt(d, tt, len, 0.12 + 0.25 * state.rate); state.next += len * 1.25; } }; break;
      case 'birds': tick = (now) => { while (state.next < now + 0.3) { const tt = state.next, f0 = 2400 + Math.random() * 1800; for (let k = 0; k < 2 + (Math.random() * 3 | 0); k++) this.tone(d, tt + k * 0.11, 'sine', f0 * (1 + Math.random() * 0.2), 0.07, 0.05, 0.004, f0 * 1.4); state.next += 1.5 + Math.random() * 4; } }; break;
      case 'drip': tick = (now) => { while (state.next < now + 0.2) { const tt = state.next; this.tone(d, tt, 'sine', 1400 + Math.random() * 600, 0.08, 0.15, 0.002, 600); state.next += 1.2 + Math.random() * 2.5; } }; break;
      case 'monitor': tick = (now) => { while (state.next < now + 0.2) { this.tone(d, state.next, 'sine', 980, 0.1, 0.12); state.next += 1.1; } }; break;
      case 'musicbox': tick = (now) => {
        while (state.next < now + 0.3) {
          const [m, len] = MELODY[state.i % MELODY.length];
          const beat = 0.34 / state.rate;
          if (m) {
            const det = state.detune ? (Math.random() - 0.5) * state.detune * 2 : 0;
            const off = Math.max(0, state.next - ctx.currentTime);
            this.noteAt(d, state.next, mtof(m), det);
            void off;
          }
          state.next += beat * len * (1 + (state.detune ? (Math.random() - 0.5) * state.detune / 400 : 0));
          state.i++;
          if (opts.once && state.i >= MELODY.length) { tick = null; break; }
        }
      }; break;
      default: break;
    }
    d.gain.setValueAtTime(0.0001, t); d.gain.linearRampToValueAtTime(state.vol, t + (opts.fadeIn ?? 0.4));
    const handle = {
      state,
      tick: (now) => tick && tick(now),
      setVol: (v, k = 0.3) => { state.vol = v; d.gain.setTargetAtTime(Math.max(v, 0.0001), ctx.currentTime, k); },
      setPos: (p) => this.movePos(o, p),
      set: (k, v) => { state[k] = v; },
      stop: (fade = 0.4) => {
        if (handle.stopped) return; handle.stopped = true; tick = null;
        d.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 3);
        setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* ok */ } }); o.dispose && o.dispose(); this.loops.delete(handle); }, fade * 1000 + 300);
      },
    };
    this.loops.add(handle);
    return handle;
  }
  noteAt(d, t, f0, detune) {
    const g = this.ctx.createGain(); g.connect(d);
    [1, 2, 3.01, 4.2].forEach((m, i) => { const os = this.osc('sine', f0 * m); os.detune.value = detune; const gg = this.ctx.createGain(); os.connect(gg); gg.connect(g); this.env(gg, t, 0.002, 0.16 / (i + 1) ** 1.4, 1.5 / (i + 1)); os.start(t); os.stop(t + 1.7); });
  }
  breathAt(d, t, len, peak) {
    const s = this.noise(), f = this.bp('bandpass', 650, 0.9), g = this.ctx.createGain(); s.connect(f); f.connect(g); g.connect(d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + len * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + len * 0.55);
    g.gain.linearRampToValueAtTime(peak * 0.7, t + len * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + len);
    s.start(t, Math.random()); s.stop(t + len + 0.05);
  }
  update() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const l of this.loops) l.tick(now);
  }
  stopAll() { for (const l of [...this.loops]) l.stop(0.2); if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  // ------------------------------ Vozes ------------------------------
  // Mostra legenda e, se habilitado, sintetiza a fala. Retorna duração estimada.
  say(speaker, text, opts = {}) {
    const preset = VOICE_PRESETS[speaker] || VOICE_PRESETS.alice;
    const label = opts.label || preset.label;
    const dur = opts.dur || Math.max(1.8, text.length * 0.068 + 1.0);
    if (this.onSubtitle) this.onSubtitle(label, text, dur, speaker);
    if (this.ctx && opts.pos) this.play(speaker === 'entity' || opts.ghost ? 'whisper' : 'breathOne', { pos: opts.pos, vol: 0.6, len: Math.min(dur, 3), bus: 'voice' });
    if (this.settings?.voiceSynth && 'speechSynthesis' in window && !opts.silent) {
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ','));
        const pt = this.voices.find((v) => /pt[-_]BR/i.test(v.lang)) || this.voices.find((v) => /^pt/i.test(v.lang));
        if (pt) u.voice = pt;
        u.lang = 'pt-BR';
        u.pitch = Math.min(2, Math.max(0, opts.pitch ?? preset.pitch));
        u.rate = opts.rate ?? preset.rate;
        u.volume = Math.min(1, (this.settings.voice ?? 1) * (this.settings.master ?? 1) * (opts.vol ?? 1));
        speechSynthesis.speak(u);
      } catch { /* TTS indisponível */ }
    }
    return dur;
  }
  speakers() { return VOICE_PRESETS; }
}
