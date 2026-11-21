// Diretor de terror: controla ritmo, eventos ambientes e alucinações.
// Ele conhece a área geral do jogador, mas a entidade depende da própria percepção.
import * as THREE from 'three';
import { pick, rand } from '../core/events.js';

export class Director {
  constructor(g) {
    this.g = g;
    this.tension = 0;            // 0..1, intensidade recente
    this.cool = 12;              // tempo até o próximo evento ambiente
    this.cooldowns = {};
    this.last = null;
    this.enabled = false;        // eventos ambientes ligados?
    this.level = 0;              // intensidade do ato (0..3)
    this.hint = null; this.hintT = 20; this.reliefT = 0;
    this.hunting = false;
    // sombra periférica (alucinação)
    const m = new THREE.MeshBasicMaterial({ color: 0x030303, transparent: true, opacity: 0.85 });
    this.shadow = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.2, 6), m); b.position.y = 0.6; this.shadow.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), m); h.position.y = 1.38; this.shadow.add(h);
    this.shadow.visible = false; g.scene.add(this.shadow);
    this.shadowT = 0;
  }

  onChase() { this.tension = 1; this.hint = null; }
  onLost() { this.reliefT = 30; }
  consumeHint() { const h = this.hint; this.hint = null; return h; }

  // inicia uma caçada: a entidade surge longe, fora da visão do jogador (nunca atrás dele)
  startHunt(o = {}) {
    const g = this.g, e = g.entity, p = g.player.pos;
    const zone = o.zone || 'house';
    const pts = (zone === 'basement' ? g.house.basementPatrol : g.house.patrol);
    e.patrolPoints = pts;
    let best = null, bestD = 0;
    for (const q of pts) {
      const d = Math.hypot(q[0] - p.x, q[1] - p.z);
      const hidden = !e.losTo.call({ head: new THREE.Vector3(q[0], 2, q[1]), ray: e.ray, g }, g.player.eyePos());
      if (d > 9 && hidden && d > bestD) { best = q; bestD = d; }
    }
    best = best || pts.reduce((a, q) => (Math.hypot(q[0] - p.x, q[1] - p.z) > Math.hypot(a[0] - p.x, a[1] - p.z) ? q : a), pts[0]);
    e.hunt(best[0], best[1], { aggression: o.aggression ?? 1 });
    this.hunting = true; this.hintT = o.firstHint ?? 18;
  }
  stopHunt() { this.hunting = false; this.g.entity.vanish(); }

  update(dt) {
    const g = this.g;
    this.tension = Math.max(0, this.tension - dt * 0.02);
    this.reliefT -= dt;
    for (const k in this.cooldowns) this.cooldowns[k] -= dt;
    // dicas de área para a entidade (estilo "menace gauge")
    if (this.hunting && g.entity.active && g.entity.state === 'patrol') {
      this.hintT -= dt;
      if (this.hintT <= 0) {
        this.hintT = rand(22, 38);
        if (this.reliefT <= 0 && this.tension < 0.5) {
          const room = g.world.roomAt(g.player.pos.x, g.player.pos.z);
          if (room) this.hint = { x: (room.minX + room.maxX) / 2, z: (room.minZ + room.maxZ) / 2 };
        }
      }
    }
    this.updateShadow(dt);
    // sinal de perigo: luzes do cômodo da entidade falham quando ela está perto ou caçando
    const e = g.entity;
    const danger = e.visible && e.active && (e.state === 'chase' || e.pos.distanceTo(g.player.pos) < 6);
    const eroom = danger ? g.world.roomAt(e.pos.x, e.pos.z) : null;
    if (this.dangerRoom && this.dangerRoom !== eroom) { this.dangerRoom.lights.forEach((f) => { f.flicker = 0; }); this.dangerRoom = null; }
    if (eroom && eroom !== this.dangerRoom) { eroom.lights.forEach((f) => { f.flicker = 0.7; }); this.dangerRoom = eroom; }
    if (!this.enabled || g.cinematic || !g.playing) return;
    this.cool -= dt;
    if (this.cool > 0) return;
    const stage = g.status.stage; // 0..4
    const intensity = this.level + stage * 0.6;
    // intervalo entre eventos: mais curto conforme o ato avança e a sanidade cai
    this.cool = Math.max(7, rand(16, 30) - intensity * 4) + (this.tension * 20);
    if (g.entity.state === 'chase') return;
    const pool = this.pool(stage);
    const options = pool.filter((e) => (this.cooldowns[e.id] || 0) <= 0 && e.id !== this.last && (!e.when || e.when()));
    if (!options.length) return;
    const ev = pick(options);
    this.last = ev.id; this.cooldowns[ev.id] = ev.cd || 60;
    ev.run();
  }

  pool(stage) {
    const g = this.g, a = g.audio, p = g.player, H = g.house;
    const inHouse = () => g.world.zoneAt(p.pos.x, p.pos.z) === 'house';
    const farPoint = (min = 6, max = 14) => {
      for (let i = 0; i < 20; i++) {
        const q = pick(H.patrol), d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z);
        if (d > min && d < max) return new THREE.Vector3(q[0], 0.1, q[1]);
      }
      return null;
    };
    const behind = (dist = 2) => { const f = p.forward(); return new THREE.Vector3(p.pos.x - f.x * dist, 1.4, p.pos.z - f.z * dist); };
    const ev = [
      // passos de alguém andando por outro cômodo (atravessam de um ponto a outro)
      { id: 'steps', cd: 35, when: inHouse, run: () => {
        const q = farPoint(5, 13), q2 = farPoint(5, 13); if (!q || !q2) return;
        const n = 7 + ((Math.random() * 5) | 0);
        for (let i = 0; i < n; i++) { const k = i / (n - 1); a.play('step', { surface: 'wood', vol: 0.55, delay: i * 0.58, pos: { x: q.x + (q2.x - q.x) * k, y: 0.1, z: q.z + (q2.z - q.z) * k }, rate: 0.85 }); }
      } },
      // respiração pesada bem no ouvido (sem ninguém ali)
      { id: 'breathEar', cd: 75, when: () => this.level >= 1 || stage >= 1, run: () => {
        const f = p.forward(), side = Math.random() < 0.5 ? 1 : -1;
        const ear = new THREE.Vector3(p.pos.x + f.z * 0.35 * side - f.x * 0.15, p.eye + p.pos.y, p.pos.z - f.x * 0.35 * side - f.z * 0.15);
        for (let i = 0; i < 3; i++) a.play('breathOne', { pos: ear, vol: 1.0, len: 1.5 - i * 0.1, peak: 0.55, delay: i * 1.6, occl: false, ref: 0.3 });
        g.status.addStress(25);
      } },
      // portas que abrem ou batem sozinhas
      { id: 'door', cd: 45, when: inHouse, run: () => this.doorSelf() },
      // crianças rindo e correndo em algum lugar da casa
      { id: 'kids', cd: 50, when: inHouse, run: () => {
        const q = farPoint(4, 12) || new THREE.Vector3(10.5, 0.1, 2);
        a.play('laugh', { pos: { x: q.x, y: 1.0, z: q.z }, vol: 0.6, pitch: 520 + Math.random() * 160 });
        if (Math.random() < 0.5) a.play('kidsRun', { pos: { x: q.x, y: 0.1, z: q.z }, count: 8, vol: 0.6, delay: 0.8 });
      } },
      { id: 'knock', cd: 80, when: inHouse, run: () => { const d = pick(g.doors.filter((x) => x.center.distanceTo(p.pos) > 5 && x.center.distanceTo(p.pos) < 14)); if (d) a.play('knock', { pos: d.center, count: 3, vol: 0.8 }); } },
      { id: 'creak', cd: 30, run: () => { const q = farPoint(3, 9); if (q) a.play('creak', { pos: q, vol: 0.45, rate: 0.8 }); } },
    ];
    if (stage >= 1) {
      ev.push({ id: 'whisper', cd: 40, run: () => a.play('whisper', { pos: behind(1.6), vol: 0.7, len: 1.4, bus: 'voice' }) });
      ev.push({ id: 'shadow', cd: 45, run: () => this.spawnShadow() });
    }
    if (stage >= 2) {
      ev.push({ id: 'falseSteps', cd: 60, run: () => { for (let i = 0; i < 4; i++) a.play('step', { surface: 'wood', vol: 0.55, delay: i * 0.55, pos: behind(2.5 - i * 0.3) }); } });
      ev.push({ id: 'flicker', cd: 50, run: () => { const r = g.world.roomAt(p.pos.x, p.pos.z); if (r) r.lights.forEach((f) => { f.flicker = 1; g.wait(2.5).then(() => { f.flicker = 0; }); }); g.flashlight.flicker = 1; } });
      ev.push({ id: 'voice', cd: 90, run: () => { const [s, t] = pick([['emily', 'Mamãe?'], ['thomas', 'Mamãe, cadê você?'], ['daniel', 'Alice...']]); a.say(s, t, { pos: behind(3), vol: 0.6, label: '...' }); } });
    }
    if (stage >= 3) {
      ev.push({ id: 'falseEntity', cd: 90, when: () => !g.entity.visible && inHouse(), run: () => this.falseSighting() });
      ev.push({ id: 'phone', cd: 120, when: inHouse, run: () => { a.play('phoneRingOnce', { pos: H.phonePos, vol: 0.8 }); } });
    }
    return ev;
  }

  // porta a alguns metros abre devagar ou bate com força, sozinha
  doorSelf() {
    const g = this.g, p = g.player.pos;
    const skip = new Set([g.house.doors.front, g.house.doors.white, g.house.doors.basement, g.house.doors.back, g.house.door04, g.house.longDoor]);
    const doors = g.doors.filter((d) => !skip.has(d) && d.pivot.visible && !d.locked && g.world.zoneAt(d.center.x, d.center.z) === 'house')
      .filter((d) => { const dist = Math.hypot(d.center.x - p.x, d.center.z - p.z); return dist > 2.2 && dist < 11; });
    const d = pick(doors); if (!d) return;
    if (d.isOpen) d.close({ slam: Math.random() < 0.45, force: true });
    else { const side = d.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)); d.open(side, { force: true, byEntity: true }); }
  }

  // sombra na visão periférica que some quando olhada
  spawnShadow() {
    const g = this.g, p = g.player;
    const side = Math.random() < 0.5 ? 1 : -1;
    const ang = p.yaw + side * rand(0.9, 1.25);
    for (let d = 5; d > 2; d -= 0.5) {
      const x = p.pos.x - Math.sin(ang) * d, z = p.pos.z - Math.cos(ang) * d;
      const nav = g.navs[g.world.zoneAt(p.pos.x, p.pos.z)];
      if (nav && nav.walkable(x, z)) {
        this.shadow.position.set(x, 0, z); this.shadow.visible = true; this.shadowT = 1.6;
        this.shadow.scale.setScalar(Math.random() < 0.5 ? 1 : 1.5);
        return;
      }
    }
  }
  updateShadow(dt) {
    if (!this.shadow.visible) return;
    this.shadowT -= dt;
    const cam = this.g.player.camera;
    const to = this.shadow.position.clone().add(new THREE.Vector3(0, 1, 0)).sub(cam.getWorldPosition(new THREE.Vector3())).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    if (fwd.dot(to) > 0.8 || this.shadowT <= 0) { this.shadow.visible = false; if (fwd.dot(to) > 0.8) this.g.audio.play('whisper', { pos: this.shadow.position, vol: 0.4, len: 0.6 }); }
  }
  // falsa aparição da entidade em uma porta distante
  falseSighting() {
    const g = this.g, p = g.player.pos;
    const spots = [[0.7, 5.0], [15.3, 5.0], [8.0, 7.0], [3.0, 7.0]];
    const s = spots.filter((q) => Math.hypot(q[0] - p.x, q[1] - p.z) > 7);
    if (!s.length) return;
    const q = pick(s);
    g.entity.appear(q[0], q[1], 0, { onLooked: (gg, e) => { e.vanish(); gg.lights.flickerAll = 0.8; gg.wait(0.9).then(() => { gg.lights.flickerAll = 0; }); gg.status.shock(3); }, lookLimit: 0.6 });
    g.wait(7).then(() => { if (g.entity.state === 'scripted' && !g.entity.active && !g.cinematic) g.entity.vanish(); });
  }
}
