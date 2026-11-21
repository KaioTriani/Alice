// O Homem de Preto: modelo, percepção (visão/audição) e máquina de estados.
// A entidade NÃO sabe onde o jogador está: ela vê, ouve, investiga e procura.
import * as THREE from 'three';
import { psx } from '../render/retro.js';
import { clamp, pick, rand } from '../core/events.js';

// O Homem de Preto: humanoide alto e magro sob uma capa preta pesada.
// Ombros marcados, leve corcunda para frente, braços longos dentro das mangas,
// dedos compridos e pálidos saindo das mangas, capuz fundo sem rosto e barra da capa rasgada.
// A frente do modelo aponta para -Z local (mesma convenção do yaw do jogo).
export function buildEntityModel(height = 2.35) {
  const s = height / 2.35;
  const grp = new THREE.Group();
  const cloth = psx(new THREE.MeshLambertMaterial({ color: 0x060505 }));
  const clothSide = psx(new THREE.MeshLambertMaterial({ color: 0x060505, side: THREE.DoubleSide }));
  const inner = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const skin = psx(new THREE.MeshLambertMaterial({ color: 0x6e6862 }));

  // manto inferior (da barra até a cintura)
  const prof = [[0.44, 0], [0.42, 0.2], [0.36, 0.6], [0.28, 1.0], [0.25, 1.15]];
  const robe = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 12, 0, Math.PI * 2), cloth);
  grp.add(robe);
  // barra rasgada: tiras soltas que balançam
  const strips = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.random() * 0.2, len = (0.18 + Math.random() * 0.22) * s;
    const geo = new THREE.PlaneGeometry(0.16 * s, len); geo.translate(0, -len / 2, 0);
    const st = new THREE.Mesh(geo, clothSide);
    const pivot = new THREE.Object3D(); pivot.position.set(Math.cos(a) * 0.43 * s, 0.16 * s, Math.sin(a) * 0.43 * s); pivot.rotation.y = -a + Math.PI / 2;
    pivot.add(st); grp.add(pivot); strips.push(pivot);
  }
  // parte de cima: corpo levemente curvado para frente
  const upper = new THREE.Group(); upper.position.y = 1.12 * s; upper.rotation.x = 0.14; grp.add(upper);
  const torsoProf = [[0.25, 0], [0.27, 0.25], [0.3, 0.5], [0.31, 0.62], [0.2, 0.72], [0.09, 0.78]];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProf.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 12), cloth);
  torso.scale.z = 0.72; upper.add(torso);
  // ombros ossudos
  for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 8, 6), cloth); sh.position.set(sx * 0.27 * s, 0.62 * s, 0); sh.scale.set(1.2, 0.8, 0.9); upper.add(sh); }
  // braços longos: manga de cima, manga de baixo alargando, mão pálida com dedos compridos
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Object3D(); shoulder.position.set(sx * 0.3 * s, 0.6 * s, 0); upper.add(shoulder);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * s, 0.085 * s, 0.48 * s, 8), cloth); up.position.y = -0.24 * s; shoulder.add(up);
    const elbow = new THREE.Object3D(); elbow.position.y = -0.48 * s; shoulder.add(elbow);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.085 * s, 0.16 * s, 0.46 * s, 8, 1, true), clothSide); low.position.y = -0.23 * s; elbow.add(low);
    const hand = new THREE.Object3D(); hand.position.y = -0.42 * s; elbow.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.11 * s, 0.035 * s), skin); palm.position.y = -0.04 * s; hand.add(palm);
    const fingers = [];
    for (let f = 0; f < 4; f++) {
      const fj = new THREE.Object3D(); fj.position.set((-0.022 + f * 0.015) * s, -0.09 * s, 0); hand.add(fj);
      const fl = (0.13 + (f === 1 || f === 2 ? 0.03 : 0)) * s;
      const fm = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.008 * s, fl, 4), skin); fm.position.y = -fl / 2; fj.add(fm);
      fj.rotation.x = -0.15 - Math.random() * 0.2; fingers.push(fj);
    }
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.008 * s, 0.08 * s, 4), skin); th.position.set(sx * -0.035 * s, -0.08 * s, -0.01 * s); th.rotation.z = sx * 0.5; hand.add(th);
    shoulder.rotation.z = sx * 0.08; shoulder.rotation.x = -0.05; elbow.rotation.x = -0.18;
    arms.push({ shoulder, elbow, hand, fingers, side: sx });
  }
  // pescoço e capuz fundo
  const head = new THREE.Object3D(); head.position.set(0, 0.8 * s, -0.05 * s); upper.add(head);
  // capuz em forma de capelo: um tubo fechado atrás que se projeta para a frente, com abertura funda
  const hoodProf = [[0.0, 0.0], [0.1, 0.02], [0.17, 0.08], [0.21, 0.18], [0.22, 0.28], [0.205, 0.36], [0.19, 0.38]];
  const hoodGeo = new THREE.LatheGeometry(hoodProf.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 14);
  const hood = new THREE.Mesh(hoodGeo, clothSide);
  const hoodGrp = new THREE.Group(); hoodGrp.position.set(0, 0.16 * s, 0.1 * s); hoodGrp.scale.set(0.95, 1.35, 1); head.add(hoodGrp);
  hood.rotation.x = -Math.PI / 2 + 0.32; hoodGrp.add(hood); // abertura para -Z, levemente inclinada para baixo
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.3 * s, 6), cloth); peak.position.set(0, 0.16 * s, 0.1 * s); peak.rotation.x = -1.25; hoodGrp.add(peak);
  // manto curto sobre os ombros: o capuz nasce da capa (silhueta contínua)
  const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * s, 0.4 * s, 0.42 * s, 12, 1, true), clothSide); mantle.position.set(0, -0.26 * s, 0.03 * s); mantle.scale.z = 0.8; head.add(mantle);
  // escuridão dentro do capuz: nenhum rosto, só vazio
  const voidBall = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 10, 8), inner); voidBall.position.set(0, -0.02 * s, -0.12 * s); hoodGrp.add(voidBall);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.18 * s, 14), inner); face.position.set(0, -0.05 * s, -0.3 * s); face.rotation.y = Math.PI; hoodGrp.add(face);
  // capa caindo dos ombros pelas costas
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * s, 1.5 * s, 1, 4), clothSide); cape.position.set(0, -0.08 * s, 0.24 * s); upper.add(cape);
  grp.userData = { hood: head, head, upper, arms, strips, cape };
  return grp;
}

