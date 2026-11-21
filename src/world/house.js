// Constrói todas as áreas jogáveis de ALICE.
// Coordenadas em metros. Convenção de yaw: 0 = olhando para -Z (norte), PI = +Z (sul), -PI/2 = +X (leste).
import * as THREE from 'three';
import { Reflector } from 'reflector';
import { mat, basic, boxGeo, WALL_H } from './builder.js';
import { Tex, toTex } from '../render/textures.js';
import { Door, Drawer, Interactable } from '../game/interact.js';
import { buildEntityModel } from '../game/entity.js';
import { Models } from '../game/models.js';

const PI = Math.PI;

// Porta de móvel (armário) que a entidade pode abrir ao checar um esconderijo
class Swing {
  constructor(pivot, dir = 1) { this.pivot = pivot; this.base = pivot.rotation.y; this.dir = dir; this.t = 0; this.target = 0; this.isOpen = false; }
  update(dt) { this.t += (this.target - this.t) * Math.min(1, dt * 6); this.pivot.rotation.y = this.base + this.dir * this.t * 1.7; }
}

export function buildHouse(g) {
  const W = g.world, S = g.scene;
  const R = {}; // referências exportadas
  const M = {
    floorWood: mat(Tex.wood([112, 74, 46])), floorWoodDark: mat(Tex.wood([80, 52, 34])),
    hall: mat(Tex.wallpaper([186, 160, 118], [160, 132, 92], 0)),
    alice: mat(Tex.wallpaper([176, 150, 160], [150, 122, 136], 1)),
    kids: mat(Tex.wallpaper([168, 196, 210], [136, 170, 190], 2)),
    bathTile: mat(Tex.tiles([196, 214, 216], [120, 136, 140], 4)), bathFloor: mat(Tex.tiles([150, 160, 166], [90, 96, 100], 6)),
    laundry: mat(Tex.paint([176, 178, 168], 1)),
    living: mat(Tex.wallpaper([150, 158, 118], [122, 132, 94], 3)),
    dining: mat(Tex.wallpaper([190, 148, 116], [160, 118, 92], 4)),
    kitchenWall: mat(Tex.tiles([214, 206, 178], [150, 140, 112], 5)), kitchenFloor: mat(Tex.checker([196, 190, 172], [92, 74, 62])),
    exterior: mat(Tex.paint([90, 86, 80], 2)), siding: mat(Tex.siding()), grass: mat(Tex.grass()), asphalt: mat(Tex.asphalt()), shingles: mat(Tex.shingles()),
    ceiling: mat(Tex.ceiling()),
    carpetRed: mat(Tex.carpet([118, 46, 42])), carpetBlue: mat(Tex.carpet([70, 86, 120])), carpetGreen: mat(Tex.carpet([70, 92, 64])),
    wood: mat(Tex.wood([128, 86, 52])), woodLight: mat(Tex.wood([170, 130, 86])), woodDark: mat(Tex.wood([70, 44, 28])),
    door: mat(Tex.wood([150, 112, 74])), frame: mat(Tex.wood([96, 64, 40])),
    white: mat(null, 0xe8e6de), offwhite: mat(null, 0xd6d0c2), metal: mat(null, 0x9a9a96), dark: mat(null, 0x1c1a18), black: mat(null, 0x0c0c0c),
    fabricGreen: mat(Tex.fabric([88, 100, 70])), fabricRed: mat(Tex.fabric([130, 52, 48])), fabricBlue: mat(Tex.fabric([70, 90, 130])), fabricPink: mat(Tex.fabric([196, 140, 160])),
    linen: mat(Tex.fabric([214, 208, 192])), cream: mat(null, 0xd9cfb3),
    concrete: mat(Tex.concrete()), concreteDark: mat(Tex.concrete(), 0x8a8a8a),
    hospWall: mat(Tex.paint([212, 216, 210], 3)), vinyl: mat(Tex.vinyl()), hospDoor: mat(Tex.paint([196, 204, 200], 4)),
    curtain: mat(Tex.fabric([120, 40, 40])),
  };
  R.M = M;

  // ===================================================== CASA (zona 'house')
  W.zone('house', -0.5, 16.5, -0.5, 12.5);
  const rooms = {
    alice: W.room('alice', 'house', 0, 5, 0, 4), bath: W.room('bath', 'house', 5, 8, 0, 4), kids: W.room('kids', 'house', 8, 13, 0, 4),
    laundry: W.room('laundry', 'house', 13, 16, 0, 4), hall: W.room('hall', 'house', 0, 16, 4, 6), living: W.room('living', 'house', 0, 6, 6, 12),
    dining: W.room('dining', 'house', 6, 10, 6, 12), kitchen: W.room('kitchen', 'house', 10, 16, 6, 12),
  };
  rooms.bath.surface = 'tile'; rooms.kitchen.surface = 'tile'; rooms.laundry.surface = 'tile';
  rooms.living.surface = 'wood'; rooms.kids.surface = 'carpet'; rooms.alice.surface = 'wood'; rooms.hall.surface = 'wood'; rooms.dining.surface = 'wood';
  R.rooms = rooms;
  rooms.alice.label = 'Quarto de Alice'; rooms.bath.label = 'Banheiro'; rooms.kids.label = 'Quarto das crianças'; rooms.laundry.label = 'Lavanderia';
  rooms.hall.label = 'Corredor'; rooms.living.label = 'Sala'; rooms.dining.label = 'Sala de jantar'; rooms.kitchen.label = 'Cozinha';

  // pisos
  W.floor(0, 5, 0, 4, M.floorWood); W.floor(5, 8, 0, 4, M.bathFloor); W.floor(8, 13, 0, 4, M.floorWood);
  W.floor(13, 16, 0, 4, M.bathFloor); W.floor(0, 16, 4, 6, M.floorWoodDark); W.floor(0, 6, 6, 12, M.floorWood);
  W.floor(6, 10, 6, 12, M.floorWood); W.floor(10, 16, 6, 12, M.kitchenFloor);
  R.ceiling = W.ceiling(0, 16, 0, 12, M.ceiling);
  // tapetes
  W.floor(1.0, 4.0, 2.2, 3.6, M.carpetRed, 0.015, 'stretch'); W.floor(8.6, 12.4, 2.0, 3.8, M.carpetBlue, 0.015, 'stretch');
  W.floor(0.6, 15.4, 4.55, 5.45, M.carpetRed, 0.015, 'runner'); W.floor(1.2, 3.2, 8.0, 10.0, M.carpetGreen, 0.015, 'stretch');

  // paredes externas
  W.wallX(0, 16, 0, M.siding, M.exterior, [], { skip: ['N'] }); // norte (faces internas definidas por cômodo abaixo)
  // redefinimos faces internas com paredes finas internas (mais simples: a parede norte usa a face sul por cômodo)
  const DOOR = { w: 0.9, h: 2.1 };
  // Parede norte por cômodo (face sul visível)
  // (a de cima é só exterior; colocamos "forros" finos por cômodo)
  const liner = (x1, x2, z, m, dirZ) => { const p = W.plane(x2 - x1, WALL_H, m, (x1 + x2) / 2, WALL_H / 2, z, dirZ > 0 ? 0 : PI); fixUV(p, x2 - x1, WALL_H); return p; };
  const linerZ = (z1, z2, x, m, dirX) => { const p = W.plane(z2 - z1, WALL_H, m, x, WALL_H / 2, (z1 + z2) / 2, dirX > 0 ? PI / 2 : -PI / 2); fixUV(p, z2 - z1, WALL_H); return p; };
  liner(0, 5, 0.081, M.alice, 1); liner(5, 8, 0.081, M.bathTile, 1); liner(8, 13, 0.081, M.kids, 1); liner(13, 16, 0.081, M.laundry, 1);
  // sul (porta da frente na sala)
  W.wallX(0, 16, 12, M.exterior, M.siding, [{ x: 3, w: 1.0, h: 2.1 }, { x: 7, w: 0.9, h: 2.1 }], { skip: ['S'] });
  liner(0, 2.5, 11.919, M.living, -1); liner(3.5, 6, 11.919, M.living, -1); liner(6, 6.55, 11.919, M.dining, -1); liner(7.45, 10, 11.919, M.dining, -1); liner(10, 16, 11.919, M.kitchenWall, -1);
  { const lt = W.plane(0.9, WALL_H - 2.1, M.dining, 7, 2.1 + (WALL_H - 2.1) / 2, 11.919, PI); fixUV(lt, 0.9, WALL_H - 2.1); }
  // oeste (porta branca no corredor: vão coberto até o Ato IV)
  W.wallZ(0, 12, 0, M.siding, M.exterior, [{ z: 5, w: 0.95, h: 2.1 }], { skip: ['W'] });
  linerZ(0, 4, 0.081, M.alice, 1); linerZ(6, 12, 0.081, M.living, 1);
  linerZ(4, 4.5, 0.081, M.hall, 1); linerZ(5.5, 6, 0.081, M.hall, 1);
  const lint = W.plane(1.0, WALL_H - 2.1, M.hall, 0.081, 2.1 + (WALL_H - 2.1) / 2, 5, PI / 2);
  void lint;
  R.whitePatch = W.box(0.1, 2.1, 0.98, M.hall, 0.13, 0, 5, { occlude: true });
  // leste (porta do porão no corredor)
  W.wallZ(0, 12, 16, M.exterior, M.siding, [{ z: 5, w: 0.9, h: 2.1 }], { skip: ['E'] });
  linerZ(0, 4, 15.919, M.laundry, -1); linerZ(6, 12, 15.919, M.kitchenWall, -1);
  linerZ(4, 4.55, 15.919, M.hall, -1); linerZ(5.45, 6, 15.919, M.hall, -1);

  // parede z=4 (quartos | corredor)
  W.wallX(0, 5, 4, M.alice, M.hall, [{ x: 2.5, ...DOOR }]);
  W.wallX(5, 8, 4, M.bathTile, M.hall, [{ x: 6.5, ...DOOR }]);
  W.wallX(8, 13, 4, M.kids, M.hall, [{ x: 10.5, ...DOOR }]);
  W.wallX(13, 16, 4, M.laundry, M.hall, [{ x: 14.5, ...DOOR }]);
  // parede z=6 (corredor | sala, jantar, cozinha)
  W.wallX(0, 6, 6, M.hall, M.living, [{ x: 3, ...DOOR }]);
  W.wallX(6, 10, 6, M.hall, M.dining, [{ x: 8, w: 1.6, h: 2.25 }]);
  W.wallX(10, 16, 6, M.hall, M.kitchenWall, [{ x: 12, ...DOOR }]);
  // divisórias norte
  W.wallZ(0, 4, 5, M.alice, M.bathTile); W.wallZ(0, 4, 8, M.bathTile, M.kids); W.wallZ(0, 4, 13, M.kids, M.laundry);
  // divisórias sul (arcos)
  W.wallZ(6, 12, 6, M.living, M.dining, [{ z: 7.8, w: 1.6, h: 2.25 }]);
  W.wallZ(6, 12, 10, M.dining, M.kitchenWall, [{ z: 7.8, w: 1.6, h: 2.25 }]);

  // rodapés (detalhe)
  // portas
  g.doors = [];
  const door = (o) => { const d = new Door(g, { material: M.door, frameMat: M.frame, ...o }); g.interact.add(d); g.doors.push(d); return d; };
  R.doors = {
    alice: door({ x: 2.5, z: 4, axis: 'x', name: 'porta do quarto', hingeSide: 1 }),
    bath: door({ x: 6.5, z: 4, axis: 'x', name: 'porta do banheiro', hingeSide: -1 }),
    kids: door({ x: 10.5, z: 4, axis: 'x', name: 'porta do quarto das crianças', hingeSide: 1 }),
    laundry: door({ x: 14.5, z: 4, axis: 'x', name: 'porta da lavanderia', hingeSide: -1 }),
    living: door({ x: 3, z: 6, axis: 'x', name: 'porta da sala', hingeSide: 1 }),
    kitchen: door({ x: 12, z: 6, axis: 'x', name: 'porta da cozinha', hingeSide: -1 }),
    front: door({ x: 3, z: 12, axis: 'x', width: 1.0, name: 'porta da frente', locked: true, lockedMsg: 'Trancada por dentro. A chave não está no gancho.', material: M.woodDark }),
    basement: door({ x: 16, z: 5, axis: 'z', name: 'porta do porão', locked: true, lockedMsg: 'A porta do porão. Não há motivo para descer agora.', material: M.woodDark }),
    back: door({ x: 7, z: 12, axis: 'x', name: 'porta do quintal', hingeSide: 1, lockedMsg: 'Trancada. Lá fora está escuro demais.' }),
  };
  // vidro da porta do quintal
  { const gm = new THREE.MeshBasicMaterial({ map: Tex.window('morning') }); const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), gm); pg.position.set(0.45, 1.45, 0.03); R.doors.back.pivot.add(pg); const pg2 = pg.clone(); pg2.position.z = -0.03; pg2.rotation.y = PI; R.doors.back.pivot.add(pg2); R.backGlass = [pg, pg2]; }
  R.doors.white = door({ x: 0, z: 5, axis: 'z', width: 0.92, name: 'porta branca', locked: 'whiteKey', lockedMsg: 'Trancada. Do outro lado, alguém empurra um carrinho.', material: M.hospDoor, frameMat: M.white });
  R.doors.white.pivot.visible = false; R.doors.white.collider.active = false; R.doors.white.enabled = false;
  // janela da porta branca (vidro com corredor branco)
  const winC = document.createElement('canvas'); winC.width = 32; winC.height = 32;
  R.whiteWindowCanvas = winC; R.whiteWindowTex = toTex(winC, false);
  const ww = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: R.whiteWindowTex }));
  ww.position.set(0.45, 1.55, 0.03); ww.rotation.y = 0; R.doors.white.pivot.add(ww);
  const ww2 = ww.clone(); ww2.position.z = -0.03; ww2.rotation.y = PI; R.doors.white.pivot.add(ww2);

  // ---------- luzes da casa
  const L = g.lights;
  const bulb = (x, y, z, r = 0.09) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); b.position.set(x, y, z); S.add(b); return b; };
  const ceilLamp = (x, z, room, o = {}) => {
    const shade = W.cyl(0.08, 0.26, 0.14, M.cream, x, WALL_H - 0.2, z); void shade;
    return L.add({ pos: [x, WALL_H - 0.55, z], room, zone: 'house', bulb: bulb(x, WALL_H - 0.24, z, 0.06), glow: 0.9, intensity: 1.0, range: 6.5, ...o });
  };
  R.fx = {
    alice: ceilLamp(2.5, 2.0, rooms.alice), bath: ceilLamp(6.5, 2.0, rooms.bath, { color: 0xf2f0e8 }), kids: ceilLamp(10.5, 2.0, rooms.kids),
    laundry: ceilLamp(14.5, 2.0, rooms.laundry, { color: 0xeef0e0 }), hallW: ceilLamp(4.0, 5.0, rooms.hall, { range: 6 }), hallE: ceilLamp(12.0, 5.0, rooms.hall, { range: 6 }),
    living: ceilLamp(3.0, 9.0, rooms.living, { range: 8 }), dining: ceilLamp(8.0, 10.0, rooms.dining, { color: 0xffd090 }), kitchen: ceilLamp(13.0, 9.0, rooms.kitchen, { color: 0xf4eedc, range: 8 }),
  };
  R.fx.bedside = L.add({ pos: [0.92, 1.0, 0.4], room: rooms.alice, zone: 'house', intensity: 0.45, range: 3.5, color: 0xffb060, glow: 0.7 });
  R.fx.floorLamp = L.add({ pos: [5.55, 1.6, 6.5], room: rooms.living, zone: 'house', intensity: 0.5, range: 4.5, color: 0xffb060, glow: 0.8 });
  // luz do dia entrando pelas janelas (apaga à noite)
  for (const [x, y, z, room] of [[3.9, 1.6, 0.8, rooms.alice], [10.5, 1.6, 0.8, rooms.kids], [1.2, 1.6, 11.2, rooms.living], [12.2, 1.8, 11.0, rooms.kitchen]]) {
    L.add({ pos: [x, y, z], room, zone: 'house', intensity: 0.45, range: 4.5, color: 0xc6d6ec, daylight: true, fixedColor: true });
  }

  // ---------- QUARTO DE ALICE
  bed(W, M, 2.2, 1.09, 1.6, 2.0, M.fabricRed, 0);
  const ns = W.box(0.5, 0.55, 0.42, M.wood, 0.92, 0, 0.32);
  fronts(W, M.wood, 0.92, 0.53, 'z', 0.5, 0.08, 0.5, 1, 2, 'drawer');
  W.cyl(0.05, 0.09, 0.3, M.metal, 0.92, 0.55, 0.32);
  W.cyl(0.1, 0.18, 0.18, M.cream, 0.92, 0.85, 0.32);
  R.lampAlice = g.interact.add(new Interactable(g, { id: 'lamp_alice', mesh: ns, prompt: () => (R.fx.bedside.on ? 'Apagar abajur' : 'Acender abajur'), onUse: () => { R.fx.bedside.on = !R.fx.bedside.on; g.audio.play('click'); } }));
  // guarda-roupa (esconderijo)
  const ward = wardrobe(W, M, g, 4.6, 1.2, PI / 2, 1.2, 2.0, 0.62);
  R.spots = [];
  R.spots.push(g.hiding.add({ id: 'ward_alice', label: 'guarda-roupa', type: 'wardrobe', zone: 'house', cam: [4.62, 1.5, 1.2], yaw: PI / 2, yawRange: 0.5, pitchRange: 0.35, exit: [3.75, 1.2, PI / 2], safety: 0.55, check: [3.65, 1.2], mesh: ward.body, door: ward.swing, hideMeshes: [ward.swing.pivot] }));
  // penteadeira com gaveta trancada (chave pequena)
  W.box(0.5, 0.78, 1.1, M.woodLight, 0.33, 0, 2.95);
  fronts(W, M.woodLight, 0.58, 2.95, 'x', 1.1, 0.06, 0.44, 2, 2, 'drawer');
  W.box(0.06, 0.9, 0.7, M.frame, 0.12, 0.85, 2.95, { collide: false });
  const vanMirror = W.box(0.02, 0.78, 0.58, mat(null, 0x6a767c), 0.155, 0.91, 2.95, { collide: false }); void vanMirror;
  const vd = drawerUnit(W, M.woodLight, 0.6, 0.55, 2.95, 'x', 0.62);
  R.vanity = g.interact.add(new Drawer(g, { id: 'vanity', group: vd, axis: new THREE.Vector3(1, 0, 0), dist: 0.3, locked: 'smallKey', lockedMsg: 'A gaveta da penteadeira está trancada. A fechadura é bem pequena.', label: 'gaveta da penteadeira' }));
  // janela
  windowOn(W, 3.9, 0.09, 'x', 1.0, 'morning', R, 'winAlice');
  // fotos na parede
  wallPhoto(W, 0.09, 1.6, 1.3, 'z', 'wedding');
  // foto grande de Alice com Daniel, acima da cabeceira (o rosto dele continua borrado)
  R.couplePhoto = wallPhoto(W, 2.2, 1.62, 0.095, 'x', 'couple', 0.52); R.couplePhoto.position.z = 0.1;
  // suporte de soro (Ato IV)
  R.ivStand = new THREE.Group();
  W.cyl(0.015, 0.015, 1.8, M.metal, 0, 0, 0, { parent: R.ivStand });
  W.box(0.5, 0.03, 0.03, M.metal, 0, 1.75, 0, { parent: R.ivStand, collide: false });
  const bag = W.box(0.12, 0.2, 0.05, basic(0xddeedd, { transparent: true, opacity: 0.7 }), 0.18, 1.45, 0, { parent: R.ivStand, collide: false }); void bag;
  R.ivStand.position.set(3.35, 0, 0.5); R.ivStand.visible = false; S.add(R.ivStand);
  R.bedRail = W.box(0.04, 0.35, 1.2, M.metal, 3.05, 0.45, 1.2, { collide: false }); R.bedRail.visible = false;

  // ---------- BANHEIRO
  W.box(1.7, 0.55, 0.75, M.white, 5.95, 0, 0.46); W.box(1.5, 0.05, 0.55, basic(0x9fb4bc), 5.95, 0.5, 0.46, { collide: false });
  // vaso sanitário: caixa acoplada encostada na parede leste, assento virado para o oeste
  W.cyl(0.13, 0.17, 0.38, M.white, 7.5, 0, 1.2, { collide: false, seg: 8 });
  W.box(0.5, 0.06, 0.4, M.white, 7.55, 0.38, 1.2, { collide: false });
  W.box(0.46, 0.03, 0.36, mat(null, 0xf4f2ec), 7.55, 0.44, 1.2, { collide: false });
  W.box(0.18, 0.42, 0.46, M.white, 7.82, 0.38, 1.2, { collide: false });
  W.box(0.2, 0.04, 0.48, M.white, 7.82, 0.8, 1.2, { collide: false });
  W.addCollider(7.25, 7.92, 0.96, 1.44);
  // pia de coluna: coluna, cuba e torneira voltada para o banheiro
  W.cyl(0.08, 0.11, 0.72, M.white, 5.36, 0, 2.5, { collide: false, seg: 8 });
  W.box(0.42, 0.14, 0.56, M.white, 5.33, 0.72, 2.5, { collide: false });
  W.box(0.3, 0.02, 0.42, mat(null, 0xb8c2c4), 5.36, 0.85, 2.5, { collide: false });
  W.addCollider(5.08, 5.56, 2.22, 2.78);
  W.cyl(0.018, 0.018, 0.14, M.metal, 5.17, 0.86, 2.5, { seg: 6 });
  W.box(0.12, 0.02, 0.025, M.metal, 5.23, 0.99, 2.5, { collide: false });
  for (const dz of [-0.1, 0.1]) W.cyl(0.02, 0.02, 0.04, mat(null, 0xd8dcdc), 5.17, 0.86, 2.5 + dz, { seg: 6 });
  // prateleira com escovas e sabonete
  W.box(0.12, 0.02, 0.5, mat(null, 0xe8e8e4), 5.14, 1.12, 2.5, { collide: false });
  W.cyl(0.03, 0.03, 0.09, mat(null, 0x6aa0c0), 5.14, 1.14, 2.35); W.cyl(0.03, 0.03, 0.07, mat(null, 0xd07a8a), 5.14, 1.14, 2.42);
  W.box(0.06, 0.03, 0.08, mat(null, 0xf0e0b0), 5.14, 1.14, 2.65, { collide: false });
  // espelho (Reflector) com a entidade visível só no reflexo
  const mirror = new Reflector(new THREE.PlaneGeometry(0.56, 0.78), { textureWidth: 256, textureHeight: 352, color: 0x9aa2a2 });
  mirror.position.set(5.115, 1.62, 2.5); mirror.rotation.y = PI / 2; S.add(mirror);
  W.box(0.025, 0.88, 0.66, M.frame, 5.09, 1.18, 2.5, { collide: false });
  R.mirror = mirror;
  const ghost = buildEntityModel(2.3); ghost.position.set(7.3, 0, 3.0); ghost.rotation.y = PI / 2; // de frente para o espelho ghost.visible = false; S.add(ghost);
  R.mirrorGhost = ghost; R.mirrorGhostOn = false;
  const ob = mirror.onBeforeRender;
  mirror.onBeforeRender = function (...a) { ghost.visible = R.mirrorGhostOn; ob.apply(this, a); ghost.visible = false; };
  R.mirrorSmudge = W.plane(0.56, 0.78, new THREE.MeshBasicMaterial({ map: Tex.grime(), transparent: true, opacity: 0.55, depthWrite: false }), 5.122, 1.62, 2.5, PI / 2);
  W.box(0.04, 0.04, 0.6, M.metal, 7.9, 1.2, 2.8, { collide: false });
  W.box(0.02, 0.5, 0.45, M.fabricBlue, 7.88, 0.75, 2.8, { collide: false });

  // ---------- QUARTO DAS CRIANÇAS
  bed(W, M, 8.65, 1.03, 1.0, 1.9, M.fabricPink, 0, 0.45);
  const bed2 = bed(W, M, 12.35, 1.03, 1.0, 1.9, M.fabricBlue, 0, 0.45);
  R.bedEmily = [8.65, 1.03]; R.bedThomas = [12.35, 1.03];
  R.spots.push(g.hiding.add({ id: 'bed_kids', label: 'embaixo da cama', type: 'bed', zone: 'house', cam: [12.35, 0.17, 1.05], yaw: PI, pitch: 0.05, yawRange: 0.7, pitchRange: 0.08, exit: [11.35, 1.1, PI], safety: 0.7, check: [11.25, 1.2], mesh: bed2 }));
  const chest = W.box(1.1, 0.5, 0.5, M.woodLight, 10.5, 0, 0.35);
  W.box(1.14, 0.08, 0.54, M.woodDark, 10.5, 0.46, 0.35, { collide: false });
  for (const sx of [-0.35, 0.35]) W.box(0.06, 0.5, 0.52, mat(null, 0x7a5030), 10.5 + sx, 0.01, 0.35, { collide: false });
  W.box(0.08, 0.06, 0.02, HANDLE(), 10.5, 0.38, 0.61, { collide: false });
  R.chest = chest;
  const kidDresser = W.box(0.45, 0.7, 1.0, M.woodLight, 8.33, 0, 2.9);
  fronts(W, mat(null, 0xd8c8a8), 8.555, 2.9, 'x', 1.0, 0.04, 0.68, 1, 3, 'drawer');
  void kidDresser;
  R.tvKids = crt(W, M, g, 8.36, 0.7, 2.9, -PI / 2, 0.38);
  const kward = wardrobe(W, M, g, 12.64, 2.9, PI / 2, 1.1, 1.8, 0.55, M.woodLight);
  R.kidsWardrobe = kward;
  windowOn(W, 10.5, 0.09, 'x', 0.9, 'morning', R, 'winKids');
  // desenhos colados na parede
  const dwall = (x, y, img) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.29), new THREE.MeshLambertMaterial({ map: toTex(img, false) })); m.position.set(x, y, 0.09); S.add(m); return m; };
  dwall(9.4, 1.5, g.images.drawingHouse()); dwall(11.6, 1.6, g.images.drawingRabbit());
  // travesseiros com os desenhos (Ato I)
  R.drawingPillow = [];
  for (const [x, img] of [[8.65, g.images.drawingFamily()], [12.35, g.images.drawingHouse()]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.21), new THREE.MeshLambertMaterial({ map: toTex(img, false) }));
    m.rotation.x = -PI / 2; m.rotation.z = (Math.random() - 0.5) * 0.4; m.position.set(x, 0.62, 0.55); S.add(m); R.drawingPillow.push(m);
  }
  // pegadas molhadas (Ato II)
  R.footprints = new THREE.Group(); S.add(R.footprints);
  const fpM = new THREE.MeshBasicMaterial({ color: 0x1d2a33, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.16), fpM); f.rotation.x = -PI / 2; f.rotation.z = -PI / 2 + 0.2; f.position.set(10.1 + i * 0.3, 0.012, 2.3 + (i % 2) * 0.12 + i * 0.07); R.footprints.add(f); }
  R.footprints.visible = false;
  // roupas sobre as camas (Ato II)
  R.clothesOnBeds = new THREE.Group(); S.add(R.clothesOnBeds);
  W.box(0.5, 0.06, 0.4, M.fabricBlue, 12.35, 0.46, 1.4, { parent: R.clothesOnBeds, collide: false });
  W.box(0.5, 0.06, 0.4, M.fabricPink, 8.65, 0.46, 1.4, { parent: R.clothesOnBeds, collide: false });
  R.clothesOnBeds.visible = false;

  // ---------- LAVANDERIA
  laundryFurniture(W, M, g, R, 0, true);

  // ---------- CORREDOR
  const phoneTable = W.box(0.7, 0.04, 0.34, M.wood, 8.6, 0.71, 4.27, { collide: false });
  legs(W, M.woodDark, 8.6, 4.27, 0.7, 0.34, 0.71);
  W.box(0.62, 0.12, 0.3, M.wood, 8.6, 0.58, 4.27, { collide: false });
  fronts(W, M.wood, 8.6, 4.43, 'z', 0.62, 0.58, 0.7, 1, 1, 'drawer');
  W.addCollider(8.25, 8.95, 4.1, 4.44);
  W.box(0.2, 0.25, 0.02, mat(null, 0xe8e0c8), 8.85, 0.75, 4.2, { collide: false, ry: 0.3 });
  W.box(0.22, 0.08, 0.16, M.dark, 8.5, 0.75, 4.25, { collide: false });
  W.box(0.2, 0.05, 0.05, M.dark, 8.5, 0.86, 4.2, { collide: false });
  R.phonePos = new THREE.Vector3(8.5, 0.9, 4.25);
  R.phoneTable = phoneTable;
  // relógio de pêndulo (compartimento com a chave branca)
  const clock = W.box(0.5, 1.9, 0.3, M.woodDark, 10.65, 0, 5.76);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshLambertMaterial({ color: 0xece4cc })); face.position.set(10.65, 1.6, 5.6); face.rotation.y = PI; S.add(face);
  R.clock = clock; R.clockPos = new THREE.Vector3(10.65, 1.2, 5.6);
  const cd = drawerUnit(W, M.woodDark, 10.65, 0.6, 5.62, 'z-', 0.36);
  R.clockDrawer = cd;
  // molduras do quebra-cabeça (4)
  R.frames = [];
  for (let i = 0; i < 4; i++) {
    const x = 3.45 + i * 0.62;
    W.box(0.46, 0.38, 0.03, M.frame, x, 1.36, 4.1, { collide: false });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2620 }));
    pic.position.set(x, 1.55, 4.125); S.add(pic);
    R.frames.push({ x, pic, value: -1 });
  }
  wallPhoto(W, 13.6, 1.6, 5.91, 'x-', 'park');
  // mensagens na parede (Ato III)
  R.scrawls = [];
  const scrawl = (text, x, y, z, ry, w = 1.3) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375), new THREE.MeshBasicMaterial({ map: Tex.scrawl(text), transparent: true, depthWrite: false })); m.position.set(x, y, z); m.rotation.y = ry; m.visible = false; S.add(m); R.scrawls.push(m); return m; };
  scrawl('VOCÊ NÃO ESTÁ SOZINHA', 9.0, 1.7, 5.9, PI);
  scrawl('NÃO ABRA A PORTA', 0.1, 1.5, 7.6, PI / 2);
  scrawl('ELES ESTÃO COM MEDO', 10.5, 1.6, 3.9, PI);
  scrawl('VOCÊ PROMETEU PROTEGER', 15.9, 1.6, 8.8, -PI / 2);
  scrawl('LEMBRE-SE DO QUE FEZ', 5.08, 1.85, 1.2, PI / 2, 1.0);
  // lâmpada fluorescente (Ato IV)
  R.fluor = W.box(1.2, 0.05, 0.12, basic(0xeef4ff), 8, WALL_H - 0.06, 5, { collide: false }); R.fluor.visible = false;
  R.fx.fluor = L.add({ pos: [8, WALL_H - 0.3, 5], room: rooms.hall, intensity: 1.1, range: 6, color: 0xdfeaff, on: false, fixedColor: true, glow: 1.4 });

  // ---------- SALA
  W.box(0.5, 0.55, 1.2, M.woodDark, 0.35, 0, 9.0);
  fronts(W, M.woodDark, 0.6, 9.0, 'x', 1.2, 0.04, 0.32, 2, 1, 'door');
  for (let i = 0; i < 6; i++) W.box(0.2, 0.025, 0.14, mat(null, [0x1a1a1a, 0x2a2a3a, 0x3a2020][i % 3]), 0.42, 0.4 + i * 0.026, 9.42, { collide: false, ry: 0.05 * i });
  W.box(0.35, 0.08, 0.4, M.dark, 0.38, 0.38, 9.0, { collide: false });
  R.tvLiving = crt(W, M, g, 0.4, 0.55, 9.0, -PI / 2, 0.55, true);
  sofa(W, M, 3.65, 9.1, PI / 2);
  W.box(0.82, 0.05, 0.82, M.woodLight, 2.2, 0.37, 9.0, { collide: false });
  legs(W, M.woodDark, 2.2, 9.0, 0.82, 0.82, 0.37, 0.03);
  W.box(0.72, 0.03, 0.72, M.woodDark, 2.2, 0.1, 9.0, { collide: false });
  W.addCollider(1.79, 2.61, 8.59, 9.41);
  W.box(0.22, 0.02, 0.3, mat(null, 0x8a3a2a), 2.0, 0.42, 9.15, { collide: false, ry: 0.4 });
  W.cyl(0.04, 0.035, 0.09, mat(null, 0xe8e4da), 2.45, 0.42, 8.8);
  armchair(W, M, 1.1, 11.0, 0.35); // voltada para a TV
  // estante aberta (fundo, laterais e prateleiras) encostada na parede norte da sala
  W.box(1.6, 1.9, 0.03, M.woodDark, 1.1, 0, 6.11, { collide: false });
  for (const sx of [0.32, 1.88]) W.box(0.04, 1.9, 0.36, M.wood, sx, 0, 6.28, { collide: false });
  for (let i = 0; i < 5; i++) W.box(1.56, 0.03, 0.34, M.wood, 1.1, i === 0 ? 0.02 : 0.4 + (i - 1) * 0.45, 6.28, { collide: false });
  W.box(1.6, 0.03, 0.36, M.wood, 1.1, 1.9, 6.28, { collide: false });
  const shelf = W.box(1.6, 1.9, 0.36, basic(0, { transparent: true, opacity: 0 }), 1.1, 0, 6.28);
  shelf.visible = true; shelf.material.depthWrite = false;
  bookRow(W, 0.4, 1.33, 6.27, 0.7); bookRow(W, 0.4, 0.43, 6.27, 1.35); bookRow(W, 1.0, 1.78, 6.27, 0.75);
  R.shelf = shelf;
  W.cyl(0.02, 0.15, 0.04, M.dark, 5.55, 0, 6.5); W.cyl(0.015, 0.015, 1.5, M.metal, 5.55, 0, 6.5); W.cyl(0.12, 0.22, 0.25, M.cream, 5.55, 1.45, 6.5);
  windowOn(W, 1.2, 11.91, 'x-', 1.0, 'morning', R, 'winLiving');
  // cortina (esconderijo)
  W.box(1.4, 1.6, 0.02, basic(0x2a3a44), 5.05, 0.7, 11.9, { collide: false });
  const curtain = W.box(1.35, 2.35, 0.12, M.curtain, 5.05, 0.05, 11.72, { collide: false });
  const pleats = [];
  for (let i = 0; i < 5; i++) pleats.push(W.box(0.06, 2.35, 0.16, M.curtain, 4.5 + i * 0.27, 0.05, 11.7 + (i % 2) * 0.03, { collide: false }));
  W.addCollider(4.35, 5.75, 11.6, 11.92);
  R.spots.push(g.hiding.add({ id: 'curtain', label: 'atrás da cortina', type: 'curtain', zone: 'house', cam: [5.05, 1.5, 11.8], yaw: 0, yawRange: 0.6, pitchRange: 0.35, exit: [5.05, 11.05, 0], safety: 0.35, check: [5.05, 10.9], mesh: curtain, hideMeshes: [curtain, ...pleats] }));
  wallPhoto(W, 4.6, 1.7, 6.09, 'x', 'dinner');

  // plantas e detalhes de decoração
  const plant = (x, z, s = 1) => {
    W.cyl(0.16 * s, 0.12 * s, 0.32 * s, mat(null, 0x8a4a30), x, 0, z, { collide: true, seg: 8 });
    W.cyl(0.15 * s, 0.15 * s, 0.02, mat(null, 0x3a2a1a), x, 0.3 * s, z, { seg: 8 });
    for (let i = 0; i < 7; i++) {
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.55 * s, 4), mat(null, i % 2 ? 0x4a6a34 : 0x3a5a2a));
      const a = i * 0.9; lf.position.set(x + Math.cos(a) * 0.08 * s, 0.55 * s, z + Math.sin(a) * 0.08 * s);
      lf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); S.add(lf);
    }
  };
  plant(5.55, 10.5); plant(9.6, 11.55, 0.9); plant(0.45, 7.0, 0.8);
  // relógio de parede na cozinha
  { const ck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), mat(null, 0xe8e2d0)); ck.rotation.z = PI / 2; ck.position.set(10.1, 2.0, 10.6); S.add(ck);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 4, 14), mat(null, 0x8a2a20)); rim.rotation.y = PI / 2; rim.position.set(10.12, 2.0, 10.6); S.add(rim);
    for (const [len, a] of [[0.1, 0.4], [0.13, 2.1]]) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.01, len, 0.012), M.dark); hd.position.set(10.13, 2.0 + Math.cos(a) * len / 2, 10.6 + Math.sin(a) * len / 2); hd.rotation.x = -a; S.add(hd); } }
  // interruptores ao lado das portas
  for (const [x, z, ry] of [[2.0, 4.09, 0], [6.05, 4.09, 0], [10.0, 4.09, 0], [14.0, 4.09, 0], [2.5, 6.09, 0], [11.5, 6.09, 0], [2.0, 3.91, PI], [10.0, 3.91, PI]]) W.box(0.07, 0.11, 0.015, mat(null, 0xe8e4d8), x, 1.2, z, { collide: false, ry });

  // ---------- SALA DE JANTAR
  // mesa no sentido do comprimento da sala: deixa passagens de 80 cm dos dois lados
  W.box(1.0, 0.06, 1.6, M.woodLight, 8, 0.72, 10.0, { collide: false });
  for (const [lx, lz] of [[7.6, 9.3], [8.4, 9.3], [7.6, 10.7], [8.4, 10.7]]) W.box(0.06, 0.72, 0.06, M.woodDark, lx, 0, lz, { collide: false });
  W.box(1.04, 0.003, 0.5, mat(Tex.fabric([200, 190, 160])), 8, 0.78, 10.0, { collide: false });
  W.addCollider(7.5, 8.5, 9.2, 10.8);
  R.chairs = {
    N: chair(W, M, 8, 8.78, PI), S: chair(W, M, 8, 11.22, 0), W: chair(W, M, 7.08, 10.0, -PI / 2), E: chair(W, M, 8.92, 10.0, PI / 2),
  };
  R.tableTop = new THREE.Vector3(8, 0.78, 10);
  R.tablePlates = new THREE.Group(); S.add(R.tablePlates);
  const plateM = mat(null, 0xeeeae0);
  R.plateMeshes = [];
  for (const [px, pz] of [[8, 9.42], [8, 10.58], [7.72, 10.0], [8.28, 10.0]]) { const p = W.cyl(0.13, 0.11, 0.02, plateM, px, 0.78, pz, { parent: R.tablePlates }); R.plateMeshes.push(p); }
  R.tablePlates.visible = false;
  R.tableBread = W.box(0.2, 0.06, 0.14, mat(null, 0xd8b070), 8.0, 0.78, 10.0, { collide: false }); R.tableBread.visible = false;
  R.tableCups = new THREE.Group(); S.add(R.tableCups);
  for (const [px, pz] of [[8.2, 9.42], [8.2, 10.58]]) W.cyl(0.04, 0.035, 0.1, mat(null, 0xf2f2f2), px, 0.78, pz, { parent: R.tableCups });
  R.tableCups.visible = false;
  // aparador no canto nordeste, de frente para a passagem (fácil de alcançar)
  const side = W.box(1.1, 0.85, 0.45, M.woodDark, 9.35, 0, 6.32);
  fronts(W, M.woodDark, 9.35, 6.545, 'z', 1.1, 0.62, 0.82, 2, 1, 'drawer');
  fronts(W, M.woodDark, 9.35, 6.545, 'z', 1.1, 0.06, 0.6, 2, 1, 'door');
  W.cyl(0.1, 0.06, 0.18, mat(null, 0x7a8aa0), 9.05, 0.85, 6.3); W.box(0.3, 0.22, 0.02, mat(null, 0x5a4a3a), 9.65, 0.85, 6.15, { collide: false, ry: -0.1 });
  R.sideboard = side;
  W.cyl(0.25, 0.05, 0.12, M.cream, 8, 2.28, 10, {}); // lustre
  // casaco preto (Ato II, cadeira virada)
  R.coat = new THREE.Group();
  W.box(0.5, 0.8, 0.12, M.black, 0, 0.5, 0.16, { parent: R.coat, collide: false });
  W.box(0.12, 0.55, 0.1, M.black, -0.28, 0.6, 0.12, { parent: R.coat, collide: false });
  W.box(0.12, 0.55, 0.1, M.black, 0.28, 0.6, 0.12, { parent: R.coat, collide: false });
  R.coat.visible = false; S.add(R.coat);

  // ---------- COZINHA
  W.box(5.5, 0.9, 0.58, M.woodLight, 13.15, 0, 11.63);
  fronts(W, M.woodLight, 13.15, 11.34, 'z-', 5.5, 0.1, 0.62, 9, 1, 'door');
  fronts(W, M.woodLight, 13.15, 11.34, 'z-', 5.5, 0.66, 0.86, 9, 1, 'drawer');
  W.box(5.5, 0.09, 0.02, M.woodDark, 13.15, 0, 11.33, { collide: false });
  // tampo com um recorte para a cuba da pia
  const topM = mat(Tex.tiles([220, 220, 210], [160, 160, 150], 6));
  W.box(1.52, 0.04, 0.6, topM, 11.16, 0.9, 11.62, { collide: false });
  W.box(3.42, 0.04, 0.6, topM, 14.19, 0.9, 11.62, { collide: false });
  W.box(0.56, 0.04, 0.1, topM, 12.2, 0.9, 11.37, { collide: false });
  W.box(0.56, 0.04, 0.1, topM, 12.2, 0.9, 11.87, { collide: false });
  // cuba de inox (fundo escuro e paredes internas) com borda
  const inox = mat(null, 0xb4b8b8), inoxDark = mat(null, 0x6a7072);
  W.box(0.56, 0.01, 0.4, inoxDark, 12.2, 0.9, 11.62, { collide: false });
  for (const [w, d, x, z] of [[0.56, 0.02, 12.2, 11.43], [0.56, 0.02, 12.2, 11.81], [0.02, 0.4, 11.93, 11.62], [0.02, 0.4, 12.47, 11.62]]) W.box(w, 0.07, d, inox, x, 0.9, z, { collide: false });
  W.cyl(0.025, 0.025, 0.005, mat(null, 0x2a2a2a), 12.2, 0.911, 11.62, { seg: 8 }); // ralo
  // torneira: base, coluna, bica curva e dois registros
  W.cyl(0.035, 0.04, 0.03, inox, 12.2, 0.94, 11.86, { seg: 8 });
  W.cyl(0.015, 0.015, 0.26, inox, 12.2, 0.97, 11.86, { seg: 6 });
  { const arc = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.013, 5, 10, Math.PI), inox); arc.position.set(12.2, 1.23, 11.78); arc.rotation.y = PI / 2; S.add(arc);
    W.cyl(0.013, 0.016, 0.06, inox, 12.2, 1.17, 11.7, { seg: 6 }); }
  for (const dx of [-0.11, 0.11]) { W.cyl(0.018, 0.018, 0.04, inox, 12.2 + dx, 0.94, 11.86, { seg: 6 }); W.box(0.06, 0.012, 0.012, mat(null, dx < 0 ? 0xc03030 : 0x3050c0), 12.2 + dx, 0.985, 11.86, { collide: false }); }
  // escorredor de louça e detergente
  W.box(0.4, 0.015, 0.3, mat(null, 0xd8d8d0), 11.55, 0.94, 11.62, { collide: false });
  for (let i = 0; i < 5; i++) W.box(0.012, 0.12, 0.28, mat(null, 0xd8d8d0), 11.4 + i * 0.075, 0.955, 11.62, { collide: false });
  for (let i = 0; i < 3; i++) { const pl = W.cyl(0.11, 0.1, 0.015, mat(null, 0xeeeae0), 11.48 + i * 0.075, 1.04, 11.62, { seg: 12 }); pl.rotation.z = PI / 2 - 0.15; }
  W.cyl(0.03, 0.032, 0.17, mat(null, 0x4aa04a), 12.62, 0.94, 11.8, { seg: 8 }); W.cyl(0.008, 0.012, 0.04, mat(null, 0xe0e0e0), 12.62, 1.11, 11.8, { seg: 5 });
  W.box(0.6, 0.04, 0.55, M.dark, 14.2, 0.92, 11.62, { collide: false });
  for (const [bx, bz] of [[14.05, 11.5], [14.35, 11.5], [14.05, 11.75], [14.35, 11.75]]) W.cyl(0.08, 0.08, 0.01, mat(null, 0x333333), bx, 0.96, bz);
  W.box(5.0, 0.6, 0.35, M.woodLight, 13.15, 1.55, 11.74, { collide: false });
  fronts(W, M.woodLight, 13.15, 11.565, 'z-', 5.0, 1.56, 2.14, 8, 1, 'door');
  windowOn(W, 12.2, 11.91, 'x-', 0.9, 'morning', R, 'winKitchen', 1.3);
  // geladeira
  W.box(0.68, 1.8, 0.7, M.offwhite, 15.56, 0, 6.72);
  fronts(W, M.offwhite, 15.22, 6.72, 'x-', 0.68, 1.22, 1.78, 1, 1, 'door');
  fronts(W, M.offwhite, 15.22, 6.72, 'x-', 0.68, 0.06, 1.18, 1, 1, 'door');
  for (const [y, c] of [[1.4, 0xd04030], [1.55, 0x3a7ad0], [1.3, 0xe0c030]]) W.box(0.01, 0.06, 0.06, mat(null, c), 15.2, y, 6.6 + y * 0.1, { collide: false });
  W.box(0.01, 0.2, 0.15, mat(null, 0xeee8d8), 15.2, 1.32, 6.85, { collide: false });
  W.box(0.03, 0.4, 0.03, M.metal, 15.2, 1.0, 6.5, { collide: false });
  R.fridgePos = new THREE.Vector3(15.5, 1, 6.7);
  // bancada leste
  W.box(0.58, 0.9, 3.4, M.woodLight, 15.63, 0, 9.15);
  fronts(W, M.woodLight, 15.34, 8.45, 'x-', 2.0, 0.1, 0.56, 3, 1, 'door');
  fronts(W, M.woodLight, 15.34, 10.55, 'x-', 0.7, 0.1, 0.56, 1, 1, 'door');
  W.box(0.02, 0.09, 3.4, M.woodDark, 15.33, 0, 9.15, { collide: false });
  W.box(0.6, 0.04, 3.4, mat(Tex.tiles([220, 220, 210], [160, 160, 150], 6)), 15.62, 0.9, 9.15, { collide: false });
  // cafeteira
  // cafeteira elétrica: base, coluna, reservatório e jarra de vidro
  const coffee = W.box(0.22, 0.04, 0.24, M.dark, 15.62, 0.92, 7.75, { collide: false });
  W.box(0.08, 0.3, 0.24, M.dark, 15.71, 0.96, 7.75, { collide: false });
  W.box(0.22, 0.07, 0.24, M.dark, 15.62, 1.26, 7.75, { collide: false });
  W.cyl(0.065, 0.07, 0.03, mat(null, 0x606060), 15.58, 0.96, 7.75);
  W.box(0.01, 0.02, 0.02, basic(0xd03020), 15.505, 0.95, 7.68, { collide: false });
  W.cyl(0.07, 0.07, 0.12, basic(0x2a1a10, { transparent: true, opacity: 0.8 }), 15.58, 0.99, 7.75);
  R.coffee = coffee;
  // gaveta com a lanterna
  const kd = drawerUnit(W, M.woodLight, 15.3, 0.62, 9.6, 'x-', 0.5);
  R.kitchenDrawer = g.interact.add(new Drawer(g, { id: 'kitchen_drawer', group: kd, axis: new THREE.Vector3(-1, 0, 0), dist: 0.32, label: 'gaveta' }));
  // pão
  R.breadMesh = Models.bread(); R.breadMesh.position.set(10.95, 0.92, 11.6); R.breadMesh.rotation.y = 0.2; S.add(R.breadMesh);
  // torradeira
  W.box(0.26, 0.18, 0.16, M.metal, 11.4, 0.92, 11.6, { collide: false });
  // despensa (esconderijo)
  const pantry = wardrobe(W, M, g, 14.0, 6.42, PI, 1.1, 2.1, 0.6, M.woodLight);
  R.spots.push(g.hiding.add({ id: 'pantry', label: 'despensa', type: 'wardrobe', zone: 'house', cam: [14.0, 1.5, 6.4], yaw: PI, yawRange: 0.5, pitchRange: 0.35, exit: [14.0, 7.35, PI], safety: 0.5, check: [14.0, 7.45], mesh: pantry.body, door: pantry.swing, hideMeshes: [pantry.swing.pivot] }));
  // xícaras e louça suja
  R.dirtyDishes = new THREE.Group(); S.add(R.dirtyDishes);
  // louça suja dentro da cuba: pratos empilhados e tortos, tigela, xícaras, talheres e esponja
  const dish = mat(null, 0xdcd6c6), dirt = mat(null, 0x8a6a4a);
  for (let i = 0; i < 4; i++) { const p = W.cyl(0.11, 0.09, 0.018, dish, 12.14 + i * 0.012, 0.912 + i * 0.019, 11.6 - i * 0.01, { parent: R.dirtyDishes, seg: 12 }); p.rotation.z = 0.1 + i * 0.04; p.rotation.x = -0.05 * i; }
  W.cyl(0.06, 0.06, 0.004, dirt, 12.16, 0.99, 11.59, { parent: R.dirtyDishes, seg: 10 });
  const bowl = W.cyl(0.09, 0.05, 0.06, mat(null, 0xe8e0d0), 12.36, 0.912, 11.7, { parent: R.dirtyDishes, seg: 10 }); bowl.rotation.z = -0.3;
  for (const [x, z] of [[12.35, 11.5], [12.02, 11.74]]) { W.cyl(0.035, 0.03, 0.08, mat(null, 0xf2f0ea), x, 0.912, z, { parent: R.dirtyDishes, seg: 8 }); W.cyl(0.033, 0.033, 0.003, mat(null, 0x5a3a20), x, 0.985, z, { parent: R.dirtyDishes, seg: 8 }); }
  for (let i = 0; i < 2; i++) W.box(0.16, 0.006, 0.012, inox, 12.1 + i * 0.05, 0.96 + i * 0.01, 11.5, { parent: R.dirtyDishes, collide: false, ry: 0.5 + i });
  W.box(0.09, 0.03, 0.06, mat(null, 0xe0c030), 12.44, 0.94, 11.86, { collide: false }); W.box(0.09, 0.012, 0.06, mat(null, 0x3a8a3a), 12.44, 0.97, 11.86, { collide: false });

  // ---------- pontos de patrulha da casa
  R.patrol = [[2.5, 2.6], [6.5, 2.4], [10.5, 2.7], [14.5, 2.4], [2.0, 5.0], [6.0, 5.0], [10.0, 5.0], [14.5, 5.0], [3.0, 7.6], [1.8, 10.5], [5.0, 10.3], [8.0, 7.6], [8.0, 11.4], [12.0, 8.5], [13.5, 10.4]];

  // ===================================================== QUINTAL (zona 'yard')
  buildYard(g, W, M, R);
  // ===================================================== PORÃO (zona 'basement')
  buildBasement(g, W, M, R);
  // ===================================================== CORREDOR IMPOSSÍVEL (zona 'longhall')
  buildLongHall(g, W, M, R);
  // ===================================================== VISÃO (zona 'vision')
  buildVision(g, W, M, R);
  // ===================================================== HOSPITAL (zona 'hospital')
  buildHospital(g, W, M, R);

  return R;
}

