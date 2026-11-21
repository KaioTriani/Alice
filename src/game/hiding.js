// Sistema de esconderijos: entrada/saída, câmera restrita, respiração e descoberta.
import * as THREE from 'three';
import { Interactable } from './interact.js';
import { clamp } from '../core/events.js';

export class HidingSystem {
  constructor(g) {
    this.g = g; this.spots = []; this.active = null;
    this.holding = false; this.gaspCooldown = 0; this.enterT = 0;
    this.struggle = null;
  }

  // spot: {id,label,type,cam:[x,y,z],yaw,yawRange,pitchRange,exit:[x,z,yaw],safety,check:[x,z],mesh,door(Drawer opcional)}
  add(spot) {
    spot.camPos = new THREE.Vector3(...spot.cam);
    spot.checkPos = new THREE.Vector3(spot.check[0], 0, spot.check[1]);
    spot.interact = this.g.interact.add(new Interactable(this.g, {
      id: 'hide_' + spot.id, mesh: spot.mesh, prompt: () => `Esconder-se (${spot.label})`,
      enabled: () => !this.active && !this.g.flags.noHide, onUse: () => this.enter(spot),
    }));
    this.spots.push(spot);
    return spot;
  }

  enter(spot) {
    const g = this.g;
    if (this.active) return;
    this.active = spot; this.enterT = 0;
    g.player.crouching = false;
    g.player.camOverride = { pos: spot.camPos };
    g.player.yaw = spot.yaw; g.player.pitch = spot.pitch || 0;
    g.ui.hideOverlay(spot.type);
    for (const m of spot.hideMeshes || []) m.visible = false;
    g.audio.play(spot.type === 'curtain' ? 'paper' : 'creak', { pos: spot.camPos, vol: 0.35 });
    g.noise(spot.camPos.clone(), 2.5, 'hide');
    if (g.entity?.canSeePlayer?.()) g.entity.sawHide = spot;
    g.events.emit('hide', spot);
    g.ui.toast(`[${g.keyName('interact')}] sair  ·  segure [${g.keyName('holdBreath')}] para prender a respiração`, 4);
  }

  exit(force = false) {
    const g = this.g, s = this.active;
    if (!s) return;
    if (!force && this.enterT < 0.4) return;
    this.active = null; this.holding = false;
    for (const m of s.hideMeshes || []) m.visible = true;
    g.player.camOverride = null;
    g.player.teleport(s.exit[0], s.exit[1], s.exit[2]);
    g.ui.hideOverlay(null);
    g.audio.play('creak', { pos: s.camPos, vol: 0.3 });
    g.noise(s.camPos.clone(), 2.5, 'hide');
    g.events.emit('unhide', s);
  }

  clampLook(p) {
    const s = this.active; if (!s) return;
    let d = p.yaw - s.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    p.yaw = s.yaw + clamp(d, -s.yawRange, s.yawRange);
    p.pitch = clamp(p.pitch, (s.pitch || 0) - (s.pitchRange || 0.4), (s.pitch || 0) + (s.pitchRange || 0.4));
  }

  // raio em que a respiração pode ser ouvida
  breathRadius() {
    if (!this.active || this.holding) return 0;
    return 0.8 + (this.g.status.stress / 100) * 2.6;
  }

  update(dt) {
    const g = this.g;
    this.gaspCooldown -= dt;
    if (this.struggle) { this.updateStruggle(dt); return; }
    if (!this.active) { this.holding = false; return; }
    this.enterT += dt;
    if (g.input.hit('interact') && !g.cinematic) { this.exit(); return; }
    const p = g.player;
    const want = g.input.key('holdBreath');
    if (want && p.stamina > 0) {
      this.holding = true;
      p.stamina = Math.max(0, p.stamina - 14 * dt); p.staminaDelay = 1.2;
      g.status.addStress(4 * dt);
      if (p.stamina <= 0) {
        this.holding = false;
        if (this.gaspCooldown <= 0) {
          this.gaspCooldown = 3;
          g.audio.play('gasp', { vol: 0.9 });
          g.noise(this.active.camPos.clone(), 6, 'gasp');
          g.ui.toast('Alice perdeu o fôlego.');
        }
      }
    } else this.holding = false;
    g.ui.setBreath(this.holding ? p.stamina / 100 : -1);
  }

  // a entidade abriu o esconderijo com o jogador dentro
  discovered(entity) {
    const g = this.g;
    if (this.struggle) return;
    const need = { easy: 5, normal: 7, hard: 9 }[g.settings.difficulty] || 7;
    this.struggle = { t: 0, max: 2.4, count: 0, need, entity };
    g.audio.play('stinger', { vol: 0.9 });
    g.status.shock(8); g.status.addStress(60);
    g.ui.struggle(0, `Empurre! Aperte [${g.keyName('interact')}] repetidamente`);
  }
  updateStruggle(dt) {
    const g = this.g, s = this.struggle;
    s.t += dt;
    if (g.input.hit('interact')) { s.count++; g.player.shake = 0.6; g.audio.play('thump', { vol: 0.4 }); }
    g.ui.struggle(s.count / s.need, `Empurre! Aperte [${g.keyName('interact')}] repetidamente`);
    if (s.count >= s.need) {
      this.struggle = null; g.ui.struggle(-1);
      const spot = this.active; this.exit(true);
      s.entity.stagger(3.0);
      g.ui.toast('Corra!');
      g.audio.play('gasp', { vol: 0.8 });
      void spot;
    } else if (s.t >= s.max) {
      this.struggle = null; g.ui.struggle(-1);
      this.exit(true);
      g.caught();
    }
  }
}
