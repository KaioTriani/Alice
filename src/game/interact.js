// Framework de interação: detecção por raycast, texto contextual, ações instantâneas e "segurar".
import * as THREE from 'three';
import { boxGeo } from '../world/builder.js';
import { damp } from '../core/events.js';

const RANGE = 2.3;

export class Interactable {
  constructor(g, o) {
    this.g = g;
    Object.assign(this, { id: null, prompt: 'Interagir', enabled: true, hold: 0, once: false, onUse: null, noise: 0 }, o);
    this.used = false;
    if (this.mesh) this.tag(this.mesh);
  }
  tag(obj) { obj.traverse((c) => { c.userData.interactable = this; }); }
  isEnabled() { if (this.used && this.once) return false; return typeof this.enabled === 'function' ? this.enabled(this.g) : this.enabled; }
  getPrompt() { return typeof this.prompt === 'function' ? this.prompt(this.g) : this.prompt; }
  use() {
    if (this.onUse) this.onUse(this.g, this);
    this.used = true;
    if (this.noise) this.g.noise(this.worldPos(), this.noise, 'interact');
  }
  worldPos() { return this.mesh ? this.mesh.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(); }
  remove() {
    this.enabled = false;
    if (this.mesh?.parent) this.mesh.parent.remove(this.mesh);
    this.g.interact.remove(this);
  }
}

