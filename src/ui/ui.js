// Interface: HUD, menus, painéis, legendas, documentos, inventário, diário e configurações.
import { BINDING_LABELS, DEFAULT_BINDINGS, saveSettings, DIFFICULTY } from '../core/settings.js';
import { SANITY_STAGES } from '../game/status.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function keyName(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { ShiftLeft: 'Shift', ShiftRight: 'Shift Dir.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl Dir.', Space: 'Espaço', Tab: 'Tab', AltLeft: 'Alt', Escape: 'Esc', Enter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Caps' };
  return map[code] || code;
}

export class UI {
  constructor(g) {
    this.g = g;
    this.open = null; // painel aberto: 'doc' | 'inventory' | 'journal'
    this.subs = [];
    this.docQueue = null;
    this.invSel = null; this.combineFrom = null;
    this.setupMenus();
    this.objHideT = 0;
  }

  // ------------------------------------------------ HUD
  showHUD(on) { $('#hud').classList.toggle('hidden', !on); }
  setPrompt(text, hold) {
    const p = $('#prompt'); p.textContent = text; p.classList.toggle('show', !!text);
    $('#crosshair').classList.toggle('active', !!text);
    $('#holdRing').classList.toggle('show', !!(text && hold && this._holdFrac > 0));
  }
  setHold(f) {
    this._holdFrac = f;
    $('#holdRing').classList.toggle('show', f > 0);
    $('#holdArc').style.strokeDashoffset = String(100.5 * (1 - Math.min(1, f)));
  }
  toast(text, dur = 2.8) {
    const box = $('#toasts');
    if ([...box.children].some((c) => c.textContent === text)) return;
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, dur * 1000);
    while (box.children.length > 3) box.firstChild.remove();
  }
  subtitle(label, text, dur, speaker) {
    if (!this.g.settings.subtitles) return;
    const box = $('#subtitles');
    const el = document.createElement('div'); el.className = 'sub' + (speaker === 'entity' ? ' entity' : '');
    const b = document.createElement('b'); b.textContent = label + ':'; el.appendChild(b);
    el.appendChild(document.createTextNode(text));
    const wrap = document.createElement('div'); wrap.appendChild(el); box.appendChild(wrap);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => wrap.remove(), 400); }, dur * 1000);
    while (box.children.length > 3) box.firstChild.remove();
  }
  hideOverlay(type) { const o = $('#hideOverlay'); o.className = type || ''; }
  setBreath(f) { const m = $('#breathMeter'); m.classList.toggle('show', f >= 0); if (f >= 0) $('b', m).style.width = (f * 100) + '%'; }
  struggle(f, text) {
    const s = $('#struggle');
    if (f < 0) { s.classList.add('hidden'); return; }
    s.classList.remove('hidden'); $('.txt', s).textContent = text; $('.bar b', s).style.width = Math.min(100, f * 100) + '%';
  }

  // objetivo atual
  objective(task, flash = true) {
    const o = $('#objective');
    if (!task) { o.classList.remove('show'); return; }
    $('.obj-head', o).textContent = task.head || 'OBJETIVO ATUAL';
    $('.obj-title', o).textContent = task.title;
    const ul = $('.obj-steps', o); ul.innerHTML = '';
    for (const s of task.steps || []) { if (s.hidden) continue; const li = document.createElement('li'); li.textContent = s.text; if (s.done) li.className = 'done'; ul.appendChild(li); }
    if (flash) { o.classList.add('show'); this.objHideT = 7; }
  }
  peekObjective() { $('#objective').classList.add('show'); this.objHideT = 4; }

  updateHUD(dt) {
    const g = this.g;
    if (this.objHideT > 0) { this.objHideT -= dt; if (this.objHideT <= 0 && !g.input.key('journal')) $('#objective').classList.remove('show'); }
    // sanidade (olho que se fecha e racha)
    const s = g.status.sanity, st = g.status.stage;
    const open = 4 + (s / 100) * 12;
    $('#eyeShape').setAttribute('d', `M2 12 Q24 ${12 - open} 46 12 Q24 ${12 + open} 2 12Z`);
    $('#eyePupil').setAttribute('r', String(3 + (100 - s) / 30));
    const cracks = ['', 'M24 2 L22 6', 'M24 2 L22 6 L26 9', 'M24 2 L22 6 L26 9 M8 10 L12 12', 'M24 2 L22 6 L26 9 L23 13 M8 10 L12 12 L10 15 M40 10 L36 13'];
    $('#eyeCrack').setAttribute('d', cracks[st]);
    $('#sanityEye').style.opacity = (0.3 + st * 0.12).toFixed(2);
    $('#sanityEye').title = 'Alice está ' + SANITY_STAGES[st].name.toLowerCase();
    $('#sanityNum').textContent = g.settings.showSanityNumber ? `${Math.round(s)}` : '';
    // lanterna
    const bat = $('#battery');
    bat.classList.toggle('show', g.flashlight.owned && (g.flashlight.on || g.flashlight.battery < 25));
    const cells = $$('#battery i'), lvl = Math.ceil(g.flashlight.battery / 25);
    cells.forEach((c, i) => c.classList.toggle('off', i >= lvl));
    bat.classList.toggle('low', g.flashlight.battery < 20);
    // estamina
    const sm = $('#stamina'); sm.classList.toggle('show', g.player.stamina < 99); $('div', sm).style.width = g.player.stamina + '%';
  }

  // ------------------------------------------------ efeitos de tela
  fade(to, dur = 1) {
    const f = $('#fade'); f.style.transitionDuration = dur + 's'; f.style.opacity = String(to);
    return this.g.wait(dur);
  }
  async titleCard(t1, t2, dur = 4) {
    const tc = $('#titlecard'); $('.t1', tc).textContent = t1; $('.t2', tc).textContent = t2;
    tc.classList.remove('hidden'); requestAnimationFrame(() => tc.classList.add('show'));
    await this.g.wait(dur); tc.classList.remove('show'); await this.g.wait(1.5); tc.classList.add('hidden');
  }
  vhs(on, draw) {
    $('#vhs').classList.toggle('hidden', !on);
    this.vhsDraw = on ? draw : null;
  }
  // dica "segure E para pular" (k < 0 esconde)
  skipHint(k, key = 'E') {
    let el = document.getElementById('skipHint');
    if (!el) { el = document.createElement('div'); el.id = 'skipHint'; el.style.cssText = 'position:fixed;right:28px;bottom:24px;z-index:7;color:#e9e2d0;font:13px Georgia;letter-spacing:.06em;text-shadow:0 0 8px #000;opacity:.75;pointer-events:none'; document.body.appendChild(el); }
    if (k < 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = k > 0.02 ? `Pulando... ${Math.round(k * 100)}%` : `Segure [${key}] para pular`;
  }
  // abertura desenhada
  story(on) { $('#story').classList.toggle('hidden', !on); this.storyOn = on; $('#status').style.visibility = on ? 'hidden' : ''; }
  updateStory(t, draw) { if (!this.storyOn) return; draw($('#storyCanvas').getContext('2d'), t); }
  updateVHS(t) {
    if (!this.vhsDraw) return;
    const c = $('#vhsCanvas'), x = c.getContext('2d');
    this.vhsDraw(x, t);
    // ruído e linhas
    for (let i = 0; i < 400; i++) { const v = Math.random() * 255; x.fillStyle = `rgba(${v},${v},${v},0.08)`; x.fillRect(Math.random() * 320, Math.random() * 240, 2, 1); }
    const band = (t * 40) % 260 - 10; x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(0, band, 320, 6);
    const s = Math.floor(t); $('#vhsTc').textContent = `SP 0:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ------------------------------------------------ documentos
  // doc: {title, img, text, style, pages:[{title,img,text}], onClose}
  showDoc(doc) {
    const g = this.g;
    const pages = doc.pages || [doc];
    this.docState = { doc, pages, i: 0 };
    if (doc.id && !g.readDocs.includes(doc.id)) { g.readDocs.push(doc.id); }
    g.audio.play('paper', { vol: 0.5 });
    this.renderDoc();
    this.openPanel('doc');
  }
  renderDoc() {
    const { pages, i, doc } = this.docState; const p = pages[i];
    const el = $('#doc');
    $('.doc-title', el).textContent = p.title || doc.title || '';
    const cv = $('.doc-img', el);
    if (p.img) { cv.classList.remove('none'); cv.width = p.img.width; cv.height = p.img.height; cv.getContext('2d').drawImage(p.img, 0, 0); }
    else cv.classList.add('none');
    const tx = $('.doc-text', el); tx.textContent = p.text || ''; tx.className = 'doc-text ' + (p.style || doc.style || '');
    const nav = $('.doc-nav', el); nav.classList.toggle('single', pages.length < 2);
    $('.page', nav).textContent = `${i + 1} / ${pages.length}`;
  }
  docPage(d) {
    const st = this.docState; if (!st) return;
    st.i = Math.max(0, Math.min(st.pages.length - 1, st.i + d));
    this.renderDoc(); this.g.audio.play('paper', { vol: 0.3 });
  }

  // ------------------------------------------------ painéis (pausam o mundo)
  openPanel(name) {
    const g = this.g;
    if (this.open && this.open !== name) this.closePanel(true);
    this.open = name;
    $('#' + name).classList.remove('hidden');
    g.wasLocked = false;
    g.input.unlock();
    if (name === 'inventory') this.renderInventory();
    if (name === 'journal') this.renderJournal();
  }
  closePanel(silent = false) {
    const g = this.g, name = this.open;
    if (!name) return;
    $('#' + name).classList.add('hidden');
    this.open = null;
    if (name === 'doc' && this.docState) {
      const cb = this.docState.doc.onClose; this.docState = null;
      if (cb) Promise.resolve().then(() => cb(g));
    }
    this.combineFrom = null;
    if (!silent && g.playing && !g.paused) g.input.lock();
  }
  handlePanelKeys() {
    const g = this.g, inp = g.input;
    if (!this.open) return false;
    // documentos fecham só com a tecla de interagir (E); inventário e diário também aceitam Esc
    if (inp.hitCode('Escape') && this.open !== 'doc') { this.closePanel(); return true; }
    if (this.open === 'doc') {
      if (inp.hit('interact')) this.closePanel();
      if (inp.hitCode('ArrowRight') || inp.hitCode('KeyD')) this.docPage(1);
      if (inp.hitCode('ArrowLeft') || inp.hitCode('KeyA')) this.docPage(-1);
    }
    if (this.open === 'inventory' && inp.hit('inventory')) this.closePanel();
    if (this.open === 'journal' && inp.hit('journal')) this.closePanel();
    return true;
  }

  renderInventory() {
    const g = this.g, grid = $('.inv-grid'), items = g.inventory.list();
    grid.innerHTML = '';
    if (!items.length) grid.innerHTML = '<div class="jr-note">Nada guardado ainda.</div>';
    for (const it of items) {
      const b = document.createElement('button'); b.className = 'inv-item' + (this.invSel === it.id ? ' sel' : '') + (this.combineFrom === it.id ? ' combine' : '');
      b.innerHTML = `<img src="${it.icon}" alt=""><span></span>${it.n > 1 ? `<span class="n">x${it.n}</span>` : ''}`;
      b.querySelector('span').textContent = it.name;
      b.onclick = () => {
        if (this.combineFrom && this.combineFrom !== it.id) {
          const a = this.combineFrom; this.combineFrom = null;
          g.inventory.combine(a, it.id); this.invSel = null; this.renderInventory(); return;
        }
        this.invSel = it.id; this.renderInventory();
      };
      grid.appendChild(b);
    }
    const sel = items.find((i) => i.id === this.invSel);
    const d = $('.inv-detail');
    d.style.visibility = sel ? 'visible' : 'hidden';
    if (sel) {
      $('.inv-icon', d).src = sel.icon; $('.inv-name', d).textContent = sel.name; $('.inv-desc', d).textContent = sel.desc;
      $('.inv-hint', d).textContent = this.combineFrom ? 'Escolha outro item para combinar.' : '';
    }
  }
  renderJournal() {
    const g = this.g, t = g.tasks.current;
    const o = $('.jr-obj'); o.innerHTML = '';
    if (t) {
      const h = document.createElement('div'); h.className = 't'; h.textContent = t.title; o.appendChild(h);
      const ul = document.createElement('ul');
      for (const s of t.steps || []) { if (s.hidden) continue; const li = document.createElement('li'); li.textContent = s.text; if (s.done) li.className = 'done'; ul.appendChild(li); }
      o.appendChild(ul);
    } else o.innerHTML = '<div class="jr-note">Nenhum objetivo.</div>';
    const n = document.createElement('p'); n.className = 'jr-note';
    n.textContent = `Dificuldade: ${DIFFICULTY[g.settings.difficulty].label}.  Alice está ${g.status.stageName().toLowerCase()}.`;
    o.appendChild(n);
    const docs = $('.jr-docs'); docs.innerHTML = '';
    if (!g.readDocs.length) docs.innerHTML = '<div class="jr-note">Nenhum documento lido.</div>';
    for (const id of g.readDocs) {
      const d = g.docs[id]; if (!d) continue;
      const b = document.createElement('button'); b.textContent = d.title; b.onclick = () => { this.closePanel(true); this.showDoc({ ...d, onClose: null }); };
      docs.appendChild(b);
    }
  }

  // ------------------------------------------------ menus
  show(id, on = true) { $('#' + id).classList.toggle('hidden', !on); }
  setupMenus() {
    const g = this.g;
    $('#warnOk').onclick = () => { this.show('warning', false); g.onWarningAccepted(); };
    $$('#menu [data-m]').forEach((b) => b.onclick = () => {
      g.audio.init(g.settings);
      const m = b.dataset.m;
      if (m === 'new') { this.show('newgame'); }
      if (m === 'continue') g.continueGame();
      if (m === 'settings') this.openSettings('menu');
      if (m === 'credits') this.show('credits');
      if (m === 'exit') { document.body.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#777;font-family:Georgia">Você pode fechar esta aba.</div>'; }
    });
    $$('#newgame [data-d]').forEach((b) => b.onclick = () => { this.show('newgame', false); g.newGame(b.dataset.d); });
    $('#newgame .back').onclick = () => this.show('newgame', false);
    $('#credits .back').onclick = () => this.show('credits', false);
    $$('#pause [data-p]').forEach((b) => b.onclick = () => {
      const p = b.dataset.p;
      if (p === 'resume') g.setPaused(false);
      if (p === 'journal') { this.show('pause', false); this.openPanel('journal'); this._fromPause = true; }
      if (p === 'settings') this.openSettings('pause');
      if (p === 'checkpoint') g.reloadCheckpoint();
      if (p === 'menu') g.toMenu();
    });
    $$('#death [data-x]').forEach((b) => b.onclick = () => { if (b.dataset.x === 'retry') g.reloadCheckpoint(); else g.toMenu(); });
    $$('#ending [data-x]').forEach((b) => b.onclick = () => g.toMenu());
    $('#settings .back').onclick = () => { this.show('settings', false); if (this._settingsFrom === 'pause') this.show('pause'); };
    $$('#settings .tabs button').forEach((b) => b.onclick = () => { $$('#settings .tabs button').forEach((x) => x.classList.toggle('on', x === b)); this.renderSettings(b.dataset.t); });
    $('#doc .prev').onclick = () => this.docPage(-1);
    $('#doc .next').onclick = () => this.docPage(1);
    $$('.inv-actions button').forEach((b) => b.onclick = () => {
      const id = this.invSel; if (!id) return;
      if (b.dataset.a === 'use') { g.inventory.use(id); this.renderInventory(); }
      if (b.dataset.a === 'combine') { this.combineFrom = id; this.renderInventory(); }
    });
  }
  openSettings(from) {
    this._settingsFrom = from; this.show('pause', false); this.show('settings');
    $$('#settings .tabs button').forEach((x, i) => x.classList.toggle('on', i === 0));
    this.renderSettings('game');
  }
  renderSettings(tab) {
    const g = this.g, s = g.settings, body = $('#settings .tabbody');
    body.innerHTML = '';
    const commit = () => { saveSettings(s); g.applySettings(); };
    const row = (label, ctl) => { const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.textContent = label; r.appendChild(l); r.appendChild(ctl); body.appendChild(r); };
    const slider = (label, key, min, max, step, fmt = (v) => v) => {
      const w = document.createElement('div'); w.className = 'ctl';
      const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = s[key];
      const v = document.createElement('span'); v.className = 'val'; v.textContent = fmt(s[key]);
      i.oninput = () => { s[key] = parseFloat(i.value); v.textContent = fmt(s[key]); commit(); };
      w.append(i, v); row(label, w);
    };
    const toggle = (label, key) => {
      const b = document.createElement('button'); b.className = 'toggle' + (s[key] ? ' on' : '');
      b.onclick = () => { s[key] = !s[key]; b.classList.toggle('on', s[key]); commit(); };
      row(label, b);
    };
    const pct = (v) => Math.round(v * 100) + '%';
    if (tab === 'game') {
      const sel = document.createElement('select');
      for (const [k, d] of Object.entries(DIFFICULTY)) { const o = document.createElement('option'); o.value = k; o.textContent = d.label; if (s.difficulty === k) o.selected = true; sel.appendChild(o); }
      sel.onchange = () => { s.difficulty = sel.value; commit(); };
      row('Dificuldade', sel);
      slider('Sensibilidade do mouse', 'sensitivity', 0.2, 3, 0.05, (v) => v.toFixed(2));
      toggle('Inverter eixo Y', 'invertY');
      toggle('Balanço da câmera ao andar', 'headBob');
      toggle('Voz sintetizada do Windows (experimental)', 'voiceSynth');
      // levar o save de um lugar para outro (navegador, site, executável)
      const sv = document.createElement('div'); sv.className = 'ctl';
      const ex = document.createElement('button'); ex.textContent = 'Exportar save';
      ex.onclick = () => {
        const data = localStorage.getItem('alice.save.v1');
        if (!data) { this.toast('Ainda não há progresso salvo.'); return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = 'alice-save.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      const im = document.createElement('button'); im.textContent = 'Importar save';
      const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
      im.onclick = () => file.click();
      file.onchange = async () => {
        try {
          const d = JSON.parse(await file.files[0].text());
          if (!d || !d.stage) throw new Error('inválido');
          localStorage.setItem('alice.save.v1', JSON.stringify(d));
          const b = document.getElementById('btnContinue'); if (b) b.disabled = false;
          this.toast('Save importado. Use "Continuar" no menu.', 4);
        } catch { this.toast('Esse arquivo não é um save de ALICE.', 4); }
        file.value = '';
      };
      sv.append(ex, im, file); row('Progresso salvo', sv);
    }
    if (tab === 'video') {
      slider('Campo de visão', 'fov', 60, 95, 1, (v) => v + '°');
      slider('Resolução interna', 'resolution', 0.6, 2.4, 0.1, (v) => Math.round(270 * v) + 'p');
      toggle('Tremor de vértices (estilo PlayStation 1)', 'vertexJitter');
      const n = document.createElement('p'); n.className = 'small'; n.textContent = 'A resolução baixa faz parte da estética. Aumente se tiver uma placa de vídeo dedicada; diminua se o jogo travar.'; body.appendChild(n);
    }
    if (tab === 'audio') {
      slider('Volume geral', 'master', 0, 1, 0.05, pct); slider('Efeitos', 'sfx', 0, 1, 0.05, pct);
      slider('Vozes', 'voice', 0, 1, 0.05, pct); slider('Música', 'music', 0, 1, 0.05, pct);
    }
    if (tab === 'access') {
      toggle('Legendas', 'subtitles'); slider('Tamanho das legendas', 'subtitleSize', 0.8, 1.8, 0.1, pct);
      toggle('Reduzir tremor de câmera', 'reduceShake'); toggle('Reduzir distorção visual', 'reduceDistortion');
      toggle('Reduzir luzes piscando', 'reduceFlashing'); toggle('Mostrar valor numérico da sanidade', 'showSanityNumber');
    }
    if (tab === 'controls') {
      for (const action of Object.keys(DEFAULT_BINDINGS)) {
        const b = document.createElement('button'); b.className = 'keybtn'; b.textContent = keyName(s.bindings[action]);
        b.onclick = () => {
          b.classList.add('wait'); b.textContent = 'Pressione...';
          g.input.captureCallback = (code) => {
            if (code !== 'Escape') {
              for (const [a, c] of Object.entries(s.bindings)) if (c === code && a !== action) s.bindings[a] = s.bindings[action];
              s.bindings[action] = code;
            }
            commit(); this.renderSettings('controls');
          };
        };
        row(BINDING_LABELS[action], b);
      }
      const r = document.createElement('button'); r.textContent = 'Restaurar padrão'; r.style.marginTop = '14px';
      r.onclick = () => { s.bindings = { ...DEFAULT_BINDINGS }; commit(); this.renderSettings('controls'); };
      body.appendChild(r);
      const n = document.createElement('p'); n.className = 'small'; n.textContent = 'Mouse: olhar ao redor.  Esc: pausar.'; body.appendChild(n);
    }
  }
}
