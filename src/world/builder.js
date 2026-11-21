// Construtor de geometria: caixas com UV em escala de mundo, paredes com vãos, colisores.
import * as THREE from 'three';
import { psx } from '../render/retro.js';

export const WALL_H = 2.6;
export const WALL_T = 0.16;

// BoxGeometry com UVs proporcionais ao tamanho real (texturas não esticam)
export function boxGeo(w, h, d, ts = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // ordem das faces: +x, -x, +y, -y, +z, -z (4 vértices cada)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts);
  }
  return g;
}

let _base = null;
const BASEBOARD = () => _base || (_base = psx(new THREE.MeshLambertMaterial({ color: 0x5a3e2a })));

const matCache = new Map();
export function mat(tex, color = 0xffffff, opts = {}) {
  const key = (tex ? tex.uuid : 'none') + color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const m = psx(new THREE.MeshLambertMaterial({ map: tex || null, color, ...opts }));
  matCache.set(key, m);
  return m;
}
export function basic(color, opts = {}) { return psx(new THREE.MeshBasicMaterial({ color, ...opts })); }

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];   // AABBs em XZ para jogador
    this.occluders = [];   // meshes que bloqueiam visão/som
    this.zones = [];       // {name, minX, maxX, minZ, maxZ}
    this.rooms = [];       // {name, zone, minX, maxX, minZ, maxZ, light}
  }

  addCollider(minX, maxX, minZ, maxZ, opts = {}) {
    const c = { minX, maxX, minZ, maxZ, active: true, nav: opts.nav !== false, tag: opts.tag || '', minY: opts.minY ?? 0, maxY: opts.maxY ?? 3 };
    this.colliders.push(c);
    return c;
  }

  // Caixa sólida. rot em múltiplos de 90° para colisão correta.
  box(w, h, d, material, x, y, z, o = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, o.ts || 1), material);
    m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry;
    (o.parent || this.scene).add(m);
    if (o.collide !== false && !o.parent) {
      const swap = o.ry && Math.abs(Math.sin(o.ry)) > 0.5;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      m.userData.collider = this.addCollider(x - hw, x + hw, z - hd, z + hd, { nav: o.nav, tag: o.tag, minY: y, maxY: y + h });
    }
    if (o.occlude) this.occluders.push(m);
    return m;
  }

  cyl(rt, rb, h, material, x, y, z, o = {}) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 8), material);
    m.position.set(x, y + h / 2, z);
    (o.parent || this.scene).add(m);
    if (o.collide && !o.parent) m.userData.collider = this.addCollider(x - rb, x + rb, z - rb, z + rb, { minY: y, maxY: y + h });
    return m;
  }

  plane(w, h, material, x, y, z, ry = 0, o = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z); m.rotation.y = ry;
    if (o.rx) m.rotation.x = o.rx;
    (o.parent || this.scene).add(m);
    return m;
  }

  // Parede ao longo de X (normal em Z). matN: face voltada para -Z, matS: face voltada para +Z.
  // openings: [{x, w, h}]
  wallX(x1, x2, z, matN, matS, openings = [], o = {}) {
    const H = o.h || WALL_H, T = WALL_T;
    const ops = [...openings].sort((a, b) => a.x - b.x);
    const mats = [matN, matN, matN, matN, matS, matN];
    let cur = x1;
    const seg = (a, b, y0, y1, collide) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return null;
      const m = new THREE.Mesh(boxGeo(b - a, y1 - y0, T, 1), mats);
      m.position.set((a + b) / 2, y0 + (y1 - y0) / 2, z);
      this.scene.add(m); this.occluders.push(m);
      if (collide) m.userData.collider = this.addCollider(a, b, z - T / 2, z + T / 2, { tag: 'wall' });
      if (collide && o.base !== false) for (const [side, dz] of [['N', -1], ['S', 1]]) {
        if ((o.skip || []).includes(side)) continue;
        const bb = new THREE.Mesh(boxGeo(b - a, 0.1, 0.018, 1), BASEBOARD()); bb.position.set((a + b) / 2, 0.05, z + dz * (T / 2 + 0.01)); this.scene.add(bb);
      }
      return m;
    };
    const out = [];
    for (const op of ops) {
      out.push(seg(cur, op.x - op.w / 2, 0, H, true));
      out.push(seg(op.x - op.w / 2, op.x + op.w / 2, op.h, H, false));
      cur = op.x + op.w / 2;
    }
    out.push(seg(cur, x2, 0, H, true));
    return out.filter(Boolean);
  }

  // Parede ao longo de Z (normal em X). matW: face voltada para -X, matE: face voltada para +X.
  wallZ(z1, z2, x, matW, matE, openings = [], o = {}) {
    const H = o.h || WALL_H, T = WALL_T;
    const ops = [...openings].sort((a, b) => a.z - b.z);
    const mats = [matE, matW, matW, matW, matW, matW];
    let cur = z1;
    const seg = (a, b, y0, y1, collide) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return null;
      const m = new THREE.Mesh(boxGeo(T, y1 - y0, b - a, 1), mats);
      m.position.set(x, y0 + (y1 - y0) / 2, (a + b) / 2);
      this.scene.add(m); this.occluders.push(m);
      if (collide) m.userData.collider = this.addCollider(x - T / 2, x + T / 2, a, b, { tag: 'wall' });
      if (collide && o.base !== false) for (const [side, dx] of [['W', -1], ['E', 1]]) {
        if ((o.skip || []).includes(side)) continue;
        const bb = new THREE.Mesh(boxGeo(0.018, 0.1, b - a, 1), BASEBOARD()); bb.position.set(x + dx * (T / 2 + 0.01), 0.05, (a + b) / 2); this.scene.add(bb);
      }
      return m;
    };
    const out = [];
    for (const op of ops) {
      out.push(seg(cur, op.z - op.w / 2, 0, H, true));
      out.push(seg(op.z - op.w / 2, op.z + op.w / 2, op.h, H, false));
      cur = op.z + op.w / 2;
    }
    out.push(seg(cur, z2, 0, H, true));
    return out.filter(Boolean);
  }

  // uvMode: 'world' (repete por metro), 'stretch' (uma estampa só, para tapetes), 'runner' (repete só no comprimento)
  floor(minX, maxX, minZ, maxZ, material, y = 0, uvMode = 'world') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), material);
    m.rotation.x = -Math.PI / 2; m.position.set((minX + maxX) / 2, y, (minZ + maxZ) / 2);
    const uv = m.geometry.attributes.uv, w = maxX - minX, d = maxZ - minZ;
    const sx = uvMode === 'stretch' ? 1 : uvMode === 'runner' ? Math.round(w / d) : w, sy = uvMode === 'world' ? d : 1;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
    this.scene.add(m);
    return m;
  }
  ceiling(minX, maxX, minZ, maxZ, material, y = WALL_H) {
    const m = this.floor(minX, maxX, minZ, maxZ, material, y);
    m.rotation.x = Math.PI / 2;
    return m;
  }

  zone(name, minX, maxX, minZ, maxZ) { this.zones.push({ name, minX, maxX, minZ, maxZ }); }
  room(name, zone, minX, maxX, minZ, maxZ) {
    const r = { name, zone, minX, maxX, minZ, maxZ, lights: [] };
    this.rooms.push(r); return r;
  }
  zoneAt(x, z) { return this.zones.find((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ)?.name || null; }
  roomAt(x, z) { return this.rooms.find((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) || null; }

  // Colisão círculo x AABB (resolve empurrando para fora)
  collide(pos, radius, ignore = null) {
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.colliders) {
        if (!c.active || c === ignore || c.maxY < 0.25) continue;
        const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), push = radius - d;
            pos.x += (dx / d) * push; pos.z += (dz / d) * push;
          } else {
            // centro dentro da caixa: empurra pelo menor eixo
            const l = pos.x - c.minX, r = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z;
            const m = Math.min(l, r, t, b);
            if (m === l) pos.x = c.minX - radius; else if (m === r) pos.x = c.maxX + radius;
            else if (m === t) pos.z = c.minZ - radius; else pos.z = c.maxZ + radius;
          }
        }
      }
    }
  }
}
