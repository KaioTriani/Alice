// Campanha completa de ALICE: tarefas, eventos roteirizados, puzzles e checkpoints.
import * as THREE from 'three';
import { Interactable, Drawer } from './interact.js';
import { mat, basic } from '../world/builder.js';
import { Tex } from '../render/textures.js';
import { buildEntityModel } from './entity.js';
import { Models } from './models.js';

const PI = Math.PI;

// ----------------------------------------------------------------- tarefas
export class Tasks {
  constructor(g) { this.g = g; this.current = null; }
  set(title, steps = [], head = 'OBJETIVO ATUAL') {
    this.current = { title, head, steps: steps.map(([id, text, hidden]) => ({ id, text, done: false, hidden: !!hidden })) };
    this.g.ui.objective(this.current);
    this.g.audio.play('paper', { vol: 0.2 });
  }
  step(id) { return this.current?.steps.find((s) => s.id === id); }
  done(id) { const s = this.step(id); if (s && !s.done) { s.done = true; s.hidden = false; this.g.ui.objective(this.current); } }
  show(id) { const s = this.step(id); if (s && s.hidden) { s.hidden = false; this.g.ui.objective(this.current); } }
  text(id, t) { const s = this.step(id); if (s && s.text !== t) { s.text = t; this.g.ui.objective(this.current, false); } }
  isDone(id) { return !!this.step(id)?.done; }
  clear() { this.current = null; this.g.ui.objective(null); }
}

// ----------------------------------------------------------------- história
export class Story {
  constructor(g) {
    this.g = g;
    this.sanityFloor = 0; this.sanityCeil = 100;
    this.tweens = [];
    this.loops = {};
    this.index = 0;
    this.stages = [
      { id: 'prologue', cp: true, spawn: [3.55, 1.3, 2.9], run: () => this.prologue() },
      { id: 'breakfast', run: () => this.breakfast() },
      { id: 'kidsroom', run: () => this.kidsRoom() },
      { id: 'search', run: () => this.search(), after: () => this.afterSearch() },
      { id: 'routine', cp: true, spawn: [8.6, 5.0, PI / 2], run: () => this.routine(), after: () => { const H = this.g.house; H.dirtyDishes.visible = false; H.plants.forEach((p) => { p.watered = true; p.setGrowth(1); }); } },
      { id: 'act2', cp: true, spawn: [12.2, 10.4, 0], before: () => this.moodAct2(), run: () => this.act2(), after: () => this.afterAct2() },
      { id: 'wet', run: () => this.wet(), after: () => this.afterWet() },
      { id: 'mirror', cp: true, spawn: [2.5, 3.2, PI], before: () => this.moodAct2(), run: () => this.mirror(), after: () => { this.g.house.mirrorSmudge.visible = false; } },
      { id: 'dinner', run: () => this.dinner(), after: () => this.afterDinner() },
      { id: 'act3', cp: true, spawn: [8.6, 5.0, PI / 2], before: () => this.moodAct3(), run: () => this.act3() },
      { id: 'chase', cp: true, spawn: [11.0, 5.0, PI / 2], before: () => this.moodAct3(), run: () => this.chase() },
      { id: 'act4', cp: true, spawn: [6.6, 2.4, PI], before: () => this.moodAct4(), run: () => this.act4(), after: () => this.afterAct4() },
      { id: 'puzzle', cp: true, spawn: [2.6, 7.4, PI], before: () => this.moodAct4(), run: () => this.puzzle() },
      { id: 'act5', cp: true, spawn: [0.8, 61.5, -PI / 2], before: () => this.moodAct5(), run: () => this.act5() },
      { id: 'final', run: () => this.final() },
    ];
  }

  // ------------------------------------------------------------- utilidades
  get f() { return this.g.flags; }
  wait(s) { return this.g.wait(s); }
  until(fn, timeout = 0) { return this.g.until(fn, timeout); }
  async say(sp, text, o = {}) { if (this.skipping) return; const d = this.g.audio.say(sp, text, o); await this.wait((o.hold ?? d) * (o.k ?? 1)); }
  inRoom(name) { const p = this.g.player.pos; const r = this.g.world.roomAt(p.x, p.z); return !!r && r.name === name; }
  obj(title, steps, head) { this.g.tasks.set(title, steps, head); }
  done(id) { this.g.tasks.done(id); }
  tween(fn, dur) { return new Promise((res) => this.tweens.push({ fn, dur, t: 0, res })); }
  behind(d = 2) { const p = this.g.player, fw = p.forward(); return new THREE.Vector3(p.pos.x - fw.x * d, 1.4, p.pos.z - fw.z * d); }

  // ------------------------------------------------------------- execução
  async runFrom(i, fromLoad) {
    const g = this.g;
    for (let k = i; k < this.stages.length; k++) {
      this.index = k;
      const st = this.stages[k];
      g.stageId = st.id;
      if (st.before) st.before();
      if (st.cp) g.saveCheckpoint(st.id);
      if (fromLoad && k === i && st.spawn) g.player.teleport(st.spawn[0], st.spawn[1], st.spawn[2]);
      await st.run();
      if (st.after) st.after();
    }
  }
  // aplica o estado permanente das etapas concluídas (ao carregar um checkpoint)
  applyUpTo(i) { for (let k = 0; k < i; k++) { const st = this.stages[k]; if (st.before) st.before(); if (st.after) st.after(); } }
  indexOf(id) { return Math.max(0, this.stages.findIndex((s) => s.id === id)); }