// ---------------------------------------------------------------- helpers de móveis
function fixUV(mesh, w, h) { const uv = mesh.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); }

// adiciona uma caixa com UV em escala real a um grupo (y = base)
function part(grp, w, h, d, m, px, py, pz, o = {}) {
  const b = new THREE.Mesh(boxGeo(w, h, d, o.ts || 0.5), m);
  b.position.set(px, py + h / 2, pz);
  if (o.rx) b.rotation.x = o.rx; if (o.rz) b.rotation.z = o.rz; if (o.ry) b.rotation.y = o.ry;
  grp.add(b); return b;
}
function cylPart(grp, rt, rb, h, m, px, py, pz, seg = 8) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(px, py + h / 2, pz); grp.add(c); return c;
}

// Cama: cabeceira encostada na parede norte (-Z), pés, estrado, colchão, lençol, colcha caindo pelas laterais e travesseiros
function bed(W, M, cx, cz, w, l, blanket, ry = 0, h = 0.5) {
  const grp = new THREE.Group(); grp.position.set(cx, 0, cz); W.scene.add(grp);
  const wd = M.woodDark;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(grp, 0.07, sz < 0 ? 0.95 : 0.4, 0.07, wd, sx * (w / 2 - 0.035), 0, sz * (l / 2 - 0.035));
  part(grp, w, 0.12, l - 0.1, wd, 0, h - 0.32, 0); // estrado
  part(grp, w - 0.1, 0.5, 0.04, wd, 0, h - 0.2, -l / 2 + 0.02); // cabeceira
  part(grp, w - 0.18, 0.36, 0.02, M.wood, 0, h - 0.12, -l / 2 + 0.05); // painel da cabeceira
  part(grp, w + 0.02, 0.05, 0.06, wd, 0, h + 0.3, -l / 2 + 0.02);
  part(grp, w - 0.1, 0.16, 0.04, wd, 0, h - 0.22, l / 2 - 0.02); // peseira
  part(grp, w - 0.08, 0.16, l - 0.14, M.linen, 0, h - 0.2, 0); // colchão
  part(grp, w + 0.02, 0.05, l * 0.66, blanket, 0, h - 0.06, l * 0.15); // colcha
  for (const sx of [-1, 1]) part(grp, 0.025, 0.22, l * 0.66, blanket, sx * (w / 2 + 0.01), h - 0.27, l * 0.15); // colcha caindo
  part(grp, w + 0.02, 0.22, 0.025, blanket, 0, h - 0.27, l / 2 - 0.02 + 0.01);
  part(grp, w + 0.01, 0.035, 0.18, M.white, 0, h - 0.04, -l / 2 + l * 0.32 + 0.05); // dobra do lençol
  const pillows = w > 1.2 ? [-w / 4, w / 4] : [0];
  for (const px of pillows) { const p = part(grp, Math.min(0.62, w * 0.42 * (w > 1.2 ? 1 : 1.6)), 0.12, 0.34, M.white, px, h - 0.04, -l / 2 + 0.26); p.rotation.x = -0.12; p.scale.y = 1; }
  const body = part(grp, w, 0.01, l, basic(0, { transparent: true, opacity: 0 }), 0, h - 0.02, 0);
  W.addCollider(cx - w / 2, cx + w / 2, cz - l / 2 - 0.05, cz + l / 2);
  void ry;
  return body;
}