// ---------------- Porta articulada ----------------
export class Door extends Interactable {
  constructor(g, o) {
    super(g, { prompt: '', ...o, mesh: null });
    const { x, z, axis = 'x', width = 0.9, height = 2.08, material, frameMat, locked = false, hingeSide = 1 } = o;
    this.axis = axis; this.width = width; this.locked = locked; this.lockedMsg = o.lockedMsg || 'Está trancada.';
    this.name = o.name || 'porta';
    this.hingeSide = hingeSide;
    this.pivot = new THREE.Object3D();
    this.base = axis === 'x' ? 0 : -Math.PI / 2;
    if (axis === 'x') this.pivot.position.set(x - (width / 2) * hingeSide, 0, z);
    else this.pivot.position.set(x, 0, z - (width / 2) * hingeSide);
    if (hingeSide < 0) this.base += Math.PI;
    this.pivot.rotation.y = this.base;
    const leaf = new THREE.Mesh(boxGeo(width - 0.02, height, 0.05, 1), material);
    leaf.position.set(width / 2, height / 2, 0);
    this.pivot.add(leaf);
    // maçaneta
    const knobM = new THREE.MeshLambertMaterial({ color: 0xb59a5a });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), knobM);
    knob.position.set(width - 0.12, 1.0, 0.05); this.pivot.add(knob);
    const knob2 = knob.clone(); knob2.position.z = -0.05; this.pivot.add(knob2);
    this.leaf = leaf; this.knob = knob;
    g.scene.add(this.pivot);
    // batente
    if (frameMat) {
      const fw = 0.06;
      if (axis === 'x') {
        g.world.box(fw, height + fw, 0.2, frameMat, x - width / 2 - fw / 2, 0, z, { collide: false });
        g.world.box(fw, height + fw, 0.2, frameMat, x + width / 2 + fw / 2, 0, z, { collide: false });
        g.world.box(width + fw * 2, fw, 0.2, frameMat, x, height, z, { collide: false });
      } else {
        g.world.box(0.2, height + fw, fw, frameMat, x, 0, z - width / 2 - fw / 2, { collide: false });
        g.world.box(0.2, height + fw, fw, frameMat, x, 0, z + width / 2 + fw / 2, { collide: false });
        g.world.box(0.2, fw, width + fw * 2, frameMat, x, height, z, { collide: false });
      }
    }
    this.mesh = this.pivot; this.tag(this.pivot);
    g.world.occluders.push(leaf);
    const hw = axis === 'x' ? width / 2 : 0.06, hd = axis === 'x' ? 0.06 : width / 2;
    this.collider = g.world.addCollider(x - hw, x + hw, z - hd, z + hd, { tag: 'door' });
    this.collider.locked = !!locked;
    this.center = new THREE.Vector3(x, 1, z);
    this.angle = 0; this.target = 0; this.isOpen = false;
    this.prompt = () => (this.locked ? `Abrir ${this.name}` : this.isOpen ? `Fechar ${this.name}` : `Abrir ${this.name}`);
    this.noise = 0;
  }
  setLocked(v) { this.locked = v; this.collider.locked = !!v; this.g.navDirty = true; }
  use() {
    const g = this.g;
    if (this.locked) {
      if (typeof this.locked === 'string' && g.inventory.has(this.locked)) {
        this.setLocked(false); g.audio.play('unlock', { pos: this.center });
        g.ui.toast(`Você usou: ${g.inventory.def(this.locked).name}`);
        if (this.onUnlock) this.onUnlock(g, this);
        return;
      }
      g.audio.play('locked', { pos: this.center });
      g.ui.toast(this.lockedMsg);
      if (this.onLocked) this.onLocked(g, this);
      return;
    }
    if (this.isOpen) this.close(); else this.open(g.player.pos);
    if (this.onUse) this.onUse(g, this);
  }
  open(fromPos, opts = {}) {
    if (this.isOpen && !opts.force) return;
    const away = this.axis === 'x' ? (fromPos.z > this.center.z ? 1 : -1) : (fromPos.x > this.center.x ? -1 : 1);
    this.target = 1.5 * away * this.hingeSide;
    this.isOpen = true;
    if (!opts.silent) { this.g.audio.play('creak', { pos: this.center, vol: 0.7, rate: 0.9 + Math.random() * 0.25 }); if (!opts.byEntity) this.g.noise(this.center.clone(), 5, 'door'); }
  }
  close(opts = {}) {
    if (!this.isOpen && !opts.force) return;
    this.target = 0; this.isOpen = false;
    this.closingSlam = !!opts.slam;
    if (!opts.silent) setTimeout(() => {
      this.g.audio.play(opts.slam ? 'slam' : 'doorClose', { pos: this.center, vol: opts.slam ? 1 : 0.6 });
      this.g.noise(this.center.clone(), opts.slam ? 14 : 5, 'door');
    }, opts.slam ? 120 : 380);
  }
  update(dt) {
    this.angle = damp(this.angle, this.target, this.closingSlam ? 14 : 4.2, dt);
    this.pivot.rotation.y = this.base + this.angle;
    this.collider.active = Math.abs(this.angle) < 0.4;
    if (this.collider.active && Math.abs(this.angle) < 0.4 && this.isOpen === false) {
      // empurra o jogador para fora se a porta fechar em cima dele
      const p = this.g.player.pos, c = this.collider;
      if (p.x > c.minX - 0.25 && p.x < c.maxX + 0.25 && p.z > c.minZ - 0.25 && p.z < c.maxZ + 0.25 && Math.abs(this.angle) > 0.05) this.target = this.angle > 0 ? 0.5 : -0.5;
    }
  }
}

