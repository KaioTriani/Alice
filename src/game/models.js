// Modelos low poly dos itens coletáveis e objetos pequenos (cada um é um THREE.Group).
import * as THREE from 'three';
import { mat, basic } from '../world/builder.js';
import { Tex } from '../render/textures.js';

const PI = Math.PI;
const box = (g, w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
const cyl = (g, rt, rb, h, m, x, y, z, seg = 8) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); g.add(c); return c; };
const label = (text, bg, fg, w = 96, h = 32) => new THREE.MeshBasicMaterial({ map: Tex.label(text, { w, h, bg, fg, font: 'bold 18px Arial' }) });

export const Models = {
  // pilha grande (tipo D): corpo preto, faixa dourada e polo
  battery() {
    const g = new THREE.Group();
    const body = cyl(g, 0.03, 0.03, 0.1, mat(null, 0x1c1c1c), 0, 0, 0, 10); body.rotation.z = PI / 2;
    const band = cyl(g, 0.0305, 0.0305, 0.045, mat(null, 0xc8a032), 0.025, 0, 0, 10); band.rotation.z = PI / 2;
    const tip = cyl(g, 0.01, 0.01, 0.012, mat(null, 0xd0d0d0), 0.056, 0, 0, 6); tip.rotation.z = PI / 2;
    g.position.y = 0.03; return g;
  },
  // lanterna de metal: corpo, cabeça larga, lente acesa e botão
  flashlight() {
    const g = new THREE.Group(), m = mat(null, 0x2e2e30), chrome = mat(null, 0xa8a8a4);
    const body = cyl(g, 0.024, 0.024, 0.18, m, 0, 0, 0, 10); body.rotation.z = PI / 2;
    const neck = cyl(g, 0.038, 0.026, 0.04, chrome, 0.11, 0, 0, 10); neck.rotation.z = PI / 2;
    const head = cyl(g, 0.04, 0.04, 0.04, m, 0.15, 0, 0, 10); head.rotation.z = PI / 2;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.034, 12), basic(0xf4ecd0)); lens.position.set(0.171, 0, 0); lens.rotation.y = PI / 2; g.add(lens);
    box(g, 0.025, 0.012, 0.016, mat(null, 0x8a2a20), 0.0, 0.026, 0);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.025), basic(0x4a9a5a)); sticker.position.set(-0.04, 0, 0.0245); g.add(sticker);
    return g;
  },
  // tesoura aberta: duas lâminas cruzadas e duas argolas coloridas
  scissors() {
    const g = new THREE.Group(), steel = mat(null, 0xc0c4c4), handle = mat(null, 0xb03a3a);
    for (const s of [-1, 1]) {
      const blade = box(g, 0.12, 0.006, 0.014, steel, 0.04, 0, 0); blade.rotation.y = s * 0.18; blade.position.z = s * 0.008;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 10), handle); ring.rotation.x = PI / 2; ring.position.set(-0.05, 0, s * 0.025); g.add(ring);
    }
    cyl(g, 0.006, 0.006, 0.012, steel, 0, 0, 0, 6);
    g.position.y = 0.006; return g;
  },
  // livro de capa dura com páginas e título
  book(color = 0x2a4a7a, title = 'ALICE') {
    const g = new THREE.Group(), cover = mat(null, color);
    box(g, 0.17, 0.006, 0.23, cover, 0, 0.003, 0); box(g, 0.17, 0.006, 0.23, cover, 0, 0.037, 0);
    box(g, 0.012, 0.04, 0.23, cover, -0.085, 0.02, 0);
    box(g, 0.158, 0.028, 0.22, mat(null, 0xeae2c8), 0.004, 0.02, 0);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.04), label(title, '#2a4a7a', '#e8d070')); t.rotation.x = -PI / 2; t.position.set(0, 0.0405, -0.04); g.add(t);
    return g;
  },
  // carrinho de brinquedo
  toyCar(color = 0xc03030) {
    const g = new THREE.Group(), m = mat(null, color);
    box(g, 0.18, 0.045, 0.09, m, 0, 0.04, 0); box(g, 0.09, 0.04, 0.08, m, -0.01, 0.08, 0);
    box(g, 0.085, 0.03, 0.081, basic(0x9ab8d0), -0.01, 0.08, 0);
    for (const sx of [-0.055, 0.055]) for (const sz of [-0.046, 0.046]) { const w = cyl(g, 0.02, 0.02, 0.014, mat(null, 0x151515), sx, 0.02, sz, 8); w.rotation.x = PI / 2; }
    return g;
  },
  // bola listrada
  ball(color = 0x3050c0) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(null, color)); b.position.y = 0.075; g.add(b);
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.012, 4, 14), mat(null, 0xf0f0e8)); s.position.y = 0.075; s.rotation.x = 0.4; g.add(s);
    return g;
  },
  // cubo de letra
  block(color = 0xe0b020, letter = 'A') {
    const g = new THREE.Group();
    const mats = Array.from({ length: 6 }, (_, i) => (i === 2 || i === 4 ? new THREE.MeshLambertMaterial({ map: Tex.label(letter, { w: 32, h: 32, bg: '#' + new THREE.Color(color).getHexString(), fg: '#ffffff', font: 'bold 24px Arial' }) }) : mat(null, color)));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mats); b.position.y = 0.05; b.rotation.y = 0.4; g.add(b);
    return g;
  },
  // ursinho de pelúcia
  teddy(color = 0x8a5a34) {
    const g = new THREE.Group(), m = mat(Tex.fabric([138, 90, 52]), color), muz = mat(null, 0xd8b890);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), m); body.scale.set(1, 1.15, 0.9); body.position.y = 0.075; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m); head.position.y = 0.18; g.add(head);
    const mz = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), muz); mz.position.set(0, 0.17, 0.043); g.add(mz);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), m); ear.position.set(s * 0.035, 0.225, 0); g.add(ear);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), m); arm.scale.set(1, 1.6, 1); arm.position.set(s * 0.07, 0.09, 0.02); g.add(arm);
      const leg = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), m); leg.position.set(s * 0.04, 0.02, 0.04); g.add(leg);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.006, 4, 3), basic(0x111111)); eye.position.set(s * 0.018, 0.19, 0.045); g.add(eye);
    }
    return g;
  },
  // chave antiga: argola, haste e dentes
  key(color = 0xd4b04a) {
    const g = new THREE.Group(), m = mat(null, color);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 12), m); ring.rotation.x = PI / 2; ring.position.set(-0.04, 0.005, 0); g.add(ring);
    box(g, 0.06, 0.006, 0.008, m, 0.005, 0.005, 0);
    box(g, 0.006, 0.006, 0.016, m, 0.03, 0.005, 0.01); box(g, 0.006, 0.006, 0.012, m, 0.02, 0.005, 0.008);
    return g;
  },
  // caixa de fotografias de papelão com tampa
  photoBox() {
    const g = new THREE.Group(), m = mat(Tex.wood([190, 160, 120]), 0xe8d4b0), lid = mat(null, 0x9a6a4a);
    box(g, 0.4, 0.17, 0.3, m, 0, 0.085, 0);
    box(g, 0.42, 0.05, 0.32, lid, 0, 0.19, 0);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), new THREE.MeshLambertMaterial({ map: Tex.label('FOTOS 87-98', { w: 128, h: 36, bg: '#efe8d6', fg: '#3a2a1a', font: 'bold 16px "Courier New"' }) }));
    lab.position.set(0, 0.11, 0.151); g.add(lab);
    return g;
  },
  // caixinha de música com tampa aberta e bailarina
  musicBox() {
    const g = new THREE.Group(), wood = mat(Tex.wood([150, 60, 50])), gold = mat(null, 0xc8a040);
    box(g, 0.16, 0.07, 0.11, wood, 0, 0.035, 0);
    const lid = box(g, 0.16, 0.012, 0.11, wood, 0, 0.12, -0.05); lid.rotation.x = -1.2;
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), basic(0xb0b8bc)); mirror.position.set(0, 0.12, -0.046); mirror.rotation.x = -1.2 + PI / 2; g.add(mirror);
    cyl(g, 0.004, 0.004, 0.03, gold, 0, 0.085, 0.01, 4);
    const dancer = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), basic(0xf0c8d8)); dancer.position.set(0, 0.112, 0.01); g.add(dancer);
    const crank = box(g, 0.004, 0.004, 0.03, gold, 0.085, 0.035, 0); crank.rotation.x = 0.6;
    return g;
  },
  // pão de forma no saco plástico
  bread() {
    const g = new THREE.Group();
    const loaf = box(g, 0.26, 0.11, 0.12, mat(null, 0xc89050), 0, 0.055, 0);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8, 1, false, 0, PI), mat(null, 0xb07838)); top.rotation.z = PI / 2; top.position.y = 0.11; g.add(top);
    box(g, 0.27, 0.13, 0.13, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }), 0, 0.065, 0);
    box(g, 0.03, 0.05, 0.06, mat(null, 0xd03030), 0.15, 0.06, 0);
    void loaf; return g;
  },
};