// Guarda-roupa: corpo com rodapé e moldura, porta com painéis em relevo e puxador
function wardrobe(W, M, g, x, z, ry, w, h, d, m = M.wood) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.scene.add(grp);
  const body = new THREE.Mesh(boxGeo(w, h - 0.08, d, 0.5), m); body.position.y = 0.08 + (h - 0.08) / 2; grp.add(body);
  part(grp, w - 0.04, 0.08, d - 0.04, M.woodDark, 0, 0, 0.0); // rodapé
  part(grp, w + 0.06, 0.06, d + 0.05, M.woodDark, 0, h, 0.0); // moldura de cima
  // porta (pivot na borda), fica na face local -Z
  const pivot = new THREE.Object3D(); pivot.position.set(-w / 2, 0, -d / 2 - 0.01); grp.add(pivot);
  const leaf = new THREE.Mesh(boxGeo(w * 0.98, h * 0.92, 0.03, 0.5), m); leaf.position.set(w / 2, 0.08 + h * 0.46, 0); pivot.add(leaf);
  for (const [py, ph] of [[0.2, h * 0.36], [0.2 + h * 0.4, h * 0.4]]) {
    const pn = new THREE.Mesh(boxGeo(w * 0.74, ph, 0.02, 0.5), M.woodDark); pn.position.set(w / 2, py + ph / 2, -0.02); pivot.add(pn);
    const pi = new THREE.Mesh(boxGeo(w * 0.66, ph - 0.07, 0.02, 0.5), m); pi.position.set(w / 2, py + ph / 2, -0.03); pivot.add(pi);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.03), M.metal); handle.position.set(w - 0.09, h * 0.52, -0.04); pivot.add(handle);
  const swing = new Swing(pivot, -1);
  g.interact.updatables.push(swing);
  const sw = Math.abs(Math.sin(ry)) > 0.5;
  const hw = (sw ? d : w) / 2, hd = (sw ? w : d) / 2;
  W.addCollider(x - hw, x + hw, z - hd, z + hd, { maxY: h });
  W.occluders.push(body);
  return { body, swing, grp };
}