const SPEED = { patrol: 0.95, investigate: 1.45, search: 1.1, chase: 3.55, check: 1.2, lose: 0.9 };

export class Entity {
  constructor(g) {
    this.g = g;
    this.model = buildEntityModel();
    this.model.visible = false;
    g.scene.add(this.model);
    this.pos = new THREE.Vector3(0, 0, 0); this.yaw = 0;
    this.state = 'dormant'; this.active = false; this.visible = false;
    this.zone = 'house';
    this.path = null; this.pathI = 0; this.repath = 0;
    this.awareness = 0; this.lastKnown = null; this.lostT = 0;
    this.searchT = 0; this.searchCenter = null; this.checkQueue = []; this.checking = null; this.checkT = 0;
    this.stateT = 0; this.sawHide = null; this.staggerT = 0;
    this.lookedAtT = 0; this.onLooked = null; this.lookLimit = 1.6;
    this.contactT = 0;
    this.ray = new THREE.Raycaster();
    this.patrolPoints = [];
    this.aggression = 1;
    this.debug = false;
    this.footAcc = 0;
  }

  get head() { return new THREE.Vector3(this.pos.x, this.pos.y + 2.0, this.pos.z); }

  // ---------------- controle de alto nível ----------------
  appear(x, z, yaw = 0, o = {}) {
    this.pos.set(x, o.y || 0, z); this.yaw = yaw;
    this.zone = this.g.world.zoneAt(x, z) || 'house';
    this.model.visible = true; this.visible = true;
    this.active = false; this.state = 'scripted';
    this.lookedAtT = 0; this.onLooked = o.onLooked || null; this.lookLimit = o.lookLimit ?? 1.6;
    this.facePlayer = o.facePlayer !== false;
    this.syncModel();
  }
  vanish() { this.g.status.seeingEntity = false; this.model.visible = false; this.visible = false; this.active = false; this.state = 'dormant'; this.path = null; this.onLooked = null; }

