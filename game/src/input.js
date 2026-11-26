// Awan Courier — input.js. Keyboard (arrows/WASD + throttle) and mouse
// steering. Nothing here touches the network; it only reads local events.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0; // -1..1 across the window
    this.mouseY = 0; // -1..1 down the window
    this.mouseActive = false; // true shortly after the mouse moves
    this.mouseDown = false;
    this.lastMouseMove = 0;
    this.onAction = null; // (action) => void — 'start' | 'restart' | 'pause' | 'next'
    this._onKeyDown = (e) => this.keyDown(e);
    this._onKeyUp = (e) => this.keyUp(e);
    this._onMouseMove = (e) => this.mouseMove(e);
    this._onMouseDown = (e) => this.mouseDownFn(e);
    this._onMouseUp = () => {
      this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }

  keyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (this.onAction) {
      if (e.key === 'Enter' || e.key === ' ') this.onAction('start');
      if (e.key === 'r' || e.key === 'R') this.onAction('restart');
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') this.onAction('pause');
    }
  }

  keyUp(e) {
    this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  }

  mouseMove(e) {
    this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    this.mouseActive = true;
    this.lastMouseMove = performance.now();
  }

  mouseDownFn(e) {
    if (e.button === 0) {
      this.mouseDown = true;
      if (this.onAction) this.onAction('start');
    }
  }

  get down() {
    return this.keys;
  }

  // -1..1 roll input (left/right), pitch input (up positive = climb),
  // throttle delta per second, boost held.
  axes(now) {
    const k = this.keys;
    let roll = 0;
    let pitch = 0;
    if (k.has('ArrowLeft') || k.has('a')) roll -= 1;
    if (k.has('ArrowRight') || k.has('d')) roll += 1;
    if (k.has('ArrowUp') || k.has('w')) pitch += 1;
    if (k.has('ArrowDown') || k.has('s')) pitch -= 1;
    // Mouse steering: pointer off-centre banks and pitches, but only while
    // the mouse was moved recently and no arrow key is steering.
    if (this.mouseActive && now - this.lastMouseMove < 2500 && roll === 0 && pitch === 0) {
      if (Math.abs(this.mouseX) > 0.06) roll = Math.max(-1, Math.min(1, this.mouseX * 1.4));
      if (Math.abs(this.mouseY) > 0.06) pitch = Math.max(-1, Math.min(1, -this.mouseY * 1.4));
    }
    let throttle = 0;
    if (k.has('Shift')) throttle += 1;
    if (k.has('Control') || k.has('c')) throttle -= 1;
    const boost = this.mouseDown || k.has('Shift');
    return { roll, pitch, throttle, boost };
  }
}