// Televisão de tubo: moldura frontal, traseira afunilada, tela curva, botões e (na sala) antena
function crt(W, M, g, x, y, z, ry, s, antenna = false) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = ry; g.scene.add(grp);
  const shell = mat(null, 0x2a2724);
  const body = new THREE.Mesh(boxGeo(s, s * 0.78, s * 0.42, 0.5), shell); body.position.set(0, s * 0.39, -s * 0.2); grp.add(body);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.4, s * 0.5, 4, 1), shell); back.rotation.x = -PI / 2; back.rotation.y = PI / 4; back.position.set(0, s * 0.39, s * 0.2); back.scale.set(1, 1, 0.8); grp.add(back);
  const bezel = new THREE.Mesh(boxGeo(s * 0.84, s * 0.64, 0.02, 0.5), mat(null, 0x161514)); bezel.position.set(-s * 0.04, s * 0.42, -s * 0.42); grp.add(bezel);
  const tex = Tex.tvScreen();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.74, s * 0.55), new THREE.MeshBasicMaterial({ map: tex, color: 0x000000 }));
  screen.position.set(-s * 0.04, s * 0.42, -s * 0.435); screen.rotation.y = PI; grp.add(screen);
  // brilho do vidro
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.74, s * 0.55), new THREE.MeshBasicMaterial({ color: 0x8090a0, transparent: true, opacity: 0.06, depthWrite: false }));
  glass.position.set(-s * 0.04, s * 0.42, -s * 0.44); glass.rotation.y = PI; grp.add(glass);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(s * 0.05, s * 0.025, 0.02), M.metal); b.position.set(s * 0.43, s * (0.62 - i * 0.08), -s * 0.425); grp.add(b); }
  for (let i = 0; i < 5; i++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(s * 0.08, 0.004, 0.01), mat(null, 0x0d0c0b)); gl.position.set(s * 0.43, s * (0.3 - i * 0.03), -s * 0.425); grp.add(gl); }
  if (antenna) for (const sgn of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, s * 0.9, 4), M.metal); a.position.set(sgn * s * 0.15, s * 1.15, -s * 0.05); a.rotation.z = -sgn * 0.45; grp.add(a); }
  const c = tex.userData.canvas.getContext('2d'); c.fillStyle = '#050605'; c.fillRect(0, 0, 64, 48); tex.needsUpdate = true;
  return { grp, screen, tex, body, on: false, pos: grp.position.clone().add(new THREE.Vector3(0, s * 0.4, 0)), mode: 'off', img: null };
}