  // Ativa a IA de caça a partir de uma posição
  hunt(x, z, o = {}) {
    this.pos.set(x, 0, z); this.zone = this.g.world.zoneAt(x, z) || 'house';
    this.model.visible = true; this.visible = true; this.active = true;
    this.awareness = 0; this.sawHide = null; this.onLooked = null;
    this.aggression = o.aggression ?? 1;
    if (o.chase) { this.lastKnown = this.g.player.pos.clone(); this.setState('chase'); }
    else this.setState('patrol');
  }
  setState(s) {
    if (this.state === s) return;
    const prev = this.state;
    this.state = s; this.stateT = 0; this.path = null; this.repath = 0;
    if (s === 'search') { this.searchT = 0; this.searchCenter = (this.lastKnown || this.pos).clone(); this.buildCheckQueue(); }
    if (s === 'chase' && prev !== 'chase') { this.g.events.emit('chaseStart'); this.g.audio.play('stinger', { vol: 0.8 }); this.g.director?.onChase(); }
    if (prev === 'chase' && s !== 'chase') this.g.events.emit('chaseEnd');
  }
  stagger(t) { this.staggerT = t; this.setState('search'); this.lastKnown = this.g.player.pos.clone(); this.g.audio.play('swell', { pos: this.head, vol: 0.6 }); }

  nav() { return this.g.navs[this.zone]; }

  // ---------------- percepção ----------------
  losTo(p) {
    const from = this.head, dir = p.clone().sub(from), d = dir.length();
    this.ray.set(from, dir.normalize()); this.ray.far = d - 0.15;
    return this.ray.intersectObjects(this.g.world.occluders, false).length === 0;
  }
  canSeePlayer() {
    const g = this.g, p = g.player;
    if (!this.visible || g.hiding.active) return false;
    if (g.world.zoneAt(p.pos.x, p.pos.z) !== this.zone) return false;
    const eye = p.eyePos(), to = eye.clone().sub(this.head); const d = to.length();
    const lightLvl = g.lights.lightAt(eye) + (g.flashlight.on && g.flashlight.light.intensity > 0.5 ? 0.9 : 0);
    let range = (lightLvl > 0.9 ? 15 : lightLvl > 0.35 ? 11 : 6) * g.diff.sight;
    if (p.crouching) range *= 0.65;
    if (d > range) return false;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
    const cos = fwd.dot(flat);
    if (cos < 0.42 && d > 2.0) return false;
    return this.losTo(eye);
  }
  hear(pos, radius, type) {
    if (!this.active || this.state === 'chase' || this.staggerT > 0) return;
    if (this.g.world.zoneAt(pos.x, pos.z) !== this.zone) return;
    let d = pos.distanceTo(this.pos);
    if (!this.losTo(new THREE.Vector3(pos.x, 1.0, pos.z))) d *= 1.6; // abafado por paredes
    if (d > radius) return;
    const p = pos.clone(); p.x += rand(-0.8, 0.8); p.z += rand(-0.8, 0.8);
    this.lastKnown = p;
    if (type === 'gasp' || type === 'run' || d < radius * 0.5) this.awareness = Math.max(this.awareness, 0.35);
    if (this.state === 'check' || this.state === 'search') { if (type === 'gasp' || type === 'hide') { this.searchCenter = p.clone(); this.buildCheckQueue(); } }
    this.setState('investigate');
  }

  // ---------------- atualização ----------------
  update(dt) {
    const g = this.g;
    if (!this.visible) { this.lookedAtT = 0; g.status.seeingEntity = false; return; }
    this.animate(dt);
    this.updateLookedAt(dt);
    if (!this.active) { if (this.facePlayer && this.state === 'scripted') this.faceTowards(g.player.pos, dt * 0.6); this.syncModel(); return; }
    if (this.staggerT > 0) { this.staggerT -= dt; this.syncModel(); return; }
    this.stateT += dt;

    // visão
    const sees = this.canSeePlayer();
    if (sees) {
      const d = this.pos.distanceTo(g.player.pos);
      this.awareness = Math.min(1.2, this.awareness + dt * (0.5 + 2.2 * clamp(1 - d / 12, 0, 1)) * this.aggression * g.diff.sight);
      this.lastKnown = g.player.pos.clone(); this.lostT = 0;
      if (this.awareness >= 1 && this.state !== 'chase') this.setState('chase');
      else if (this.awareness > 0.4 && ['patrol', 'lose'].includes(this.state)) this.setState('investigate');
    } else {
      this.awareness = Math.max(0, this.awareness - dt * (this.state === 'chase' ? 0.05 : 0.12));
    }

    switch (this.state) {
      case 'patrol': this.doPatrol(dt); break;
      case 'investigate': this.doInvestigate(dt); break;
      case 'search': this.doSearch(dt); break;
      case 'check': this.doCheck(dt); break;
      case 'chase': this.doChase(dt, sees); break;
      case 'lose': this.doLose(dt); break;
      default: break;
    }
    this.syncModel();
  }

