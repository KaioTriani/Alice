// Lanterna com bateria, cintilação e comportamento em eventos.
import * as THREE from 'three';

export class Flashlight {
  constructor(g) {
    this.g = g; this.on = false; this.battery = 100; this.owned = false;
    this.light = new THREE.SpotLight(0xfff1d0, 0, 14, 0.48, 0.55, 1.2);
    this.light.position.set(0.18, -0.12, 0.05);
    this.target = new THREE.Object3D(); this.target.position.set(0.05, -0.15, -5);
    g.player.camera.add(this.light); g.player.camera.add(this.target);
    this.light.target = this.target;
    this.flicker = 0; this.forcedOff = 0;
    this.drainRate = 0.9; // % por segundo
  }
  toggle() {
    const g = this.g;
    if (!this.owned) { g.ui.toast('Você não tem uma lanterna.'); return; }
    if (!this.on && this.battery <= 0) { g.audio.play('click'); g.ui.toast('A bateria acabou. Encontre pilhas.'); return; }
    this.on = !this.on; g.audio.play('click', { vol: 0.6 });
  }
  reload() {
    const g = this.g;
    if (!this.owned) { g.ui.toast('Você precisa de uma lanterna.'); return false; }
    if (!g.inventory.has('battery')) { g.ui.toast('Você não tem pilhas.'); return false; }
    if (this.battery > 90) { g.ui.toast('A lanterna ainda está carregada.'); return false; }
    g.inventory.take('battery'); this.battery = 100; g.audio.play('click'); g.ui.toast('Pilhas trocadas.');
    return true;
  }
  update(dt) {
    const g = this.g;
    if (this.on) {
      this.battery = Math.max(0, this.battery - this.drainRate * dt);
      if (this.battery <= 0) { this.on = false; g.audio.play('click'); g.ui.toast('A lanterna apagou.'); if (g.inventory.has('battery')) g.ui.toast(`Pressione [${g.keyName('inventory')}] e use uma pilha.`); }
    }
    if (this.forcedOff > 0) this.forcedOff -= dt;
    let k = this.on && this.forcedOff <= 0 ? 1 : 0;
    if (k) {
      const low = this.battery < 15 ? (15 - this.battery) / 15 : 0;
      const fl = Math.max(this.flicker, low * 0.6);
      if (fl > 0 && Math.random() < fl * 0.25) k = Math.random() * 0.3;
      k *= 0.55 + 0.45 * Math.min(1, this.battery / 30);
    }
    if (this.flicker > 0) this.flicker = Math.max(0, this.flicker - dt * 0.5);
    this.light.intensity = 11 * k;
    // tremor da mão sob estresse
    const st = g.status.stress / 100, t = g.time;
    const w = (g.settings.reduceShake ? 0.3 : 1) * st;
    this.target.position.set(0.05 + Math.sin(t * 9.1) * 0.12 * w, -0.15 + Math.cos(t * 7.3) * 0.1 * w, -5);
  }
}
