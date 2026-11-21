// Pool fixo de luzes pontuais: evita recompilar shaders e mantém o custo baixo em GPUs integradas.
// Cada ponto de luz ("fixture") pode ter brilho visível ao redor da lâmpada.
import * as THREE from 'three';

const POOL = 8;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,240,210,0.55)');
  g.addColorStop(0.45, 'rgba(255,220,170,0.12)'); g.addColorStop(1, 'rgba(255,220,170,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class LightSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.fixtures = [];
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 9, 2);
      scene.add(l); this.pool.push(l);
    }
    this.hemi = new THREE.HemisphereLight(0xb8b2a4, 0x2a2420, 0.42);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x1c1c24, 0.35);
    scene.add(this.ambient);
    this.timer = 0;
    this.mood = { warm: 1 };
    this.globalDim = 1;
    this.blackout = 0;
    this.flickerAll = 0;
    this.gain = 6.5;    // compensa as unidades físicas do Three.js
    this.glowTex = glowTexture();
    this.daylight = true;
  }

  // fixture: {pos, color, intensity, range, on, zone, room, flicker, bulb, glow(tamanho), daylight}
  add(f) {
    const fx = { on: true, flicker: 0, intensity: 1.2, range: 7, color: 0xffe2b0, ...f, _cur: 0, _k: 1 };
    fx.pos = f.pos.clone ? f.pos.clone() : new THREE.Vector3(...f.pos);
    this.fixtures.push(fx);
    if (fx.room) fx.room.lights.push(fx);
    if (fx.glow) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: fx.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sp.position.copy(fx.pos); sp.scale.setScalar(fx.glow);
      this.scene.add(sp); fx.sprite = sp;
    }
    return fx;
  }

  setMood(warm, dim = 1) { this.mood.warm = warm; this.globalDim = dim; }
  setDaylight(on) { this.daylight = on; }
  isOn(f) { return f.on && (!f.daylight || this.daylight); }

  update(dt, playerPos, time) {
    this.timer -= dt;
    const zone = this.world.zoneAt(playerPos.x, playerPos.z);
    const room = this.world.roomAt(playerPos.x, playerPos.z);
    if (!this.slots) this.slots = this.pool.map(() => ({ f: null, level: 0, out: false }));
    if (this.timer <= 0) {
      this.timer = 0.25;
      // prioriza as luzes do cômodo atual e da mesma zona (reduz luz "vazando" pelas paredes).
      // luzes já acesas ganham vantagem (histerese) para não ficarem trocando a cada passo.
      const held = new Set(this.slots.filter((s) => s.f && !s.out).map((s) => s.f));
      const score = (f) => f.pos.distanceTo(playerPos) + (room && f.room && f.room !== room ? 3.5 : 0) - (held.has(f) ? 2.5 : 0);
      const desired = this.fixtures
        .filter((f) => this.isOn(f) && (!f.zone || f.zone === zone) && f.pos.distanceToSquared(playerPos) < 20 * 20)
        .sort((a, b) => score(a) - score(b))
        .slice(0, POOL);
      // luzes que saíram do conjunto apagam devagar; as novas entram em slots livres acendendo devagar
      for (const s of this.slots) if (s.f && !desired.includes(s.f)) s.out = true; else if (s.f) s.out = false;
      for (const f of desired) {
        if (this.slots.some((s) => s.f === f)) continue;
        const free = this.slots.find((s) => !s.f) || this.slots.find((s) => s.out && s.level < 0.05);
        if (free) { free.f = f; free.level = 0; free.out = false; }
      }
    }
    const cold = new THREE.Color(0xb8d0ff), tmp = new THREE.Color();
    for (const f of this.fixtures) f._k = 1;
    for (let i = 0; i < POOL; i++) {
      const l = this.pool[i], s = this.slots[i], f = s.f;
      if (f) {
        s.level += ((s.out ? 0 : 1) - s.level) * Math.min(1, dt * 5);
        if (s.out && s.level < 0.02) { s.f = null; s.level = 0; }
      }
      if (!f || this.blackout > 0) { l.intensity = 0; continue; }
      l.position.copy(f.pos);
      tmp.set(f.color).lerp(cold, (1 - this.mood.warm) * (f.fixedColor ? 0 : 0.7));
      l.color.copy(tmp);
      l.distance = f.range; l.decay = f.decay ?? 2;
      let k = 1;
      const fl = Math.max(f.flicker, this.flickerAll);
      if (fl > 0) {
        // lâmpada com mau contato: fica acesa por um tempo, falha rapidamente, volta (nada de estroboscópio)
        f._flT = (f._flT ?? 0) - dt;
        if (f._flT <= 0) {
          const fail = Math.random() < 0.25 + fl * 0.5;
          f._flOff = fail ? (this.reduce ? 0.65 : 0.1 + Math.random() * 0.35) : 1;
          f._flT = fail ? 0.06 + Math.random() * 0.18 : (0.4 + Math.random() * 2.2) * (1.3 - fl);
        }
        k = f._flOff ?? 1;
      } else f._flOff = 1;
      f._k = k;
      l.intensity = f.intensity * k * this.globalDim * this.gain * s.level;
    }
    // lâmpadas e brilhos visíveis
    for (const f of this.fixtures) {
      const lit = this.isOn(f) && this.blackout <= 0;
      const k = lit ? f._k : 0;
      if (f.bulb) f.bulb.material.color.setScalar(k > 0.5 ? 1 : 0.15);
      if (f.sprite) { f.sprite.visible = k > 0.05; f.sprite.material.opacity = 0.75 * k * this.globalDim; }
    }
    if (this.blackout > 0) this.blackout -= dt;
  }

  // nível de luz aproximado no ponto (0..1+)
  lightAt(p) {
    if (this.blackout > 0) return 0;
    let s = 0;
    for (const f of this.fixtures) {
      if (!this.isOn(f)) continue;
      const d = f.pos.distanceTo(p);
      if (d < f.range) s += f.intensity * (1 - d / f.range) * this.globalDim;
    }
    return s;
  }
}