// Sofá: pés, base, três almofadas de assento e de encosto, braços acolchoados
function sofa(W, M, x, z, ry) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; W.scene.add(grp);
  const F = M.fabricGreen, F2 = mat(Tex.fabric([78, 90, 62]));
  for (const sx of [-0.98, 0.98]) for (const sz of [-0.36, 0.36]) part(grp, 0.05, 0.1, 0.05, M.woodDark, sx, 0, sz);
  part(grp, 2.1, 0.2, 0.86, F2, 0, 0.1, 0.02);
  for (let i = -1; i <= 1; i++) {
    part(grp, 0.6, 0.14, 0.6, F, i * 0.62, 0.3, -0.08); // assento
    const bc = part(grp, 0.6, 0.42, 0.16, F, i * 0.62, 0.42, 0.26); bc.rotation.x = 0.12; // encosto
  }
  part(grp, 2.1, 0.5, 0.14, F2, 0, 0.3, 0.38);
  for (const sx of [-1, 1]) { part(grp, 0.2, 0.32, 0.86, F2, sx * 0.98, 0.3, 0.02); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.86, 8), F); arm.rotation.x = PI / 2; arm.position.set(sx * 0.98, 0.62, 0.02); grp.add(arm); }
  // manta dobrada sobre um braço
  part(grp, 0.24, 0.04, 0.5, M.fabricRed, 0.98, 0.72, 0.05);
  W.addCollider(x - 0.45, x + 0.45, z - 1.1, z + 1.1);
}
function armchair(W, M, x, z, ry) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; W.scene.add(grp);
  const F = M.fabricRed, F2 = mat(Tex.fabric([110, 44, 40]));
  for (const sx of [-0.34, 0.34]) for (const sz of [-0.32, 0.32]) part(grp, 0.05, 0.1, 0.05, M.woodDark, sx, 0, sz);
  part(grp, 0.8, 0.22, 0.76, F2, 0, 0.1, 0);
  part(grp, 0.56, 0.13, 0.56, F, 0, 0.32, -0.06);
  const bk = part(grp, 0.6, 0.5, 0.16, F, 0, 0.38, 0.28); bk.rotation.x = 0.14;
  for (const sx of [-1, 1]) { part(grp, 0.12, 0.3, 0.76, F2, sx * 0.34, 0.32, 0); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.76, 8), F); arm.rotation.x = PI / 2; arm.position.set(sx * 0.34, 0.62, 0); grp.add(arm); }
  W.addCollider(x - 0.42, x + 0.42, z - 0.42, z + 0.42);
}
// Cadeira de jantar com encosto de ripas
function chair(W, M, x, z, ry) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; W.scene.add(grp);
  const w = M.woodDark;
  part(grp, 0.44, 0.04, 0.42, w, 0, 0.44, 0);
  part(grp, 0.4, 0.025, 0.38, mat(Tex.fabric([120, 90, 70])), 0, 0.48, 0);
  for (const [a, b] of [[-0.19, -0.18], [0.19, -0.18]]) part(grp, 0.035, 0.44, 0.035, w, a, 0, b);
  for (const a of [-0.19, 0.19]) part(grp, 0.035, 0.98, 0.035, w, a, 0, 0.18);
  part(grp, 0.42, 0.06, 0.035, w, 0, 0.9, 0.18);
  for (const a of [-0.09, 0, 0.09]) part(grp, 0.025, 0.36, 0.02, w, a, 0.52, 0.18);
  part(grp, 0.36, 0.02, 0.02, w, 0, 0.15, -0.18); part(grp, 0.36, 0.02, 0.02, w, 0, 0.15, 0.18);
  grp.userData.collider = W.addCollider(x - 0.22, x + 0.22, z - 0.22, z + 0.22, { nav: true });
  grp.userData.home = { x, z, ry };
  return grp;
}


// Frentes de móveis: portas e gavetas com moldura e puxador numa face.
// face: 'x' (frente para +X), 'x-', 'z' (+Z), 'z-'. (cx, cz) = ponto no plano da face; y0..y1 = faixa de altura.
function fronts(W, m, cx, cz, face, width, y0, y1, cols = 1, rows = 1, kind = 'door') {
  const S = W.scene, out = face === 'x' ? [1, 0] : face === 'x-' ? [-1, 0] : face === 'z' ? [0, 1] : [0, -1];
  const along = out[0] ? [0, 1] : [1, 0];
  const hm = HANDLE();
  const cw = width / cols, rh = (y1 - y0) / rows;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const off = -width / 2 + cw * (c + 0.5), py = y0 + rh * (r + 0.5);
    const px = cx + along[0] * off + out[0] * 0.008, pz = cz + along[1] * off + out[1] * 0.008;
    const pw = cw - 0.03, ph = rh - 0.03;
    const panel = new THREE.Mesh(boxGeo(out[0] ? 0.016 : pw, ph, out[0] ? pw : 0.016, 0.5), m);
    panel.position.set(px, py, pz); S.add(panel);
    const inset = new THREE.Mesh(boxGeo(out[0] ? 0.01 : pw * 0.8, ph * 0.78, out[0] ? pw * 0.8 : 0.01, 0.5), DARKEN(m));
    inset.position.set(px + out[0] * 0.006, py, pz + out[1] * 0.006); S.add(inset);
    // puxador: gaveta no centro, porta perto da borda
    const hx = kind === 'drawer' ? 0 : (cols > 1 ? (c % 2 ? -1 : 1) : 1) * (pw / 2 - 0.05);
    const hy = kind === 'drawer' ? 0 : ph * 0.25;
    const h = new THREE.Mesh(new THREE.BoxGeometry(out[0] ? 0.02 : (kind === 'drawer' ? 0.12 : 0.02), kind === 'drawer' ? 0.02 : 0.1, out[0] ? (kind === 'drawer' ? 0.12 : 0.02) : 0.02), hm);
    h.position.set(px + out[0] * 0.02 + along[0] * hx, py + hy, pz + out[1] * 0.02 + along[1] * hx); S.add(h);
  }
}
let _hm = null; const HANDLE = () => _hm || (_hm = mat(null, 0xb59a5a));
const _dk = new Map();
function DARKEN(m) { if (!_dk.has(m)) { const d = m.clone(); d.color = m.color.clone().multiplyScalar(0.82); d.onBeforeCompile = m.onBeforeCompile; d.customProgramCacheKey = m.customProgramCacheKey; _dk.set(m, d); } return _dk.get(m); }
function legs(W, m, cx, cz, w, d, h, r = 0.025) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(r * 2, h, r * 2, m, cx + sx * (w / 2 - r * 2), 0, cz + sz * (d / 2 - r * 2), { collide: false });
}