  doPatrol() {
    if (!this.path || this.pathI >= this.path.length) {
      // escolhe um ponto: às vezes guiado pelo diretor (sabe a área geral, não a posição exata)
      let target = null;
      const hint = this.g.director?.consumeHint();
      if (hint) target = this.nav().randomFreeNear(hint.x, hint.z, 3.5);
      if (!target && this.patrolPoints.length) {
        const far = this.patrolPoints.filter((q) => Math.hypot(q[0] - this.pos.x, q[1] - this.pos.z) > 3);
        target = pick(far.length ? far : this.patrolPoints);
      }
      if (target) this.goTo(target[0], target[1]);
      if (Math.random() < 0.5) this.pauseT = rand(1, 3);
    }
    if (this.pauseT > 0) { this.pauseT -= this.g.dt; this.yaw += Math.sin(this.g.time) * this.g.dt * 0.6; return; }
    this.follow(SPEED.patrol);
  }
  doInvestigate() {
    if (!this.lastKnown) { this.setState('patrol'); return; }
    if (!this.path) this.goTo(this.lastKnown.x, this.lastKnown.z);
    if (this.follow(SPEED.investigate * (0.9 + this.awareness * 0.4))) {
      // chegou: procura ao redor
      this.setState('search');
    }
    if (this.stateT > 14) this.setState('search');
  }
  buildCheckQueue() {
    const c = this.searchCenter || this.pos;
    this.checkQueue = this.g.hiding.spots
      .filter((s) => s.zone === this.zone && s.checkPos.distanceTo(new THREE.Vector3(c.x, 0, c.z)) < 7.5)
      .sort((a, b) => a.checkPos.distanceTo(c) - b.checkPos.distanceTo(c))
      .slice(0, 3);
    if (this.sawHide && !this.checkQueue.includes(this.sawHide)) this.checkQueue.unshift(this.sawHide);
  }
  doSearch(dt) {
    this.searchT += dt;
    while (this.checkQueue.length && !this.path) {
      const s = this.checkQueue.shift();
      if (!this.goTo(s.checkPos.x, s.checkPos.z)) continue; // sem caminho: ignora esse esconderijo
      this.checking = s;
      this.setStateKeep('check');
      return;
    }
    if (!this.path || this.pathI >= this.path.length) {
      const c = this.searchCenter || this.pos;
      const p = this.nav().randomFreeNear(c.x, c.z, 4.5);
      if (p) this.goTo(p[0], p[1]);
      this.pauseT = rand(0.8, 2.2);
    }
    if (this.pauseT > 0) { this.pauseT -= dt; this.yaw += Math.sin(this.g.time * 1.5) * dt * 1.2; }
    else this.follow(SPEED.search);
    if (this.searchT > 20) this.setState('lose');
  }
  setStateKeep(s) { this.state = s; this.stateT = 0; this.checkT = 0; }
  doCheck(dt) {
    const s = this.checking;
    if (!s) { this.state = 'search'; return; }
    if (this.path && this.pathI < this.path.length) { if (!this.follow(SPEED.check)) return; }
    if (this.pos.distanceTo(s.checkPos) > 0.9 && !s._decided) {
      // não chegou perto o bastante: tenta de novo ou desiste
      if (this.stateT > 8 || !this.goTo(s.checkPos.x, s.checkPos.z)) { this.checking = null; this.state = 'search'; this.path = null; }
      return;
    }
    // parado em frente ao esconderijo: escuta
    this.faceTowards(s.camPos, dt * 4);
    this.checkT += dt;
    const g = this.g;
    const playerHere = g.hiding.active === s;
    if (this.checkT > 1.4 && !s._decided) {
      s._decided = true;
      let evidence = (1 - s.safety) * 0.3 * g.diff.searchOpen + Math.random() * 0.2;
      if (this.sawHide === s) evidence += 1;
      if (playerHere) {
        const br = g.hiding.breathRadius();
        if (br > this.pos.distanceTo(s.camPos)) { evidence += 0.55; g.ui.toast('Ele ouviu sua respiração.'); }
      }
      this._open = evidence > 0.6 || (!playerHere && Math.random() < (1 - s.safety) * 0.6);
      if (this._open) {
        if (s.door) { s.door.isOpen = true; s.door.target = 1; }
        g.audio.play('creak', { pos: s.camPos, vol: 0.8 });
        if (playerHere && evidence > 0.6) { g.hiding.discovered(this); }
      }
    }
    if (this.checkT > (this._open ? 3.2 : 2.4)) {
      if (s.door && !g.hiding.active) { s.door.isOpen = false; s.door.target = 0; }
      s._decided = false; this._open = false; this.checking = null;
      if (this.sawHide === s) this.sawHide = null;
      this.state = 'search'; this.path = null;
    }
  }
  doChase(dt, sees) {
    const g = this.g;
    if (sees) this.lostT = 0; else this.lostT += dt;
    this.repath -= dt;
    const target = sees ? g.player.pos : this.lastKnown;
    if (this.repath <= 0 && target) { this.goTo(target.x, target.z); this.repath = sees ? 0.35 : 1.0; }
    // linha direta se perto e visível
    const d = this.pos.distanceTo(g.player.pos);
    if (sees && d < 2.5) this.moveDirect(g.player.pos, SPEED.chase * g.diff.chaseSpeed * this.aggression, dt);
    else this.follow(SPEED.chase * g.diff.chaseSpeed * this.aggression);
    // pegar
    if (sees && d < 1.0) { this.contactT += dt; if (this.contactT > 0.3) { this.contactT = 0; g.caught(); } }
    else this.contactT = 0;
    if (g.hiding.active && this.sawHide === null && !sees && this.lostT > 0.5) { this.setState('search'); }
    if (this.lostT > 2.8 || (!this.path && !sees)) { this.awareness = 0.5; this.setState('search'); }
    if (this.stateT > 45) this.setState('search');
  }
  doLose() {
    if (!this.path) { const p = this.patrolPoints.length ? pick(this.patrolPoints) : null; if (p) this.goTo(p[0], p[1]); }
    if (this.follow(SPEED.lose) || this.stateT > 10) { this.awareness = 0; this.setState('patrol'); this.g.director?.onLost(); }
  }

