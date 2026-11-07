(function (root) {
  'use strict';
  class IndexedCanvas {
    constructor(width = 128, height = 128) {
      this.width = width; this.height = height;
      this.ids = new Uint16Array(width * height);
      this.positions = new Uint8Array(width * height);
      this.alpha = new Uint8Array(width * height);
      this.palettes = new Map();
    }
    setPalette(id, colors) {
      if (!Number.isInteger(id) || id < 1 || id > 65535 || colors.length < 2 || colors.some(c => !/^#[\da-f]{6}$/i.test(c))) throw new Error('Invalid palette');
      const rgb = colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
      const lut = new Uint8Array(256 * 3);
      for (let p = 0; p < 256; p++) {
        const t = p / 255 * (rgb.length - 1), a = Math.min(Math.floor(t), rgb.length - 2), f = t - a;
        for (let k = 0; k < 3; k++) lut[p * 3 + k] = Math.round(rgb[a][k] * (1 - f) + rgb[a + 1][k] * f);
      }
      this.palettes.set(id, { colors: [...colors], lut });
    }
    snapshot() { return { ids: this.ids.slice(), positions: this.positions.slice(), alpha: this.alpha.slice() }; }
    restore(s) { this.ids.set(s.ids); this.positions.set(s.positions); this.alpha.set(s.alpha); }
    sample(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
      const i = y * this.width + x;
      return this.alpha[i] ? { id: this.ids[i], position: this.positions[i], alpha: this.alpha[i] } : null;
    }
    // Pixel-center coverage, no antialiasing. A stroke replaces the reference and alpha.
    line(a, b, size, id, position, alpha, erase = false) {
      if (!erase && (!alpha || !this.palettes.has(id))) return;
      const radius = size / 2, dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
      for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius)); y < Math.min(this.height, Math.ceil(Math.max(a.y, b.y) + radius)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius)); x < Math.min(this.width, Math.ceil(Math.max(a.x, b.x) + radius)); x++) {
          const t = length ? Math.max(0, Math.min(1, ((x + .5 - a.x) * dx + (y + .5 - a.y) * dy) / length)) : 0;
          if (Math.hypot(x + .5 - a.x - t * dx, y + .5 - a.y - t * dy) > radius) continue;
          const i = y * this.width + x;
          this.ids[i] = erase ? 0 : id; this.positions[i] = erase ? 0 : position; this.alpha[i] = erase ? 0 : alpha;
        }
      }
    }
    renderDebug(target, mode, colors) {
      for (let i = 0; i < this.ids.length; i++) {
        const offset = i * 4, value = this.positions[i];
        const rgb = mode === 'palette' ? colors.get(this.ids[i]) : [value, value, value];
        for (let k = 0; k < 3; k++) target[offset + k] = rgb ? rgb[k] : 0;
        // Show stored values independently of opacity; empty pixels stay transparent.
        target[offset + 3] = this.alpha[i] ? 255 : 0;
      }
      return target;
    }
    render(target = new Uint8ClampedArray(this.width * this.height * 4)) {
      for (let i = 0; i < this.ids.length; i++) {
        const lut = this.palettes.get(this.ids[i])?.lut, p = this.positions[i] * 3;
        for (let k = 0; k < 3; k++) target[i * 4 + k] = lut ? lut[p + k] : 0;
        target[i * 4 + 3] = lut ? this.alpha[i] : 0;
      }
      return target;
    }
  }
  if (typeof module !== 'undefined') module.exports = IndexedCanvas;
  else root.IndexedCanvas = IndexedCanvas;
})(globalThis);
