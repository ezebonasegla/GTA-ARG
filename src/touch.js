// On-screen controls for phones and tablets. They feed the same Input object as
// the keyboard (virtual key codes + camera deltas), so the game logic does not
// need to know whether it is being played with touch or keyboard.
export const isTouchDevice = () =>
  matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const STICK_RADIUS = 60;

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.stick = null; // { id, x0, y0 }
    this.look = null; // { id, x, y }
    this.stickKeys = new Set();
    this.inCar = false;
    document.body.classList.add('touch');
    this.buildDom();
    const opts = { passive: false };
    this.root.addEventListener('touchstart', (e) => this.onStart(e), opts);
    this.root.addEventListener('touchmove', (e) => this.onMove(e), opts);
    this.root.addEventListener('touchend', (e) => this.onEnd(e), opts);
    this.root.addEventListener('touchcancel', (e) => this.onEnd(e), opts);
  }

  buildDom() {
    const root = (this.root = document.createElement('div'));
    root.id = 'touch';
    root.innerHTML = `
      <div class="stick-base"><div class="stick-knob"></div></div>
      <div class="tbuttons">
        <button data-key="KeyE" class="tb big" data-foot="Subir" data-car="Bajar">Subir</button>
        <button data-key="Space" class="tb big" data-foot="Saltar" data-car="Freno de mano">Saltar</button>
        <button data-key="KeyF" class="tb foot-only">Empujar</button>
        <button data-key="KeyH" class="tb car-only">Bocina</button>
        <button data-key="KeyC" class="tb">Cámara</button>
      </div>
      <div class="pedals car-only">
        <button data-key="KeyS" class="tb pedal">Freno</button>
        <button data-key="KeyW" class="tb pedal gas">Acelerar</button>
      </div>
      <button data-key="Tab" class="tb help">?</button>`;
    document.body.appendChild(root);
    this.base = root.querySelector('.stick-base');
    this.knob = root.querySelector('.stick-knob');
    this.buttons = [...root.querySelectorAll('button')];
  }

  // Called every frame by the game so the buttons match what the player is doing.
  update(inCar) {
    if (inCar === this.inCar) return;
    this.inCar = inCar;
    this.root.classList.toggle('in-car', inCar);
    for (const b of this.buttons) if (b.dataset.foot) b.textContent = inCar ? b.dataset.car : b.dataset.foot;
  }

  press(code) {
    const { keys, pressed } = this.input;
    if (!keys.has(code)) pressed.add(code);
    keys.add(code);
  }

  // A key stays down while any button or the stick still holds it.
  release(code) {
    if (this.stickKeys.has(code)) return;
    if (this.buttons.some((b) => b.dataset.key === code && b.classList.contains('down'))) return;
    this.input.keys.delete(code);
  }

  onStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const btn = t.target.closest?.('button');
      if (btn) {
        btn.dataset.touch = t.identifier;
        btn.classList.add('down');
        this.press(btn.dataset.key);
        continue;
      }
      if (!this.stick && t.clientX < innerWidth * 0.45) {
        this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY };
        this.base.style.left = `${t.clientX - STICK_RADIUS}px`;
        this.base.style.top = `${t.clientY - STICK_RADIUS}px`;
        this.base.classList.add('active');
        this.setStick(0, 0);
      } else if (!this.look) {
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  }

  onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.stick?.id === t.identifier) {
        this.setStick(t.clientX - this.stick.x0, t.clientY - this.stick.y0);
      } else if (this.look?.id === t.identifier) {
        this.input.mouseDX += (t.clientX - this.look.x) * 2.2;
        this.input.mouseDY += (t.clientY - this.look.y) * 2.2;
        this.look.x = t.clientX;
        this.look.y = t.clientY;
      }
    }
  }

  onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      for (const b of this.buttons) {
        if (b.dataset.touch === String(t.identifier)) {
          delete b.dataset.touch;
          b.classList.remove('down');
          this.release(b.dataset.key);
        }
      }
      if (this.stick?.id === t.identifier) {
        this.stick = null;
        this.base.classList.remove('active');
        this.setStick(0, 0);
      }
      if (this.look?.id === t.identifier) this.look = null;
    }
  }

  // Joystick offset (px) -> WASD (+ Shift to run when pushed all the way).
  setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / STICK_RADIUS, ny = dy / STICK_RADIUS;
    const want = new Set();
    const th = 0.3;
    if (ny < -th) want.add('KeyW');
    if (ny > th) want.add('KeyS');
    if (nx < -th) want.add('KeyA');
    if (nx > th) want.add('KeyD');
    if (!this.inCar && Math.hypot(nx, ny) > 0.95) want.add('ShiftLeft');
    const old = this.stickKeys;
    this.stickKeys = want;
    for (const k of old) if (!want.has(k)) this.release(k);
    for (const k of want) if (!old.has(k)) this.press(k);
  }
}
