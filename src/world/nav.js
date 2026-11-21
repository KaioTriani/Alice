// Grade de navegação + A* para a entidade (por zona).
const CELL = 0.25;

export class NavGrid {
  constructor(world, minX, maxX, minZ, maxZ, radius = 0.2) {
    this.world = world; this.radius = radius;
    this.minX = minX; this.minZ = minZ;
    this.w = Math.ceil((maxX - minX) / CELL); this.h = Math.ceil((maxZ - minZ) / CELL);
    this.blocked = new Uint8Array(this.w * this.h);
    this.rebuild();
  }
  rebuild() {
    const r = this.radius;
    this.blocked.fill(0);
    for (const c of this.world.colliders) {
      // portas não bloqueiam a navegação (a entidade abre); colisores desativados também não
      if (!c.nav || !c.active || c.tag === 'door' || c.maxY < 0.3) continue;
      const x0 = Math.max(0, Math.floor((c.minX - r - this.minX) / CELL));
      const x1 = Math.min(this.w - 1, Math.floor((c.maxX + r - this.minX) / CELL));
      const z0 = Math.max(0, Math.floor((c.minZ - r - this.minZ) / CELL));
      const z1 = Math.min(this.h - 1, Math.floor((c.maxZ + r - this.minZ) / CELL));
      // bloqueia só as células cujo centro fica a menos de r do obstáculo (antes bastava encostar,
      // o que fechava passagens onde uma pessoa cabe)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const cx = this.minX + (x + 0.5) * CELL, cz = this.minZ + (z + 0.5) * CELL;
        const dx = Math.max(c.minX - cx, 0, cx - c.maxX), dz = Math.max(c.minZ - cz, 0, cz - c.maxZ);
        if (dx * dx + dz * dz < r * r) this.blocked[z * this.w + x] = 1;
      }
    }
    // portas trancadas bloqueiam
    for (const c of this.world.colliders) {
      if (c.tag !== 'door' || !c.locked) continue;
      const x0 = Math.max(0, Math.floor((c.minX - this.minX) / CELL)), x1 = Math.min(this.w - 1, Math.floor((c.maxX - this.minX) / CELL));
      const z0 = Math.max(0, Math.floor((c.minZ - this.minZ) / CELL)), z1 = Math.min(this.h - 1, Math.floor((c.maxZ - this.minZ) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
  }
  toCell(x, z) { return [Math.floor((x - this.minX) / CELL), Math.floor((z - this.minZ) / CELL)]; }
  toWorld(cx, cz) { return [this.minX + (cx + 0.5) * CELL, this.minZ + (cz + 0.5) * CELL]; }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h; }
  free(cx, cz) { return this.inside(cx, cz) && !this.blocked[cz * this.w + cx]; }
  walkable(x, z) { const [cx, cz] = this.toCell(x, z); return this.free(cx, cz); }

  nearestFree(cx, cz) {
    if (this.free(cx, cz)) return [cx, cz];
    for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      if (this.free(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    }
    return null;
  }

  // A* com 8 direções; retorna lista de pontos [x,z] suavizada
  path(sx, sz, tx, tz) {
    let s = this.nearestFree(...this.toCell(sx, sz)), t = this.nearestFree(...this.toCell(tx, tz));
    if (!s || !t) return null;
    const W = this.w, N = W * this.h;
    const start = s[1] * W + s[0], goal = t[1] * W + t[0];
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; // [f, idx]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hfn = (i) => { const x = i % W, z = (i / W) | 0, dx = Math.abs(x - t[0]), dz = Math.abs(z - t[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    g[start] = 0; push(hfn(start), start);
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let iter = 0;
    while (heap.length && iter++ < 20000) {
      const [, cur] = pop();
      if (cur === goal) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.free(nx, nz)) continue;
        if (dx && dz && (!this.free(cx + dx, cz) || !this.free(cx, cz + dz))) continue;
        const ni = nz * W + nx, ng = g[cur] + cost;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + hfn(ni), ni); }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) { cells.push(i); if (i === start) break; }
    cells.reverse();
    // suavização por linha de visão na grade
    const pts = cells.map((i) => this.toWorld(i % W, (i / W) | 0));
    const out = [pts[0]];
    let anchor = 0;
    for (let i = 2; i < pts.length; i++) {
      if (!this.lineFree(pts[anchor], pts[i])) { out.push(pts[i - 1]); anchor = i - 1; }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  lineFree(a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const n = Math.ceil(Math.hypot(dx, dz) / (CELL * 0.5));
    for (let i = 1; i < n; i++) { if (!this.walkable(a[0] + dx * i / n, a[1] + dz * i / n)) return false; }
    return true;
  }
  randomFreeNear(x, z, radius, tries = 30) {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (this.walkable(px, pz)) return [px, pz];
    }
    return null;
  }
}