// gaveta: grupo que desliza. dir: 'x' (frente para +X), 'x-' (frente -X), 'z' (+Z), 'z-' (-Z)
function drawerUnit(W, m, x, y, z, dir, width) {
  const grp = new THREE.Group(); grp.position.set(x, y, z); W.scene.add(grp);
  const rot = { x: PI / 2, 'x-': -PI / 2, z: 0, 'z-': PI }[dir];
  grp.rotation.y = rot;
  const front = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, 0.03), m); front.position.set(0, 0, 0.0); grp.add(front);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.02, 0.36), m); bottom.position.set(0, -0.07, -0.18); grp.add(bottom);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), new THREE.MeshLambertMaterial({ color: 0xb59a5a })); handle.position.set(0, 0.02, 0.025); grp.add(handle);
  grp.userData.inside = new THREE.Vector3(0, -0.04, -0.15);
  return grp;
}

function bookRow(W, x0, y, z, len) {
  const cols = [0x6a2a24, 0x2a4a6a, 0x3a5a2a, 0x7a6a3a, 0x4a2a4a, 0x8a7a6a];
  let x = x0;
  while (x < x0 + len) { const w = 0.04 + Math.random() * 0.04, h = 0.22 + Math.random() * 0.1; W.box(w, h, 0.22, mat(null, cols[(Math.random() * cols.length) | 0]), x + w / 2, y, z, { collide: false }); x += w + 0.005; }
}
function windowOn(W, x, z, axis, w, kind, R, key, y = 1.1) {
  const m = new THREE.MeshBasicMaterial({ map: Tex.window(kind) });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.0), m);
  p.position.set(x, y + 0.5, z); p.rotation.y = axis === 'x' ? 0 : axis === 'x-' ? PI : axis === 'z' ? PI / 2 : -PI / 2;
  W.scene.add(p);
  const fm = mat(Tex.wood([200, 196, 186]));
  const bar = (bw, bh, ox, oy) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), fm); b.position.copy(p.position).add(new THREE.Vector3(ox, oy, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation.y)); b.rotation.y = p.rotation.y; W.scene.add(b); };
  bar(w + 0.1, 0.06, 0, 0.53); bar(w + 0.1, 0.08, 0, -0.53); bar(0.06, 1.1, -w / 2 - 0.02, 0); bar(0.06, 1.1, w / 2 + 0.02, 0);
  bar(0.03, 1.0, 0, 0); bar(w, 0.03, 0, 0); // divisões do vidro
  if (R && kind !== 'hospital') {
    // varão e cortinas presas nas laterais
    const cm = mat(Tex.fabric(key === 'winKids' ? [200, 170, 190] : key === 'winKitchen' ? [210, 200, 160] : [150, 60, 50]));
    const along = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation.y);
    const outv = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation.y);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, w + 0.8, 6), mat(null, 0x6a5a40));
    rod.rotation.z = PI / 2; rod.rotation.y = p.rotation.y; rod.position.copy(p.position).addScaledVector(outv, 0.08).setY(y + 1.18); W.scene.add(rod);
    for (const sgn of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        const c = new THREE.Mesh(boxGeo(0.12, 1.3, 0.03, 0.5), cm);
        c.position.copy(p.position).addScaledVector(along, sgn * (w / 2 + 0.07 + f * 0.1)).addScaledVector(outv, 0.06 + (f % 2) * 0.03).setY(y + 0.52);
        c.rotation.y = p.rotation.y + (f % 2 ? 0.25 : -0.25) * sgn; W.scene.add(c);
      }
    }
  }
  if (R) R[key] = p;
  return p;
}
function wallPhoto(W, x, y, z, axis, kind, size = 0.3) {
  const img = W.__images.photo(kind);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.75), new THREE.MeshLambertMaterial({ map: toTex(img, false) }));
  p.position.set(x, y, z); p.rotation.y = axis === 'x' ? 0 : axis === 'x-' ? PI : axis === 'z' ? PI / 2 : -PI / 2;
  W.scene.add(p);
  const f = new THREE.Mesh(new THREE.BoxGeometry(size * 1.2, size * 0.95, 0.02), mat(Tex.wood([80, 52, 34]))); f.position.copy(p.position); f.rotation.y = p.rotation.y;
  f.translateZ(-0.012); W.scene.add(f);
  return p;
}

function laundryFurniture(W, M, g, R, dz, real) {
  const washer = W.box(0.62, 0.85, 0.62, M.white, 13.6, 0, 0.45 + dz);
  const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), basic(0x3a4a50)); porthole.position.set(13.6, 0.5, 0.77 + dz); W.scene.add(porthole);
  W.box(0.62, 0.85, 0.62, M.white, 14.3, 0, 0.45 + dz);
  { const ph = new THREE.Mesh(new THREE.CircleGeometry(0.17, 10), basic(0x2e3a40)); ph.position.set(14.3, 0.5, 0.77 + dz); W.scene.add(ph);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.2, 10), M.metal); rim.position.set(14.3, 0.5, 0.772 + dz); W.scene.add(rim);
    const rim2 = rim.clone(); rim2.position.x = 13.6; W.scene.add(rim2); }
  W.box(0.42, 0.9, 1.0, M.woodLight, 13.3, 0, 2.1 + dz);
  fronts(W, M.woodLight, 13.51, 2.1 + dz, 'x', 1.0, 0.06, 0.52, 2, 1, 'door');
  W.box(0.3, 0.25, 0.2, mat(null, 0x3a7ac0), 13.3, 0.9, 1.85 + dz, { collide: false }); W.box(0.18, 0.3, 0.12, mat(null, 0xe8e0c8), 13.3, 0.9, 2.3 + dz, { collide: false });
  W.box(0.5, 0.3, 0.4, M.fabricBlue, 14.9, 0, 0.45 + dz); // cesto
  W.box(0.9, 0.03, 0.3, M.wood, 14.4, 1.6, 0.25 + dz, { collide: false });
  for (let i = 0; i < 3; i++) W.box(0.12, 0.25, 0.1, mat(null, [0x3a6aaa, 0xe8e0c0, 0xaa3a3a][i]), 14.1 + i * 0.25, 1.63, 0.25 + dz, { collide: false });
  const cab = wardrobe(W, M, g, 15.6, 1.6 + dz, PI / 2, 1.1, 2.0, 0.6, M.offwhite);
  W.lights.add({ pos: [14.5, WALL_H - 0.35, 2.0 + dz], intensity: 1.1, range: 6, color: 0xeef0e0, zone: real ? 'house' : 'longhall', bulb: null });
  if (real) {
    R.washer = washer;
    R.spots.push(g.hiding.add({ id: 'cab_laundry', label: 'armário de limpeza', type: 'wardrobe', zone: 'house', cam: [15.62, 1.5, 1.6], yaw: PI / 2, yawRange: 0.5, pitchRange: 0.35, exit: [14.75, 1.6, PI / 2], safety: 0.6, check: [14.65, 1.6], mesh: cab.body, door: cab.swing, hideMeshes: [cab.swing.pivot] }));
    const ld = drawerUnit(W, M.woodLight, 13.53, 0.62, 2.1, 'x', 0.5);
    R.laundryDrawer = g.interact.add(new Drawer(g, { id: 'laundry_drawer', group: ld, axis: new THREE.Vector3(1, 0, 0), dist: 0.3, label: 'gaveta' }));
  } else R.washerDup = washer;
}

// ---------------------------------------------------------------- PORÃO
function buildBasement(g, W, M, R) {
  const H = 2.3;
  W.zone('basement', 29.5, 38.5, -0.5, 8.5);
  const room = W.room('basement', 'basement', 30, 38, 0, 8); room.surface = 'concrete'; room.label = 'Porão';
  W.floor(30, 38, 0, 8, M.concrete); W.ceiling(30, 38, 0, 8, M.concreteDark, H);
  W.wallX(30, 38, 0, M.concreteDark, M.concrete, [], { h: H, base: false }); W.wallX(30, 38, 8, M.concrete, M.concreteDark, [], { h: H, base: false });
  W.wallZ(0, 8, 30, M.concreteDark, M.concrete, [], { h: H, base: false }); W.wallZ(0, 8, 38, M.concrete, M.concreteDark, [], { h: H, base: false });
  // escada
  for (let i = 0; i < 8; i++) W.box(1.0, 0.18 * (i + 1), 0.28, M.woodDark, 30.7, 0, 2.4 - i * 0.28, { collide: false });
  W.addCollider(30.15, 31.25, 0.0, 2.5);
  const stairDoor = W.box(0.9, 2.0, 0.06, M.woodDark, 30.7, 1.4, 0.06, { collide: false });
  R.basementStairs = W.box(1.0, 1.2, 0.4, basic(0x000000, { transparent: true, opacity: 0 }), 30.7, 0, 2.55, { collide: false });
  R.basementStairDoor = stairDoor;
  // prateleiras e caixas
  const shelfM = mat(Tex.wood([96, 80, 60]));
  // estantes abertas de metal/madeira com tralhas guardadas
  const postM = mat(null, 0x5a5a56), junk = [0x8a6a4a, 0x6a7a8a, 0x9a3a2a, 0x4a5a3a, 0xb8a888];
  for (const [x, z, w, d] of [[37.6, 2.0, 0.6, 2.4], [37.6, 6.0, 0.6, 2.4], [33.5, 0.35, 2.4, 0.5]]) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) W.box(0.04, 1.9, 0.04, postM, x + sx * (w / 2 - 0.02), 0, z + sz * (d / 2 - 0.02), { collide: false });
    for (const y of [0.1, 0.55, 1.0, 1.45, 1.86]) W.box(w, 0.03, d, shelfM, x, y, z, { collide: false });
    W.addCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    for (const y of [0.13, 0.58, 1.48]) {
      let t = -(Math.max(w, d) / 2) + 0.1;
      while (t < Math.max(w, d) / 2 - 0.25) {
        const sz = 0.15 + Math.random() * 0.2, hgt = 0.1 + Math.random() * 0.25;
        if (Math.random() < 0.75) W.box(w > d ? sz : w * 0.8, hgt, w > d ? d * 0.8 : sz, mat(null, junk[(Math.random() * junk.length) | 0]), x + (w > d ? t + sz / 2 : 0), y, z + (w > d ? 0 : t + sz / 2), { collide: false });
        t += sz + 0.05;
      }
    }
  }
  const boxM = mat(Tex.wood([150, 120, 80]), 0xc8b48c);
  const boxes = [[32.5, 4.0, 0.6], [33.2, 4.3, 0.5], [32.6, 4.6, 0.45], [35.2, 2.6, 0.7], [35.8, 3.0, 0.5], [34.0, 6.8, 0.6], [31.4, 6.6, 0.55], [31.9, 7.2, 0.5], [35.0, 5.0, 0.4]];
  boxes.forEach(([x, z, s], i) => W.box(s, s * (i % 3 === 0 ? 1.5 : 1), s, boxM, x, 0, z, { occlude: s > 0.55 }));
  W.box(0.9, 1.6, 0.8, M.metal, 35.5, 0, 7.4, { occlude: true }); // fornalha
  W.cyl(0.12, 0.12, 0.9, M.metal, 35.5, 1.6, 7.4);
  // caixa de fotografias
  R.photoBoxBasement = Models.photoBox(); R.photoBoxBasement.position.set(37.5, 1.03, 6.0); R.photoBoxBasement.rotation.y = -PI / 2; g.scene.add(R.photoBoxBasement);
  R.basementBulbs = [
    W.lights.add({ pos: [31.2, 2.05, 3.2], room, zone: 'basement', intensity: 1.0, range: 6, color: 0xffd8a0, glow: 0.6 }),
    W.lights.add({ pos: [35.2, 2.05, 5.0], room, zone: 'basement', intensity: 0.9, range: 6, color: 0xffd8a0, glow: 0.6 }),
  ];
  for (const f of R.basementBulbs) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); b.position.copy(f.pos); g.scene.add(b); f.bulb = b; W.cyl(0.005, 0.005, 0.2, M.dark, f.pos.x, f.pos.y + 0.05, f.pos.z); }
  R.basementPatrol = [[32, 3.5], [34, 2.0], [36.5, 4.0], [33, 6.0], [36.6, 6.8], [31.2, 5.5]];
}