  // ---------------- navegação ----------------
  goTo(x, z) {
    const n = this.nav(); if (!n) return false;
    this.path = n.path(this.pos.x, this.pos.z, x, z); this.pathI = 1;
    if (!this.path) { this.path = null; return false; }
    return true;
  }
  // segue caminho; retorna true ao chegar
  follow(speed) {
    const dt = this.g.dt;
    if (!this.path) return true;
    if (this.pathI >= this.path.length) { this.path = null; return true; }
    const [tx, tz] = this.path[this.pathI];
    const to = new THREE.Vector3(tx - this.pos.x, 0, tz - this.pos.z);
    const d = to.length();
    this.openDoorsAhead();
    if (d < 0.15) { this.pathI++; return false; }
    const step = Math.min(d, speed * dt);
    this.pos.addScaledVector(to.normalize(), step);
    this.faceTowards(new THREE.Vector3(tx, 0, tz), dt * 6);
    this.stepSound(step, speed);
    return false;
  }
  moveDirect(p, speed, dt) {
    const to = new THREE.Vector3(p.x - this.pos.x, 0, p.z - this.pos.z), d = to.length();
    if (d < 0.6) return;
    const next = this.pos.clone().addScaledVector(to.normalize(), Math.min(d, speed * dt));
    if (this.nav().walkable(next.x, next.z)) this.pos.copy(next);
    this.faceTowards(p, dt * 8);
    this.stepSound(speed * dt, speed);
  }
  stepSound(step, speed) {
    this.footAcc += step;
    if (this.footAcc > (speed > 2 ? 0.95 : 0.8)) {
      this.footAcc = 0;
      const room = this.g.world.roomAt(this.pos.x, this.pos.z);
      this.g.audio.play('step', { surface: room?.surface || 'wood', pos: { x: this.pos.x, y: 0.1, z: this.pos.z }, vol: speed > 2 ? 0.9 : 0.55, rate: 0.8 });
    }
  }
  openDoorsAhead() {
    for (const d of this.g.doors) {
      if (d.isOpen || d.locked) continue;
      if (Math.hypot(d.center.x - this.pos.x, d.center.z - this.pos.z) < 1.15) {
        d.open(this.pos, { byEntity: true });
        if (this.state === 'chase') this.g.audio.play('slam', { pos: d.center, vol: 0.6 });
      }
    }
  }
  faceTowards(p, k) {
    const want = Math.atan2(-(p.x - this.pos.x), -(p.z - this.pos.z));
    let d = want - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, k);
  }

  // ---------------- aparência ----------------
  animate() {
    const t = this.g.time, u = this.model.userData;
    const moving = this.active && this.path;
    const walk = moving ? t * (this.state === 'chase' ? 7 : 3.2) : 0;
    // respiração lenta do tronco e cabeça que se inclina de repente, de vez em quando
    u.upper.scale.set(1, 1 + Math.sin(t * 1.1) * 0.012, 1);
    const twitch = Math.sin(t * 5.3 + this.pos.x) > 0.985 ? 0.45 : 0;
    u.head.rotation.z = Math.sin(t * 0.7) * 0.05 + twitch;
    u.head.rotation.x = Math.sin(t * 0.5) * 0.04 + 0.1;
    // braços pendurados balançando com o passo; dedos se mexendo devagar
    for (const a of u.arms) {
      a.shoulder.rotation.x = -0.05 + Math.sin(walk + (a.side > 0 ? 0 : Math.PI)) * (moving ? 0.22 : 0.02) + Math.sin(t * 0.8 + a.side) * 0.02;
      a.elbow.rotation.x = -0.18 - (this.state === 'chase' ? 0.35 : 0);
      a.fingers.forEach((f, i) => { f.rotation.x = -0.2 - Math.max(0, Math.sin(t * 1.7 + i * 0.9 + a.side)) * 0.25; });
    }
    // barra rasgada e capa balançando
    u.strips.forEach((st, i) => { st.rotation.x = Math.sin(t * 2.1 + i * 1.3 + walk) * (moving ? 0.35 : 0.08); });
    u.cape.rotation.x = 0.05 + Math.sin(t * 1.5 + walk * 0.5) * (moving ? 0.08 : 0.02);
  }
  syncModel() {
    const moving = this.active && this.path;
    this.model.position.set(this.pos.x, this.pos.y + (moving ? Math.abs(Math.sin(this.g.time * 3)) * 0.015 : 0), this.pos.z);
    this.model.rotation.y = this.yaw; // a frente (o vazio do capuz) aponta para onde ele olha
    this.model.rotation.z = Math.sin(this.g.time * 0.6) * 0.015;
  }
  // jogador olhando diretamente para a entidade
  updateLookedAt(dt) {
    const g = this.g, cam = g.player.camera;
    const head = this.head.clone().add(new THREE.Vector3(0, -0.4, 0));
    const to = head.clone().sub(cam.getWorldPosition(new THREE.Vector3()));
    const d = to.length();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const inView = fwd.dot(to.normalize()) > 0.86 && d < 22 && this.losTo(cam.getWorldPosition(new THREE.Vector3()));
    const roughlyVisible = fwd.dot(to) > 0.55 && d < 22;
    g.status.seeingEntity = roughlyVisible && this.visible && this.losTo(cam.getWorldPosition(new THREE.Vector3()));
    if (inView) {
      this.lookedAtT += dt;
      if (this.onLooked && this.lookedAtT > this.lookLimit) { const cb = this.onLooked; this.onLooked = null; cb(g, this); }
    } else this.lookedAtT = Math.max(0, this.lookedAtT - dt * 0.5);
  }
  say(speaker, text, o = {}) { return this.g.audio.say(speaker, text, { pos: this.head, ghost: true, ...o }); }
}
