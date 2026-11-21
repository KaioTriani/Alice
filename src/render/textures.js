// Texturas procedurais em baixa resolução (sem assets externos).
import * as THREE from 'three';

let seed = 1337;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const srand = (s) => { seed = s; };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  // ampliação nítida (pixel art) e redução com mipmaps: evita o "chiado" e a mistura de texturas à distância
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const hex = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
function jitterColor([r, g, b], amt) { const k = (rnd() - 0.5) * amt; return hex(r + k, g + k, b + k); }
function noise(ctx, w, h, amt, alpha = 0.12) {
  for (let i = 0; i < w * h * 0.5; i++) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd() * amt})`;
    ctx.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1);
  }
}

const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

export const Tex = {
  wood: (base = [118, 78, 48]) => cached('wood' + base, () => {
    srand(11); const S = 128, [c, x] = canvas(S, S), P = S / 4;
    for (let p = 0; p < 4; p++) {
      const tone = (rnd() - 0.5) * 26;
      x.fillStyle = hex(base[0] + tone, base[1] + tone * 0.8, base[2] + tone * 0.6); x.fillRect(0, p * P, S, P);
      // veios: linhas onduladas finas
      for (let v = 0; v < 9; v++) {
        const y0 = p * P + 2 + rnd() * (P - 4), amp = 0.6 + rnd() * 1.8, ph = rnd() * 6, dark = rnd() < 0.6;
        x.fillStyle = dark ? `rgba(40,22,10,${0.12 + rnd() * 0.14})` : `rgba(255,230,190,${0.05 + rnd() * 0.06})`;
        for (let px = 0; px < S; px++) x.fillRect(px, (y0 + Math.sin(px * 0.06 + ph) * amp) | 0, 1, 1);
      }
      // nó na madeira
      if (rnd() < 0.5) { x.fillStyle = 'rgba(50,28,14,0.35)'; x.beginPath(); x.ellipse(rnd() * S, p * P + P / 2, 3 + rnd() * 3, 1.5 + rnd(), 0, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(20,10,5,0.45)'; x.fillRect(0, p * P + P - 1, S, 1);
      x.fillStyle = 'rgba(255,240,210,0.08)'; x.fillRect(0, p * P, S, 1);
      const cut = (rnd() * S) | 0; x.fillStyle = 'rgba(20,10,5,0.4)'; x.fillRect(cut, p * P, 1, P - 1);
    }
    noise(x, S, S, 0.6, 0.08); return toTex(c);
  }),
  wallpaper: (a = [196, 170, 128], b = [170, 140, 100], k = 0) => cached('wp' + a + b + k, () => {
    srand(21 + k); const S = 64, [c, x] = canvas(S, S);
    x.fillStyle = hex(...a); x.fillRect(0, 0, S, S);
    // listras suaves
    for (let i = 0; i < S; i += 16) { x.fillStyle = `rgba(${b[0]},${b[1]},${b[2]},0.55)`; x.fillRect(i + 6, 0, 3, S); x.fillStyle = `rgba(${b[0]},${b[1]},${b[2]},0.25)`; x.fillRect(i + 5, 0, 1, S); x.fillRect(i + 9, 0, 1, S); }
    // pequenas flores entre as listras
    for (let y = 8; y < S; y += 24) for (let i = 0; i < S; i += 16) {
      const cx = i + 14 - 8 + ((y / 24) % 2 ? 8 : 0) - 6, cy = y;
      x.fillStyle = `rgba(${b[0] - 20},${b[1] - 20},${b[2] - 20},0.55)`;
      x.fillRect(cx - 1, cy, 3, 1); x.fillRect(cx, cy - 1, 1, 3);
      x.fillStyle = `rgba(${b[0]},${b[1] + 10},${b[2]},0.35)`; x.fillRect(cx - 2, cy + 2, 1, 1); x.fillRect(cx + 2, cy + 2, 1, 1);
    }
    // manchas do tempo
    for (let i = 0; i < 4; i++) { const g = x.createRadialGradient(rnd() * S, rnd() * S, 0, rnd() * S, rnd() * S, 14 + rnd() * 10); g.addColorStop(0, 'rgba(90,70,40,0.07)'); g.addColorStop(1, 'rgba(90,70,40,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
    noise(x, S, S, 0.5, 0.07); return toTex(c);
  }),
  paint: (col = [200, 196, 186], k = 0) => cached('paint' + col + k, () => {
    srand(31 + k); const S = 64, [c, x] = canvas(S, S);
    x.fillStyle = hex(...col); x.fillRect(0, 0, S, S);
    for (let i = 0; i < 5; i++) { const g = x.createRadialGradient(rnd() * S, rnd() * S, 0, rnd() * S, rnd() * S, 18); g.addColorStop(0, 'rgba(0,0,0,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
    noise(x, S, S, 0.6, 0.06); return toTex(c);
  }),
  tiles: (col = [210, 214, 206], grout = [120, 124, 118], n = 4) => cached('tile' + col + grout + n, () => {
    srand(41); const S = 64, [c, x] = canvas(S, S), s = S / n;
    // rejunte mais claro e fino, para os azulejos não virarem uma grade pesada
    const gr = [(grout[0] + col[0] * 2) / 3, (grout[1] + col[1] * 2) / 3, (grout[2] + col[2] * 2) / 3];
    x.fillStyle = hex(...gr); x.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const t = (rnd() - 0.5) * 12;
      x.fillStyle = hex(col[0] + t, col[1] + t, col[2] + t); x.fillRect(i * s + 1, j * s + 1, s - 1, s - 1);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i * s + 1, j * s + 1, s - 1, 1); x.fillRect(i * s + 1, j * s + 1, 1, s - 1);
      x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(i * s + 1, j * s + s - 1, s - 1, 1); x.fillRect(i * s + s - 1, j * s + 1, 1, s - 1);
      if (rnd() < 0.3) { x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(i * s + 3, j * s + 3, 2, 2); }
    }
    noise(x, S, S, 0.35, 0.05); return toTex(c);
  }),
  checker: (a = [200, 196, 180], b = [90, 70, 60]) => cached('chk' + a + b, () => {
    srand(5); const S = 32, [c, x] = canvas(S, S);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const t = (rnd() - 0.5) * 10, cc = (i + j) % 2 ? b : a; x.fillStyle = hex(cc[0] + t, cc[1] + t, cc[2] + t); x.fillRect(i * 16, j * 16, 16, 16); }
    x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(0, 16, S, 1); x.fillRect(16, 0, 1, S);
    noise(x, S, S, 0.5, 0.07); return toTex(c);
  }),
  carpet: (col = [120, 50, 46]) => cached('carpet' + col, () => {
    srand(51); const S = 64, [c, x] = canvas(S, S); x.fillStyle = hex(...col); x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { x.fillStyle = jitterColor(col, 24); x.fillRect((rnd() * S) | 0, (rnd() * S) | 0, 1, 1); }
    // barrado e losango central
    x.strokeStyle = 'rgba(214,180,110,0.35)'; x.lineWidth = 2; x.strokeRect(4, 4, S - 8, S - 8);
    x.strokeStyle = 'rgba(30,14,10,0.25)'; x.lineWidth = 1; x.strokeRect(8.5, 8.5, S - 17, S - 17);
    x.strokeStyle = 'rgba(214,180,110,0.25)'; x.beginPath(); x.moveTo(S / 2, 14); x.lineTo(S - 14, S / 2); x.lineTo(S / 2, S - 14); x.lineTo(14, S / 2); x.closePath(); x.stroke();
    return toTex(c);
  }),
  grime: () => cached('grime', () => {
    srand(61); const S = 64, [c, x] = canvas(S, S);
    for (let i = 0; i < 26; i++) { const px = rnd() * S, py = rnd() * S, r = 4 + rnd() * 14, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(200,200,190,${0.25 + rnd() * 0.3})`); g.addColorStop(1, 'rgba(200,200,190,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(150,140,120,0.25)'; x.fillRect(rnd() * S, rnd() * S * 0.6, 1, 6 + rnd() * 20); }
    const t = toTex(c, false); return t;
  }),
  concrete: () => cached('concrete', () => {
    srand(61); const [c, x] = canvas(64, 64); x.fillStyle = '#5a5852'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(20,18,16,${0.2 * rnd()})`; x.beginPath(); x.arc(rnd() * 64, rnd() * 64, 2 + rnd() * 8, 0, 7); x.fill(); }
    noise(x, 64, 64, 1.2, 0.16); return toTex(c);
  }),
  vinyl: () => cached('vinyl', () => {
    srand(71); const [c, x] = canvas(32, 32);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#c9cbc4' : '#b8bdb6'; x.fillRect(i * 16, j * 16, 16, 16); }
    for (let i = 0; i < 80; i++) { x.fillStyle = `rgba(90,100,95,${0.3 * rnd()})`; x.fillRect((rnd() * 32) | 0, (rnd() * 32) | 0, 1, 1); }
    return toTex(c);
  }),
  fabric: (col = [90, 100, 80]) => cached('fab' + col, () => {
    srand(81); const [c, x] = canvas(16, 16); x.fillStyle = hex(...col); x.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 16; i += 2) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, i, 16, 1); x.fillRect(i, 0, 1, 16); }
    noise(x, 16, 16, 0.6); return toTex(c);
  }),
  grass: () => cached('grass', () => {
    srand(101); const [c, x] = canvas(64, 64); x.fillStyle = '#4a5a32'; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 1400; i++) { const v = rnd(); x.fillStyle = v > 0.6 ? '#5d6e3c' : v > 0.3 ? '#3b4a28' : '#6b7744'; x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 2 + (rnd() * 2 | 0)); }
    for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(80,60,40,0.35)'; x.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 3, 2); }
    return toTex(c);
  }),
  asphalt: () => cached('asphalt', () => { srand(111); const [c, x] = canvas(64, 64); x.fillStyle = '#34363a'; x.fillRect(0, 0, 64, 64); noise(x, 64, 64, 1.5, 0.2); return toTex(c); }),
  shingles: () => cached('shingles', () => {
    srand(121); const [c, x] = canvas(32, 32);
    for (let r = 0; r < 4; r++) for (let i = -1; i < 4; i++) { x.fillStyle = jitterColor([70, 52, 46], 20); x.fillRect(i * 8 + (r % 2) * 4, r * 8, 8, 8); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(i * 8 + (r % 2) * 4, r * 8 + 7, 8, 1); x.fillRect(i * 8 + (r % 2) * 4, r * 8, 1, 8); }
    return toTex(c);
  }),
  siding: () => cached('siding', () => {
    srand(131); const [c, x] = canvas(32, 32);
    for (let r = 0; r < 4; r++) { x.fillStyle = jitterColor([196, 190, 172], 10); x.fillRect(0, r * 8, 32, 8); x.fillStyle = 'rgba(40,36,30,0.45)'; x.fillRect(0, r * 8 + 7, 32, 1); }
    noise(x, 32, 32, 0.8); return toTex(c);
  }),
  ceiling: () => cached('ceil', () => { srand(91); const [c, x] = canvas(32, 32); x.fillStyle = '#c8c2b4'; x.fillRect(0, 0, 32, 32); noise(x, 32, 32, 1.2, 0.1); return toTex(c); }),
  window: (kind = 'morning') => cached('win' + kind, () => {
    const [c, x] = canvas(32, 32);
    const g = x.createLinearGradient(0, 0, 0, 32);
    if (kind === 'morning') { g.addColorStop(0, '#b9c6cf'); g.addColorStop(1, '#e7d6b4'); }
    else if (kind === 'night') { g.addColorStop(0, '#05070c'); g.addColorStop(1, '#141824'); }
    else { g.addColorStop(0, '#dfe6e6'); g.addColorStop(1, '#f2f4f1'); }
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    if (kind !== 'hospital') { x.fillStyle = kind === 'night' ? '#020304' : '#56614f'; for (let i = 0; i < 32; i += 3) x.fillRect(i, 22 + ((i * 7) % 5), 3, 10); }
    x.fillStyle = '#2b2218'; x.fillRect(15, 0, 2, 32); x.fillRect(0, 15, 32, 2);
    return toTex(c, false);
  }),
  tvScreen: () => { const [c] = canvas(64, 48); const t = toTex(c, false); t.userData = { canvas: c }; return t; },
  label: (text, opts = {}) => {
    const { w = 128, h = 32, bg = null, fg = '#000', font = 'bold 20px Georgia', align = 'center' } = opts;
    const [c, x] = canvas(w, h);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.fillStyle = fg; x.font = font; x.textAlign = align; x.textBaseline = 'middle';
    x.fillText(text, align === 'center' ? w / 2 : 4, h / 2);
    return toTex(c, false);
  },
  // Escritos na parede (como se fossem feitos à mão)
  scrawl: (text, color = '#5a0a08') => {
    const words = text.split(' ');
    const [c, x] = canvas(256, 96);
    x.fillStyle = color; x.font = 'bold 26px "Courier New", monospace'; x.textBaseline = 'middle';
    let lines = []; let cur = '';
    for (const wd of words) { if ((cur + ' ' + wd).trim().length > 14) { lines.push(cur.trim()); cur = wd; } else cur += ' ' + wd; }
    lines.push(cur.trim());
    srand(text.length * 13);
    lines.forEach((ln, i) => {
      for (let k = 0; k < ln.length; k++) {
        x.save(); x.translate(10 + k * 17 + (rnd() - 0.5) * 3, 24 + i * 34 + (rnd() - 0.5) * 6);
        x.rotate((rnd() - 0.5) * 0.25); x.fillText(ln[k], 0, 0); x.restore();
      }
      for (let d = 0; d < 6; d++) { x.fillRect(12 + rnd() * ln.length * 17, 30 + i * 34, 2, 6 + rnd() * 20); }
    });
    return toTex(c, false);
  },
};

// ---------- Imagens narrativas (usadas no visualizador de documentos e em objetos) ----------
function stick(x, px, py, s, color, kid = false) {
  x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 3; x.lineCap = 'round';
  x.beginPath(); x.arc(px, py, 7 * s, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(px, py + 7 * s); x.lineTo(px, py + 30 * s);
  x.moveTo(px - 12 * s, py + 15 * s); x.lineTo(px + 12 * s, py + 15 * s);
  x.moveTo(px, py + 30 * s); x.lineTo(px - 9 * s, py + 46 * s);
  x.moveTo(px, py + 30 * s); x.lineTo(px + 9 * s, py + 46 * s); x.stroke();
  if (kid) { x.beginPath(); x.arc(px - 2 * s, py - 1 * s, 1, 0, 7); x.arc(px + 2 * s, py - 1 * s, 1, 0, 7); x.fill(); }
}
function paperBg(x, w, h) {
  x.fillStyle = '#efe8d6'; x.fillRect(0, 0, w, h);
  srand(7); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,100,60,${0.06 * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
}

// ---------- Desenhos infantis em giz de cera ----------
// Tudo é traçado à mão por código: linhas tremidas, várias passadas, falhas na cera,
// preenchimento rabiscado que sai da linha e letras tortas.
const DW = 480, DH = 330;
let crSeed = 1;
const cr = () => { crSeed = (crSeed * 16807) % 2147483647; return (crSeed - 1) / 2147483646; };
const jit = (a) => (cr() - 0.5) * 2 * a;

function notebookPaper(x, lined = true) {
  x.fillStyle = '#f1ebdb'; x.fillRect(0, 0, DW, DH);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(120,100,70,${0.05 * cr()})`; x.fillRect(cr() * DW, cr() * DH, 1 + cr() * 2, 1); }
  if (lined) {
    x.strokeStyle = 'rgba(110,150,200,0.35)'; x.lineWidth = 1;
    for (let y = 34; y < DH; y += 22) { x.beginPath(); x.moveTo(0, y + 0.5); x.lineTo(DW, y + 0.5); x.stroke(); }
    x.strokeStyle = 'rgba(200,90,90,0.35)'; x.beginPath(); x.moveTo(42.5, 0); x.lineTo(42.5, DH); x.stroke();
  }
  // dobra no meio e marcas de manuseio
  const g = x.createLinearGradient(DW * 0.55 - 6, 0, DW * 0.55 + 6, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(60,40,20,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
  x.fillStyle = g; x.fillRect(DW * 0.55 - 6, 0, 12, DH);
  x.fillStyle = 'rgba(140,110,60,0.08)'; x.beginPath(); x.ellipse(DW - 40, DH - 30, 34, 22, 0.4, 0, 7); x.fill();
}

// camada transparente onde a cera é desenhada (depois recebe as falhas)
function layer() { const c = document.createElement('canvas'); c.width = DW; c.height = DH; return [c, c.getContext('2d')]; }
function waxGrain(c, amount = 0.22) {
  const x = c.getContext('2d');
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < DW * DH * amount * 0.35; i++) { x.fillStyle = `rgba(0,0,0,${0.4 + cr() * 0.6})`; x.fillRect(cr() * DW, cr() * DH, 1 + (cr() < 0.2 ? 1 : 0), 1); }
  x.globalCompositeOperation = 'source-over';
}

// linha de giz: segmentos tremidos, várias passadas
function crayon(x, pts, color, w = 4, passes = 3, wobble = 1.6) {
  x.strokeStyle = color; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    x.globalAlpha = 0.45 + cr() * 0.3; x.lineWidth = w + jit(1);
    x.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      if (i === 0) { x.moveTo(px + jit(wobble), py + jit(wobble)); continue; }
      const [ax, ay] = pts[i - 1], d = Math.hypot(px - ax, py - ay), n = Math.max(1, Math.round(d / 7));
      for (let k = 1; k <= n; k++) x.lineTo(ax + (px - ax) * k / n + jit(wobble), ay + (py - ay) * k / n + jit(wobble));
    }
    x.stroke();
  }
  x.globalAlpha = 1;
}
function circlePts(cx, cy, rx, ry = rx, over = 0.25) {
  const pts = [], a0 = cr() * 6.28, n = 22;
  for (let i = 0; i <= n * (1 + over); i++) { const a = a0 + (i / n) * 6.28; pts.push([cx + Math.cos(a) * rx * (1 + jit(0.06)), cy + Math.sin(a) * ry * (1 + jit(0.06))]); }
  return pts;
}
// preenchimento rabiscado em zigue-zague, limitado (mais ou menos) a um polígono
function scribble(x, poly, color, spacing = 5, w = 3.5, overflow = 3) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs) - overflow, maxX = Math.max(...xs) + overflow, minY = Math.min(...ys) - overflow, maxY = Math.max(...ys) + overflow;
  x.save(); x.beginPath(); poly.forEach(([px, py], i) => (i ? x.lineTo(px + jit(overflow), py + jit(overflow)) : x.moveTo(px, py))); x.closePath(); x.clip();
  const pts = []; let up = true;
  for (let px = minX; px <= maxX; px += spacing * (0.7 + cr() * 0.6)) { pts.push([px + jit(2), up ? minY + jit(3) : maxY + jit(3)]); up = !up; }
  crayon(x, pts, color, w, 2, 1.2);
  x.restore();
}
// letras de criança: tamanhos e ângulos irregulares, algumas espelhadas
function kidText(x, text, x0, y0, size, color, o = {}) {
  let cx = x0, base = y0;
  x.fillStyle = color; x.textBaseline = 'alphabetic';
  for (const ch of text) {
    if (ch === ' ') { cx += size * (0.45 + cr() * 0.3); continue; }
    const s = size * (0.85 + cr() * 0.35);
    x.font = `bold ${s}px "Segoe Print", "Comic Sans MS", cursive`;
    const wch = x.measureText(ch).width;
    x.save(); x.translate(cx, base + jit(3));
    x.rotate(jit(0.22));
    if (o.mirror && o.mirror.includes(ch) && cr() < 0.7) x.scale(-1, 1);
    for (let p = 0; p < 2; p++) { x.globalAlpha = 0.55 + cr() * 0.3; x.fillText(ch, jit(0.8) - (x.getTransform().a < 0 ? wch : 0), jit(0.8)); }
    x.restore();
    cx += wch * (0.95 + cr() * 0.25);
    base += jit(1.2) + (o.slope || 0);
  }
  x.globalAlpha = 1;
}
function person(x, cx, top, h, color, o = {}) {
  const head = h * 0.17, neck = top + head * 2;
  crayon(x, circlePts(cx, top + head, head, head * 1.05), o.skin || '#d9a070', 3, 2);
  // olhos e sorriso
  x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(cx - head * 0.35, top + head * 0.85, 2.2, 0, 7); x.arc(cx + head * 0.35, top + head * 0.9, 2.2, 0, 7); x.fill();
  crayon(x, [[cx - head * 0.45, top + head * 1.3], [cx, top + head * 1.6], [cx + head * 0.45, top + head * 1.25]], '#c03a3a', 2.4, 2, 0.6);
  if (o.hair) crayon(x, o.hair === 'long'
    ? [[cx - head, top + head * 1.8], [cx - head * 1.1, top + head * 0.4], [cx, top - 2], [cx + head * 1.1, top + head * 0.4], [cx + head, top + head * 1.9]]
    : [[cx - head * 0.9, top + head * 0.5], [cx - head * 0.3, top - 1], [cx + head * 0.4, top], [cx + head * 0.9, top + head * 0.5]], o.hairColor || '#6a4020', 4, 3);
  if (o.pigtails) for (const s of [-1, 1]) crayon(x, circlePts(cx + s * head * 1.3, top + head * 0.9, 5, 6), o.hairColor || '#c08030', 4, 2);
  const bodyBot = top + h * 0.68;
  if (o.dress) { const poly = [[cx, neck], [cx - h * 0.2, bodyBot], [cx + h * 0.2, bodyBot]]; scribble(x, poly, color, 4, 3.2, 2); crayon(x, [...poly, poly[0]], color, 3, 2); }
  else { const poly = [[cx - h * 0.1, neck], [cx + h * 0.1, neck], [cx + h * 0.1, bodyBot], [cx - h * 0.1, bodyBot]]; scribble(x, poly, color, 4, 3.2, 2); }
  // braços com dedos espetados
  for (const s of [-1, 1]) {
    const hx = cx + s * h * 0.34, hy = neck + h * 0.14 + jit(4);
    crayon(x, [[cx + s * h * 0.08, neck + 6], [hx, hy]], o.skin || '#d9a070', 3, 2);
    for (let f = -2; f <= 2; f++) crayon(x, [[hx, hy], [hx + s * 6 + jit(1), hy + f * 3.2]], o.skin || '#d9a070', 1.8, 1, 0.4);
  }
  // pernas e sapatos
  for (const s of [-1, 1]) {
    const fx = cx + s * h * 0.09, fy = top + h;
    crayon(x, [[cx + s * h * 0.05, bodyBot], [fx, fy]], '#3a3a3a', 3, 2);
    crayon(x, [[fx, fy], [fx + s * 9, fy + 1]], '#5a3020', 5, 2);
  }
}