// ---------------------------------------------------------------- CORREDOR IMPOSSÍVEL
function buildLongHall(g, W, M, R) {
  const dz = -40; // longe do quintal e de qualquer outra área
  W.zone('longhall', -25, 17, dz - 1, dz + 7);
  const lroom = W.room('longlaundry', 'longhall', 13, 16, dz, 4 + dz); lroom.surface = 'tile';
  const hall = W.room('longhall', 'longhall', -24, 16, 4 + dz, 6 + dz); hall.surface = 'wood'; hall.label = 'Corredor';
  W.floor(13, 16, dz, 4 + dz, M.bathFloor); W.floor(-24, 16, 4 + dz, 6 + dz, M.floorWoodDark);
  W.floor(-23.5, 15.4, 4.55 + dz, 5.45 + dz, M.carpetRed, 0.015, 'runner');
  W.ceiling(-24, 16, dz, 6 + dz, M.ceiling);
  // lavanderia duplicada
  W.wallX(13, 16, dz, M.laundry, M.laundry); W.wallZ(dz, 4 + dz, 13, M.laundry, M.laundry); W.wallZ(dz, 6 + dz, 16, M.laundry, M.laundry);
  W.wallX(13, 16, 4 + dz, M.laundry, M.hall, [{ x: 14.5, w: 0.9, h: 2.1 }]);
  laundryFurniture(W, M, g, R, dz, false);
  R.longDoor = new Door(g, { x: 14.5, z: 4 + dz, axis: 'x', name: 'porta da lavanderia', hingeSide: -1, material: M.door, frameMat: M.frame });
  g.interact.add(R.longDoor); g.doors.push(R.longDoor);
  // corredor longo: parede norte e sul com portas falsas
  const fakeN = [10.5, 6.5, 2.5, -6, -14], fakeS = [12, 3, -3, -10, -18];
  W.wallX(-24, 13, 4 + dz, M.hall, M.hall);
  W.wallX(-24, 16, 6 + dz, M.hall, M.hall);
  W.wallZ(4 + dz, 6 + dz, -24, M.hall, M.hall, [{ z: 5 + dz, w: 0.9, h: 2.1 }]);
  const fakeDoor = (x, z, rot) => {
    const d = W.box(0.88, 2.05, 0.05, M.door, x, 0, z, { collide: false, ry: rot });
    W.box(1.0, 2.15, 0.04, M.frame, x, 0, z + (rot ? -0.02 : 0.02), { collide: false, ry: rot });
    g.interact.add(new Interactable(g, { mesh: d, prompt: 'Abrir porta', onUse: () => { g.audio.play('locked', { pos: d.position }); g.ui.toast(['Não abre.', 'Não é aqui.', 'Do outro lado, silêncio.', 'A maçaneta está gelada.'][(Math.random() * 4) | 0]); g.noise(d.position.clone(), 3, 'door'); } }));
  };
  fakeN.forEach((x) => fakeDoor(x, 4.1 + dz, 0)); fakeS.forEach((x) => fakeDoor(x, 5.9 + dz, 0));
  // porta do quarto das crianças no fim do corredor
  R.longKidsDoor = W.box(0.05, 2.05, 0.88, M.door, -23.9, 0, 5 + dz, { collide: false });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ map: Tex.label('EMILY & TOM', { w: 128, h: 48, bg: '#e8d8b8', fg: '#a03030', font: 'bold 18px "Comic Sans MS"' }) }));
  label.position.set(-23.86, 1.55, 5 + dz); label.rotation.y = PI / 2; g.scene.add(label);
  W.addCollider(-24.1, -23.85, 4.5 + dz, 5.5 + dz);
  // luzes frias e espaçadas
  for (let x = 12; x > -24; x -= 7) W.lights.add({ pos: [x, WALL_H - 0.3, 5 + dz], room: hall, zone: 'longhall', intensity: 0.7, range: 5.5, color: 0xb0c4e0, glow: 0.8, flicker: x < -15 ? 0.3 : 0, fixedColor: true });
  // relógio de bolso no chão
  R.watchMesh = W.cyl(0.04, 0.04, 0.012, mat(null, 0xc9a640), -4, 0, 5.2 + dz);
  // fotos tortas na parede
  for (let x = 8; x > -22; x -= 5) { const p = wallPhoto(W, x, 1.5 + Math.sin(x) * 0.2, 4.09 + dz, 'x', ['park', 'hold', 'dinner', 'alone'][Math.abs(x) % 4]); p.rotation.z = Math.sin(x * 3) * 0.3; }
  R.longSpawnOffset = dz;
}

// ---------------------------------------------------------------- VISÃO (dentro do armário)
function buildVision(g, W, M, R) {
  W.zone('vision', 69.5, 72.5, 19.5, 32.5);
  const dm = mat(Tex.wallpaper([60, 70, 80], [40, 48, 56], 9));
  W.floor(70, 72, 20, 32, M.floorWoodDark); W.ceiling(70, 72, 20, 32, M.concreteDark, 2.3);
  W.wallZ(20, 32, 70, dm, dm, [], { h: 2.3, base: false }); W.wallZ(20, 32, 72, dm, dm, [], { h: 2.3, base: false }); W.wallX(70, 72, 32, dm, dm, [], { h: 2.3, base: false }); W.wallX(70, 72, 20, dm, dm, [], { h: 2.3, base: false });
  const kid = (x, h) => { const k = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: 0x050505 }); const b = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.12, h * 0.17, h * 0.62, 7), m); b.position.y = h * 0.31; k.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(h * 0.13, 7, 5), m); hd.position.y = h * 0.72; k.add(hd); k.position.set(x, 0, 31.2); g.scene.add(k); return k; };
  R.visionKids = [kid(70.75, 1.3), kid(71.25, 1.05)];
  R.visionLight = W.lights.add({ pos: [71, 1.9, 30.6], zone: 'vision', intensity: 0.8, range: 4, color: 0xd0d8ff, fixedColor: true, on: false });
}

// ---------------------------------------------------------------- HOSPITAL
function buildHospital(g, W, M, R) {
  W.zone('hospital', -1, 36, 58, 65);
  const cor = W.room('hcorridor', 'hospital', 0, 30, 60, 63); cor.surface = 'vinyl'; cor.label = 'Ala C';
  const r4 = W.room('room04', 'hospital', 30, 35, 59.5, 63.5); r4.surface = 'vinyl'; r4.label = 'Quarto 04';
  W.floor(0, 30, 60, 63, M.vinyl); W.ceiling(0, 30, 60, 63, M.hospWall);
  W.floor(30, 35, 59.5, 63.5, M.vinyl); W.ceiling(30, 35, 59.5, 63.5, M.hospWall);
  W.wallX(0, 30, 60, M.hospWall, M.hospWall); W.wallX(0, 30, 63, M.hospWall, M.hospWall);
  W.wallZ(60, 63, 0, M.hospWall, M.hospWall);
  W.wallZ(59.5, 63.5, 30, M.hospWall, M.hospWall, [{ z: 61.5, w: 0.95, h: 2.1 }]);
  R.room04Patch = W.box(0.1, 2.1, 0.98, M.hospWall, 29.95, 0, 61.5, { occlude: true });
  W.wallX(30, 35, 59.5, M.hospWall, M.hospWall); W.wallX(30, 35, 63.5, M.hospWall, M.hospWall); W.wallZ(59.5, 63.5, 35, M.hospWall, M.hospWall);
  // faixa colorida na parede
  W.box(30, 0.12, 0.02, mat(null, 0x6a8a90), 15, 0.9, 60.09, { collide: false }); W.box(30, 0.12, 0.02, mat(null, 0x6a8a90), 15, 0.9, 62.91, { collide: false });
  // portas numeradas (fechadas)
  const num = ['01', '03', '05', '07', '02', '06', '08', '10'];
  const places = [[5, 60.08, 0], [11, 60.08, 0], [17, 60.08, 0], [23, 60.08, 0], [8, 62.92, PI], [14, 62.92, PI], [20, 62.92, PI], [26, 62.92, PI]];
  places.forEach(([x, z, ry], i) => {
    const d = W.box(0.95, 2.1, 0.05, M.hospDoor, x, 0, z, { collide: false, ry });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ map: Tex.label(num[i], { w: 64, h: 32, bg: '#203040', fg: '#e8eef0', font: 'bold 20px Arial' }) }));
    lab.position.set(x, 1.75, z + (ry ? -0.035 : 0.035)); lab.rotation.y = ry; g.scene.add(lab);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), basic(0x1a2226)); win.position.set(x, 1.45, z + (ry ? -0.03 : 0.03)); win.rotation.y = ry; g.scene.add(win);
    g.interact.add(new Interactable(g, { mesh: d, prompt: `Abrir quarto ${num[i]}`, onUse: () => { g.audio.play('locked', { pos: d.position }); g.ui.toast(['Trancada.', 'Alguém respira do outro lado.', 'Trancada. Há um nome riscado na placa.'][i % 3]); } }));
  });
  W.box(0.95, 2.1, 0.05, M.hospDoor, 0.06, 0, 61.5, { collide: false, ry: PI / 2 });
  // macas e carrinhos
  W.box(0.7, 0.75, 1.9, M.metal, 9.5, 0, 62.4, { ry: PI / 2 });
  W.box(0.6, 0.9, 0.4, M.metal, 19.5, 0, 60.4);
  W.box(0.5, 1.0, 0.5, M.hospDoor, 24.5, 0, 62.6);
  // fluorescentes
  R.hospLights = [];
  for (let x = 2; x < 30; x += 4) {
    W.box(1.0, 0.05, 0.14, basic(0xeef6ff), x, WALL_H - 0.05, 61.5, { collide: false });
    R.hospLights.push(W.lights.add({ pos: [x, WALL_H - 0.3, 61.5], room: cor, zone: 'hospital', intensity: 1.0, range: 6, color: 0xe4eeff, fixedColor: true, glow: 1.4, flicker: x === 22 ? 0.3 : 0 }));
  }
  // QUARTO 04: reconstrução do quarto de Alice
  R.door04 = new Door(g, { x: 30, z: 61.5, axis: 'z', width: 0.92, name: 'porta 04', material: M.hospDoor, frameMat: M.white, hingeSide: 1 });
  g.interact.add(R.door04); g.doors.push(R.door04);
  R.door04.pivot.visible = false; R.door04.collider.active = false; R.door04.enabled = false;
  const lab04 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ map: Tex.label('04', { w: 64, h: 32, bg: '#203040', fg: '#e8eef0', font: 'bold 20px Arial' }) }));
  lab04.position.set(0.45, 1.8, 0.03); R.door04.pivot.add(lab04);
  // cama hospitalar (mesma posição relativa da cama de Alice)
  W.box(2.0, 0.5, 0.95, M.metal, 34.0, 0, 61.5);
  W.box(1.95, 0.14, 0.9, M.linen, 34.0, 0.5, 61.5, { collide: false });
  W.box(0.32, 0.1, 0.6, M.white, 34.75, 0.64, 61.5, { collide: false });
  W.box(0.04, 0.3, 0.9, M.metal, 33.0, 0.6, 61.5, { collide: false });
  R.bed04 = new THREE.Vector3(33.2, 0, 61.5);
  // guarda-roupa, janela, TV, mesa
  W.box(1.1, 1.9, 0.5, M.hospDoor, 31.6, 0, 59.8);
  windowOn(W, 33.8, 59.59, 'x', 0.9, 'hospital', null, '');
  W.box(0.8, 0.75, 0.5, M.hospDoor, 31.6, 0, 63.2);
  const tv04 = crt(W, M, g, 34.6, 1.6, 59.8, PI, 0.36); R.tv04 = tv04;
  W.box(0.4, 0.04, 0.3, M.metal, 34.6, 1.58, 59.8, { collide: false });
  R.file = W.box(0.24, 0.03, 0.32, mat(null, 0xd8c070), 31.4, 0.75, 63.2, { collide: false });
  R.recorder = W.box(0.22, 0.07, 0.14, M.dark, 31.85, 0.75, 63.15, { collide: false });
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), new THREE.MeshLambertMaterial({ map: g.images.calendarTex }));
  cal.position.set(32.6, 1.55, 63.41); cal.rotation.y = PI; g.scene.add(cal);
  R.cup = W.cyl(0.035, 0.03, 0.09, basic(0xddeeff, { transparent: true, opacity: 0.7 }), 31.9, 0.75, 63.0); R.cup.visible = false;
  R.lights04 = W.lights.add({ pos: [32.5, WALL_H - 0.3, 61.5], room: r4, zone: 'hospital', intensity: 1.0, range: 6, color: 0xe8f0ff, fixedColor: true });
  W.box(1.0, 0.05, 0.14, basic(0xeef6ff), 32.5, WALL_H - 0.05, 61.5, { collide: false });
}

