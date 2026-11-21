// Inventário: coleção pessoal de objetos e lembranças.
const ICON = (draw) => {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; draw(x); return c.toDataURL();
};
const R = (x, col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };

export const ITEMS = {
  flashlight: { name: 'Lanterna', desc: 'A lanterna de Daniel. Ainda tem o adesivo de dinossauro que Thomas colou.', icon: ICON((x) => { R(x, '#333', 8, 20, 26, 10); R(x, '#666', 30, 16, 10, 18); R(x, '#ffe9a8', 40, 18, 3, 14); R(x, '#4a8', 14, 22, 5, 5); }) },
  battery: { name: 'Pilha', desc: 'Pilha grande. Recarrega a lanterna.', stack: true, icon: ICON((x) => { R(x, '#222', 14, 10, 20, 30); R(x, '#c8a032', 14, 10, 20, 9); R(x, '#888', 20, 6, 8, 4); }) },
  bread: { name: 'Pão de forma', desc: 'Duas fatias. Emily gosta sem casca.', icon: ICON((x) => { R(x, '#d9a860', 10, 12, 28, 26); R(x, '#f2e2b8', 13, 15, 22, 20); }) },
  plates: { name: 'Pratos', desc: 'Quatro pratos de louça. Um deles tem uma lasca.', icon: ICON((x) => { x.fillStyle = '#e8e8e2'; x.beginPath(); x.ellipse(24, 26, 18, 10, 0, 0, 7); x.fill(); x.fillStyle = '#c9c9c0'; x.beginPath(); x.ellipse(24, 26, 10, 5, 0, 0, 7); x.fill(); }) },
  clothes: { name: 'Roupas das crianças', desc: 'Ainda quentes da máquina. Ou deveriam estar.', icon: ICON((x) => { R(x, '#7a9ac8', 8, 14, 18, 22); R(x, '#d07a9a', 22, 18, 18, 20); }) },
  toy: { name: 'Brinquedos', desc: 'Brinquedos das crianças espalhados pela casa.', stack: true, icon: ICON((x) => { R(x, '#c33', 10, 20, 14, 14); R(x, '#33c', 24, 14, 14, 14); R(x, '#fc3', 18, 30, 12, 10); }) },
  scissors: { name: 'Tesoura', desc: 'Tesoura de costura. Fria ao toque.', icon: ICON((x) => { x.strokeStyle = '#bbb'; x.lineWidth = 3; x.beginPath(); x.moveTo(12, 10); x.lineTo(36, 34); x.moveTo(36, 10); x.lineTo(12, 34); x.stroke(); x.strokeStyle = '#a33'; x.beginPath(); x.arc(12, 38, 5, 0, 7); x.arc(36, 38, 5, 0, 7); x.stroke(); }) },
  rabbit: { name: 'Coelho de pelúcia', desc: 'Um coelho branco de pelúcia. Há algo duro dentro da barriga. A costura parece recente.', icon: ICON((x) => { x.fillStyle = '#eee'; x.beginPath(); x.ellipse(24, 32, 11, 12, 0, 0, 7); x.ellipse(19, 12, 3, 9, 0, 0, 7); x.ellipse(29, 12, 3, 9, 0, 0, 7); x.fill(); R(x, '#c33', 20, 28, 2, 2); R(x, '#c33', 27, 28, 2, 2); }) },
  smallKey: { name: 'Chave pequena', desc: 'Uma chave pequena e dourada. Do tamanho de uma fechadura de gaveta.', icon: ICON((x) => { x.strokeStyle = '#d4b04a'; x.lineWidth = 4; x.beginPath(); x.arc(14, 24, 7, 0, 7); x.moveTo(21, 24); x.lineTo(40, 24); x.moveTo(34, 24); x.lineTo(34, 30); x.moveTo(39, 24); x.lineTo(39, 30); x.stroke(); }) },
  watch: { name: 'Relógio de bolso', desc: 'Parado às 4:15. Atrás, gravado: "Para D., que nunca chega atrasado."', icon: ICON((x) => { x.fillStyle = '#c9a640'; x.beginPath(); x.arc(24, 26, 15, 0, 7); x.fill(); x.fillStyle = '#f4efe0'; x.beginPath(); x.arc(24, 26, 11, 0, 7); x.fill(); x.strokeStyle = '#222'; x.lineWidth = 2; x.beginPath(); x.moveTo(24, 26); x.lineTo(24, 18); x.moveTo(24, 26); x.lineTo(30, 27); x.stroke(); }) },
  book: { name: 'Alice no País das Maravilhas', desc: 'Edição infantil ilustrada. Alguém marcou uma página.', icon: ICON((x) => { R(x, '#2a4a7a', 10, 8, 28, 34); R(x, '#e8e0c8', 34, 10, 4, 30); R(x, '#d4b04a', 15, 16, 16, 3); }) },
  photos: { name: 'Fotografias', desc: 'Quatro fotos de família. No verso de cada uma, Alice escreveu o que lembrava.', icon: ICON((x) => { R(x, '#f4efe2', 8, 12, 24, 20); R(x, '#8aa', 10, 14, 20, 14); R(x, '#f4efe2', 16, 18, 24, 20); R(x, '#a86', 18, 20, 20, 14); }) },
  whiteKey: { name: 'Chave branca', desc: 'Uma chave de metal pintada de branco. Tem uma etiqueta: "ALA C".', icon: ICON((x) => { x.strokeStyle = '#f2f2f2'; x.lineWidth = 4; x.beginPath(); x.arc(14, 24, 7, 0, 7); x.moveTo(21, 24); x.lineTo(40, 24); x.moveTo(34, 24); x.lineTo(34, 31); x.stroke(); R(x, '#c33', 8, 34, 10, 6); }) },
  wateringCan: { name: 'Regador', desc: 'O regador verde de Emily. Ela sempre queria regar as plantas sozinha.', icon: ICON((x) => { R(x, '#3a8a4a', 10, 20, 22, 16); R(x, '#3a8a4a', 30, 18, 12, 4); R(x, '#2a6a3a', 14, 14, 12, 4); }) },
  vhs: { name: 'Fita VHS', desc: 'Etiqueta escrita à mão: "Para Alice. Assista quando estiver pronta."', icon: ICON((x) => { R(x, '#151515', 6, 14, 36, 22); R(x, '#eee', 12, 16, 24, 6); R(x, '#333', 14, 26, 8, 6); R(x, '#333', 26, 26, 8, 6); }) },
};

