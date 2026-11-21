// ALICE: ponto de entrada. Liga todos os sistemas e roda o loop principal.
import * as THREE from 'three';
import { RetroRenderer } from './render/retro.js';
import { Images } from './render/textures.js';
import { World } from './world/builder.js';
import { LightSystem } from './world/lights.js';
import { NavGrid } from './world/nav.js';
import { buildHouse } from './world/house.js';
import { Input } from './core/input.js';
import { EventBus, damp } from './core/events.js';
import { loadSettings, saveSettings, DIFFICULTY } from './core/settings.js';
import { AudioEngine } from './audio/audio.js';
import { Player } from './game/player.js';
import { InteractionSystem } from './game/interact.js';
import { HidingSystem } from './game/hiding.js';
import { Inventory } from './game/inventory.js';
import { Status } from './game/status.js';
import { Flashlight } from './game/flashlight.js';
import { Entity } from './game/entity.js';
import { Director } from './game/director.js';
import { Story, Tasks } from './game/story.js';
import { buildDocs } from './game/docs.js';
import { UI, keyName } from './ui/ui.js';
import { drawStory } from './game/cutscene.js';

const SAVE_KEY = 'alice.save.v1';
const BOOT_KEY = 'alice.boot';

// Recursos que sobrevivem entre partidas (o mundo é recriado sem recarregar a página,
// então voltar ao menu ou a um checkpoint não depende do servidor e funciona no executável)
const SHARED = {};
function shared() {
  if (SHARED.rr) return SHARED;
  SHARED.settings = loadSettings();
  SHARED.canvas = document.getElementById('game');
  SHARED.rr = new RetroRenderer(SHARED.canvas);
  SHARED.input = new Input(SHARED.canvas, SHARED.settings);
  SHARED.audio = new AudioEngine(); SHARED.audio.settings = SHARED.settings;
  SHARED.canvas.addEventListener('click', () => { const g = window.__alice; if (g && g.playing && !g.paused && !g.ui.open && !g.dead) g.input.lock(); });
  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);color:#e9e2d0;font:15px Georgia;letter-spacing:.05em;text-shadow:0 0 10px #000;pointer-events:none;display:none;z-index:6';
  hint.textContent = 'Clique na tela para continuar';
  document.body.appendChild(hint); SHARED.clickHint = hint;
  return SHARED;
}