// ---------------------------------------------------------------- QUINTAL E TELHADO
function buildYard(g, W, M, R) {
  const S = g.scene, L = g.lights;
  const before = new Set(S.children);
  W.zone('yard', -9, 25, 12.4, 42);
  const yard = W.room('yard', 'yard', -6, 22, 12.16, 27); yard.surface = 'grass'; yard.label = 'Quintal';
  // chão: grama, calçada atrás da cerca, rua
  W.floor(-30, 46, 12, 28, M.grass);
  W.floor(-30, 46, 28, 29.6, mat(Tex.concrete(), 0xb8b8b0));
  W.floor(-30, 46, 29.6, 36, M.asphalt);
  W.floor(-30, 46, 36, 52, M.grass, -0.01);
  for (let x = -26; x < 44; x += 4) W.floor(x, x + 2, 32.7, 32.85, basic(0xb8a850), 0.005);
  // degrau de concreto na porta
  W.box(1.4, 0.12, 0.8, mat(Tex.concrete(), 0xa0a098), 7, 0, 12.5, { collide: false });
  // telhado de duas águas
  const slope = Math.atan2(1.8, 6.4), len = Math.hypot(6.4, 1.8) + 0.3;
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(17.0, 0.14, len), M.shingles);
    r.position.set(8, WALL_H + 0.9, 6 + side * 3.2); r.rotation.x = side * slope; S.add(r);
    const uv = r.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 3);
  }
  const gable = new THREE.Shape(); gable.moveTo(-6.2, 0); gable.lineTo(6.2, 0); gable.lineTo(0, 1.8); gable.lineTo(-6.2, 0);
  for (const x of [0, 16]) { const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), M.siding); gm.position.set(x + (x ? 0.08 : -0.08), WALL_H, 6); gm.rotation.y = x ? PI / 2 : -PI / 2; S.add(gm); }
  W.box(17.2, 0.12, 0.25, M.woodDark, 8, WALL_H - 0.05, 12.25, { collide: false });
  // janelas vistas de fora (sala e cozinha)
  const outWin = (x, w) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.0), basic(0x1d1a16)); p.position.set(x, 1.6, 12.09); S.add(p); W.box(w + 0.12, 0.08, 0.1, M.woodLight, x, 1.06, 12.1, { collide: false }); return p; };
  R.outWindows = [outWin(1.2, 1.0), outWin(12.2, 0.9)];
  // cerca de madeira
  const fenceM = mat(Tex.wood([160, 130, 96]));
  const fence = (x1, z1, x2, z2) => {
    const horiz = z1 === z2, len2 = horiz ? x2 - x1 : z2 - z1;
    for (let t = 0; t <= len2; t += 0.32) {
      const px = horiz ? x1 + t : x1, pz = horiz ? z1 : z1 + t;
      W.box(0.12, 1.25 + Math.sin(t * 7) * 0.03, 0.05, fenceM, px, 0, pz, { collide: false, ry: horiz ? 0 : PI / 2 });
    }
    W.box(horiz ? len2 : 0.06, 0.08, horiz ? 0.06 : len2, fenceM, (x1 + x2) / 2, 0.85, (z1 + z2) / 2, { collide: false });
    W.box(horiz ? len2 : 0.06, 0.08, horiz ? 0.06 : len2, fenceM, (x1 + x2) / 2, 0.3, (z1 + z2) / 2, { collide: false });
    W.addCollider(Math.min(x1, x2) - 0.1, Math.max(x1, x2) + 0.1, Math.min(z1, z2) - 0.1, Math.max(z1, z2) + 0.1);
  };
  fence(-6, 27, 22, 27); fence(-6, 12, -6, 27); fence(22, 12, 22, 27); fence(-6, 12, 0, 12); fence(16, 12, 22, 12);
  // árvores low poly
  const trunkM = mat(Tex.wood([80, 60, 44])), leafM = mat(null, 0x3a4a2c), leafM2 = mat(null, 0x2f3d25);
  const tree = (x, z, s = 1) => {
    W.cyl(0.14 * s, 0.22 * s, 2.4 * s, trunkM, x, 0, z, { collide: true, seg: 6 });
    for (const [dy, r, m] of [[2.2, 1.5, leafM], [3.1, 1.15, leafM2], [3.8, 0.7, leafM]]) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), m); c.position.set(x + Math.sin(dy) * 0.2, dy * s, z); c.rotation.y = dy; S.add(c);
    }
  };
  tree(-3.5, 22, 1.2); tree(19.5, 25.2, 1.1); tree(-2, 15.2, 0.8);
  for (const [x, z, s] of [[-14, 44, 1.4], [6, 45, 1.3], [26, 44, 1.5], [36, 46, 1.2], [-24, 45, 1.3]]) tree(x, z, s);
  // balanço das crianças
  const metal = M.metal;
  for (const sx of [0.8, 3.2]) for (const sz of [-1, 1]) { const p = W.cyl(0.04, 0.04, 2.3, metal, sx, 0, 20 + sz * 0.35, { seg: 5 }); p.rotation.x = -sz * 0.3; }
  W.box(2.6, 0.08, 0.08, metal, 2.0, 2.2, 20, { collide: false });
  W.addCollider(0.6, 3.4, 19.4, 20.6);
  const swing = new THREE.Group(); swing.position.set(2.0, 2.2, 20); S.add(swing);
  for (const sx of [-0.25, 0.25]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.7, 0.02), metal); ch.position.set(sx, -0.85, 0); swing.add(ch); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.25), mat(Tex.wood([150, 60, 50]))); seat.position.y = -1.72; swing.add(seat);
  R.swing = swing;
  // caixa de areia com balde
  W.box(2.0, 0.25, 2.0, M.woodLight, 12.5, 0, 18, { collide: true });
  W.floor(11.6, 13.4, 17.1, 18.9, mat(null, 0xc9b48a), 0.255);
  W.cyl(0.1, 0.07, 0.14, mat(null, 0xc03030), 12.2, 0.255, 17.7);
  // varal com lençóis
  for (const x of [15, 20]) W.cyl(0.04, 0.04, 2.0, metal, x, 0, 15, { collide: true, seg: 5 });
  W.box(5, 0.01, 0.01, mat(null, 0xdddddd), 17.5, 1.95, 15, { collide: false });
  R.sheets = [];
  for (const [x, w, c] of [[16.2, 1.0, 0xe8e6dc], [17.6, 1.2, 0xc8d4e4], [19.0, 0.8, 0xe4cfcf]]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), mat(null, c, { side: THREE.DoubleSide })); sh.position.set(x, 1.4, 15); S.add(sh); R.sheets.push(sh); }
  // galpão
  W.box(2.6, 2.2, 2.2, M.siding, 18.8, 0, 22.4, { occlude: true });
  W.box(2.9, 0.12, 2.5, M.shingles, 18.8, 2.2, 22.4, { collide: false });
  W.box(0.9, 1.8, 0.04, M.woodDark, 18.8, 0, 21.28, { collide: false });
  // bicicleta infantil caída
  const bike = new THREE.Group(); bike.position.set(8.5, 0.12, 22); bike.rotation.z = PI / 2 - 0.15; bike.rotation.y = 0.6; S.add(bike);
  for (const dz of [-0.35, 0.35]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 4, 10), M.dark); wh.position.z = dz; wh.rotation.y = PI / 2; bike.add(wh); }
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.7), mat(null, 0x2a5aa0)); fr.position.y = 0.15; bike.add(fr);
  // canteiro com vasos (tarefa de regar)
  R.plants = [];
  for (const [x, z] of [[4.4, 12.6], [10.6, 12.6], [14.4, 12.6]]) {
    const pot = W.cyl(0.22, 0.16, 0.32, mat(null, 0x9a5a3a), x, 0, z, { collide: true, seg: 7 });
    W.cyl(0.2, 0.2, 0.02, mat(null, 0x4a3420), x, 0.3, z, { seg: 7 }); // terra seca
    // planta: folhas murchas (marrons e caídas) que se levantam e ficam verdes ao regar
    const leaves = new THREE.Group(); leaves.position.set(x, 0.32, z); S.add(leaves);
    const leafRef = mat(null, 0xffffff), leafM = new THREE.MeshLambertMaterial({ color: 0x7a6a3a }); leafM.onBeforeCompile = leafRef.onBeforeCompile; leafM.customProgramCacheKey = leafRef.customProgramCacheKey;
    const blades = [];
    for (let i = 0; i < 9; i++) {
      const piv = new THREE.Object3D(); piv.rotation.y = i * 0.7 + Math.random() * 0.3; leaves.add(piv);
      const len = 0.28 + Math.random() * 0.16;
      const bl = new THREE.Mesh(new THREE.ConeGeometry(0.035, len, 4), leafM); bl.position.y = len / 2; const tilt = new THREE.Object3D(); tilt.add(bl); piv.add(tilt);
      blades.push({ tilt, dry: 1.25 + Math.random() * 0.3, wet: 0.25 + Math.random() * 0.25 });
    }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.5, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.15; leaves.add(hit);
    const pl = { pot, leaves, watered: false, growth: 0 };
    pl.setGrowth = (k) => { pl.growth = k; leafM.color.setHex(0x7a6a3a).lerp(new THREE.Color(0x4a8a34), k); blades.forEach((b) => { b.tilt.rotation.x = b.dry + (b.wet - b.dry) * k; }); };
    pl.setGrowth(0);
    R.plants.push(pl);
  }
  R.wateringCanPos = new THREE.Vector3(7.8, 0, 12.6);
  // casas vizinhas além da rua
  const nb = (x, w, d, lit) => {
    W.box(w, 3.2, d, mat(Tex.siding(), 0x8a8478), x, 0, 40, { collide: false });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, 1.6, 4), M.shingles); roof.position.set(x, 4.0, 40); roof.rotation.y = PI / 4; roof.scale.z = d / w; S.add(roof);
    for (const wx of [-w / 4, w / 4]) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.9), basic(lit && wx > 0 ? 0xd8b070 : 0x15171a)); wm.position.set(x + wx, 1.8, 40 - d / 2 - 0.01); wm.rotation.y = PI; S.add(wm); }
  };
  nb(-12, 7, 6, false); nb(2, 8, 6, true); nb(17, 7, 6, false); nb(31, 8, 6, false);
  // poste de luz
  W.cyl(0.07, 0.1, 4.6, metal, 10, 0, 28.6, { collide: false, seg: 6 });
  W.box(0.9, 0.06, 0.12, metal, 9.6, 4.55, 28.6, { collide: false });
  R.streetLamp = L.add({ pos: [9.2, 4.4, 28.6], zone: 'yard', intensity: 1.2, range: 10, color: 0xffd9a0, glow: 1.6 });
  R.porchLamp = L.add({ pos: [7, WALL_H - 0.3, 12.35], zone: 'yard', intensity: 0.7, range: 5, color: 0xffcf90, glow: 0.6 });
  W.cyl(0.06, 0.09, 0.16, M.cream, 7, WALL_H - 0.4, 12.2);
  // luz difusa da manhã nublada (só vale do lado de fora)
  R.yardSky = L.add({ pos: [6, 12, 20], zone: 'yard', decay: 0, intensity: 0.12, range: 40, color: 0xd8dce0, fixedColor: true, daylight: true });
  R.yardSky2 = L.add({ pos: [14, 9, 25], zone: 'yard', decay: 0, intensity: 0.06, range: 30, color: 0xc8d0d8, fixedColor: true, daylight: true });
  // neblina densa além da cerca: camadas de "cartões" de névoa que escondem a rua e os vizinhos
  const fc = document.createElement('canvas'); fc.width = 4; fc.height = 64; const fx = fc.getContext('2d');
  const fg = fx.createLinearGradient(0, 0, 0, 64); fg.addColorStop(0, 'rgba(160,168,172,0)'); fg.addColorStop(0.35, 'rgba(160,168,172,0.75)'); fg.addColorStop(1, 'rgba(160,168,172,0.95)');
  fx.fillStyle = fg; fx.fillRect(0, 0, 4, 64);
  const fogTex = new THREE.CanvasTexture(fc);
  R.fogCards = [];
  const card = (x, z, w, ry, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 9), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, opacity: op, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.position.set(x, 3.6, z); m.rotation.y = ry; S.add(m); R.fogCards.push(m); };
  for (const [d, op] of [[1.5, 0.45], [4, 0.6], [8, 0.8]]) {
    card(8, 27 + d, 60, 0, op); card(-6 - d, 19.5, 30, PI / 2, op); card(22 + d, 19.5, 30, PI / 2, op);
  }
  // o quintal é visto de dentro de casa: materiais com um leve brilho próprio de "luz do dia"
  // (as luzes externas só valem do lado de fora, então sem isso a porta mostrava um vazio preto)
  const clones = new Map(); R.yardMats = [];
  for (const obj of S.children) {
    if (before.has(obj)) continue;
    obj.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.isMeshLambertMaterial) return;
      if (!clones.has(o.material)) {
        const c = o.material.clone(); c.onBeforeCompile = o.material.onBeforeCompile; c.customProgramCacheKey = o.material.customProgramCacheKey;
        c.emissive = c.color.clone().multiplyScalar(0.28); c.emissiveMap = c.map || null;
        clones.set(o.material, c); R.yardMats.push(c);
      }
      o.material = clones.get(o.material);
    });
  }
  R.setYardDay = (on) => { for (const m of R.yardMats) m.emissiveIntensity = on ? 1 : 0.08; for (const c of R.fogCards) c.material.color.setHex(on ? 0xffffff : 0x202428); };
}
