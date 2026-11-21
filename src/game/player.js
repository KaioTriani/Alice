// Controlador em primeira pessoa.
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/events.js';

const STAND = 1.62, CROUCH = 0.95, RADIUS = 0.28;

export class Player {
  constructor(game) {
    this.g = game;
    this.pos = new THREE.Vector3(2.5, 0, 2.6);
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.eye = STAND; this.crouching = false;
    this.vel = new THREE.Vector3();
    this.stamina = 100; this.staminaDelay = 0; this.exhausted = false;
    this.bobT = 0; this.stepAcc = 0; this.lean = 0;
    this.moveLocked = false; this.lookLocked = false;
    this.speedMul = 1;
    this.rig = new THREE.Object3D();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 80);
    this.rig.add(this.camera);
    game.scene.add(this.rig);
    this.moving = false; this.sprinting = false;
    this.lookTween = null;
    this.camOverride = null;  // {pos, quat} para cinemáticas/esconderijos
    this.shake = 0;
  }

  get radius() { return RADIUS; }
  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  teleport(x, z, yaw = null, y = 0) {
    this.pos.set(x, y, z); if (yaw !== null) { this.yaw = yaw; this.pitch = 0; }
    this.vel.set(0, 0, 0);
  }

  // gira suavemente a câmera para olhar um ponto
  lookAt(target, dur = 1.0) {
    const e = this.eyePos(), dx = target.x - e.x, dz = target.z - e.z, dy = target.y - e.y;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    let dyaw = yaw - this.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.lookTween = { y0: this.yaw, y1: this.yaw + dyaw, p0: this.pitch, p1: pitch, t: 0, dur };
    return new Promise((r) => { this.lookTween.done = r; });
  }

  update(dt) {
    const g = this.g, inp = g.input, s = g.settings;
    // ---------- olhar ----------
    const [mx, my] = inp.consumeMouse();
    if (this.lookTween) {
      const lt = this.lookTween; lt.t += dt; const k = Math.min(1, lt.t / lt.dur), e = k * k * (3 - 2 * k);
      this.yaw = lerp(lt.y0, lt.y1, e); this.pitch = lerp(lt.p0, lt.p1, e);
      if (k >= 1) { this.lookTween = null; lt.done && lt.done(); }
    } else if (!this.lookLocked && (inp.locked || inp.down.size)) {
      const sens = 0.0022 * s.sensitivity;
      // setas também giram a câmera (útil quando o mouse chega na borda da tela)
      const kx = (inp.down.has('ArrowRight') ? 1 : 0) - (inp.down.has('ArrowLeft') ? 1 : 0);
      const ky = (inp.down.has('ArrowDown') ? 1 : 0) - (inp.down.has('ArrowUp') ? 1 : 0);
      // modo livre (navegador sem captura do mouse): encostar o cursor na borda continua girando
      let ex = 0, ey = 0;
      if (inp.free && inp.locked) {
        const edge = (v) => (Math.abs(v) > 0.9 ? Math.sign(v) * Math.min(1, (Math.abs(v) - 0.9) / 0.09) : 0);
        ex = edge(inp.cursorX); ey = edge(inp.cursorY);
      }
      this.yaw -= (inp.locked ? mx * sens : 0) + (kx + ex * 1.2) * 2.2 * s.sensitivity * dt;
      this.pitch -= (inp.locked ? my * sens : 0) * (s.invertY ? -1 : 1) + (ky + ey * 0.8) * 1.6 * s.sensitivity * dt;
      this.pitch = clamp(this.pitch, -1.45, 1.45);
      if (g.hiding.active) g.hiding.clampLook(this);
    }

    // ---------- movimento ----------
    const hidden = g.hiding.active;
    let ix = 0, iz = 0;
    if (!this.moveLocked && !hidden) {
      if (inp.key('forward')) iz -= 1; if (inp.key('back')) iz += 1;
      if (inp.key('left')) ix -= 1; if (inp.key('right')) ix += 1;
    }
    const wantMove = ix !== 0 || iz !== 0;
    // agachar (alternar)
    if (!this.moveLocked && !hidden && inp.hit('crouch')) this.crouching = !this.crouching;
    if (this.crouching && inp.key('sprint') && wantMove) this.crouching = false;
    // correr
    const wantSprint = inp.key('sprint') && wantMove && iz < 0 && !this.crouching && !this.exhausted && !this.moveLocked;
    this.sprinting = wantSprint && this.stamina > 0;
    if (this.sprinting) { this.stamina -= 15 * dt; this.staminaDelay = 1.0; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; g.audio.play('gasp', { vol: 0.5 }); } }
    else { this.staminaDelay -= dt; if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + (wantMove ? 9 : 16) * dt); }
    if (this.exhausted && this.stamina > 30) this.exhausted = false;

    const speed = (this.crouching ? 1.15 : this.sprinting ? 4.3 : 2.05) * this.speedMul;
    const dir = new THREE.Vector3(ix, 0, iz);
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).multiplyScalar(speed);
    this.vel.x = damp(this.vel.x, dir.x, 12, dt); this.vel.z = damp(this.vel.z, dir.z, 12, dt);
    if (!hidden && !this.moveLocked) {
      const before = this.pos.clone();
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      g.world.collide(this.pos, RADIUS);
      const moved = before.distanceTo(this.pos);
      this.moving = moved > 0.001 * dt * 60 && wantMove;
      // passos
      if (this.moving) {
        this.stepAcc += moved;
        const stride = this.sprinting ? 0.78 : this.crouching ? 0.5 : 0.62;
        if (this.stepAcc >= stride) { this.stepAcc = 0; this.footstep(); }
        this.bobT += moved * (this.sprinting ? 2.2 : 2.6);
      }
    } else { this.moving = false; this.vel.set(0, 0, 0); }

    // altura dos olhos
    const crouchBlockedUp = false;
    this.eye = damp(this.eye, this.crouching && !crouchBlockedUp ? CROUCH : STAND, 10, dt);

    // inclinar
    let wantLean = 0;
    if (!this.moveLocked && !hidden) { if (inp.key('leanLeft')) wantLean -= 1; if (inp.key('leanRight')) wantLean += 1; }
    this.lean = damp(this.lean, wantLean, 9, dt);

    this.applyCamera(dt);
  }

  footstep() {
    const g = this.g;
    const room = g.world.roomAt(this.pos.x, this.pos.z);
    const surface = room?.surface || 'wood';
    const vol = this.sprinting ? 0.75 : this.crouching ? 0.18 : 0.42;
    const side = (this.stepSide = !this.stepSide) ? 1 : -1;
    const f = this.forward();
    g.audio.play('step', { surface, vol, pos: { x: this.pos.x + f.z * 0.15 * side, y: 0.1, z: this.pos.z - f.x * 0.15 * side }, occl: false });
    const radius = (this.sprinting ? 13 : this.crouching ? 1.2 : 4.5) * g.diff.hearing;
    g.noise(this.pos.clone(), radius, this.sprinting ? 'run' : 'step');
  }

  applyCamera(dt) {
    const g = this.g, s = g.settings, cam = this.camera;
    if (this.camOverride) {
      this.rig.position.copy(this.camOverride.pos);
      this.rig.rotation.set(0, 0, 0);
      cam.position.set(0, 0, 0);
      cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      if (this.camOverride.quatBase) { /* reservado */ }
    } else {
      // head bob
      let bobY = 0, bobX = 0;
      if (s.headBob && this.moving) {
        const amp = (this.sprinting ? 0.055 : this.crouching ? 0.02 : 0.032) * (s.reduceShake ? 0.4 : 1);
        bobY = Math.abs(Math.sin(this.bobT * Math.PI)) * amp; bobX = Math.cos(this.bobT * Math.PI) * amp * 0.6;
      }
      // tremor de estresse
      const st = g.status ? g.status.stress / 100 : 0;
      const shakeK = (s.reduceShake ? 0.25 : 1);
      const t = g.time;
      const swayY = (Math.sin(t * 1.3) * 0.004 + Math.sin(t * 7.1) * 0.003 * st) * shakeK;
      const swayX = (Math.sin(t * 0.9) * 0.004 + Math.cos(t * 6.3) * 0.003 * st) * shakeK;
      const shake = this.shake * shakeK;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.5);
      // posição da inclinação (com checagem de parede)
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      let leanAmt = this.lean * 0.38;
      if (Math.abs(leanAmt) > 0.01) {
        const test = this.pos.clone().addScaledVector(right, leanAmt);
        const p2 = test.clone(); g.world.collide(p2, 0.12);
        if (p2.distanceTo(test) > 0.01) leanAmt *= 0.3;
      }
      this.rig.position.set(this.pos.x, this.pos.y + this.eye + bobY, this.pos.z).addScaledVector(right, leanAmt + bobX);
      this.rig.rotation.set(0, 0, 0);
      cam.position.set(0, 0, 0);
      this.roll = damp(this.roll, -this.lean * 0.16, 9, dt);
      cam.rotation.set(this.pitch + swayY + (Math.random() - 0.5) * shake * 0.02, this.yaw + swayX + (Math.random() - 0.5) * shake * 0.02, this.roll, 'YXZ');
    }
    const fov = s.fov + (this.sprinting ? 4 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = damp(cam.fov, fov, 6, dt); cam.updateProjectionMatrix(); }
  }
}