  update(dt) {
    const g = this.g;
    for (const tw of [...this.tweens]) {
      tw.t += dt; const k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.res(); }
    }
    // televisores
    for (const tv of [g.house.tvLiving, g.house.tvKids, g.house.tv04]) this.drawTV(tv);
    // janela da porta branca
    if (g.house.doors.white.pivot.visible) {
      const c = g.house.whiteWindowCanvas, x = c.getContext('2d');
      x.fillStyle = '#e4e8e4'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#c8ccc8'; x.fillRect(0, 20, 32, 12);
      const px = ((g.time * 6) % 50) - 10;
      if (Math.sin(g.time * 0.4) > 0.6) { x.fillStyle = '#7a8a9a'; x.fillRect(px, 8, 6, 16); x.beginPath(); x.arc(px + 3, 6, 3, 0, 7); x.fill(); }
      g.house.whiteWindowTex.needsUpdate = true;
    }
    this.updatePour(dt);
    // segurar E durante a abertura desenhada pula a animação
    if (this.skippable && !this.skipping) {
      this.skipHold = g.input.key('interact') ? this.skipHold + dt : Math.max(0, this.skipHold - dt * 2);
      g.ui.skipHint(this.skipHold / 1.2, g.keyName('interact'));
      if (this.skipHold >= 1.2) {
        this.skipping = true; g.storyT = 39.6; g.ui.skipHint(-1);
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        document.getElementById('subtitles').innerHTML = '';
      }
    }
    // quintal: balanço que se move sozinho e ambiente externo
    if (g.house.swing) g.house.swing.rotation.x = Math.sin(g.time * 1.7) * (this.f.night ? 0.12 : 0.45);
    if (g.house.sheets) g.house.sheets.forEach((sh, i) => { sh.rotation.x = Math.sin(g.time * 1.3 + i) * 0.12; });
    const zone = g.world.zoneAt(g.player.pos.x, g.player.pos.z);
    if (zone === 'yard' && !this.loops.yard) {
      this.loops.yard = [g.audio.loop('wind', { vol: 0.5 })];
      if (!this.f.night) this.loops.yard.push(g.audio.loop('birds', { vol: 0.6 }));
      if (!this.f.yardIntro) { this.f.yardIntro = true; g.audio.play('creak', { pos: { x: 2, y: 2, z: 20 }, vol: 0.6, rate: 0.7 }); }
    } else if (zone !== 'yard' && this.loops.yard) { this.loops.yard.forEach((l) => l.stop(1)); this.loops.yard = null; }
    // cochichos de gente na neblina, além da cerca
    if (zone === 'yard') {
      this.whisperT = (this.whisperT ?? 6) - dt;
      if (this.whisperT <= 0) {
        this.whisperT = 7 + Math.random() * 12;
        const n = 1 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * PI, x = 8 + Math.cos(a) * 20, z = 19 + Math.sin(a) * 14 + 4;
          g.audio.play('whisper', { pos: { x, y: 1.6, z }, vol: 0.9, len: 1.2 + Math.random() * 1.5, delay: i * 0.4, bus: 'voice', occl: false, ref: 4 });
        }
      }
    }
    // contador de brinquedos
    if (this.f.toysTask) {
      const have = g.inventory.count('toy') + (this.f.toysStored || 0);
      // dica: depois de um tempo sem achar, uma risadinha perto do brinquedo que falta
      this.toyHintT = (this.toyHintT || 0) + dt;
      if (have < 4 && this.toyHintT > 45) {
        this.toyHintT = 0;
        const left = this.toySpots.filter((t) => !g.collected.has(t.id));
        const p = g.player.pos, t = left.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        if (t) { const room = g.world.roomAt(t.x, t.z); g.audio.play('laugh', { pos: { x: t.x, y: 0.6, z: t.z }, vol: 0.5, pitch: 640 }); const where = { hall: 'do corredor', living: 'da sala', dining: 'da sala de jantar', kitchen: 'da cozinha' }[room?.name] || 'de algum lugar perto'; g.ui.toast(`Uma risadinha vem ${where}.`, 3.5); }
      }
      g.tasks.text('toys', `Junte os brinquedos espalhados (${Math.min(4, have)}/4)`);
      if (have >= 4) g.tasks.done('toys');
    }
    // visita de cômodos durante a busca
    if (this.f.searching) {
      const p = g.player.pos, r = g.world.roomAt(p.x, p.z);
      if (r && ['living', 'bath', 'laundry'].includes(r.name)) {
        if (!g.tasks.isDone(r.name)) { g.tasks.done(r.name); this.onSearchRoom(r.name); }
      }
    }
  }

  drawTV(tv) {
    if (!tv || tv.mode === 'off') return;
    const c = tv.tex.userData.canvas, x = c.getContext('2d');
    if (tv.mode === 'static') {
      const img = x.createImageData(64, 48);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0);
    } else if (tv.mode === 'image' && tv.img) {
      x.drawImage(tv.img, 0, 0, 64, 48);
      for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.2})`; x.fillRect(Math.random() * 64, Math.random() * 48, 2, 1); }
    }
    tv.tex.needsUpdate = true;
  }
  setTV(tv, mode, img = null) {
    const g = this.g;
    tv.mode = mode; tv.img = img;
    tv.screen.material.color.set(mode === 'off' ? 0x000000 : 0xffffff);
    if (tv.loop) { tv.loop.stop(0.2); tv.loop = null; }
    if (mode === 'static') tv.loop = g.audio.loop('static', { pos: tv.pos, vol: 0.5, bus: 'sfx' });
    if (mode !== 'off') g.audio.play('tvOn', { pos: tv.pos, vol: 0.5 });
    if (mode === 'off') { const x = tv.tex.userData.canvas.getContext('2d'); x.fillStyle = '#050605'; x.fillRect(0, 0, 64, 48); tv.tex.needsUpdate = true; }
  }

  // ------------------------------------------------------------- interações da campanha
  setup() {
    const g = this.g, H = g.house, I = (o) => g.interact.add(new Interactable(g, o)), F = this.f;
    const S = g.scene;
    this.pickups = {};
    const hitM = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const pickup = (id, mesh, item, o = {}) => {
      // área de interação mínima de ~28 cm: itens pequenos (chave, pilha, relógio) ficam fáceis de mirar
      mesh.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(mesh), size = box.getSize(new THREE.Vector3());
      if (Math.max(size.x, size.y, size.z) < 0.3) {
        const s = mesh.scale.x || 1;
        const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, 0.28) / s, Math.max(size.y, 0.18) / s, Math.max(size.z, 0.28) / s), hitM);
        const c = box.getCenter(new THREE.Vector3()); mesh.worldToLocal(c); hit.position.copy(c);
        mesh.add(hit);
      }
      const it = I({ id, mesh, prompt: o.prompt || `Pegar ${g.inventory.def(item).name.toLowerCase()}`, enabled: o.when || true,
        onUse: () => {
          g.inventory.add(item, o.n || 1); if (mesh.parent) mesh.parent.remove(mesh); g.collected.add(id); it.remove();
          if (o.after) o.after(g);
        } });
      this.pickups[id] = { it, mesh };
      return it;
    };
    // ---------- objetos pequenos
    const battery = (x, y, z, parent) => { const m = Models.battery(); m.position.set(x, y + 0.03, z); m.rotation.y = x * 7; (parent || S).add(m); return m; };
    const diff = g.settings.difficulty;
    const batts = [
      ['bat_alice', 0.75, 0.55, 0.28], ['bat_basement', 32.5, 0.9, 4.0], ['bat_laundry', 14.75, 1.63, 0.25],
      ['bat_living', 0.8, 1.78, 6.3], ['bat_phone', 8.85, 0.75, 4.27],
    ];
    const keep = diff === 'hard' ? 3 : diff === 'easy' ? 5 : 4;
    batts.slice(0, keep).forEach(([id, x, y, z]) => pickup(id, battery(x, y, z), 'battery'));
    // lanterna + pilha na gaveta da cozinha
    const kd = H.kitchenDrawer.group;
    const fl = Models.flashlight(); fl.position.set(-0.06, -0.035, -0.16); fl.rotation.y = 0.3; kd.add(fl);
    pickup('flashlight', fl, 'flashlight', { when: () => H.kitchenDrawer.isOpen, after: () => { g.flashlight.owned = true; g.ui.toast(`[${g.keyName('flashlight')}] liga e desliga a lanterna.`, 4); } });
    pickup('bat_kitchen', battery(0.12, -0.05, -0.15, kd), 'battery', { when: () => H.kitchenDrawer.isOpen });
    // tesoura na gaveta da lavanderia
    const ld = H.laundryDrawer.group;
    const sc = Models.scissors(); sc.position.set(0, -0.058, -0.15); sc.rotation.y = 0.5; ld.add(sc);
    pickup('scissors', sc, 'scissors', { when: () => H.laundryDrawer.isOpen });
    // livro na gaveta da penteadeira
    const vd = H.vanity.group;
    const bk = Models.book(); bk.position.set(0, -0.06, -0.16); bk.rotation.y = PI / 2 + 0.1; vd.add(bk);
    pickup('book', bk, 'book', { prompt: 'Pegar o livro', when: () => H.vanity.isOpen, after: () => { F.gotBook = true; g.ui.showDoc(g.docs.book); g.status.ground(4); } });
    // brinquedos
    const toyCols = [0xc03030, 0x3050c0, 0xe0b020, 0x30a050];
    // brinquedos em lugares visíveis (corredor, entrada da sala, sala, sala de jantar), um pouco maiores
    this.toySpots = [];
    [[9.3, 5.5], [2.4, 7.3], [4.7, 7.0], [9.0, 7.4]].forEach(([x, z], i) => {
      const m = [Models.toyCar(toyCols[0]), Models.ball(toyCols[1]), Models.block(toyCols[2], 'E'), Models.teddy(0xe8c8a8)][i];
      m.position.set(x, 0, z); m.rotation.y = i; m.scale.setScalar(1.4); S.add(m);
      this.toySpots.push({ id: 'toy' + i, x, z });
      pickup('toy' + i, m, 'toy', { prompt: 'Pegar brinquedo', after: () => {
        this.toyHintT = 0; const left = 4 - g.inventory.count('toy') - (F.toysStored || 0);
        if (left > 0) g.ui.toast(left === 1 ? 'Falta um brinquedo.' : `Faltam ${left} brinquedos.`, 2.5);
      } });
    });
    I({ id: 'chest', mesh: H.chest, prompt: () => (g.inventory.has('toy') ? 'Guardar os brinquedos no baú' : 'Baú de brinquedos'), onUse: () => {
      const n = g.inventory.count('toy');
      if (!n) { g.ui.toast('O baú está quase vazio.'); return; }
      g.inventory.take('toy', n); F.toysStored = (F.toysStored || 0) + n; g.audio.play('thump', { pos: H.chest.position, vol: 0.4 });
      g.ui.toast(n > 1 ? 'Brinquedos guardados.' : 'Brinquedo guardado.'); g.status.ground(2);
      if (F.toysStored >= 4) { g.tasks.done('chest'); F.toysDone = true; }
    } });
    // ---------- café da manhã
    pickup('bread', H.breadMesh, 'bread', { when: () => F.breakfast, after: () => this.done('bread') });
    I({ id: 'coffee', mesh: H.coffee, hold: 3, prompt: 'Fazer o café (segure)', enabled: () => F.breakfast && !F.coffeeDone,
      whileHold: (gg, it, t) => { if (!it._snd || t < 0.1) { it._snd = true; gg.audio.play('coffee', { pos: H.coffee.position, vol: 0.6 }); } },
      onCancel: (gg, it) => { it._snd = false; },
      onUse: () => { F.coffeeDone = true; this.done('coffee'); g.ui.toast('O cheiro de café enche a cozinha.'); g.status.ground(3); } });
    I({ id: 'plates', mesh: H.sideboard, prompt: 'Pegar os pratos', enabled: () => (F.breakfast || F.dinnerPrep) && !g.inventory.has('plates') && !F.tableSet,
      onUse: () => { g.inventory.add('plates'); this.done('plates'); g.audio.play('cutlery', { pos: H.sideboard.position, vol: 0.4 }); } });
    const tableMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.6), basic(0x000000, { transparent: true, opacity: 0 }));
    tableMesh.position.set(8, 0.75, 10); S.add(tableMesh);
    I({ id: 'table', mesh: tableMesh,
      prompt: () => (!F.tableSet ? 'Pôr a mesa' : F.dinnerPrep ? 'Chamar a família' : 'Chamar as crianças'),
      enabled: () => (F.breakfast || F.dinnerPrep) && !F.called,
      onUse: () => {
        if (!F.tableSet) {
          if (!g.inventory.has('plates')) { g.ui.toast('Faltam os pratos. Ficam no aparador.'); return; }
          if (F.breakfast && !g.inventory.has('bread')) { g.ui.toast('Falta o pão.'); return; }
          g.inventory.take('plates'); if (F.breakfast) { g.inventory.take('bread'); H.tableBread.visible = true; }
          H.tablePlates.visible = true; H.tableCups.visible = F.breakfast; F.tableSet = true; this.done('table');
          g.audio.play('cutlery', { pos: H.tableTop, vol: 0.5 });
          return;
        }
        if (F.breakfast && !F.coffeeDone) { g.ui.toast('O café ainda não está pronto.'); return; }
        if (F.dinnerPrep && !F.stoveDone) { g.ui.toast('O jantar ainda não está pronto.'); return; }
        F.called = true; this.done('call');
      } });
    // ---------- quintal: regador e plantas
    const can = new THREE.Group();
    const canM = mat(null, 0x3a8a4a);
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.24, 8), canM); cb.position.y = 0.12; can.add(cb);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5), canM); sp.position.set(0.17, 0.2, 0); sp.rotation.z = -0.9; can.add(sp);
    can.position.copy(H.wateringCanPos); S.add(can);
    pickup('wateringCan', can, 'wateringCan', { when: () => F.plantsTask, prompt: 'Pegar o regador' });
    H.plants.forEach((pl, i) => I({ id: 'plant' + i, mesh: pl.leaves, hold: 2.5, prompt: () => (g.inventory.has('wateringCan') ? 'Regar a planta (segure)' : 'Planta seca'),
      enabled: () => F.plantsTask && !pl.watered,
      whileHold: (gg, it, t) => {
        if (!g.inventory.has('wateringCan')) return;
        if (!it._snd) { it._snd = true; gg.audio.play('water', { pos: pl.leaves.position, len: 2.5, vol: 0.4 }); }
        this.pour = { plant: pl, until: g.time + 0.12 }; pl.setGrowth(Math.min(1, t / 2.5));
      },
      onCancel: (gg, it) => { it._snd = false; if (!pl.watered) pl.setGrowth(0); },
      onUse: (gg, it) => {
        it._snd = false;
        if (!g.inventory.has('wateringCan')) { g.ui.toast('O regador fica perto da porta do quintal.'); return; }
        pl.watered = true; pl.setGrowth(1);
        const n = H.plants.filter((q) => q.watered).length; F.plantsWatered = n;
        g.tasks.text('plants', `Regue as plantas do quintal (${n}/3)`); g.status.ground(3);
        if (n === 2) this.yardSighting();
        if (n === 3) { g.tasks.done('plants'); F.plantsDone = true; g.inventory.take('wateringCan'); g.ui.toast('Você deixa o regador no degrau.'); }
      } }));
    // ---------- telefone
    I({ id: 'phone', mesh: H.phoneTable, prompt: () => (F.phoneRinging ? 'Atender o telefone' : 'Telefone'), onUse: () => {
      if (F.phoneRinging) { F.phoneRinging = false; F.phoneAnswered = true; if (this.loops.phone) { this.loops.phone.stop(0.05); this.loops.phone = null; } g.audio.play('click', { pos: H.phonePos }); }
      else { g.audio.play('click', { pos: H.phonePos }); g.ui.toast(F.act3 ? 'Só um chiado. E, no fundo, uma respiração.' : 'Sinal de discagem. Daniel não vai atender.'); }
    } });
    // ---------- desenhos nos travesseiros
    H.drawingPillow.forEach((m, i) => I({ id: 'drawing' + (i + 1), mesh: m, prompt: 'Examinar o desenho', enabled: () => F.kidsEmpty && m.visible,
      onUse: () => { g.ui.showDoc({ ...g.docs['drawing' + (i + 1)], onClose: () => { F['readDrawing' + (i + 1)] = true; } }); } }));
    // ---------- pia
    const sinkM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.45), basic(0, { transparent: true, opacity: 0 })); sinkM.position.set(12.2, 0.95, 11.6); S.add(sinkM);
    I({ id: 'sinkUse', mesh: sinkM, hold: 4, prompt: () => (F.act3 ? 'Lavar as mãos (segure)' : 'Lavar a louça (segure)'),
      enabled: () => (F.routine && !F.dishesDone) || (F.act3 && !F.redWater),
      whileHold: (gg, it, t) => { if (!it._snd) { it._snd = true; gg.audio.play('water', { pos: sinkM.position, len: 4, vol: 0.6 }); } if (F.act3 && t > 1.5) gg.fxRed = 0.45; },
      onCancel: (gg, it) => { it._snd = false; gg.fxRed = 0; },
      onUse: (gg, it) => {
        it._snd = false;
        if (F.act3) { F.redWater = true; g.fxRed = 0; g.ui.toast('Por alguns segundos, a água ficou vermelha.'); g.status.shock(5); return; }
        F.dishesDone = true; H.dirtyDishes.visible = false; this.kitchenEncounter();
      } });
    // ---------- lavanderia
    I({ id: 'washer', mesh: H.washer, prompt: 'Tirar a roupa da máquina', enabled: () => F.act2 && !F.gotClothes,
      onUse: () => { g.inventory.add('clothes'); F.gotClothes = true; this.done('washer'); } });
    // ---------- coelho (aparece no corredor no Ato II)
    const rabbit = new THREE.Group();
    const wm = mat(null, 0xeeeeea);
    const rb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), wm); rb.position.y = 0.09; rabbit.add(rb);
    const rh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), wm); rh.position.y = 0.21; rabbit.add(rh);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.015), wm); e.position.set(0.025 * s, 0.31, 0); e.rotation.z = -s * 0.15; rabbit.add(e); }
    const eyeM = basic(0xaa1010); for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 3), eyeM); e.position.set(0.022 * s, 0.22, 0.058); rabbit.add(e); }
    rabbit.position.set(12.1, 0, 5.1); rabbit.rotation.y = PI; rabbit.visible = false; S.add(rabbit);
    H.rabbit = rabbit;
    pickup('rabbit', rabbit, 'rabbit', { prompt: 'Pegar o coelho de pelúcia', when: () => rabbit.visible, after: () => g.ui.toast('Ele estava exatamente onde o homem estava parado.') });
    g.events.on('combine:rabbit', () => {
      g.inventory.take('rabbit'); g.inventory.take('scissors'); g.inventory.add('smallKey');
      g.ui.toast('Dentro do enchimento, enrolada em algodão: uma chave pequena.', 4); g.audio.play('paper');
      if (g.ui.open === 'inventory') g.ui.renderInventory();
    });
    // ---------- relógio de bolso no corredor impossível
    pickup('watch', H.watchMesh, 'watch', { prompt: 'Pegar o relógio de bolso', after: () => { g.ui.showDoc(g.docs.watch); g.status.shock(3); } });
    I({ id: 'longKids', mesh: H.longKidsDoor, prompt: 'Abrir o quarto das crianças', onUse: () => { F.longKids = true; } });
    // ---------- camas (roupas molhadas)
    for (const [x, z] of [H.bedEmily, H.bedThomas]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 1.6), basic(0, { transparent: true, opacity: 0 })); m.position.set(x, 0.5, z); S.add(m);
      I({ mesh: m, prompt: 'Colocar as roupas na cama', enabled: () => g.inventory.has('clothes') && F.wetStage, onUse: () => { g.inventory.take('clothes'); F.clothesPlaced = true; } });
    }
    // armário das crianças (visão)
    I({ id: 'kidsWardrobe', mesh: H.kidsWardrobe.body, prompt: 'Abrir o guarda-roupa', enabled: () => F.followPrints && !F.visionDone, onUse: () => this.vision() });
    // desenho do coelho
    const d3 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.21), new THREE.MeshLambertMaterial({ map: (() => { const t = new THREE.CanvasTexture(g.images.drawingRabbit()); t.magFilter = THREE.NearestFilter; return t; })() }));
    d3.rotation.x = -PI / 2; d3.position.set(12.35, 0.62, 1.2); d3.visible = false; S.add(d3); H.drawing3 = d3;
    I({ id: 'drawing3', mesh: d3, prompt: 'Examinar o desenho', enabled: () => d3.visible, onUse: () => g.ui.showDoc({ ...g.docs.drawing3, onClose: () => { F.readDrawing3 = true; } }) });
    // ---------- espelho
    const mirM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.6), basic(0, { transparent: true, opacity: 0 })); mirM.position.set(5.16, 1.58, 2.5); S.add(mirM);
    I({ id: 'mirror', mesh: mirM, hold: 4.5, prompt: 'Limpar o espelho (segure)', enabled: () => F.mirrorStage && !F.mirrorDone,
      whileHold: (gg, it, t) => { H.mirrorSmudge.material.opacity = 0.55 * (1 - t / 4.5); if (t > 2.6 && !H.mirrorGhostOn) { H.mirrorGhostOn = true; gg.audio.play('whisper', { pos: { x: 7.4, y: 1.8, z: 3.1 }, vol: 0.5, len: 1.5 }); } },
      onCancel: () => { H.mirrorSmudge.material.opacity = 0.55; },
      onUse: () => { H.mirrorSmudge.visible = false; F.mirrorDone = true; } });
    // ---------- fogão
    const stoveM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.55), basic(0, { transparent: true, opacity: 0 })); stoveM.position.set(14.2, 0.95, 11.62); S.add(stoveM);
    I({ id: 'stove', mesh: stoveM, hold: 3.5, prompt: 'Cozinhar (segure)', enabled: () => F.dinnerPrep && !F.stoveDone,
      whileHold: (gg, it) => { if (!it._snd) { it._snd = true; gg.audio.play('sizzle', { pos: stoveM.position, len: 3.5, vol: 0.6 }); } },
      onCancel: (gg, it) => { it._snd = false; },
      onUse: () => { F.stoveDone = true; this.done('stove'); g.ui.toast('Sopa de legumes. A preferida de Thomas.'); } });
    // ---------- cadeira (sentar no jantar)
    I({ id: 'sit', mesh: H.chairs.S, prompt: 'Sentar-se', enabled: () => F.canSit && !F.sat, onUse: () => { F.sat = true; } });
    // ---------- porta do porão e escada
    const bd = H.doors.basement;
    const origUse = bd.use.bind(bd), origPrompt = bd.prompt;
    bd.use = () => { if (F.basementOpen && !F.chase) this.goBasement(); else origUse(); };
    bd.prompt = () => (F.basementOpen && !F.chase ? 'Descer ao porão' : origPrompt());
    I({ id: 'stairs', mesh: H.basementStairs, prompt: 'Subir a escada', onUse: () => {
      if (F.stairsBlocked) { g.audio.play('locked', { pos: new THREE.Vector3(30.7, 2, 0.4) }); g.ui.toast('A porta lá em cima não abre!'); return; }
      this.goUp();
    } });
    pickup('photoBox', H.photoBoxBasement, 'photos', { prompt: 'Pegar a caixa de fotografias', when: () => F.act3, after: () => { g.inventory.take('photos'); F.gotPhotoBox = true; this.done('box'); } });
    // ---------- porta do banheiro (trancar durante a fuga)
    const bath = H.doors.bath, bathUse = bath.use.bind(bath), bathPrompt = bath.prompt;
    bath.use = () => { if (F.chase && this.inRoom('bath')) { bath.close({ force: true }); bath.setLocked(true); F.bathLocked = true; } else bathUse(); };
    bath.prompt = () => (F.chase && this.inRoom('bath') ? 'Fechar e trancar a porta' : bathPrompt());
    // ---------- Ato IV: caixa de fotos na sala, TV, molduras, relógio
    const pbox = Models.photoBox();
    pbox.position.set(2.2, 0.42, 9.0); pbox.visible = false; S.add(pbox); H.photoBoxLiving = pbox;
    I({ id: 'photoBoxLiving', mesh: pbox, prompt: 'Examinar a caixa de fotografias', enabled: () => pbox.visible, onUse: () => {
      g.ui.showDoc({ ...g.docs.photosBox, onClose: () => {
        if (!F.photosRead) { F.photosRead = true; if (!g.inventory.has('photos')) g.inventory.add('photos'); g.readDocs.includes('framePhotos') || g.readDocs.push('framePhotos'); }
      } });
    } });
    I({ id: 'tvLiving', mesh: H.tvLiving.body, prompt: () => (F.vhsReady && !F.vhsDone ? 'Assistir à fita' : 'Televisão'), enabled: () => F.vhsReady || H.tvLiving.mode !== 'off',
      onUse: () => { if (F.vhsReady && !F.vhsDone) this.playDanielTape(); else { this.setTV(H.tvLiving, 'off'); } } });
    I({ id: 'tvKids', mesh: H.tvKids.body, prompt: 'Ver a televisão', enabled: () => F.kidsTvOn && !F.kidsTvSeen, onUse: () => this.playKidsTape() });
    const order = ['wedding', 'house', 'emily', 'thomas'];
    this.frameImgs = order.map((k) => { const t = new THREE.CanvasTexture(g.images.photo(k)); t.magFilter = THREE.NearestFilter; return t; });
    // as molduras do corredor já têm fotos desde o começo, fora de ordem (o quebra-cabeça do Ato IV é reordená-las)
    [2, 0, 3, 1].forEach((v, i) => { const fr = H.frames[i]; fr.value = v; fr.pic.material.map = this.frameImgs[v]; fr.pic.material.color.set(0xffffff); fr.pic.material.needsUpdate = true; });
    // foto do casal no quarto
    I({ id: 'couplePhoto', mesh: H.couplePhoto, prompt: 'Olhar a foto', onUse: () => {
      g.ui.showDoc({ id: 'couplePhoto', title: 'Alice e Daniel', img: g.images.photo('couple'), style: 'hand', text: F.act3 ? 'Você tenta lembrar do rosto dele. Não consegue.' : 'Praia de Tambaú, o primeiro verão juntos.\nNo verso, a letra dele: "Pra você nunca esquecer da minha cara feia. D."' });
      g.status.ground(F.act3 ? 0 : 4);
    } });
    H.frames.forEach((fr, i) => I({ id: 'frame' + i, mesh: fr.pic, prompt: () => (fr.value < 0 ? 'Colocar uma foto' : 'Trocar a foto'), enabled: () => F.puzzle && !F.framesSolved,
      onUse: () => {
        if (!F.frameNoteRead) { F.frameNoteRead = true; g.ui.showDoc(g.docs.frameNote); return; }
        fr.value = (fr.value + 1) % 4;
        fr.pic.material.map = this.frameImgs[fr.value]; fr.pic.material.color.set(0xffffff); fr.pic.material.needsUpdate = true;
        g.audio.play('click', { pos: fr.pic.position, vol: 0.5 });
        if (H.frames.every((q, k) => q.value === k)) this.framesSolved();
      } }));
    const keyM = Models.key(0xf2f2f2); keyM.position.set(0, -0.06, -0.12); H.clockDrawer.add(keyM);
    pickup('whiteKey', keyM, 'whiteKey', { when: () => F.framesSolved, prompt: 'Pegar a chave branca' });
    // ---------- porta branca
    const wd = H.doors.white, wdUse = wd.use.bind(wd);
    wd.use = () => { if (!wd.locked && F.puzzleDone) this.goHospital(); else wdUse(); };
    // ---------- objetos de conforto (recuperam sanidade aos poucos)
    const mb = Models.musicBox(); mb.position.set(1.6, 0.88, 6.32); S.add(mb);
    I({ id: 'musicbox', mesh: mb, prompt: 'Dar corda na caixinha de música', enabled: () => !this._mbCd || g.time > this._mbCd, onUse: () => {
      this._mbCd = g.time + 60; const det = (F.act3 ? 60 : F.act2 ? 25 : 0);
      const l = g.audio.loop('musicbox', { pos: mb.position, vol: 0.8, bus: 'music', detune: det, once: true, rate: F.act4 ? 0.8 : 1 });
      g.wait(11).then(() => l.stop(1));
      g.status.ground(F.act4 ? 4 : 10); g.ui.toast(F.act4 ? 'A melodia está errada. Mesmo assim, ajuda um pouco.' : 'A melodia que Emily cantava para dormir.');
    } });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(g.images.photo('park')) }));
    fp.position.set(0.55, 0.98, 6.36); S.add(fp);
    I({ id: 'familyPhoto', mesh: fp, prompt: 'Olhar a foto da família', enabled: () => !this._fpCd || g.time > this._fpCd, onUse: () => {
      this._fpCd = g.time + 45; g.status.ground(F.act4 ? 3 : 6); g.ui.toast(F.act3 ? 'Na foto, Daniel não está sorrindo. Ele sempre sorria.' : 'Domingo no parque. Thomas não largou o coelho.');
    } });
    // ---------- hospital
    I({ id: 'file', mesh: H.file, prompt: 'Ler o prontuário', enabled: () => F.room04, onUse: () => g.ui.showDoc({ ...g.docs.file, onClose: () => { F.fileRead = true; this.done('file'); } }) });
    I({ id: 'recorder', mesh: H.recorder, prompt: 'Ouvir a gravação', enabled: () => F.room04 && !F.tapeStarted, onUse: () => this.interviewTape() });
    const bedM = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 0.95), basic(0, { transparent: true, opacity: 0 })); bedM.position.set(34.0, 0.6, 61.5); S.add(bedM);
    I({ id: 'bed04', mesh: bedM, prompt: 'Sentar-se na cama', enabled: () => F.tapeDone && !F.ending, onUse: () => { F.ending = true; } });
  }
  // animação de regar: regador na mão de Alice inclinando e um fio de água caindo na planta
  updatePour(dt) {
    const g = this.g;
    if (!this.canFP) {
      const can = new THREE.Group(), m = mat(null, 0x3a8a4a);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), m); can.add(body);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.22, 5), m); spout.position.set(0, 0.03, -0.13); spout.rotation.x = -1.0; can.add(spout);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 8, Math.PI), m); handle.position.set(0, 0.06, 0.03); handle.rotation.y = PI / 2; can.add(handle);
      const tip = new THREE.Object3D(); tip.position.set(0, 0.11, -0.22); can.add(tip);
      can.position.set(0.24, -0.3, -0.52); can.scale.setScalar(0.75); can.visible = false; g.player.camera.add(can);
      const drops = [];
      for (let i = 0; i < 18; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 3), new THREE.MeshBasicMaterial({ color: 0xbcd8e8, transparent: true, opacity: 0.85 })); d.visible = false; g.scene.add(d); drops.push({ m: d, k: i / 18 }); }
      this.canFP = { can, tip, drops, tilt: 0 };
    }
    const c = this.canFP, on = this.pour && g.time < this.pour.until;
    c.tilt += ((on ? 1 : 0) - c.tilt) * Math.min(1, dt * 8);
    c.can.visible = c.tilt > 0.02;
    c.can.rotation.x = -0.9 * c.tilt; c.can.position.y = -0.3 + 0.07 * c.tilt;
    const from = c.tip.getWorldPosition(new THREE.Vector3());
    const to = on ? this.pour.plant.leaves.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)) : null;
    for (const d of c.drops) {
      d.m.visible = on && c.tilt > 0.6;
      if (!d.m.visible) continue;
      d.k = (d.k + dt * 1.8) % 1;
      const p = from.clone().lerp(to, d.k); p.y -= Math.sin(d.k * PI) * -0.05 + d.k * d.k * 0.05;
      p.x += (Math.random() - 0.5) * 0.01; p.z += (Math.random() - 0.5) * 0.01;
      d.m.position.copy(p);
    }
  }
  // evento no quintal: o homem parado na calçada, ao lado do poste
  yardSighting() {
    const g = this.g, H = g.house, e = g.entity;
    if (this.f.yardSeen) return; this.f.yardSeen = true;
    g.audio.play('laugh', { pos: { x: 2, y: 1.2, z: 20 }, pitch: 620, vol: 0.6 });
    e.appear(10.6, 28.3, 0, { lookLimit: 1.0, onLooked: (gg, en) => {
      H.streetLamp.flicker = 1; gg.audio.play('glitch', { pos: { x: 10, y: 3, z: 28.6 }, vol: 0.4 });
      gg.wait(0.8).then(() => { en.vanish(); H.streetLamp.flicker = 0; }); gg.status.shock(5);
    } });
    g.wait(20).then(() => { if (e.state === 'scripted' && e.pos.z > 20) e.vanish(); });
  }
  // remove coletáveis já pegos (ao carregar)
  applyCollected() {
    for (const id of this.g.collected) { const p = this.pickups[id]; if (p) { if (p.mesh.parent) p.mesh.parent.remove(p.mesh); p.it.remove(); } }
  }

  // ------------------------------------------------------------- humores por ato
  moodAct2() { const g = this.g; g.lights.setMood(0.75, 0.95); g.fx.desat = 0.2; g.fx.tint = [1.0, 0.97, 0.93]; g.director.level = 1; this.f.act2 = true; }
  moodAct3() {
    const g = this.g, H = g.house; g.lights.setMood(0.3, 0.75); g.fx.desat = 0.35; g.fx.tint = [0.9, 0.95, 1.05]; g.fx.grain = 0.08;
    g.director.level = 2; this.f.act2 = true; this.f.act3 = true; this.sanityCeil = 85;
    H.scrawls.forEach((s) => { s.visible = true; }); H.fx.kids.on = false;
    this.windows('night'); H.tablePlates.visible = false; H.tableBread.visible = false; H.tableCups.visible = false;
    this.f.basementOpen = true;
    this.lockBackDoor();
  }
  lockBackDoor() {
    const H = this.g.house, d = H.doors.back;
    if (d.isOpen) d.close({ force: true, silent: true });
    d.setLocked(true);
    H.backGlass.forEach((p) => { p.material = new THREE.MeshBasicMaterial({ map: Tex.window('night') }); });
    H.yardSky.on = false; H.yardSky2.on = false;
  }
  moodAct4() {
    const g = this.g, H = g.house;
    this.moodAct3();
    g.lights.setMood(0.15, 0.7); g.fx.desat = 0.45; g.fx.tint = [0.92, 0.98, 1.06]; g.fx.vhs = 0.08;
    g.director.level = 3; this.f.act4 = true; this.sanityCeil = 70; this.sanityFloor = 10;
    H.whitePatch.visible = false; H.whitePatch.userData.collider.active = false;
    g.world.occluders = g.world.occluders.filter((o) => o !== H.whitePatch);
    const wd = H.doors.white; wd.pivot.visible = true; wd.collider.active = true; wd.enabled = true;
    H.fluor.visible = true; H.fx.fluor.on = true; H.fx.hallW.on = false; H.fx.hallE.on = false;
    H.ivStand.visible = true; H.bedRail.visible = true;
    H.scrawls[1].visible = true;
    H.photoBoxLiving.visible = true;
    H.doors.bath.setLocked(false);
    g.navDirty = true;
    if (!this.loops.hosp) {
      this.loops.hosp = [g.audio.loop('monitor', { pos: { x: -0.6, y: 1.2, z: 5 }, vol: 0.5 }), g.audio.loop('fluor', { pos: { x: 8, y: 2.4, z: 5 }, vol: 0.7 })];
    }
  }
  moodAct5() {
    const g = this.g; g.lights.setMood(1, 1); g.fx.desat = 0.5; g.fx.tint = [0.95, 1.0, 1.04]; g.fx.vhs = 0.18; g.fx.grain = 0.09;
    g.director.enabled = false; this.sanityCeil = 45; this.sanityFloor = 15; this.f.act5 = true;
    if (this.loops.hosp) { this.loops.hosp.forEach((l) => l.stop(1)); this.loops.hosp = null; }
    g.audio.setReverb(0.35);
  }
  windows(kind) {
    const H = this.g.house;
    for (const k of ['winAlice', 'winKids', 'winLiving', 'winKitchen']) if (H[k]) H[k].material.map = Tex.window(kind);
    this.g.lights.setDaylight(kind !== 'night');
    if (this.g.house.setYardDay) this.g.house.setYardDay(kind !== 'night');
    this.f.night = kind === 'night';
  }

  // ------------------------------------------------------------- PRÓLOGO
  async prologue() {
    const g = this.g;
    g.ui.fade(1, 0.01); g.setCinematic(true);
    // abertura desenhada: a despedida, o táxi, o aeroporto e o voo
    g.storyT = 0; g.ui.story(true); this.skippable = true; this.skipHold = 0;
    const at = (t) => this.until(() => g.storyT >= t);
    const mbox = g.audio.loop('musicbox', { bus: 'music', vol: 0.35, rate: 0.9 });
    await at(1.2);
    await this.say('daniel', 'Eu volto na sexta. Prometo.');
    await this.say('alice', 'Você sempre promete.');
    await at(9.5);
    await this.say('daniel', 'Dá um beijo nas crianças. Fala pro Thomas que eu trago o avião de brinquedo.');
    await this.say('alice', 'Liga quando chegar.');
    await at(18.5);
    this.say('emily', 'Tchau, papai!'); await this.wait(1.6);
    await this.say('thomas', 'Traz o avião!');
    await at(25.2);
    mbox.stop(2);
    const hall = g.audio.loop('room', { vol: 0.4 });
    g.audio.play('bell', { vol: 0.4 });
    await this.say('radio', 'Última chamada para o voo das quinze horas.', { label: 'Aeroporto' });
    await at(32.2);
    hall.stop(0.5);
    const cabin = g.audio.loop('cabin', { vol: 0.5, fadeIn: 1 });
    await at(34.5);
    g.audio.play('alarm', { vol: 0.5 });
    await this.say('radio', 'Senhores passageiros, permaneçam sentados com os cintos afivelados.', { label: 'Comandante' });
    await at(39.6);
    g.ui.story(false); this.skippable = false; this.skipping = false; g.ui.skipHint(-1);
    g.audio.play('crash', { vol: 1 }); cabin.stop(0.05);
    g.fx.flash = 0.6;
    await this.wait(3.5);
    g.audio.play('phoneRingOnce', { vol: 0.7 }); await this.wait(3); g.audio.play('phoneRingOnce', { vol: 0.7 }); await this.wait(2);
    await this.say('radio', 'Senhora Alice? Aqui é da companhia aérea. Eu sinto muito.', { label: 'Telefone' });
    await this.wait(2.5);
    await g.ui.titleCard('', 'ALICE', 3.5);
    await g.ui.titleCard('NOVEMBRO', 'Oito meses depois', 3);
    await this.say('daniel', 'Alice... você precisa abrir a porta.', { pitch: 0.4, rate: 0.7 });
    await this.wait(1);
    g.player.teleport(3.55, 1.3, 2.9); g.player.eye = 0.6; g.player.pitch = -0.2;
    g.ui.fade(0, 3.5);
    g.audio.play('breathOne', { vol: 0.6, len: 2 });
    await this.wait(2);
    g.setCinematic(false);
    g.ui.toast(`Mouse para olhar. ${g.keyName('forward')} ${g.keyName('left')} ${g.keyName('back')} ${g.keyName('right')} para andar. [${g.keyName('interact')}] para interagir.`, 6);
  }

  // ------------------------------------------------------------- ATO I
  async breakfast() {
    const g = this.g, F = this.f, H = g.house;
    F.breakfast = true;
    this.obj('Prepare o café da manhã', [['bread', 'Pegue o pão na cozinha'], ['coffee', 'Faça o café'], ['plates', 'Pegue os pratos no aparador da sala de jantar'], ['table', 'Ponha a mesa'], ['call', 'Chame as crianças']], '07:15 AM');
    g.ui.toast(`[${g.keyName('journal')}] mostra os objetivos.`, 5);
    this.loops.clock = g.audio.loop('clock', { pos: H.clockPos, vol: 0.5 });
    this.loops.fridge = g.audio.loop('hum', { pos: H.fridgePos, vol: 0.35, freq: 58 });
    await this.until(() => F.called);
    F.breakfast = false;
    await this.wait(0.8);
    g.audio.say('emily', 'Já estamos indo, mamãe!', { pos: new THREE.Vector3(10.5, 1, 2) });
    await this.wait(1.6);
    g.audio.play('kidsRun', { pos: { x: 10.5, y: 0.1, z: 4.8 }, count: 12, vol: 0.9 });
    const sh = g.director.shadow; sh.visible = true; sh.scale.setScalar(0.85);
    await this.tween((k) => { sh.position.set(10.5 - k * 9, 0, 5.0); }, 1.7);
    sh.visible = false;
    await this.wait(3);
    this.obj('Por que estão demorando?', [['go', 'Vá até o quarto das crianças']]);
    await this.until(() => this.inRoom('kids'));
  }
  async kidsRoom() {
    const g = this.g, F = this.f;
    F.kidsEmpty = true;
    await this.wait(0.7);
    g.audio.play('swell', { vol: 0.35 });
    g.ui.toast('As camas estão vazias.');
    this.obj('Onde estão as crianças?', [['d1', 'Olhe os desenhos sobre o travesseiro']]);
    await this.until(() => F.readDrawing1);
    this.done('d1'); g.status.shock(4);
    await this.wait(0.5);
  }
  async search() {
    const g = this.g, F = this.f, H = g.house;
    F.searching = true; g.director.enabled = true; g.director.cool = 25;
    this.obj('Procure as crianças', [['living', 'Procure na sala'], ['bath', 'Procure no banheiro'], ['laundry', 'Procure na lavanderia'], ['front', 'Verifique a porta da frente']]);
    H.doors.front.onLocked = () => { if (!g.tasks.isDone('front')) { g.tasks.done('front'); g.ui.toast('Trancada por dentro. E a chave não está no gancho.', 3.5); } };
    await this.until(() => ['living', 'bath', 'laundry', 'front'].every((k) => g.tasks.isDone(k)));
    F.searching = false;
    await this.wait(2);
    await this.ringPhone();
    g.audio.play('glitch', { vol: 0.4 });
    await this.say('daniel', 'Alice...', { pitch: 0.4, rate: 0.7 });
    await this.say('daniel', 'Você precisa abrir a porta.', { pitch: 0.4, rate: 0.7 });
    g.audio.play('click'); g.status.shock(6);
    await this.wait(1.2);
    // silhueta no fim do corredor
    const e = g.entity;
    e.appear(0.55, 5.0, -PI / 2, { lookLimit: 1.2, onLooked: (gg, en) => { gg.lights.flickerAll = 1; gg.audio.play('glitch', { vol: 0.5 }); gg.wait(0.7).then(() => { gg.lights.flickerAll = 0; en.vanish(); }); gg.status.shock(6); } });
    g.audio.play('creak', { pos: new THREE.Vector3(0.6, 1, 5), vol: 0.7 });
    await this.until(() => !e.visible, 14);
    if (e.visible) e.vanish();
  }
  onSearchRoom(name) {
    const g = this.g, H = g.house, F = this.f;
    if (name === 'living' && !F.tvEvent) {
      F.tvEvent = true;
      g.wait(1.8).then(() => { this.setTV(H.tvLiving, 'static'); g.status.shock(2); g.ui.toast('A televisão ligou sozinha.'); });
    }
    if (name !== 'living' && F.tvEvent && !F.chairEvent) {
      F.chairEvent = true;
      this.moveChair(H.chairs.W, 4.9, 9.6, PI / 2);
      g.audio.play('chairDrag', { pos: new THREE.Vector3(5.4, 0.4, 9.2), vol: 0.7 });
    }
  }
  afterSearch() { const H = this.g.house; this.moveChair(H.chairs.W, 4.9, 9.6, PI / 2); }
  moveChair(c, x, z, ry) {
    c.position.set(x, 0, z); c.rotation.y = ry;
    const col = c.userData.collider; col.minX = x - 0.22; col.maxX = x + 0.22; col.minZ = z - 0.22; col.maxZ = z + 0.22;
    this.g.navDirty = true;
  }
  async ringPhone(label = 'Atenda o telefone') {
    const g = this.g, F = this.f, H = g.house;
    F.phoneRinging = true; F.phoneAnswered = false;
    this.loops.phone = g.audio.loop('phone', { pos: H.phonePos, vol: 0.9, bus: 'sfx' });
    const prev = g.tasks.current;
    this.obj(label, [['phone', 'O telefone está tocando no corredor']], 'AGORA');
    await this.until(() => F.phoneAnswered);
    void prev;
  }
  async routine() {
    const g = this.g, F = this.f;
    F.routine = true; F.toysTask = true; g.director.enabled = true;
    F.plantsTask = true;
    this.obj('Mantenha a rotina. Elas vão aparecer.', [['toys', 'Junte os brinquedos espalhados (0/4)'], ['chest', 'Guarde-os no baú do quarto das crianças'], ['plants', 'Regue as plantas do quintal (0/3)'], ['dishes', 'Lave a louça na cozinha']], 'ELAS VÃO VOLTAR');
    await this.until(() => F.toysDone && F.encounterDone && F.plantsDone);
    F.plantsTask = false;
    F.toysTask = false; F.routine = false;
    await this.wait(1.5);
  }
  async kitchenEncounter() {
    const g = this.g, F = this.f, H = g.house, e = g.entity;
    g.player.moveLocked = true;
    H.doors.kitchen.open(new THREE.Vector3(12, 0, 8), { silent: true, force: true });
    await this.wait(1);
    await this.say('thomas', 'Mamãe? O homem está aqui de novo.', { pos: this.behind(1.5) });
    e.appear(12.0, 4.9, PI, { lookLimit: 99 });
    g.audio.play('creak', { pos: new THREE.Vector3(12, 1, 5.5), vol: 0.5 });
    await this.until(() => e.lookedAtT > 0.7, 9);
    await this.say('alice', 'Quem está aí?');
    await this.wait(0.8);
    const d = e.say('daniel', 'Você sabe quem eu sou.', { pitch: 0.45, rate: 0.75 }); await this.wait(d);
    g.lights.blackout = 2.2; g.flashlight.forcedOff = 2.2;
    g.audio.play('stinger', { vol: 0.7 });
    await this.wait(1.2); e.vanish(); await this.wait(1.2);
    g.player.moveLocked = false; g.status.shock(10);
    this.done('dishes'); F.encounterDone = true;
  }

  // ------------------------------------------------------------- ATO II
  async act2() {
    const g = this.g, F = this.f, H = g.house;
    g.tasks.clear();
    await g.ui.titleCard('ATO II', 'O coelho branco', 3.5);
    H.rabbit.visible = !g.collected.has('rabbit');
    this.obj('As roupas das crianças', [['washer', 'Tire a roupa da máquina na lavanderia'], ['bring', 'Leve as roupas para o quarto das crianças']]);
    await this.until(() => F.gotClothes);
    await this.wait(0.5);
    if (this.inRoom('laundry')) {
      H.doors.laundry.close({ slam: true, force: true });
      await this.wait(0.4);
      g.lights.flickerAll = 1; await this.wait(1.0); g.lights.flickerAll = 0;
      const p = g.player.pos.clone();
      g.player.teleport(p.x, p.z + H.longSpawnOffset);
      g.audio.play('glitch', { vol: 0.3 });
      g.audio.setReverb(0.4);
      this.loops.mbox = g.audio.loop('musicbox', { pos: { x: -22, y: 1, z: 5 + H.longSpawnOffset }, vol: 0.9, bus: 'music', detune: 35, rate: 0.85 });
      this.loops.wind = g.audio.loop('wind', { vol: 0.4 });
      await this.until(() => F.longKids);
      await g.ui.fade(1, 0.6);
      this.loops.mbox.stop(0.3); this.loops.wind.stop(0.3); g.audio.setReverb(0.22);
      g.player.teleport(10.5, 3.3, 0);
      H.doors.kids.close({ force: true, silent: true });
      g.ui.fade(0, 0.8);
    }
    F.inKidsFromHall = true;
  }
  afterAct2() { const H = this.g.house; H.rabbit.visible = H.rabbit.visible && !this.g.collected.has('rabbit'); }
  async wet() {
    const g = this.g, F = this.f, H = g.house;
    F.wetStage = true;
    this.obj('As roupas das crianças', [['beds', 'Coloque as roupas sobre as camas']]);
    await this.until(() => F.clothesPlaced);
    H.clothesOnBeds.visible = true; this.done('beds');
    g.ui.toast('As roupas estão encharcadas. Água fria escorre pelo lençol.', 4);
    g.audio.play('swell', { vol: 0.3 });
    H.footprints.visible = true;
    this.loops.drip = g.audio.loop('drip', { pos: { x: 12.6, y: 1, z: 2.9 }, vol: 0.8 });
    this.loops.tub = g.audio.loop('drip', { pos: { x: 6, y: 0.6, z: 0.5 }, vol: 0.5 });
    await this.wait(1.5);
    g.ui.toast('Pegadas pequenas e molhadas no chão. Pés descalços, do tamanho dos do Thomas.', 4.5);
    this.obj('Pegadas pequenas', [['tub', 'Descubra de onde vêm as pegadas molhadas'], ['follow', 'Siga as pegadas até onde elas terminam']]);
    F.followPrints = true;
    H.kidsWardrobe.swing.target = 0.06; // fresta: a água escorre por baixo
    const t0 = g.time; let hinted = false;
    await this.until(() => {
      const p = g.player.pos;
      if (!F.sawTub && p.x > 5 && p.x < 8 && p.z < 2.4) { F.sawTub = true; this.done('tub'); g.ui.toast('A banheira está cheia. A água está gelada e ninguém a encheu.', 4); g.status.shock(3); }
      if (!hinted && g.time - t0 > 50) { hinted = true; g.ui.toast('As pegadas terminam no guarda-roupa das crianças. Algo pinga lá dentro.', 4.5); }
      return F.visionDone;
    });
    this.done('tub'); this.done('follow');
    this.loops.drip.stop(); this.loops.tub.stop(); H.footprints.visible = false;
    H.drawing3.visible = true;
    const steps = [['rabbit', 'Encontre o coelho de pelúcia', g.inventory.has('rabbit')], ['read', 'Veja o desenho deixado na cama do Thomas'], ['open', 'Encontre algo para abrir a costura do coelho'], ['key', `Abra o coelho (inventário [${g.keyName('inventory')}]: Combinar)`], ['vanity', 'Descubra o que a chave pequena abre']];
    this.obj('O segredo do coelho', steps.map(([a, b]) => [a, b]));
    if (g.inventory.has('rabbit')) this.done('rabbit');
    await this.until(() => {
      if (g.inventory.has('rabbit') || g.inventory.has('smallKey') || F.gotBook) this.done('rabbit');
      if (F.readDrawing3) this.done('read');
      if (g.inventory.has('scissors') || g.inventory.has('smallKey') || F.gotBook) this.done('open');
      if (g.inventory.has('smallKey') || F.gotBook) this.done('key');
      return F.gotBook;
    });
    this.done('vanity');
    await this.wait(2);
  }
  afterWet() { const H = this.g.house; H.clothesOnBeds.visible = true; H.drawingPillow.forEach((m) => { m.visible = false; }); }
  async vision() {
    const g = this.g, F = this.f, H = g.house;
    F.visionDone = true;
    g.setCinematic(true);
    H.kidsWardrobe.swing.target = 1;
    g.audio.play('creak', { pos: new THREE.Vector3(12.6, 1, 2.9), vol: 0.7 });
    await this.wait(0.6);
    g.audio.play('glitch', { vol: 0.6 }); g.fx.flash = 0.4;
    g.player.camOverride = { pos: new THREE.Vector3(71, 1.35, 20.6) };
    const yaw0 = g.player.yaw, pitch0 = g.player.pitch;
    g.player.yaw = PI; g.player.pitch = 0;
    H.visionLight.on = true;
    await this.wait(1.5);
    await this.say('emily', 'Mamãe, por que você trancou a porta?', { pos: new THREE.Vector3(70.75, 1, 31) });
    await this.wait(0.5);
    await this.say('thomas', 'Você vai fazer de novo?', { pos: new THREE.Vector3(71.25, 0.8, 31) });
    await this.wait(0.6);
    g.lights.flickerAll = 1; await this.wait(0.5);
    H.visionKids.forEach((k) => { k.visible = false; });
    await this.wait(0.6); g.lights.flickerAll = 0;
    g.audio.play('glitch', { vol: 0.6 }); g.fx.flash = 0.4;
    H.visionLight.on = false;
    g.player.camOverride = null; g.player.yaw = yaw0; g.player.pitch = pitch0;
    H.kidsWardrobe.swing.target = 0;
    g.setCinematic(false);
    g.status.shock(12);
    g.ui.toast('É só um guarda-roupa.');
  }
  async mirror() {
    const g = this.g, F = this.f, H = g.house;
    F.mirrorStage = true;
    this.obj('Antes do jantar', [['mirror', 'Limpe o espelho do banheiro']], '18:50');
    await this.until(() => F.mirrorDone);
    H.mirrorGhostOn = true;
    g.audio.play('stinger', { vol: 0.6 }); g.status.shock(10);
    await this.until(() => {
      const fw = g.player.forward(); return fw.x > 0.3; // virou de costas para o espelho
    }, 6);
    H.mirrorGhostOn = false;
    g.audio.play('whisper', { pos: { x: 7.4, y: 1.8, z: 3.1 }, vol: 0.4, len: 0.8 });
    await this.wait(1.5);
  }
  async dinner() {
    const g = this.g, F = this.f, H = g.house;
    this.windows('night'); g.lights.setMood(0.65, 0.9);
    H.tablePlates.visible = false; H.tableBread.visible = false; H.tableCups.visible = false;
    F.tableSet = false; F.called = false; F.dinnerPrep = true;
    this.lockBackDoor();
    this.obj('Prepare o jantar', [['stove', 'Cozinhe no fogão'], ['plates', 'Pegue os pratos no aparador'], ['table', 'Ponha a mesa para quatro'], ['call', 'Chame a família']], '19:40');
    await this.until(() => F.called);
    F.dinnerPrep = false;
    // a família "chega" só em som
    const pN = new THREE.Vector3(8, 1.1, 9.1), pE = new THREE.Vector3(9.1, 1.0, 10), pW = new THREE.Vector3(6.9, 1.0, 10);
    g.audio.play('chairDrag', { pos: pE, vol: 0.6 }); await this.wait(0.6);
    g.audio.play('chairDrag', { pos: pW, vol: 0.6 });
    g.audio.play('laugh', { pos: pE, pitch: 600, vol: 0.6 });
    await this.say('daniel', 'O cheiro está ótimo, Alice.', { pos: pN });
    g.audio.play('cutlery', { pos: H.tableTop, vol: 0.6 });
    await this.say('emily', 'Mamãe, senta com a gente!', { pos: pE });
    g.audio.play('laugh', { pos: pW, pitch: 680, vol: 0.5 });
    this.obj('O jantar', [['sit', 'Sente-se à mesa com eles']]);
    F.canSit = true;
    const ambient = setInterval(() => { if (!F.sat) g.audio.play('cutlery', { pos: H.tableTop, vol: 0.4 }); }, 2200);
    await this.until(() => F.sat);
    clearInterval(ambient);
    g.setCinematic(true);
    g.player.camOverride = { pos: new THREE.Vector3(8, 1.12, 11.3) }; g.player.yaw = 0; g.player.pitch = -0.25;
    await this.wait(0.4);
    g.audio.stopAll(); this.loops = {};
    // a mesa está vazia. pratos sujos. a cadeira virada com o casaco preto.
    H.plateMeshes.forEach((p) => { p.material = mat(null, 0x6a5040); });
    this.moveChair(H.chairs.W, 7.08, 10.0, PI / 2);
    H.coat.position.set(7.08, 0, 10.0); H.coat.rotation.y = PI / 2; H.coat.visible = true;
    await this.wait(2.5);
    g.ui.toast('Silêncio.');
    await this.wait(2);
    g.player.camOverride = null; g.player.teleport(6.5, 11.3, 0);
    g.setCinematic(false);
    g.status.shock(8);
    await this.ringPhone();
    await this.say('emily', 'Mamãe, você não pode continuar fingindo que nós estamos aqui.', { pitch: 1.6 });
    g.audio.play('click'); g.status.shock(8);
    await this.wait(2);
  }
  afterDinner() {
    const H = this.g.house;
    this.lockBackDoor(); this.windows('night');
    H.tablePlates.visible = true; H.plateMeshes.forEach((p) => { p.material = mat(null, 0x6a5040); });
    this.moveChair(H.chairs.W, 7.08, 10.0, PI / 2); H.coat.position.set(7.08, 0, 10.0); H.coat.rotation.y = PI / 2; H.coat.visible = true;
  }

  // ------------------------------------------------------------- ATO III
  async act3() {
    const g = this.g, F = this.f, H = g.house;
    g.tasks.clear();
    await g.ui.titleCard('ATO III', 'Ele está dentro da casa', 3.5);
    g.director.enabled = true; g.director.cool = 20;
    this.loops.clock = g.audio.loop('clock', { pos: H.clockPos, vol: 0.5 });
    this.obj('As fotografias antigas', [['flash', 'Pegue a lanterna na gaveta da cozinha', g.flashlight.owned], ['down', 'Desça ao porão (porta no fim do corredor)'], ['box', 'Encontre a caixa de fotografias antigas']]);
    if (g.flashlight.owned) this.done('flash');
    await this.until(() => { if (g.flashlight.owned) this.done('flash'); return F.inBasement; });
    this.done('flash'); this.done('down');
    g.director.enabled = false;
    await this.until(() => F.gotPhotoBox);
    await this.wait(1);
    await this.say('daniel', 'Alice...', { pos: this.behind(4), pitch: 0.45 });
    await this.say('daniel', 'Não deixa ele levar as crianças.', { pos: this.behind(4), pitch: 0.45 });
    H.basementBulbs.forEach((b) => { b.flicker = 1; });
    g.flashlight.flicker = 1;
    await this.wait(1.4);
    H.basementBulbs.forEach((b) => { b.on = false; b.flicker = 0; if (b.bulb) b.bulb.material.color.setScalar(0.1); });
    g.audio.play('thump', { vol: 0.6 });
    const e = g.entity;
    e.appear(31.3, 7.3, 0, { lookLimit: 99 });
    this.obj('Saia daqui', [['up', 'Suba a escada do porão']], 'AGORA');
    F.stairsBlocked = true;
    await this.until(() => g.player.pos.distanceTo(new THREE.Vector3(30.7, 0, 3.0)) < 1.8);
    g.audio.play('slam', { pos: new THREE.Vector3(30.7, 2.2, 0.3), vol: 1 });
    g.ui.toast('A porta lá em cima bateu.');
    await this.wait(1.2);
    g.audio.play('sob', { pos: this.behind(2), pitch: 520, vol: 0.6 });
    await this.say('thomas', 'Mamãe, ele está atrás de você.', { pos: this.behind(1.5) });
    // a figura agora está muito mais perto
    const nav = g.navs.basement, b = this.behind(2.3);
    const free = nav.walkable(b.x, b.z) ? [b.x, b.z] : nav.randomFreeNear(b.x, b.z, 1.5) || [31.2, 5.2];
    e.appear(free[0], free[1], 0, { lookLimit: 99 });
    await this.until(() => e.lookedAtT > 0.25, 7);
    g.audio.play('stinger', { vol: 0.9 });
    const d = e.say('entity', 'Por que você fez isso?', { label: 'Vozes de Emily e Thomas' });
    g.audio.play('whisper', { pos: e.head, vol: 0.9, len: d });
    await this.wait(d);
    g.status.shock(10);
    F.stairsBlocked = false;
  }
  goBasement() {
    const g = this.g, F = this.f;
    g.setCinematic(true);
    g.audio.play('creak', { pos: g.house.doors.basement.center, vol: 0.7 });
    g.ui.fade(1, 0.5).then(async () => {
      g.player.teleport(30.7, 3.2, PI);
      g.audio.setReverb(0.3);
      F.inBasement = true;
      await this.wait(0.3);
      g.setCinematic(false);
      g.ui.fade(0, 0.8);
      if (!g.flashlight.on && g.flashlight.owned) g.ui.toast(`Está escuro. [${g.keyName('flashlight')}] liga a lanterna.`);
    });
  }
  goUp() {
    const g = this.g, F = this.f;
    g.setCinematic(true);
    g.audio.play('step', { surface: 'wood', vol: 0.6 });
    g.ui.fade(1, 0.35).then(async () => {
      g.player.teleport(15.2, 5.0, PI / 2);
      g.audio.setReverb(0.22);
      F.inBasement = false;
      g.setCinematic(false);
      g.ui.fade(0, 0.5);
      const e = g.entity;
      if (F.chase && e.active && e.zone === 'basement') {
        e.vanish();
        await this.wait(2.6);
        // não surge em cima do jogador: espera ele se afastar da porta (ou mais alguns segundos)
        await this.until(() => g.player.pos.distanceTo(new THREE.Vector3(15.4, 0, 5)) > 3, 3);
        if (!F.bathLocked) {
          g.house.doors.basement.open(new THREE.Vector3(17, 0, 5), { force: true, silent: true });
          g.audio.play('slam', { pos: g.house.doors.basement.center, vol: 1 });
          e.patrolPoints = g.house.patrol;
          e.hunt(15.4, 5.0, { chase: true }); e.staggerT = 0.8;
          e.lastKnown = g.player.pos.clone();
        }
      }
    });
  }
  async chase() {
    const g = this.g, F = this.f, H = g.house, e = g.entity;
    F.chase = true; g.director.enabled = false;
    this.loops.drone = g.audio.loop('drone', { vol: 0.8, bus: 'music' });
    this.obj('FUJA', [['bath', 'Tranque-se no banheiro']], 'ELE ESTÁ AQUI');
    if (F.inBasement) {
      e.patrolPoints = H.basementPatrol;
      e.hunt(e.pos.x, e.pos.z, { chase: true });
      e.staggerT = 3.2; // ele não corre de imediato: dá tempo de virar, mirar na escada e subir
      g.ui.toast(`Suba a escada! [${g.keyName('interact')}]`, 3);
    } else {
      // carregado do checkpoint: ele sobe do porão
      await this.wait(3);
      H.doors.basement.open(new THREE.Vector3(17, 0, 5), { force: true, silent: true });
      g.audio.play('slam', { pos: H.doors.basement.center, vol: 1 });
      e.patrolPoints = H.patrol; e.hunt(15.4, 5.0, { chase: true }); e.staggerT = 0.8; e.lastKnown = g.player.pos.clone();
    }
    g.ui.toast(`Corra com [${g.keyName('sprint')}]. Esconda-se se precisar.`, 4);
    await this.until(() => F.bathLocked);
    e.vanish(); this.loops.drone.stop(2);
    g.status.stressTarget = 70;
    await this.wait(3);
    const dp = H.doors.bath.center;
    g.audio.play('knock', { pos: dp, count: 3, vol: 1 });
    await this.wait(2);
    await this.say('emily', 'Mamãe, podemos entrar?', { pos: dp });
    await this.wait(2.5);
    await this.say('daniel', 'Você não precisa mais se esconder de nós.', { pos: dp, pitch: 0.45 });
    for (let i = 0; i < 6; i++) { g.audio.play('thump', { pos: dp, vol: 0.7 }); H.doors.bath.pivot.rotation.y += (i % 2 ? 0.03 : -0.03); g.player.shake = 0.4; await this.wait(0.35); }
    g.audio.play('stinger', { vol: 0.8 });
    await g.ui.fade(1, 1.2);
    F.chase = false;
    g.audio.stopAll(); this.loops = {};
    await this.wait(2.5);
  }

  // ------------------------------------------------------------- ATO IV
  async act4() {
    const g = this.g, F = this.f;
    g.ui.fade(1, 0.01);
    g.player.teleport(6.6, 2.4, PI); g.player.eye = 0.35; g.player.pitch = 0.3;
    g.director.enabled = false;
    g.tasks.clear();
    await g.ui.titleCard('ATO IV', 'A casa que não existe', 3.5);
    g.ui.fade(0, 3);
    await this.wait(2.5);
    g.status.shock(6);
    this.obj('Alguma coisa mudou', [['box', 'Examine a caixa de fotografias na sala'], ['tv', 'Assista à fita na televisão', true], ['door', 'Há uma porta branca no fim do corredor', true]]);
    g.director.enabled = true; g.director.cool = 30;
    await this.until(() => F.photosRead);
    this.done('box'); g.status.shock(8);
    await this.wait(1.2);
    F.vhsReady = true; g.tasks.show('tv'); g.tasks.show('door');
    this.setTV(g.house.tvLiving, 'static'); g.ui.toast('A televisão ligou. Há uma fita no videocassete.');
    await this.until(() => F.vhsDone);
    this.done('tv');
  }
  afterAct4() { const g = this.g; g.house.photoBoxLiving.visible = true; this.f.photosRead = true; this.f.vhsDone = true; if (!g.inventory.has('photos') && !this.f.puzzleDone) g.inventory.add('photos', 1, true); }
  async playDanielTape() {
    const g = this.g, F = this.f;
    F.vhsDone = true;
    g.setCinematic(true);
    g.audio.play('vhsInsert', { pos: g.house.tvLiving.pos });
    this.setTV(g.house.tvLiving, 'off');
    await this.wait(1.2);
    const st = g.audio.loop('static', { vol: 0.15, bus: 'sfx' });
    const img = g.images.vhs('28 MAR 1998');
    g.ui.vhs(true, (x, t) => { x.drawImage(img, 0, 0); if (Math.sin(t * 7) > 0.92) { x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(0, (t * 300) % 240, 320, 14); } });
    await this.wait(1.5);
    await this.say('daniel', 'Se você estiver assistindo isso, Alice, eu espero que esteja melhor.', { pitch: 0.75 });
    g.audio.play('glitch', { vol: 0.4 });
    await this.say('daniel', 'Eu sei que está sendo difícil. Mas você precisa entender que as crianças precisam de você.', { pitch: 0.75 });
    g.audio.play('glitch', { vol: 0.6 });
    await this.wait(0.6);
    await this.say('daniel', 'Você precisa parar de falar com elas como se eu ainda estivesse aqui.', { pitch: 0.6, rate: 0.75 });
    await this.wait(1);
    st.stop(0.2); g.ui.vhs(false);
    g.ui.showDoc({ ...g.docs.vhsLabel });
    g.setCinematic(false);
    g.status.shock(8);
  }
  async puzzle() {
    const g = this.g, F = this.f;
    F.puzzle = true;
    if (!g.inventory.has('photos') && !F.framesSolved) g.inventory.add('photos', 1, true);
    this.obj('A porta branca', [['frames', 'Ponha as fotos do corredor na ordem em que tudo aconteceu'], ['key', 'Encontre a chave da porta branca']]);
    g.ui.toast('Ele está andando pela casa. Fique em silêncio.', 4);
    g.director.enabled = true;
    // a caçada começa depois que o jogador entende o quebra-cabeça (leu o bilhete) ou após 25 s
    await this.until(() => F.frameNoteRead, 25);
    await this.wait(3);
    if (!F.framesSolved || !g.inventory.has('whiteKey')) g.director.startHunt({ aggression: 0.7, firstHint: 35 });
    await this.until(() => F.framesSolved);
    this.done('frames');
    await this.until(() => g.inventory.has('whiteKey'));
    this.done('key');
    g.director.stopHunt(); g.director.enabled = false;
    await this.wait(1.5);
    g.audio.play('sob', { pos: { x: 10.5, y: 1, z: 2 }, pitch: 500, vol: 0.8 });
    await this.say('emily', 'Mamãe! Não deixa ele entrar!', { pos: new THREE.Vector3(10.5, 1, 2) });
    await this.say('thomas', 'Por favor, mamãe. A gente está com medo.', { pos: new THREE.Vector3(10.5, 0.8, 2) });
    F.kidsTvOn = true; F.puzzleDone = true;
    this.setTV(g.house.tvKids, 'static');
    // quarto das crianças: camas arrumadas, coelho entre elas
    g.house.clothesOnBeds.visible = false;
    if (g.house.rabbit) { const r = g.house.rabbit; r.position.set(10.5, 0.5, 0.4); r.rotation.y = PI; r.visible = true; if (r.parent !== g.scene) g.scene.add(r); }
    this.obj('Uma escolha', [['kids', 'Vá até o quarto das crianças'], ['white', 'Abra a porta branca']]);
    await this.until(() => F.wentHospital);
  }
  framesSolved() {
    const g = this.g, F = this.f, H = g.house;
    F.framesSolved = true;
    g.inventory.take('photos');
    g.audio.play('bell', { pos: H.clockPos, vol: 0.9 });
    g.ui.toast('O relógio do corredor bateu. Algo se abriu dentro dele.', 4);
    const d = H.clockDrawer, home = d.position.clone();
    this.tween((k) => { d.position.set(home.x, home.y, home.z - 0.28 * k); }, 0.8).then(() => {
      // a chave cai do relógio no tapete do corredor (fácil de ver e de pegar)
      const key = this.pickups.whiteKey?.mesh;
      if (key && key.parent) {
        g.scene.add(key); key.position.set(10.62, 0.025, 5.22); key.rotation.set(0, 0.7, 0); key.scale.setScalar(1.8);
        g.audio.play('click', { pos: key.position, vol: 0.7 }); g.audio.play('pickup', { pos: key.position, vol: 0.4 });
        g.ui.toast('Algo caiu de dentro do relógio.', 3);
      }
    });
    g.status.ground(6);
  }
  async playKidsTape() {
    const g = this.g, F = this.f;
    F.kidsTvSeen = true;
    g.setCinematic(true);
    const img = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d'); x.fillStyle = '#0d0f12'; x.fillRect(0, 0, 320, 240); x.fillStyle = '#2a2622'; x.fillRect(0, 170, 320, 70); x.fillStyle = '#5a3a4a'; x.beginPath(); x.ellipse(160, 160, 34, 44, 0, 0, 7); x.fill(); x.beginPath(); x.arc(160, 108, 20, 0, 7); x.fill(); x.fillStyle = '#e8e8e8'; x.font = 'bold 16px "Courier New"'; x.fillText('REC ●', 16, 26); return c; })();
    g.ui.vhs(true, (x, t) => { x.drawImage(img, 0, 0); x.save(); x.translate(0, Math.sin(t * 2) * 2); x.restore(); });
    await this.wait(1);
    g.audio.play('sob', { pitch: 380, vol: 0.5 });
    await this.say('emily', 'Mamãe, por que você não consegue nos ver?');
    await this.say('alice', 'Eu estou tentando. Eu estou tentando.', { pitch: 0.9 });
    await this.wait(1);
    g.ui.vhs(false); this.setTV(g.house.tvKids, 'off');
    g.setCinematic(false); g.status.shock(6); this.done('kids');
  }
  goHospital() {
    const g = this.g, F = this.f;
    F.wentHospital = true;
    g.setCinematic(true);
    g.audio.play('creak', { pos: g.house.doors.white.center, vol: 0.8 });
    g.ui.fade(1, 1.2).then(() => {
      g.audio.stopAll(); this.loops = {};
      g.player.teleport(0.8, 61.5, -PI / 2);
    });
  }

  // ------------------------------------------------------------- ATO V
  async act5() {
    const g = this.g, F = this.f, H = g.house, e = g.entity;
    g.ui.fade(1, 0.01); g.setCinematic(true);
    g.player.teleport(0.8, 61.5, -PI / 2);
    this.loops.fluor = g.audio.loop('fluor', { vol: 0.5 });
    this.loops.monitor = g.audio.loop('monitor', { pos: { x: 14, y: 1.2, z: 60.3 }, vol: 0.5 });
    g.tasks.clear();
    await g.ui.titleCard('ATO V', 'Através do espelho', 3.5);
    g.ui.fade(0, 2.5); g.setCinematic(false);
    e.appear(27.5, 61.5, PI / 2, { lookLimit: 99 });
    this.obj('Ala C', [['walk', 'Caminhe até o fim do corredor']]);
    const cart = setInterval(() => { if (Math.random() < 0.5) g.audio.play('whisper', { pos: { x: g.player.pos.x + 4, y: 1.2, z: 63.5 }, vol: 0.3, len: 1.2 }); }, 4000);
    await this.until(() => g.player.pos.x > 16);
    g.player.speedMul = 0.5;
    let d = e.say('daniel', 'Está na hora de acordar, Alice.', { pitch: 0.5 }); await this.wait(d + 0.5);
    await this.say('alice', 'Onde estão meus filhos?');
    d = e.say('emily', 'Você sabe onde eles estão.'); await this.wait(d + 0.5);
    g.audio.play('sob', { pitch: 330, vol: 0.5 });
    await this.say('alice', 'Eu quero ir para casa.', { pitch: 0.9, rate: 0.85 });
    d = e.say('thomas', 'Você já está em casa, mamãe.'); await this.wait(d + 0.4);
    g.lights.blackout = 2.5; g.flashlight.forcedOff = 2.5; g.audio.play('thump', { vol: 0.8 });
    await this.wait(1.2);
    e.vanish();
    H.room04Patch.visible = false; H.room04Patch.userData.collider.active = false;
    g.world.occluders = g.world.occluders.filter((o) => o !== H.room04Patch);
    const dr = H.door04; dr.pivot.visible = true; dr.collider.active = true; dr.enabled = true;
    await this.wait(1.4);
    clearInterval(cart);
    g.player.speedMul = 1;
    this.obj('Quarto 04', [['open', 'Abra a porta 04']]);
    await this.until(() => this.inRoom('room04'));
    this.done('open');
  }
  async final() {
    const g = this.g, F = this.f, H = g.house;
    F.room04 = true;
    await this.wait(1.2);
    g.ui.toast('A cama. O armário. A televisão. A janela.', 4);
    await this.wait(2.5);
    g.ui.toast('É o mesmo quarto.', 3);
    this.obj('Quarto 04', [['file', 'Leia o prontuário sobre a mesa'], ['tape', 'Ouça a gravação'], ['bed', 'Sente-se na cama', true]]);
    await this.until(() => F.tapeDone);
    this.done('tape'); g.tasks.show('bed');
    await this.until(() => F.ending);
    await this.endingScene();
  }
  async interviewTape() {
    const g = this.g, F = this.f, H = g.house;
    F.tapeStarted = true;
    g.player.moveLocked = true;
    g.audio.play('click', { pos: H.recorder.position });
    const hiss = g.audio.loop('static', { pos: H.recorder.position, vol: 0.12 });
    await this.wait(1.2);
    await this.say('doctor', 'Alice, você se lembra do que aconteceu naquela noite?', { label: 'Dr. Ramos' });
    await this.wait(2.5);
    await this.say('alice', 'Eu preparei o jantar. Eles estavam com fome.');
    await this.say('doctor', 'E depois?', { label: 'Dr. Ramos' });
    g.audio.play('sob', { pitch: 340, vol: 0.4 });
    await this.say('alice', 'O Daniel estava lá. Ele disse que precisava viajar. Mas eu sabia que ele não podia ir embora de novo.', { pitch: 0.9 });
    await this.wait(1.5);
    await this.say('alice', 'As crianças estavam chorando. Elas não queriam ficar sozinhas comigo.', { pitch: 0.9 });
    await this.say('doctor', 'Alice, onde estão os seus filhos?', { label: 'Dr. Ramos' });
    await this.wait(3.5);
    await this.say('alice', 'Eles estão no quarto. Estão dormindo.');
    await this.wait(1.5);
    await this.say('doctor', 'Alice... os seus filhos morreram.', { label: 'Dr. Ramos', rate: 0.8 });
    await this.wait(2.5);
    g.audio.play('sob', { pitch: 320, vol: 0.5 });
    await this.say('alice', 'Ele ia levar os dois. O homem de preto. Ele estava parado no corredor, com a voz do Daniel.', { pitch: 0.9 });
    await this.say('alice', 'Eu precisava esconder os meus filhos num lugar onde ele nunca fosse achar.', { pitch: 0.9 });
    await this.wait(1.5);
    await this.say('doctor', 'Não havia ninguém no corredor, Alice. Naquela casa estavam só você e as crianças.', { label: 'Dr. Ramos', rate: 0.85 });
    await this.wait(2);
    await this.say('doctor', 'Foi você.', { label: 'Dr. Ramos', rate: 0.75 });
    await this.wait(2.5);
    await this.say('alice', 'Eu só queria que eles ficassem seguros.', { pitch: 0.85, rate: 0.8 });
    g.audio.play('glitch', { vol: 0.7 }); g.fx.flash = 0.3;
    hiss.stop(0.1);
    await this.wait(2);
    g.status.shock(15);
    g.setCinematic(true);
    await g.ui.fade(0.85, 1.5);
    for (const [a, b] of [
      ['', 'Daniel morreu em março de 1998.'],
      ['', 'Sem tratamento, o luto de Alice virou uma psicose: ela passou a ouvir vozes e a ver uma figura de capa preta.'],
      ['', 'Na noite de 20 de novembro, em plena crise psicótica, ela acreditou que a figura vinha buscar as crianças.'],
      ['', 'Tentando protegê-las de algo que não existia, Alice tirou a vida de Emily e Thomas.'],
      ['', 'Ela não se lembra. A mente dela construiu uma casa onde eles ainda estão vivos.'],
      ['', 'A casa é uma lembrança. O quarto 04 é real.'],
    ]) await g.ui.titleCard(a, b, 3.6);
    await g.ui.fade(0, 1.5);
    g.setCinematic(false); g.player.moveLocked = false;
    F.tapeDone = true;
  }
  async endingScene() {
    const g = this.g, H = g.house, e = g.entity, P = g.player;
    g.setCinematic(true);
    P.camOverride = { pos: new THREE.Vector3(33.35, 1.15, 61.5) }; P.yaw = PI / 2; P.pitch = -0.1;
    await this.wait(1.5);
    // olhar para as próprias mãos
    const hands = new THREE.Group(); const skin = mat(null, 0xc9a48a);
    for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.18), skin); h.position.set(0.09 * s, 0, 0); h.rotation.y = -s * 0.25; hands.add(h); }
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.035), new THREE.MeshBasicMaterial({ map: Tex.label('ALICE M. · ALA C · 04', { w: 192, h: 48, bg: '#f4f4f0', fg: '#203040', font: 'bold 16px Arial' }) }));
    band.position.set(0.1, 0.017, 0.07); band.rotation.x = -PI / 2; band.rotation.z = -0.25; hands.add(band);
    hands.position.set(0, -0.32, -0.38); P.camera.add(hands);
    await P.lookAt(new THREE.Vector3(33.0, 0.6, 61.5), 2);
    await this.wait(3.5);
    P.camera.remove(hands);
    await P.lookAt(new THREE.Vector3(29.5, 1.4, 61.5), 1.5);
    // a enfermeira entra
    const nurse = buildNurse(); nurse.position.set(29.2, 0, 61.5); nurse.rotation.y = -PI / 2; g.scene.add(nurse);
    H.door04.open(new THREE.Vector3(28, 0, 61.5), { force: true });
    await this.tween((k) => { nurse.position.set(29.2 + k * 2.0, 0, 61.5 + k * 0.9); }, 2.2);
    H.cup.visible = true; g.audio.play('click', { pos: H.cup.position });
    await this.wait(0.6);
    await P.lookAt(new THREE.Vector3(31.2, 1.55, 62.4), 1.2);
    await this.say('nurse', 'Alice, você está bem?');
    await this.wait(1.5);
    await this.say('nurse', 'Você gostaria de conversar um pouco?');
    await this.wait(1.5);
    await this.say('alice', 'Você ouviu as crianças?');
    await this.wait(1.5);
    await this.say('alice', 'Elas estavam brincando no corredor.');
    await this.say('nurse', 'Não tem ninguém no corredor, Alice.');
    // a câmera se volta para a porta aberta
    e.appear(16, 61.5, -PI / 2, { lookLimit: 99 });
    await P.lookAt(new THREE.Vector3(16, 1.6, 61.5), 3.5);
    await this.wait(1.5);
    const d = e.say('daniel', 'Alice...', { pitch: 0.4, rate: 0.7 }); await this.wait(d + 0.5);
    await P.lookAt(new THREE.Vector3(31.2, 1.55, 62.4), 1.4);
    await this.say('nurse', 'O que foi?');
    await this.wait(0.8);
    await this.say('alice', 'Nada. Ele já foi embora.');
    await g.ui.fade(1, 2.5);
    e.vanish();
    await this.wait(2);
    g.audio.play('knock', { count: 3, vol: 1 });
    await this.wait(2.4);
    g.audio.say('emily', 'Mamãe?', { label: '...', pitch: 1.8, rate: 0.7 });
    await this.wait(3.5);
    g.finishGame();
  }
}

function buildNurse() {
  // enfermeira low poly: uniforma com avental, touca, coque, rosto com olhos e sapatos
  const g = new THREE.Group();
  const white = mat(null, 0xe8ecec), blue = mat(null, 0xa8c0cc), skin = mat(null, 0xc9a48a), hair = mat(null, 0x2a1e18), dark = mat(null, 0x222222);
  const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.19, 0.27, 0.62, 8), blue, 0, 0.72, 0); // saia
  add(new THREE.BoxGeometry(0.3, 0.5, 0.02), white, 0, 0.75, -0.2); // avental
  add(new THREE.CylinderGeometry(0.16, 0.19, 0.5, 8), blue, 0, 1.28, 0, 1, 1, 0.75); // tronco
  add(new THREE.BoxGeometry(0.26, 0.04, 0.02), white, 0, 1.47, -0.12); // gola
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 6), skin, 0, 1.56, 0); // pescoço
  add(new THREE.SphereGeometry(0.11, 10, 8), skin, 0, 1.68, 0, 1, 1.12, 1); // cabeça
  add(new THREE.SphereGeometry(0.115, 10, 8, 0, PI * 2, 0, PI / 2.1), hair, 0, 1.7, 0.01); // cabelo
  add(new THREE.SphereGeometry(0.06, 8, 6), hair, 0, 1.7, 0.11); // coque
  add(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 8), white, 0, 1.81, -0.01); // touca
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.012, 5, 4), dark, 0.038 * s, 1.7, -0.1); // olhos
    add(new THREE.CylinderGeometry(0.035, 0.03, 0.42, 6), blue, 0.2 * s, 1.24, -0.02).rotation.z = 0.1 * s; // braço
    add(new THREE.SphereGeometry(0.035, 6, 5), skin, 0.22 * s, 1.0, -0.03); // mão
    add(new THREE.CylinderGeometry(0.04, 0.035, 0.42, 6), mat(null, 0xd8cfc4), 0.08 * s, 0.21, 0); // perna (meia)
    add(new THREE.BoxGeometry(0.08, 0.05, 0.16), white, 0.08 * s, 0.025, -0.03); // sapato
  }
  return g;
}
void buildEntityModel; void Drawer;
