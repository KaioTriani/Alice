// Entrada: teclado com remapeamento, mouse com pointer lock.
// Se o navegador bloquear a captura do mouse (alguns painéis embutidos fazem isso),
// entra no "modo livre": o movimento do mouse sobre a tela gira a câmera mesmo sem captura.
export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.down = new Set();
    this.pressed = new Set();   // códigos pressionados neste frame
    this.mouseDX = 0; this.mouseDY = 0;
    this.mousePressed = false;
    this.locked = false;
    this.free = false;          // modo livre (sem pointer lock)
    this.captureCallback = null; // para remapear teclas
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (this.captureCallback) {
        e.preventDefault();
        const cb = this.captureCallback; this.captureCallback = null; cb(e.code); return;
      }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || e.code === this.settings.bindings.journal) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    window.addEventListener('blur', () => this.down.clear());
    this.cursorX = 0; this.cursorY = 0; // posição normalizada do cursor (-1..1), usada no modo livre
    document.addEventListener('mousemove', (e) => {
      this.cursorX = (e.clientX / window.innerWidth) * 2 - 1; this.cursorY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0; this.mouseDY += e.movementY || 0;
    });
    document.addEventListener('mousedown', (e) => { if (this.locked && e.button === 0) this.mousePressed = true; });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) { this.free = false; this.locked = true; this.setCursor(true); return; }
      if (!this.free) { this.locked = false; this.down.clear(); this.setCursor(false); }
    });
    document.addEventListener('pointerlockerror', () => this.enterFree());
    document.addEventListener('mouseleave', () => { this.cursorX = 0; this.cursorY = 0; });
  }
  setCursor(hidden) { this.canvas.style.cursor = hidden ? 'none' : ''; document.body.style.cursor = hidden ? 'none' : ''; }
  enterFree() { this.free = true; this.locked = true; this.setCursor(true); }
  lock() {
    if (this.locked) return;
    if (this.free) { this.locked = true; this.setCursor(true); return; }
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => this.enterFree());
    } catch { this.enterFree(); return; }
    // se a captura não acontecer em pouco tempo, o navegador bloqueou: usa o modo livre
    setTimeout(() => { if (!this.locked && document.pointerLockElement !== this.canvas) this.enterFree(); }, 600);
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.free) { this.locked = false; this.down.clear(); this.setCursor(false); }
  }
  key(action) { return this.enabled && this.down.has(this.settings.bindings[action]); }
  hit(action) { return this.enabled && this.pressed.has(this.settings.bindings[action]); }
  hitCode(code) { return this.pressed.has(code); }
  consumeMouse() { const d = [this.mouseDX, this.mouseDY]; this.mouseDX = 0; this.mouseDY = 0; return d; }
  endFrame() { this.pressed.clear(); this.mousePressed = false; }
}