// ---------------- Gaveta / armário com movimento ----------------
export class Drawer extends Interactable {
  constructor(g, o) {
    super(g, { ...o });
    this.group = o.group; this.axis = o.axis || new THREE.Vector3(0, 0, 1); this.dist = o.dist ?? 0.32;
    this.home = this.group.position.clone(); this.baseRotY = this.group.rotation.y; this.t = 0; this.target = 0; this.isOpen = false;
    this.locked = o.locked || false; this.lockedMsg = o.lockedMsg || 'Está trancada.';
    this.label = o.label || 'gaveta';
    this.rotary = o.rotary || false; // porta de armário girando
    this.prompt = () => (this.isOpen ? `Fechar ${this.label}` : `Abrir ${this.label}`);
    this.tag(this.group);
    this.mesh = this.group;
  }
  use() {
    const g = this.g;
    if (this.locked) {
      if (typeof this.locked === 'string' && g.inventory.has(this.locked)) {
        g.ui.toast(`Você usou: ${g.inventory.def(this.locked).name}`);
        this.locked = false; g.audio.play('unlock', { pos: this.worldPos() });
        if (this.onUnlock) this.onUnlock(g, this);
      } else { g.audio.play('locked', { pos: this.worldPos() }); g.ui.toast(this.lockedMsg); return; }
    }
    this.isOpen = !this.isOpen; this.target = this.isOpen ? 1 : 0;
    g.audio.play(this.rotary ? 'creak' : 'drawer', { pos: this.worldPos(), vol: 0.5 });
    g.noise(this.worldPos(), 2.5, 'interact');
    if (this.onUse) this.onUse(g, this);
  }
  update(dt) {
    this.t = damp(this.t, this.target, 8, dt);
    if (this.rotary) this.group.rotation.y = this.baseRotY + this.rotary * this.t * 1.6;
    else this.group.position.copy(this.home).addScaledVector(this.axis, this.dist * this.t);
  }
}

// ---------------- Sistema ----------------
export class InteractionSystem {
  constructor(g) {
    this.g = g; this.list = []; this.updatables = [];
    this.ray = new THREE.Raycaster(); this.ray.far = RANGE;
    this.focus = null; this.holdT = 0; this.holding = null;
  }
  add(i) { this.list.push(i); if (i.update) this.updatables.push(i); return i; }
  remove(i) { this.list = this.list.filter((x) => x !== i); this.updatables = this.updatables.filter((x) => x !== i); if (this.focus === i) this.focus = null; }
  get(id) { return this.list.find((i) => i.id === id); }

  update(dt) {
    const g = this.g;
    for (const u of this.updatables) u.update(dt);
    if (g.cinematic || g.hiding.active) { this.setFocus(null); this.holdT = 0; return; }
    // raycast do centro da tela (atualiza a câmera antes: sem isso a mira ficava um quadro atrasada)
    g.player.rig.updateMatrixWorld(true);
    this.ray.setFromCamera(new THREE.Vector2(0, 0), g.player.camera);
    const targets = [];
    for (const i of this.list) if (i.mesh && i.isEnabled() && i.mesh.visible !== false) targets.push(i.mesh);
    const hits = this.ray.intersectObjects([...targets, ...g.world.occluders], true);
    let found = null;
    for (const h of hits) {
      if (h.object.visible === false) continue;
      const it = h.object.userData.interactable;
      if (it && it.isEnabled()) { found = it; break; }
      if (g.world.occluders.includes(h.object)) break; // parede/porta na frente
    }
    this.setFocus(found);
    const inp = g.input;
    if (found) {
      if (found.hold > 0) {
        if (inp.key('interact')) {
          this.holdT += dt; g.ui.setHold(this.holdT / found.hold);
          if (found.whileHold) found.whileHold(g, found, this.holdT);
          if (this.holdT >= found.hold) { this.holdT = 0; g.ui.setHold(0); found.use(); }
        } else if (this.holdT > 0) { this.holdT = 0; g.ui.setHold(0); if (found.onCancel) found.onCancel(g, found); }
      } else if (inp.hit('interact')) found.use();
    } else if (this.holdT > 0) { this.holdT = 0; g.ui.setHold(0); }
  }
  setFocus(i) {
    if (this.focus === i) { if (i) this.g.ui.setPrompt(this.keyLabel() + ' ' + i.getPrompt(), i.hold > 0); return; }
    this.focus = i;
    this.g.ui.setPrompt(i ? this.keyLabel() + ' ' + i.getPrompt() : '', i?.hold > 0);
  }
  keyLabel() { return '[' + this.g.keyName('interact') + ']'; }
}
