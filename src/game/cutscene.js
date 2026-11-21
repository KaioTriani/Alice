// Abertura desenhada: a família se despede de Daniel, ele vai ao aeroporto e o avião decola.
// Estilo de livro ilustrado: lápis tremido ("line boil"), aquarela e papel.
// Todos os rostos aparecem borrados, menos o de Alice.
const W = 640, H = 360;
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const jit = (a) => (rnd() - 0.5) * 2 * a;

let paper = null;
function paperTex() {
  if (paper) return paper;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, W, H);
  seed = 99;
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(110,90,60,${0.05 * rnd()})`; x.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1); }
  for (let i = 0; i < 14; i++) { const g = x.createRadialGradient(rnd() * W, rnd() * H, 0, rnd() * W, rnd() * H, 60 + rnd() * 90); g.addColorStop(0, 'rgba(150,120,70,0.06)'); g.addColorStop(1, 'rgba(150,120,70,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
  paper = c; return c;
}

// traço de lápis tremido com várias passadas
function line(x, pts, color = '#3a2e26', w = 2, passes = 2, wob = 1.2) {
  x.strokeStyle = color; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    x.globalAlpha = 0.55 + rnd() * 0.35; x.lineWidth = w * (0.8 + rnd() * 0.4);
    x.beginPath();
    pts.forEach(([px, py], i) => {
      if (!i) { x.moveTo(px + jit(wob), py + jit(wob)); return; }
      const [ax, ay] = pts[i - 1], n = Math.max(1, Math.round(Math.hypot(px - ax, py - ay) / 10));
      for (let k = 1; k <= n; k++) x.lineTo(ax + (px - ax) * k / n + jit(wob), ay + (py - ay) * k / n + jit(wob));
    });
    x.stroke();
  }
  x.globalAlpha = 1;
}
// aguada de aquarela (preenchimento com bordas irregulares)
function wash(x, pts, color, alpha = 0.55) {
  x.fillStyle = color;
  for (let p = 0; p < 3; p++) {
    x.globalAlpha = alpha / 2.2; x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px + jit(2.5), py + jit(2.5)) : x.moveTo(px + jit(2.5), py + jit(2.5))));
    x.closePath(); x.fill();
  }
  x.globalAlpha = 1;
}
const rect = (x0, y0, w, h) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]];
const ellipse = (cx, cy, rx, ry, n = 18) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(i / n * 6.283) * rx, cy + Math.sin(i / n * 6.283) * ry]);

// rosto: os olhos e a boca de Alice são nítidos; os dos outros são desfocados (borrados)
const faceBuf = document.createElement('canvas'); faceBuf.width = faceBuf.height = 96;
function head(x, cx, cy, r, o) {
  const fx = faceBuf.getContext('2d');
  fx.clearRect(0, 0, 96, 96);
  const c = 48, k = 40 / r;
  fx.save(); fx.scale(1, 1);
  // pele
  fx.fillStyle = o.skin || '#e4b896'; fx.beginPath(); fx.ellipse(c, c, 30, 36, 0, 0, 7); fx.fill();
  // cabelo
  fx.fillStyle = o.hair || '#4a3020';
  if (o.longHair) { fx.beginPath(); fx.ellipse(c, c - 8, 34, 36, 0, Math.PI, 0); fx.fill(); fx.fillRect(c - 34, c - 8, 12, 44); fx.fillRect(c + 22, c - 8, 12, 44); }
  else { fx.beginPath(); fx.ellipse(c, c - 14, 31, 22, 0, Math.PI, 0); fx.fill(); }
  // traços do rosto
  fx.fillStyle = '#2a1e18';
  fx.beginPath(); fx.ellipse(c - 11, c + 2, 3, o.sad ? 2 : 3.5, 0, 0, 7); fx.ellipse(c + 11, c + 2, 3, o.sad ? 2 : 3.5, 0, 0, 7); fx.fill();
  fx.strokeStyle = '#6a3a30'; fx.lineWidth = 2; fx.beginPath();
  if (o.sad) { fx.moveTo(c - 8, c + 20); fx.quadraticCurveTo(c, c + 16, c + 8, c + 20); } else { fx.moveTo(c - 9, c + 16); fx.quadraticCurveTo(c, c + 23, c + 9, c + 16); }
  fx.stroke();
  // sobrancelhas: na tristeza a ponta de dentro sobe
  fx.strokeStyle = '#4a3020'; fx.beginPath(); fx.moveTo(c - 16, c - (o.sad ? 5 : 7)); fx.lineTo(c - 6, c - (o.sad ? 10 : 8)); fx.moveTo(c + 16, c - (o.sad ? 5 : 7)); fx.lineTo(c + 6, c - (o.sad ? 10 : 8)); fx.stroke();
  fx.restore();
  x.save();
  if (o.blur) x.filter = `blur(${Math.max(3, r * 0.35)}px)`;
  x.drawImage(faceBuf, cx - 48 / k, cy - 48 / k, 96 / k, 96 / k);
  x.restore();
  if (!o.blur) line(x, ellipse(cx, cy, r * 0.76, r * 0.92), '#5a3a2a', 1.2, 1, 0.8);
}
// pessoa desenhada: cabeça, corpo, braços e pernas
function person(x, cx, top, h, o = {}) {
  const r = h * 0.1, neck = top + r * 2;
  const body = o.dress
    ? [[cx - h * 0.07, neck], [cx + h * 0.07, neck], [cx + h * 0.15, top + h * 0.62], [cx - h * 0.15, top + h * 0.62]]
    : [[cx - h * 0.1, neck], [cx + h * 0.1, neck], [cx + h * 0.09, top + h * 0.55], [cx - h * 0.09, top + h * 0.55]];
  wash(x, body, o.color || '#4a6a9a', 0.8); line(x, [...body, body[0]], '#2a221c', 1.4, 2, 0.8);
  // pernas
  for (const s of [-1, 1]) line(x, [[cx + s * h * 0.05, top + h * (o.dress ? 0.62 : 0.55)], [cx + s * h * 0.06, top + h]], o.legs || '#2e2a2a', h * 0.05, 1, 0.5);
  // braços
  const armL = o.armL || [[cx - h * 0.1, neck + h * 0.03], [cx - h * 0.17, top + h * 0.5]];
  const armR = o.armR || [[cx + h * 0.1, neck + h * 0.03], [cx + h * 0.17, top + h * 0.5]];
  line(x, armL, o.color || '#4a6a9a', h * 0.045, 1, 0.6); line(x, armR, o.color || '#4a6a9a', h * 0.045, 1, 0.6);
  head(x, cx, top + r, r, o);
}
function sky(x, top, bottom) { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom); x.globalAlpha = 0.55; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
function cloud(x, cx, cy, s, col = '#ffffff') { for (let i = 0; i < 4; i++) wash(x, ellipse(cx + (i - 1.5) * 22 * s, cy + Math.sin(i * 2) * 5 * s, 26 * s, 15 * s, 12), col, 0.5); }
function plane(x, cx, cy, s, rot = 0) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  const body = [[-60, -6], [50, -8], [66, 0], [50, 8], [-60, 6], [-70, 0], [-60, -6]];
  wash(x, body, '#dcdad4', 0.9); line(x, body, '#2a2a2a', 1.6);
  wash(x, [[-10, 0], [10, 0], [-20, 40], [-30, 40]], '#c8c6c0', 0.9); line(x, [[-10, 0], [-30, 40], [-20, 40], [10, 0]], '#2a2a2a', 1.4);
  wash(x, [[-55, -4], [-48, -4], [-58, -26], [-64, -26]], '#9a2a2a', 0.9); line(x, [[-55, -4], [-64, -26], [-58, -26], [-48, -4]], '#2a2a2a', 1.2);
  for (let i = 0; i < 7; i++) { x.fillStyle = '#3a4a5a'; x.fillRect(-40 + i * 12, -3, 5, 4); }
  x.restore();
}
function houseFront(x, ox, oy, s) {
  const wallP = rect(ox, oy, 260 * s, 150 * s);
  wash(x, wallP, '#d8cdb4', 0.8); line(x, wallP, '#3a2e26', 2);
  const roof = [[ox - 20 * s, oy], [ox + 130 * s, oy - 80 * s], [ox + 280 * s, oy]];
  wash(x, [...roof, roof[0]], '#7a3e2e', 0.8); line(x, roof, '#3a2e26', 2);
  const door = rect(ox + 105 * s, oy + 55 * s, 50 * s, 95 * s); wash(x, door, '#6a4a30', 0.85); line(x, door, '#2a1e16', 1.6);
  for (const wx of [30, 190]) { const w = rect(ox + wx * s, oy + 40 * s, 45 * s, 40 * s); wash(x, w, '#b8cad4', 0.8); line(x, w, '#3a2e26', 1.4); line(x, [[ox + (wx + 22) * s, oy + 40 * s], [ox + (wx + 22) * s, oy + 80 * s]], '#3a2e26', 1); }
}

// ---------------------------------------------------------------- cenas
const SCENES = [
  { dur: 9, draw(x, t) { // despedida na porta de casa
    sky(x, '#b8c8d6', '#efe6d2');
    houseFront(x, 120, 120, 1.25);
    wash(x, [[0, 300], [W, 296], [W, H], [0, H]], '#8aa070', 0.6);
    const sway = Math.sin(t * 2) * 3;
    // Daniel com a mala
    person(x, 300, 150, 150, { color: '#3a4a6a', hair: '#2a1e16', blur: true, armR: [[310, 185], [338, 238]] });
    const suit = rect(330, 236, 34, 46); wash(x, suit, '#5a3a24', 0.9); line(x, suit, '#2a1e16', 1.4); line(x, [[340, 236], [342, 228], [352, 228], [354, 236]], '#2a1e16', 1.6);
    // Emily abraçando a perna do pai
    person(x, 274 + sway * 0.2, 222, 80, { color: '#c4508a', hair: '#9a6a30', longHair: true, dress: true, blur: true, armR: [[280, 248], [296, 262]] });
    // Alice segurando a mão de Thomas
    person(x, 410, 152, 146, { color: '#8a3a4a', hair: '#5a3a20', longHair: true, dress: true, sad: true });
    person(x, 452, 232, 66, { color: '#3a8a5a', hair: '#b8904a', blur: true, armL: [[446, 252], [430, 270]] });
  } },
  { dur: 9, draw(x, t) { // close em Alice e Daniel
    sky(x, '#d8c0a8', '#efe6d2');
    const z = 1 + t * 0.012;
    x.save(); x.translate(W / 2, H / 2); x.scale(z, z); x.translate(-W / 2, -H / 2);
    person(x, 250, 40, 380, { color: '#3a4a6a', hair: '#2a1e16', blur: true, armR: [[270, 130], [330, 230]] });
    person(x, 400, 60, 360, { color: '#8a3a4a', hair: '#5a3a20', longHair: true, dress: true, sad: true, armL: [[380, 140], [320, 225]] });
    x.restore();
  } },
  { dur: 7, draw(x, t) { // o táxi vai embora, as crianças acenam
    sky(x, '#b8c8d6', '#efe6d2');
    wash(x, [[0, 250], [W, 250], [W, H], [0, H]], '#7a7a74', 0.6);
    line(x, [[0, 250], [W, 250]], '#3a3a3a', 1.5);
    for (let i = 0; i < 10; i++) line(x, [[i * 70 - (t * 40) % 70, 300], [i * 70 + 30 - (t * 40) % 70, 300]], '#e8e0b0', 3, 1, 0.3);
    const cx = 380 + t * 55;
    const car = [[cx - 70, 270], [cx - 60, 238], [cx - 30, 220], [cx + 40, 220], [cx + 66, 240], [cx + 72, 270]];
    wash(x, [...car, car[0]], '#e0b830', 0.9); line(x, [...car, car[0]], '#2a2a2a', 1.8);
    for (const wx of [-40, 45]) { wash(x, ellipse(cx + wx, 272, 14, 14, 10), '#222', 0.95); }
    wash(x, rect(cx - 25, 226, 50, 16), '#9ab8c8', 0.8);
    const wave = Math.sin(t * 8) * 10;
    person(x, 90, 190, 80, { color: '#c4508a', hair: '#9a6a30', longHair: true, dress: true, blur: true, armR: [[96, 214], [116 + wave, 180]] });
    person(x, 130, 204, 66, { color: '#3a8a5a', hair: '#b8904a', blur: true, armR: [[134, 222], [152 - wave, 192]] });
    person(x, 175, 150, 120, { color: '#8a3a4a', hair: '#5a3a20', longHair: true, dress: true, sad: true });
  } },
  { dur: 7, draw(x, t) { // aeroporto: o avião decola pela janela
    sky(x, '#c8b8a0', '#efe6d2');
    wash(x, [[0, 230], [W, 230], [W, H], [0, H]], '#8a8478', 0.5);
    const k = Math.min(1, t / 6);
    plane(x, 120 + k * 520, 210 - k * k * 150, 1.0, -0.25 * k);
    // moldura da janela do terminal
    x.fillStyle = 'rgba(40,34,28,0.85)'; x.fillRect(0, 0, W, 26); x.fillRect(0, H - 40, W, 40); x.fillRect(0, 0, 26, H); x.fillRect(W - 26, 0, 26, H); x.fillRect(W / 2 - 8, 0, 16, H);
    line(x, rect(26, 26, W - 52, H - 66), '#1a1612', 2);
    // silhueta de Daniel olhando (de costas)
    wash(x, [[470, 360], [480, 250], [520, 236], [560, 250], [570, 360]], '#1c1a1a', 0.95);
    wash(x, ellipse(520, 218, 22, 26), '#1c1a1a', 0.95);
  } },
  { dur: 8, draw(x, t) { // nas nuvens, ao entardecer; turbulência e escuridão
    const dark = Math.max(0, (t - 3) / 5);
    sky(x, '#d89060', '#5a4a6a');
    for (let i = 0; i < 6; i++) cloud(x, ((i * 140 - t * 60) % (W + 200)) - 80, 80 + (i % 3) * 70, 1.4, '#f4e4d0');
    const shake = t > 3 ? Math.sin(t * 40) * 6 * dark : 0;
    plane(x, W / 2 + shake, H / 2 + Math.sin(t * 2) * 6 + shake * 0.6, 2.0, Math.sin(t * 3) * 0.05 * (1 + dark * 3));
    x.globalAlpha = dark * 0.85; x.fillStyle = '#0a0808'; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
    // a tinta escorre: manchas pretas crescendo
    if (t > 5) { seed = 7; for (let i = 0; i < 14; i++) { const r = (t - 5) * (30 + rnd() * 60); wash(x, ellipse(rnd() * W, rnd() * H, r, r * 0.8, 12), '#000', 0.9); } }
  } },
];
export const STORY_LENGTH = SCENES.reduce((a, s) => a + s.dur, 0);

// desenha o quadro do tempo t (segundos desde o início)
export function drawStory(ctx, t) {
  let acc = 0, i = 0;
  while (i < SCENES.length - 1 && t > acc + SCENES[i].dur) { acc += SCENES[i].dur; i++; }
  const local = t - acc, sc = SCENES[i];
  seed = 1000 + i * 77 + Math.floor(t * 6); // "line boil": o traço treme 6 vezes por segundo
  ctx.save();
  ctx.drawImage(paperTex(), 0, 0);
  // movimento lento de câmera
  const z = 1.02 + local * 0.004;
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  sc.draw(ctx, local);
  ctx.restore();
  // papel por cima (textura) e vinheta sépia
  ctx.globalAlpha = 0.25; ctx.drawImage(paperTex(), 0, 0); ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, 'rgba(40,24,10,0)'); g.addColorStop(1, 'rgba(40,24,10,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // transição entre cenas: escurece no começo e no fim de cada uma
  const edge = Math.min(local, sc.dur - local);
  if (edge < 0.6) { ctx.globalAlpha = 1 - edge / 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
export const STORY_SIZE = [W, H];