// Combinações possíveis: [a, b] -> resultado
const COMBOS = [
  { a: 'rabbit', b: 'scissors', result: (g) => g.events.emit('combine:rabbit'), text: 'Você abre a costura do coelho...' },
  { a: 'flashlight', b: 'battery', result: (g) => g.flashlight.reload(), text: '' },
];

export class Inventory {
  constructor(g) { this.g = g; this.items = new Map(); }
  def(id) { return ITEMS[id] || { name: id, desc: '' }; }
  add(id, n = 1, silent = false) {
    this.items.set(id, (this.items.get(id) || 0) + n);
    if (!silent) { this.g.ui.toast(`Guardado: ${this.def(id).name}${n > 1 ? ' x' + n : ''}`); this.g.audio.play('pickup'); }
    this.g.events.emit('inventory', { id, n });
  }
  has(id, n = 1) { return (this.items.get(id) || 0) >= n; }
  count(id) { return this.items.get(id) || 0; }
  take(id, n = 1) {
    const c = (this.items.get(id) || 0) - n;
    if (c <= 0) this.items.delete(id); else this.items.set(id, c);
    this.g.events.emit('inventory', { id, n: -n });
  }
  list() { return [...this.items.entries()].map(([id, n]) => ({ id, n, ...this.def(id) })); }
  combine(a, b) {
    const c = COMBOS.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!c) { this.g.ui.toast('Isso não serve aqui.'); return false; }
    if (c.text) this.g.ui.toast(c.text);
    c.result(this.g);
    return true;
  }
  use(id) {
    const g = this.g;
    if (id === 'battery') return g.flashlight.reload();
    if (id === 'flashlight') { g.flashlight.toggle(); return true; }
    if (id === 'book') { g.ui.showDoc(g.docs.book); return true; }
    if (id === 'watch') { g.ui.showDoc(g.docs.watch); return true; }
    if (id === 'photos') { g.ui.showDoc(g.docs.framePhotos); return true; }
    g.ui.toast('Não há como usar isso agora.');
    return false;
  }
  serialize() { return [...this.items.entries()]; }
  load(arr) { this.items = new Map(arr || []); }
}
