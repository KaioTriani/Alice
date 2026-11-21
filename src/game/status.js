// Sanidade (percepção, longo prazo) e Estresse (perigo imediato). Sistemas separados.
import { clamp, damp } from '../core/events.js';

export const SANITY_STAGES = [
  { min: 80, name: 'Estável' },
  { min: 60, name: 'Inquieta' },
  { min: 40, name: 'Perturbada' },
  { min: 20, name: 'Grave' },
  { min: 0, name: 'Crítica' },
];

export class Status {
  constructor(g) {
    this.g = g;
    this.sanity = 100; this.stress = 0;
    this.pendingRecovery = 0;  // recuperação gradual (nunca instantânea)
    this.stressTarget = 0;
    this.seeingEntity = false;
    this.heart = null; this.breath = null;
  }
  get stage() { return SANITY_STAGES.findIndex((s) => this.sanity >= s.min); }
  stageName() { return SANITY_STAGES[this.stage].name; }

  shock(amount) { this.sanity = clamp(this.sanity - amount * this.g.diff.drain, 0, 100); this.g.events.emit('sanity', this.sanity); }
  ground(amount) { this.pendingRecovery += amount; }
  addStress(v) { this.stress = clamp(this.stress + v, 0, 100); }

  update(dt) {
    const g = this.g;
    if (!g.playing) return;
    const p = g.player.eyePos();
    let light = g.lights.lightAt(p);
    if (g.flashlight.on) light += 0.35;
    const zone = g.world.zoneAt(p.x, p.z);
    let drain = 0, regen = 0;
    if (light < 0.22 && !g.cinematic) drain += 0.45;
    if (this.seeingEntity) drain += 3.2;
    if (zone === 'longhall' || zone === 'vision') drain += 0.35;
    if (g.entity?.state === 'chase') drain += 0.6;
    if (light > 0.5 && !this.seeingEntity && this.stress < 25) regen += 0.22 * g.diff.sanityRecovery;
    // recuperação gradual de objetos/rotinas
    if (this.pendingRecovery > 0) { const r = Math.min(this.pendingRecovery, 1.5 * dt); this.pendingRecovery -= r; this.sanity += r; }
    // piso de sanidade por ato (a narrativa empurra Alice para baixo, sem punir em excesso)
    const floor = g.story?.sanityFloor ?? 0;
    this.sanity = clamp(this.sanity - drain * g.diff.drain * dt + regen * dt, floor, 100);
    // teto narrativo (atos finais não voltam a 100)
    const ceil = g.story?.sanityCeil ?? 100;
    if (this.sanity > ceil) this.sanity = damp(this.sanity, ceil, 0.5, dt);

    // estresse
    let target = 0;
    const e = g.entity;
    if (e && e.visible && e.active) {
      const d = e.pos.distanceTo(g.player.pos);
      target = Math.max(target, clamp(100 - d * 9, 0, 85));
      if (e.state === 'chase') target = Math.max(target, 90);
    }
    if (g.hiding.active && e?.active) target = Math.max(target, 40);
    target = Math.max(target, this.stressTarget);
    const k = target > this.stress ? 1.4 : 0.35;
    this.stress = damp(this.stress, target, k, dt);
    this.stressTarget = Math.max(0, this.stressTarget - dt * 12);

    // áudio corporal
    if (g.audio.ctx) {
      if (!this.heart) this.heart = g.audio.loop('heartbeat', { vol: 0, bus: 'sfx' });
      if (!this.breath) this.breath = g.audio.loop('breath', { vol: 0, bus: 'sfx' });
      const s = this.stress / 100;
      this.heart.setVol(s > 0.3 ? (s - 0.3) * 1.1 : 0.0001); this.heart.set('rate', s);
      const exhausted = g.player.stamina < 40 ? (40 - g.player.stamina) / 40 : 0;
      const bv = g.hiding.holding ? 0.0001 : Math.max(s * 0.6, exhausted * 0.7, g.hiding.active ? 0.25 : 0);
      this.breath.setVol(bv < 0.05 ? 0.0001 : bv, 0.15); this.breath.set('rate', Math.max(s, exhausted));
    }
  }
}