class Game {
  constructor(mode = null) {
    const sh = shared();
    this.settings = sh.settings;
    this.diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.normal;
    this.events = new EventBus();
    this.canvas = sh.canvas;
    this.rr = sh.rr;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x050505, 7, 24);
    this.time = 0; this.dt = 0; this.realT = 0;
    this.flags = {}; this.collected = new Set(); this.readDocs = [];
    this.timers = []; this.conds = [];
    this.playing = false; this.paused = false; this.cinematic = false; this.dead = false;
    this.fx = { desat: 0.1, tint: [1.05, 0.98, 0.9], grain: 0.06, vhs: 0, flash: 0 };
    this.fxRed = 0; this.deathRed = 0; this.navDirty = false; this.wasLocked = false;
    this.input = sh.input; this.input.down.clear();
    this.audio = sh.audio; this.audio.settings = this.settings;
    this.ui = new UI(this);
    this.audio.onSubtitle = (...a) => this.ui.subtitle(...a);
    this.images = { ...Images, calendarTex: Images.calendar() };
    // mundo
    this.world = new World(this.scene); this.world.__images = this.images;
    this.lights = new LightSystem(this.scene, this.world); this.world.lights = this.lights;
    this.player = new Player(this);
    this.interact = new InteractionSystem(this);
    this.hiding = new HidingSystem(this);
    this.inventory = new Inventory(this);
    this.status = new Status(this);
    this.flashlight = new Flashlight(this);
    this.tasks = new Tasks(this);
    this.docs = buildDocs(this.images);
    this.house = buildHouse(this);
    this.entity = new Entity(this);
    this.navs = {
      house: new NavGrid(this.world, -0.5, 16.5, -0.5, 12.5),
      basement: new NavGrid(this.world, 29.5, 38.5, -0.5, 8.5),
    };
    this.director = new Director(this);
    this.story = new Story(this); this.story.setup();
    this.ray = new THREE.Raycaster();
    this.audio.occlusionFn = (p) => this.occlusion(p);
    this.occT = 0; this.vhsT = 0;
    this.applySettings();
    this.clickHint = sh.clickHint;
    window.__alice = this; // depuração
    // Atalho de desenvolvimento: aliceDebug.goto('act3') salta para um checkpoint
    window.aliceDebug = {
      stages: () => this.story.stages.map((s) => s.id),
      goto: (stage, diff = 'normal') => {
        const items = { act2: [['flashlight', 1]], act3: [], chase: [['flashlight', 1], ['battery', 2]], act4: [['flashlight', 1]], puzzle: [['flashlight', 1]], act5: [], mirror: [] };
        const d = { stage, difficulty: diff, inventory: items[stage] || [], flags: {}, readDocs: [], sanity: 80, battery: 100, owned: ['chase', 'act4', 'puzzle', 'act2'].includes(stage) };
        d.collected = d.owned ? ['flashlight'] : [];
        localStorage.setItem(SAVE_KEY, JSON.stringify(d)); window.__alice.reloadCheckpoint();
      },
    };
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.boot(mode);
  }

  // desmonta esta partida e cria outra do zero, sem recarregar a página
  restart(mode) {
    this.destroyed = true;
    this.audio.stopAll();
    this.input.unlock(); this.input.down.clear();
    for (const id of ['menu', 'newgame', 'pause', 'settings', 'credits', 'death', 'ending', 'loading', 'doc', 'inventory', 'journal', 'vhs', 'titlecard', 'warning', 'story']) document.getElementById(id).classList.add('hidden');
    document.getElementById('subtitles').innerHTML = ''; document.getElementById('toasts').innerHTML = '';
    this.ui.hideOverlay(null); this.ui.struggle(-1); this.ui.objective(null); this.ui.showHUD(false); this.ui.setPrompt(''); this.ui.storyOn = false;
    this.clickHint.style.display = 'none';
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    new Game(mode);
    window.__alice.ui.fade(0, 0.6);
  }

  // ------------------------------------------------ inicialização / menus
  boot(mode) {
    this.menuScene();
    if (mode === 'load' && this.hasSave()) { this.ui.show('warning', false); this.audio.init(this.settings); this.startFromSave(this.loadSave()); return; }
    if (mode === 'menu') { this.ui.show('warning', false); this.showMenu(); return; }
    this.ui.show('warning', true);
  }
  onWarningAccepted() { this.audio.init(this.settings); this.showMenu(); }
  showMenu() {
    this.ui.show('menu');
    document.getElementById('btnContinue').disabled = !this.hasSave();
    if (!this.menuAmb && this.audio.ctx) this.menuAmb = [this.audio.loop('room', { vol: 0.5 }), this.audio.loop('musicbox', { bus: 'music', vol: 0.5, detune: 18, rate: 0.85 })];
  }
  menuScene() {
    this.lights.setMood(0.6, 0.8);
    this.entity.appear(15.3, 5.0, PI_2(), { lookLimit: 99 });
    this.house.doors.living.open(new THREE.Vector3(3, 0, 4), { silent: true });
  }
  stopMenu() {
    if (this.menuAmb) { this.menuAmb.forEach((l) => l.stop(0.5)); this.menuAmb = null; }
    this.entity.vanish();
    this.house.doors.living.close({ silent: true });
    this.lights.setMood(1, 1);
  }
  beginPlay() {
    this.stopMenu();
    this.ui.show('menu', false);
    this.playing = true; this.dead = false;
    this.ui.showHUD(true);
    this.input.lock();
  }
  newGame(diff) {
    this.settings.difficulty = diff; saveSettings(this.settings); this.diff = DIFFICULTY[diff];
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ok */ }
    this.beginPlay();
    this.story.runFrom(0, false);
  }
  continueGame() { if (this.hasSave()) this.startFromSave(this.loadSave()); }
  startFromSave(d) {
    this.settings.difficulty = d.difficulty || 'normal'; this.diff = DIFFICULTY[this.settings.difficulty];
    this.inventory.load(d.inventory);
    for (const k of Object.keys(this.flags)) delete this.flags[k];
    Object.assign(this.flags, d.flags || {}); // mantém a mesma referência usada pelas interações
    this.collected = new Set(d.collected || []);
    this.readDocs = d.readDocs || [];
    this.status.sanity = d.sanity ?? 100;
    this.flashlight.battery = d.battery ?? 100; this.flashlight.owned = !!d.owned;
    const idx = this.story.indexOf(d.stage);
    this.story.applyUpTo(idx);
    this.story.applyCollected();
    this.navDirty = true;
    this.beginPlay();
    this.story.runFrom(idx, true);
  }
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }
  saveCheckpoint(stage) {
    const d = {
      stage, difficulty: this.settings.difficulty, inventory: this.inventory.serialize(), flags: { ...this.flags, phoneRinging: false },
      collected: [...this.collected], readDocs: this.readDocs, sanity: Math.max(this.status.sanity, 35),
      battery: this.flashlight.battery, owned: this.flashlight.owned, savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* sem armazenamento */ }
    if (stage !== 'prologue') this.ui.toast('Progresso salvo.', 2);
  }
  reloadCheckpoint() { this.restart('load'); }
  toMenu() { this.restart('menu'); }
  finishGame() {
    try { localStorage.removeItem(SAVE_KEY); localStorage.setItem('alice.completed', '1'); } catch { /* ok */ }
    this.playing = false; this.ui.showHUD(false); this.input.unlock(); this.audio.stopAll();
    this.ui.show('ending');
  }

  // ------------------------------------------------ estado
  setPaused(p) {
    if (!this.playing || this.dead) return;
    this.paused = p; this.ui.show('pause', p); this.ui.show('settings', false);
    this.audio.pause(p);
    if (p) { this.input.unlock(); this.wasLocked = false; } else this.input.lock();
  }
  setCinematic(on) { this.cinematic = on; this.player.moveLocked = on; this.player.lookLocked = on; if (on) this.ui.setPrompt(''); }
  wait(s) { return new Promise((res) => this.timers.push({ t: s, res })); }
  until(fn, timeout = 0) { return new Promise((res) => this.conds.push({ fn, res, t: timeout })); }
  keyName(action) { return keyName(this.settings.bindings[action]); }
  noise(pos, radius, type) { this.entity.hear(pos, radius, type); this.events.emit('noise', { pos, radius, type }); }
  occlusion(p) {
    const from = this.player.camera.getWorldPosition(new THREE.Vector3());
    const dir = p.clone().sub(from); const d = dir.length(); if (d < 0.5) return 0;
    this.ray.set(from, dir.normalize()); this.ray.far = d - 0.2;
    return Math.min(2, this.ray.intersectObjects(this.world.occluders, false).length);
  }
  caught() {
    if (this.dead) return;
    this.dead = true;
    const e = this.entity;
    this.setCinematic(true);
    this.hiding.active && this.hiding.exit(true);
    this.player.lookAt(e.head, 0.25);
    this.audio.play('stinger', { vol: 1, base: 80 });
    const lines = [['daniel', 'Achei você.'], ['emily', 'Mamãe, fica com a gente.'], ['thomas', 'Agora você não vai embora.']];
    const [sp, t] = lines[(Math.random() * lines.length) | 0];
    e.say(sp, t);
    this.deathRed = 0.8; this.player.shake = 1.5;
    this.wait(0.9).then(() => {
      this.ui.fade(1, 1.2).then(() => {
        this.ui.showHUD(false); this.input.unlock(); this.audio.stopAll();
        this.ui.show('death'); this.ui.fade(0, 0.01);
      });
    });
  }
  applySettings() {
    const s = this.settings;
    this.diff = DIFFICULTY[s.difficulty] || DIFFICULTY.normal;
    this.rr.setScale(s.resolution);
    this.rr.setVertexJitter(!!s.vertexJitter && !s.reduceDistortion);
    this.audio.settings = s; this.audio.applyVolumes();
    document.documentElement.style.setProperty('--sub', s.subtitleSize);
    this.lights.reduce = s.reduceFlashing;
  }

  // ------------------------------------------------ entrada global
  handleKeys() {
    const inp = this.input, ui = this.ui;
    if (ui.open) {
      ui.handlePanelKeys();
      // a tecla que fechou o painel não pode valer também para o mundo (senão o E reabre o documento)
      inp.pressed.clear();
      if (!ui.open && ui._fromPause) { ui._fromPause = false; this.setPaused(true); }
      return;
    }
    if (this.paused) { if (inp.hitCode('Escape')) this.setPaused(false); return; }
    if (inp.hitCode('Escape')) { this.setPaused(true); return; }
    if (this.cinematic || this.hiding.struggle) return;
    if (inp.hit('inventory')) { this.wasLocked = false; ui.openPanel('inventory'); return; }
    if (inp.hit('journal')) { this.wasLocked = false; ui.openPanel('journal'); return; }
    if (inp.hit('flashlight')) this.flashlight.toggle();
  }

  // ------------------------------------------------ loop
  loop(now) {
    if (this.destroyed) return;
    requestAnimationFrame(this.loop);
    if (!this.manual) this.tick(now);
  }
  // avança a simulação manualmente (testes automatizados)
  async step(sec, fps = 30) {
    this.manual = true;
    let t = this.lastNow || performance.now();
    for (let i = 0; i < Math.round(sec * fps); i++) { t += 1000 / fps; this.tick(t); await Promise.resolve(); await Promise.resolve(); }
    this.manual = false; this.lastNow = performance.now();
    return this.stageId;
  }
  tick(now) {
    const dt = Math.max(0, Math.min(0.05, (now - (this.lastNow || now)) / 1000)); this.lastNow = Math.max(now, this.lastNow || 0);
    this.realT += dt;
    if (this.playing && !this.dead) this.handleKeys();
    const sim = this.playing && !this.paused && !this.ui.open && !this.dead;
    if (this.navDirty) { this.navs.house.rebuild(); this.navs.basement.rebuild(); this.navDirty = false; }
    if (sim) {
      this.dt = dt; this.time += dt;
      // ponteiro travado?
      if (this.input.locked) { this.wasLocked = true; this.clickHint.style.display = 'none'; }
      else { if (this.wasLocked) { this.wasLocked = false; this.setPaused(true); } else this.clickHint.style.display = this.cinematic ? 'none' : 'block'; }
      for (const t of [...this.timers]) { t.t -= dt; if (t.t <= 0) { this.timers.splice(this.timers.indexOf(t), 1); t.res(); } }
      for (const c of [...this.conds]) {
        let ok = false; try { ok = c.fn(); } catch (err) { console.error(err); }
        if (c.t > 0) { c.t -= dt; if (c.t <= 0) ok = true; }
        if (ok) { this.conds.splice(this.conds.indexOf(c), 1); c.res(); }
      }
      this.player.update(dt);
      this.interact.update(dt);
      this.hiding.update(dt);
      this.entity.update(dt);
      this.director.update(dt);
      this.status.update(dt);
      this.flashlight.update(dt);
      this.story.update(dt);
    } else {
      this.clickHint.style.display = 'none';
      if (!this.playing) this.menuCamera(dt);
      else if (this.dead) {
        this.dt = dt; this.player.lookTween && this.player.update(dt); this.player.applyCamera(dt);
        for (const t of [...this.timers]) { t.t -= dt; if (t.t <= 0) { this.timers.splice(this.timers.indexOf(t), 1); t.res(); } }
      }
    }
    if (this.dead) this.time += dt;
    this.lights.update(dt, this.player.pos, this.time);
    this.updateFog();
    this.updateFX(dt);
    if (this.audio.ctx) {
      this.audio.updateListener(this.player.camera);
      this.audio.update();
      this.occT -= dt; if (this.occT <= 0) { this.occT = 0.2; this.audio.updateOcclusion(); }
    }
    if (this.playing) this.ui.updateHUD(dt);
    if (this.ui.vhsDraw) { this.vhsT += dt; this.ui.updateVHS(this.vhsT); } else this.vhsT = 0;
    if (this.ui.storyOn) { if (sim) this.storyT = (this.storyT || 0) + dt; this.ui.updateStory(this.storyT || 0, drawStory); }
    this.rr.render(this.scene, this.player.camera, this.realT);
    this.input.endFrame();
  }
  menuCamera(dt) {
    const p = this.player, t = this.realT;
    p.pos.set(1.0 + Math.sin(t * 0.05) * 0.4, 0, 5.0 + Math.sin(t * 0.13) * 0.15);
    p.yaw = -Math.PI / 2 + Math.sin(t * 0.11) * 0.08; p.pitch = Math.sin(t * 0.07) * 0.04 - 0.03;
    p.eye = 1.55;
    p.applyCamera(dt);
    this.entity.update(dt);
    this.time = t;
  }
  updateFog() {
    const z = this.world.zoneAt(this.player.pos.x, this.player.pos.z);
    const f = this.scene.fog;
    const night = this.flags.night;
    const target = { yard: night ? [0x05070a, 4, 22] : [0x9aa2a6, 5, 30], house: [0x050505, 7, 24], basement: [0x020202, 2.5, 13], longhall: [0x030406, 3, 17], vision: [0x000000, 2, 12], hospital: [0xbfc4c0, 6, 30] }[z] || [0x050505, 7, 24];
    if (this.flags.act3 && z === 'house') { target[1] = 5; target[2] = 18; }
    // olhando o quintal de dentro de casa com a porta aberta: a neblina da casa vira a de fora
    const bd = this.house.doors.back;
    if (z === 'house' && bd.isOpen && !night) {
      const d = Math.hypot(this.player.pos.x - 7, this.player.pos.z - 12);
      if (d < 7) { const k = 1 - d / 7; target[0] = new THREE.Color(0x050505).lerp(new THREE.Color(0x9aa2a6), k).getHex(); target[1] = 7 - k * 4; target[2] = 24 + k * 6; }
    }
    // céu aberto: luz ambiente mais forte do lado de fora durante o dia
    this.lights.hemi.intensity = damp(this.lights.hemi.intensity, z === 'yard' ? (night ? 0.25 : 1.3) : 0.42, 3, this.dt || 0.016);
    f.color.setHex(target[0]); f.near = damp(f.near, target[1], 2, this.dt || 0.016); f.far = damp(f.far, target[2], 2, this.dt || 0.016);
    this.scene.background.setHex(z === 'hospital' ? 0xbfc4c0 : z === 'yard' ? (night ? 0x05070a : 0x9aa2a6) : (z === 'house' && this.house.doors.back.isOpen && !night && Math.hypot(this.player.pos.x - 7, this.player.pos.z - 12) < 7 ? 0x9aa2a6 : 0x000000));
  }
  updateFX(dt) {
    const u = this.rr.u, s = this.settings, fx = this.fx;
    const san = this.playing ? this.status.sanity / 100 : 0.85, st = this.playing ? this.status.stress / 100 : 0;
    const red = s.reduceDistortion ? 0.3 : 1;
    u.uGrain.value = fx.grain * 0.7 + (1 - san) * 0.06;
    // aberração só aparece de verdade com a sanidade baixa ou em perigo
    u.uAberr.value = (Math.max(0, 0.6 - san) * 2.2 + st * 0.5) * red;
    u.uDesat.value = Math.min(0.85, fx.desat + (1 - san) * 0.3);
    u.uWarp.value = 0; // distorção ondulada removida a pedido
    u.uVhs.value = (fx.vhs + (san < 0.2 ? 0.25 : 0)) * red;
    u.uVignette.value = 0.55 + st * 0.35 + (1 - san) * 0.2;
    u.uTint.value.set(...fx.tint);
    fx.flash = Math.max(0, fx.flash - dt * 1.2);
    u.uFlash.value = fx.flash * (s.reduceFlashing ? 0.2 : 1);
    this.deathRed = Math.max(0, this.deathRed - dt * 0.15);
    u.uRedPulse.value = Math.max(this.fxRed, this.deathRed) * (s.reduceFlashing ? 0.6 : 1);
  }
}

function PI_2() { return Math.PI / 2; }

new Game();