const KidArt = {
  family() {
    crSeed = 4242;
    const c = document.createElement('canvas'); c.width = DW; c.height = DH; const px = c.getContext('2d');
    notebookPaper(px, true);
    const [l, x] = layer();
    // céu em faixa, sol com raios e grama
    scribble(x, [[0, 0], [DW, 0], [DW, 26], [0, 30]], '#6aa0d8', 6, 4, 2);
    crayon(x, circlePts(DW - 62, 52, 26), '#f0b820', 4, 3);
    scribble(x, circlePts(DW - 62, 52, 24).slice(0, 22), '#f6c830', 4, 3.5, 2);
    for (let i = 0; i < 9; i++) { const a = i * 0.7 + 0.2; crayon(x, [[DW - 62 + Math.cos(a) * 32, 52 + Math.sin(a) * 32], [DW - 62 + Math.cos(a) * 48, 52 + Math.sin(a) * 48]], '#f0b820', 3.5, 2); }
    const ground = DH - 46;
    scribble(x, [[0, ground], [DW, ground - 4], [DW, DH], [0, DH]], '#4c9a3a', 5, 4, 3);
    for (let gx = 4; gx < DW; gx += 9) crayon(x, [[gx, ground + 2], [gx + 3, ground - 9 - cr() * 6]], '#3a8a2a', 2.5, 1, 0.5);
    // casa
    const hx = 44, hy = 150, hw = 108, hh = 112;
    crayon(x, [[hx, hy], [hx + hw, hy + 2], [hx + hw - 2, hy + hh], [hx + 2, hy + hh], [hx, hy - 4]], '#c0392b', 4, 3);
    const roof = [[hx - 14, hy + 4], [hx + hw / 2, hy - 64], [hx + hw + 14, hy + 2]];
    scribble(x, roof, '#7a3e1e', 5, 3.5, 3); crayon(x, [...roof, roof[0]], '#5a2a10', 4, 2);
    scribble(x, [[hx + 42, hy + 52], [hx + 70, hy + 52], [hx + 70, hy + hh], [hx + 42, hy + hh]], '#8a5a30', 4, 3, 1);
    crayon(x, [[hx + 12, hy + 18], [hx + 36, hy + 18], [hx + 36, hy + 42], [hx + 12, hy + 42], [hx + 12, hy + 16]], '#3a6ab0', 3, 2);
    crayon(x, [[hx + 24, hy + 18], [hx + 24, hy + 42]], '#3a6ab0', 2.5, 1); crayon(x, [[hx + 12, hy + 30], [hx + 36, hy + 30]], '#3a6ab0', 2.5, 1);
    // família de mãos dadas
    person(x, 196, 118, 150, '#2f5fb8', { hair: 'short', hairColor: '#3a2a1a', skin: '#e0aa78' });
    person(x, 254, 122, 146, '#c2447e', { hair: 'long', hairColor: '#7a4a22', dress: true, skin: '#e0aa78' });
    person(x, 306, 176, 96, '#e08a2a', { pigtails: true, hairColor: '#c08030', dress: true, skin: '#e8b48a' });
    person(x, 346, 190, 82, '#2e9a4a', { hair: 'short', hairColor: '#c89048', skin: '#e8b48a' });
    // a quinta figura: alta, preta, rabiscada com força até borrar
    const ent = [[402, 36], [434, 250], [364, 252]];
    for (let r = 0; r < 3; r++) scribble(x, ent, '#0c0c0c', 2.5, 4.5, 6);
    crayon(x, circlePts(400, 40, 19, 22, 0.6), '#0c0c0c', 6, 4, 2);
    scribble(x, circlePts(400, 40, 19, 22).slice(0, 22), '#0c0c0c', 2.5, 5, 3);
    for (let i = 0; i < 14; i++) { const sx = 372 + cr() * 60, sy = 70 + cr() * 170; crayon(x, [[sx, sy], [sx + jit(22), sy + jit(26)]], '#111', 5, 2, 3); }
    waxGrain(l, 0.24);
    // rótulos
    kidText(x, 'PAPAI', 166, 108, 19, '#2f5fb8', { mirror: 'P' });
    kidText(x, 'MAMÃE', 228, 112, 19, '#c2447e');
    kidText(x, 'EU', 296, 168, 18, '#e08a2a');
    kidText(x, 'TOM', 334, 184, 18, '#2e9a4a', { mirror: 'T' });
    kidText(x, 'EMILY  8 ANOS', 56, 58, 16, '#7a4a9a', { mirror: 'Y', slope: 0.3 });
    px.drawImage(l, 0, 0);
    // papel amassado onde a cera foi apertada demais
    px.strokeStyle = 'rgba(60,40,20,0.25)'; px.lineWidth = 1;
    for (let i = 0; i < 5; i++) { px.beginPath(); px.moveTo(380 + cr() * 50, 80 + cr() * 150); px.lineTo(380 + cr() * 50, 80 + cr() * 150); px.stroke(); }
    return c;
  },
  house() {
    crSeed = 777;
    const c = document.createElement('canvas'); c.width = DW; c.height = DH; const px = c.getContext('2d');
    notebookPaper(px, false);
    const [l, x] = layer();
    // planta da casa vista de cima, bem torta (Thomas tem 5 anos)
    crayon(x, [[70, 60], [420, 52], [428, 288], [64, 296], [72, 56]], '#3a3a3a', 5, 3, 3);
    for (let i = 0; i < 4; i++) {
      const rx = 86 + i * 82;
      crayon(x, [[rx, 70 + jit(4)], [rx + 70, 68 + jit(4)], [rx + 72, 150 + jit(6)], [rx - 2, 152 + jit(4)], [rx, 66]], '#555', 3.5, 2, 2.5);
    }
    crayon(x, [[80, 166], [416, 160]], '#555', 3.5, 2, 3);
    // "ele": risco preto e comprido no último quarto
    for (let r = 0; r < 3; r++) scribble(x, [[350, 78], [368, 78], [372, 146], [346, 148]], '#0c0c0c', 2.5, 4.5, 4);
    crayon(x, circlePts(359, 82, 9, 10, 0.5), '#0c0c0c', 5, 3);
    // estrela no quarto deles
    crayon(x, [[150, 92], [158, 120], [134, 102], [164, 102], [140, 120], [150, 92]], '#e0a020', 3.5, 2);
    // a porta branca do lado de fora: giz branco quase invisível, contornado de cinza
    scribble(x, [[34, 180], [54, 180], [54, 236], [34, 236]], '#ffffff', 3, 5, 1);
    crayon(x, [[34, 180], [54, 179], [55, 237], [33, 236], [34, 178]], '#9a9a9a', 2.5, 2);
    crayon(x, [[56, 208], [64, 206]], '#9a9a9a', 3, 1);
    // setas
    crayon(x, [[300, 196], [348, 154]], '#c0392b', 3.5, 2); crayon(x, [[336, 152], [348, 154], [346, 166]], '#c0392b', 3.5, 2);
    waxGrain(l, 0.26);
    kidText(x, 'MEU QUARTO', 100, 196, 22, '#c0392b', { mirror: 'Q' });
    kidText(x, 'ELE FIKA AQI', 252, 222, 20, '#c0392b', { mirror: 'K', slope: -0.4 });
    kidText(x, 'A PORTA BRANKA', 86, 258, 19, '#3a3a3a', { mirror: 'K' });
    kidText(x, 'NAO E NOSA', 96, 282, 19, '#3a3a3a', { mirror: 'N', slope: 0.3 });
    kidText(x, 'TOM', 400, 318, 16, '#2e9a4a', { mirror: 'T' });
    px.drawImage(l, 0, 0);
    return c;
  },
  rabbit() {
    crSeed = 3131;
    const c = document.createElement('canvas'); c.width = DW; c.height = DH; const px = c.getContext('2d');
    notebookPaper(px, true);
    const [l, x] = layer();
    const cx = 240;
    // corpo, cabeça e orelhas
    crayon(x, circlePts(cx, 206, 66, 76), '#8a8a8a', 4, 3);
    crayon(x, circlePts(cx, 112, 44, 40), '#8a8a8a', 4, 3);
    for (const s of [-1, 1]) {
      crayon(x, circlePts(cx + s * 22, 46, 12, 42, 0.2), '#8a8a8a', 4, 2);
      scribble(x, circlePts(cx + s * 22, 50, 6, 30).slice(0, 22), '#e8909a', 3, 3, 1);
    }
    // olhos vermelhos e boca
    for (const s of [-1, 1]) { scribble(x, circlePts(cx + s * 16, 106, 6, 7).slice(0, 22), '#c01818', 2, 3.5, 1); }
    crayon(x, [[cx - 6, 128], [cx, 134], [cx + 6, 128]], '#c01818', 2.5, 2);
    // dentro da barriga: uma chave amarela
    crayon(x, circlePts(cx - 18, 210, 10), '#e0a820', 4, 3);
    crayon(x, [[cx - 8, 210], [cx + 30, 212]], '#e0a820', 4, 3);
    crayon(x, [[cx + 20, 212], [cx + 20, 222]], '#e0a820', 3.5, 2); crayon(x, [[cx + 29, 212], [cx + 29, 220]], '#e0a820', 3.5, 2);
    // costura em X
    for (let i = 0; i < 4; i++) { const yy = 170 + i * 26; crayon(x, [[cx - 40, yy - 6], [cx - 28, yy + 6]], '#555', 2.2, 1); crayon(x, [[cx - 40, yy + 6], [cx - 28, yy - 6]], '#555', 2.2, 1); }
    waxGrain(l, 0.22);
    kidText(x, 'O COELHO GUARDA', 62, 300, 21, '#3a3a3a', { mirror: 'G' });
    kidText(x, 'O SEGREDO', 290, 302, 21, '#3a3a3a', { mirror: 'S' });
    kidText(x, 'DENTRO DA BARIGA', 120, 26, 19, '#c01818', { slope: 0.25 });
    px.drawImage(l, 0, 0);
    return c;
  },
};

