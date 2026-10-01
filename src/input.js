// Keyboard + mouse (pointer lock) + gamepad-free touch fallback.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return; // typing in a text box, not playing
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (!this.locked && !document.body.classList.contains('touch')) canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    // mouse buttons as virtual keys (fire / aim) while playing
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const code = `Mouse${e.button}`;
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
    });
    addEventListener('mouseup', (e) => this.keys.delete(`Mouse${e.button}`));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.wheel = 0;
    addEventListener('wheel', (e) => (this.wheel += Math.sign(e.deltaY)), { passive: true });
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  hit(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = this.mouseDY = 0;
    this.wheel = 0;
  }
}
