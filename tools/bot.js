// Jogador automático para testes: anda com as teclas, mira com a câmera e aperta E,
// exatamente como um jogador. Registra tudo o que der errado.
// Uso no console: const { Bot } = await import('/tools/bot.js'); const bot = new Bot(); ...
import * as THREE from 'three';
import { NavGrid } from '../src/world/nav.js';

export class Bot {
  constructor() {
    this.log = []; this.issues = []; this.prompts = new Set(); this.navs = {};
  }
  get g() { return window.__alice; }
  note(msg) { this.log.push(`[${this.g.stageId}] ${msg}`); }
  issue(msg) { this.issues.push(`[${this.g.stageId}] ${msg}`); this.note('PROBLEMA: ' + msg); }

  nav(zone) {
    const g = this.g;
    if (zone === 'house' || zone === 'basement') return g.navs[zone];
    if (!this.navs[zone] || this.navs[zone].world !== g.world) {
      const z = g.world.zones.find((q) => q.name === zone);
      this.navs[zone] = new NavGrid(g.world, z.minX, z.maxX, z.minZ, z.maxZ, 0.2);
    }
    return this.navs[zone];
  }
  async tick(n = 1) { await this.g.step(n / 20, 20); this.track(); }
  track() { const p = this.g.interact.focus; if (p) this.prompts.add(p.getPrompt()); }
  async wait(sec) { await this.g.step(sec, 20); this.track(); }
  async waitFor(fn, maxSec, label) {
    for (let t = 0; t < maxSec; t += 0.5) { if (fn()) return true; await this.g.step(0.5, 20); this.track(); if (this.g.dead) { this.issue(`morreu esperando: ${label}`); return false; } }
    this.issue(`tempo esgotado esperando: ${label}`); return false;
  }