export const Images = {
  drawingFamily() { return KidArt.family(); },
  drawingHouse() { return KidArt.house(); },
  drawingRabbit() { return KidArt.rabbit(); },
  // Fotografias da família (estilo foto revelada dos anos 80/90).
  // Rosto de Alice nítido; os de Daniel e das crianças sempre borrados.
  photo(kind, withEntity = false) {
    const W2 = 240, H2 = 180;
    const [c, x] = canvas(W2, H2);
    const P = {
      alice: { skin: '#e2b494', hair: '#5a3a20', long: true, top: '#8a3a4a', dress: true },
      daniel: { skin: '#d8a888', hair: '#2a1e16', top: '#3a4a6a', blur: true },
      emily: { skin: '#ecc0a0', hair: '#9a6a30', long: true, top: '#c4508a', dress: true, blur: true },
      thomas: { skin: '#ecc0a0', hair: '#b8904a', top: '#3a8a5a', blur: true },
    };
    const face = document.createElement('canvas'); face.width = face.height = 48;
    const person = (who, cx, top, h, o = {}) => {
      const p = { ...P[who], ...o }, r = h * 0.11, neck = top + r * 2;
      // corpo
      x.fillStyle = p.top;
      if (p.dress) { x.beginPath(); x.moveTo(cx - h * 0.08, neck); x.lineTo(cx + h * 0.08, neck); x.lineTo(cx + h * 0.17, top + h * 0.7); x.lineTo(cx - h * 0.17, top + h * 0.7); x.closePath(); x.fill(); }
      else { x.fillRect(cx - h * 0.11, neck, h * 0.22, h * 0.42); x.fillStyle = '#2a2a30'; x.fillRect(cx - h * 0.1, neck + h * 0.42, h * 0.2, h * 0.3); }
      x.fillStyle = p.skin; x.fillRect(cx - h * 0.2, neck + h * 0.05, h * 0.07, h * 0.3); x.fillRect(cx + h * 0.13, neck + h * 0.05, h * 0.07, h * 0.3);
      x.fillStyle = '#2a2420'; x.fillRect(cx - h * 0.08, top + h * 0.7, h * 0.06, h * 0.3); x.fillRect(cx + h * 0.02, top + h * 0.7, h * 0.06, h * 0.3);
      // cabeça desenhada num buffer e, se for o caso, borrada
      const f = face.getContext('2d'); f.clearRect(0, 0, 48, 48);
      f.fillStyle = p.hair; if (p.long) { f.beginPath(); f.ellipse(24, 22, 16, 18, 0, 0, 7); f.fill(); f.fillRect(8, 22, 32, 18); }
      f.fillStyle = p.skin; f.beginPath(); f.ellipse(24, 26, 12, 14, 0, 0, 7); f.fill();
      f.fillStyle = p.hair; f.beginPath(); f.ellipse(24, 16, 13, 8, 0, Math.PI, 0); f.fill();
      f.fillStyle = '#2a1e18'; f.fillRect(18, 24, 3, 3); f.fillRect(27, 24, 3, 3);
      f.fillStyle = '#9a4a40'; f.fillRect(20, 33, 8, 2);
      x.save(); if (p.blur) x.filter = `blur(${Math.max(2, r * 0.38)}px)`;
      x.drawImage(face, cx - r * 2, top - r * 0.5, r * 4, r * 4);
      x.restore();
    };
    const bg = (a, b) => { const g = x.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, W2, H2); };
    const tree = (tx, ty, s) => { x.fillStyle = '#4a3a2a'; x.fillRect(tx - 3 * s, ty, 6 * s, 30 * s); x.fillStyle = '#4a6a34'; x.beginPath(); x.arc(tx, ty, 18 * s, 0, 7); x.fill(); };
    const houseBg = (hx, hy, s) => { x.fillStyle = '#c8bca4'; x.fillRect(hx, hy, 120 * s, 70 * s); x.fillStyle = '#6a3a2a'; x.beginPath(); x.moveTo(hx - 8 * s, hy); x.lineTo(hx + 60 * s, hy - 36 * s); x.lineTo(hx + 128 * s, hy); x.fill(); x.fillStyle = '#5a3a24'; x.fillRect(hx + 50 * s, hy + 30 * s, 20 * s, 40 * s); x.fillStyle = '#9ab0bc'; x.fillRect(hx + 12 * s, hy + 18 * s, 22 * s, 18 * s); x.fillRect(hx + 86 * s, hy + 18 * s, 22 * s, 18 * s); };
    switch (kind) {
      case 'park': bg('#a8c0cc', '#7a9a52'); tree(30, 60, 1.2); tree(210, 54, 1.4); person('daniel', 70, 52, 110); person('alice', 112, 56, 104); person('emily', 150, 92, 70); person('thomas', 182, 104, 58); break;
      case 'hold': bg('#d4b48c', '#8a6a4a'); person('alice', 120, 36, 140); person('emily', 86, 96, 76); person('thomas', 156, 104, 66); break;
      case 'dinner': bg('#8a5a32', '#4a2e1c'); x.fillStyle = '#e8dcc0'; x.fillRect(20, 118, 200, 30); person('daniel', 50, 50, 100); person('alice', 100, 52, 98); person('emily', 150, 76, 70); person('thomas', 190, 84, 60); x.fillStyle = '#d8cbb0'; x.fillRect(20, 112, 200, 10); break;
      case 'alone': bg('#8a96a0', '#5a6052'); houseBg(60, 50, 1); person('alice', 120, 90, 80); break;
      case 'hospital': bg('#dfe3de', '#b8bcb6'); x.fillStyle = '#eef0ec'; x.fillRect(40, 112, 160, 28); x.fillStyle = '#9aa2a0'; x.fillRect(40, 140, 6, 30); x.fillRect(194, 140, 6, 30); x.fillStyle = '#56606a'; x.fillRect(180, 20, 40, 50); person('alice', 120, 56, 96, { top: '#c9d0d4', dress: true }); break;
      case 'wedding': bg('#e8dcc8', '#b8a48a'); x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.arc(120, 40, 60, 0, 7); x.fill(); person('daniel', 96, 40, 130, { top: '#1a1a1a' }); person('alice', 144, 42, 126, { top: '#f6f2ea' }); x.fillStyle = '#f0e8f0'; x.beginPath(); x.ellipse(144, 52, 22, 14, 0, Math.PI, 0); x.fill(); x.fillStyle = '#d86a7a'; x.beginPath(); x.arc(128, 100, 7, 0, 7); x.fill(); break;
      case 'house': bg('#a8b8c2', '#6e7d52'); houseBg(40, 50, 1.3); x.fillStyle = '#e8e0c8'; x.fillRect(190, 100, 34, 22); x.fillStyle = '#a03030'; x.font = 'bold 9px Arial'; x.fillText('VENDIDA', 191, 114); person('daniel', 90, 92, 80); person('alice', 120, 94, 78); break;
      case 'emily': bg('#ece0d4', '#b8a090'); person('alice', 120, 30, 150, { top: '#c9a0a8' }); x.fillStyle = '#f2c6d2'; x.beginPath(); x.ellipse(120, 112, 26, 16, -0.2, 0, 7); x.fill(); x.save(); x.filter = 'blur(2px)'; x.fillStyle = '#ecc0a0'; x.beginPath(); x.arc(104, 106, 9, 0, 7); x.fill(); x.restore(); break;
      case 'thomas': bg('#d4dde4', '#9aaab6'); person('alice', 110, 34, 140, { top: '#a8b0c8' }); x.fillStyle = '#c8dcf0'; x.beginPath(); x.ellipse(112, 112, 24, 15, -0.2, 0, 7); x.fill(); x.save(); x.filter = 'blur(2px)'; x.fillStyle = '#ecc0a0'; x.beginPath(); x.arc(97, 106, 8, 0, 7); x.fill(); x.restore(); person('emily', 170, 92, 70); break;
      case 'couple': bg('#e0c8a4', '#a8885e'); x.fillStyle = 'rgba(255,230,180,0.5)'; x.beginPath(); x.arc(200, 40, 34, 0, 7); x.fill(); x.fillStyle = '#7aa0b4'; x.fillRect(0, 108, 240, 20); person('daniel', 100, 30, 150, { top: '#e8e0cc' }); person('alice', 140, 34, 146, { top: '#c4506a' }); break;
      default: bg('#a8c0cc', '#7a9a52');
    }
    if (withEntity) { x.fillStyle = 'rgba(8,6,6,0.82)'; x.beginPath(); x.moveTo(30, 10); x.lineTo(48, 150); x.lineTo(12, 150); x.closePath(); x.fill(); x.beginPath(); x.ellipse(30, 16, 9, 12, 0, 0, 7); x.fill(); }
    // envelhecimento: tom amarelado, grão, marca de dedo e borda branca
    srand(kind.length * 31);
    x.fillStyle = 'rgba(220,170,90,0.2)'; x.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,240,220,${0.08 * rnd()})`; x.fillRect(rnd() * W2, rnd() * H2, 1, 1); }
    const vg = x.createRadialGradient(W2 / 2, H2 / 2, 40, W2 / 2, H2 / 2, 150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.35)'); x.fillStyle = vg; x.fillRect(0, 0, W2, H2);
    x.strokeStyle = '#f4efe2'; x.lineWidth = 10; x.strokeRect(0, 0, W2, H2);
    return c;
  },
  vhs(lines) {
    const [c, x] = canvas(320, 240);
    x.fillStyle = '#0a0d10'; x.fillRect(0, 0, 320, 240);
    x.fillStyle = '#3a3428'; x.fillRect(40, 110, 240, 80);
    x.fillStyle = '#1a1612'; x.beginPath(); x.arc(170, 80, 22, 0, 7); x.fill(); x.fillRect(146, 100, 48, 70);
    x.fillStyle = '#e8e8e8'; x.font = 'bold 16px "Courier New", monospace';
    x.fillText('PLAY ▶', 16, 26); x.fillText(lines || 'SP 0:00:13', 200, 26);
    for (let i = 0; i < 240; i += 3) { x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(0, i, 320, 1); }
    return c;
  },
  calendar() {
    const [c, x] = canvas(128, 160); x.fillStyle = '#f1eee6'; x.fillRect(0, 0, 128, 160);
    x.fillStyle = '#7a1c18'; x.fillRect(0, 0, 128, 34);
    x.fillStyle = '#fff'; x.font = 'bold 16px Georgia'; x.textAlign = 'center'; x.fillText('NOVEMBRO', 64, 16); x.font = '11px Georgia'; x.fillText('2006', 64, 29);
    x.fillStyle = '#222'; x.font = '10px Georgia';
    for (let i = 0; i < 30; i++) { const col = i % 7, row = (i / 7) | 0; x.fillText(String(i + 1), 12 + col * 17, 50 + row * 20); }
    x.strokeStyle = '#a01818'; x.lineWidth = 2; x.beginPath(); x.arc(12 + 4 * 17, 50 + 2 * 20 - 4, 8, 0, 7); x.stroke();
    return toTex(c, false);
  },
};

export { toTex };