  // olha para um ponto (instantâneo, como mover o mouse)
  lookAt(p) {
    const P = this.g.player, e = P.eyePos();
    P.yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z));
    P.pitch = Math.atan2(p.y - e.y, Math.hypot(p.x - e.x, p.z - e.z));
  }
  center(obj) {
    const b = new THREE.Box3().setFromObject(obj); return b.isEmpty() ? obj.getWorldPosition(new THREE.Vector3()) : b.getCenter(new THREE.Vector3());
  }

  // anda até (x, z) pelas teclas W, abrindo portas pelo caminho
  async walkTo(x, z, opts = {}) {
    const g = this.g, P = g.player, inp = g.input;
    const zone = g.world.zoneAt(P.pos.x, P.pos.z);
    const nav = this.nav(zone);
    let path = nav && nav.path(P.pos.x, P.pos.z, x, z);
    if (!path && nav) {
      // a grade do bot é mais grossa que a colisão real: tenta sair do aperto andando reto até o ponto livre mais próximo
      const near = nav.randomFreeNear(P.pos.x, P.pos.z, 1.2, 60);
      if (near) { const p2 = nav.path(near[0], near[1], x, z); if (p2) path = [[P.pos.x, P.pos.z], ...p2]; }
    }
    if (!path) { this.issue(`sem caminho de (${P.pos.x.toFixed(1)},${P.pos.z.toFixed(1)}) até (${x},${z}) na zona ${zone}`); return false; }
    const key = opts.run ? ['KeyW', 'ShiftLeft'] : ['KeyW'];
    let i = 1, stuckT = 0, last = P.pos.clone(), t = 0;
    while (i < path.length) {
      if (g.dead || g.stageId !== (opts.stage || g.stageId)) break;
      const [tx, tz] = path[i];
      const d = Math.hypot(tx - P.pos.x, tz - P.pos.z);
      if (d < (i === path.length - 1 ? 0.25 : 0.35)) { i++; continue; }
      await this.openDoorAhead(tx, tz);
      P.yaw = Math.atan2(-(tx - P.pos.x), -(tz - P.pos.z)); P.pitch = 0;
      key.forEach((k) => inp.down.add(k));
      await g.step(0.1, 20);
      t += 0.1;
      if (P.pos.distanceTo(last) < 0.02) stuckT += 0.1; else { stuckT = 0; last.copy(P.pos); }
      if (stuckT > 2.5) { key.forEach((k) => inp.down.delete(k)); this.issue(`travou andando perto de (${P.pos.x.toFixed(2)}, ${P.pos.z.toFixed(2)}) indo para (${tx.toFixed(2)}, ${tz.toFixed(2)})`); return false; }
      if (t > 60) break;
      if (P.moveLocked || g.cinematic) { key.forEach((k) => inp.down.delete(k)); await this.wait(0.5); }
    }
    key.forEach((k) => inp.down.delete(k));
    await g.step(0.15, 20);
    return true;
  }
  async openDoorAhead(tx, tz) {
    const g = this.g, P = g.player;
    for (const d of g.doors) {
      if (d.isOpen || !d.pivot.visible) continue;
      const dc = d.center, dist = Math.hypot(dc.x - P.pos.x, dc.z - P.pos.z);
      const toT = Math.hypot(tx - P.pos.x, tz - P.pos.z);
      if (dist < 1.4 && Math.hypot(dc.x - tx, dc.z - tz) < toT + 0.6) {
        this.lookAt(new THREE.Vector3(dc.x, 1.1, dc.z));
        await g.step(0.05, 20);
        if (g.interact.focus !== d) { this.issue(`porta "${d.name}" não ficou em foco a ${dist.toFixed(2)} m (foco: ${g.interact.focus ? g.interact.focus.getPrompt() : 'nada'})`); }
        await this.press();
        if (d.locked) { this.note(`porta trancada: ${d.name}`); return; }
        await this.wait(0.6);
      }
    }
  }
  async press(code = 'KeyE') { this.g.input.pressed.add(code); await this.g.step(0.05, 20); this.track(); }
  async hold(sec, code = 'KeyE') { this.g.input.down.add(code); await this.g.step(sec + 0.25, 20); this.g.input.down.delete(code); await this.g.step(0.1, 20); }

  // vai até um objeto e interage com ele pela mira, como o jogador
  async use(target, opts = {}) {
    const g = this.g;
    const it = typeof target === 'string' ? g.interact.get(target) : target;
    if (!it) { this.issue(`interação inexistente: ${target}`); return false; }
    const obj = it.mesh;
    const c = this.center(obj);
    this._target = obj;
    const stand = opts.from || this.standPoint(c, opts.dist ?? 1.1);
    if (stand) await this.walkTo(stand[0], stand[1], opts);
    this.lookAt(opts.aim || c);
    await g.step(0.05, 20);
    let f = g.interact.focus;
    if (f !== it) {
      // tenta mirar em pontos ao redor do centro (como um jogador ajustando a mira)
      for (const [dx, dy] of [[0, 0.1], [0, -0.1], [0.1, 0], [-0.1, 0], [0, 0.2], [0, -0.2]]) {
        this.lookAt(new THREE.Vector3(c.x + dx, c.y + dy, c.z + dx)); await g.step(0.05, 20); f = g.interact.focus; if (f === it) break;
      }
    }
    if (f !== it) { this.issue(`não consegui mirar em "${it.id || it.getPrompt()}" (foco: ${f ? f.getPrompt() : 'nada'}, distância ${g.player.eyePos().distanceTo(c).toFixed(2)} m)`); return false; }
    this.note(`[E] ${it.getPrompt()}`);
    if (it.hold > 0) await this.hold(it.hold); else await this.press();
    return true;
  }
  // ponto livre a ~dist do objeto, do lado de onde o jogador está
  standPoint(c, dist) {
    const g = this.g, P = g.player.pos;
    const zone = g.world.zoneAt(c.x, c.z) || g.world.zoneAt(P.x, P.z);
    const nav = this.nav(zone); if (!nav) return null;
    let best = null, bd = 1e9;
    for (let a = 0; a < 16; a++) for (const r of [dist, dist * 0.75, dist * 1.3]) {
      const x = c.x + Math.cos(a / 16 * Math.PI * 2) * r, z = c.z + Math.sin(a / 16 * Math.PI * 2) * r;
      if (!nav.walkable(x, z)) continue;
      // precisa enxergar o objeto dali (sem parede no meio)
      const eye = new THREE.Vector3(x, 1.5, z), dir = c.clone().sub(eye), len = dir.length();
      const ray = new THREE.Raycaster(eye, dir.normalize(), 0, len - 0.15);
      const own = this._target ? new Set() : null;
      if (this._target) this._target.traverse((o) => own.add(o));
      if (ray.intersectObjects(g.world.occluders, false).some((h) => !own || !own.has(h.object))) continue;
      const path = nav.path(P.x, P.z, x, z); if (!path) continue;
      const d = Math.hypot(x - P.x, z - P.z);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    return best;
  }
  async closeDocs() { let n = 0; while (this.g.ui.open === 'doc' && n++ < 8) { if (this.g.ui.docState && this.g.ui.docState.i < this.g.ui.docState.pages.length - 1) { this.g.input.pressed.add('ArrowRight'); await this.g.step(0.05, 20); continue; } await this.press(); } }
  objective() { const t = this.g.tasks.current; return t ? `${t.title}: ${t.steps.filter((s) => !s.hidden).map((s) => (s.done ? '[x] ' : '[ ] ') + s.text).join(' | ')}` : '(sem objetivo)'; }
  report() { return { issues: this.issues, prompts: [...this.prompts], log: this.log.slice(-60) }; }
}
