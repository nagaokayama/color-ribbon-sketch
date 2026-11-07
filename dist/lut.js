'use strict';
const $ = id => document.getElementById(id);
const icons = {
  back: 'M19 12H5m6-6-6 6 6 6',
  pen: 'm14 4 6 6M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Z',
  eraser: 'm4 13 10-10 8 8-10 10H8l-4-4Z M9 8l8 8M12 21h10',
  picker: 'm14 4 6 6M16 6l3-3a2 2 0 0 1 3 3l-3 3M15 7 5 17l-1 4 4-1L18 10',
  undo: 'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',
  redo: 'm16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12',
  export: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  size: 'M4 18h16M6 14V6m-3 3 3-3 3 3M18 14V3m-3 3 3-3 3 3',
  opacity: 'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12ZM12 10v10',
  pressure: 'm9 3 6 0 2 11-5 5-5-5 2-11ZM12 8v7M5 22h14',
  ramp: 'M3 20V15h6V10h6V5h6',
  palette: 'M3 5h12v14H3ZM7 5v14M11 5v14M20 8v8m-3-4h6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14'
};
document.querySelectorAll('[data-icon]').forEach(element => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', icons[element.dataset.icon]); svg.append(path); element.prepend(svg);
});
const CANVAS_SIZE = 512;
const model = new IndexedCanvas(CANVAS_SIZE, CANVAS_SIZE), canvas = $('canvas');
canvas.width = model.width; canvas.height = model.height;
canvas.setAttribute('aria-label', `${model.width}×${model.height}ピクセルのお絵かきキャンバス`);
const context = canvas.getContext('2d');
const frame = context.createImageData(model.width, model.height);
let paletteId = 1, position = 128, tool = 'pen', active = null, pending = false;
const undo = [], redo = [];
let viewMode = 'normal';
const debugColors = new Map();
const debugSeed = Math.floor(Math.random() * 0x1000000);
function syncDebugColors() {
  for (const id of model.palettes.keys()) {
    if (!debugColors.has(id)) {
      // An odd multiplier gives distinct 24-bit colors for distinct palette IDs.
      const color = (Math.imul(id, 0x9e3779) + debugSeed) & 0xffffff;
      debugColors.set(id, [(color >>> 16) & 255, (color >>> 8) & 255, color & 255]);
    }
  }
}
function debugLegend() {
  syncDebugColors();
  $('debug-info').hidden = viewMode === 'normal';
  $('debug-legend').replaceChildren();
  if (viewMode === 'palette') {
    for (const [id, rgb] of debugColors) {
      const item = document.createElement('span'), chip = document.createElement('i');
      chip.style.background = 'rgb(' + rgb.join(',') + ')';
      item.append(chip, document.createTextNode('ID ' + id)); $('debug-legend').append(item);
    }
  } else if (viewMode === 'position') {
    $('debug-legend').textContent = '0（黒）→ 255（白）';
  }
}
document.querySelectorAll('[data-view]').forEach(button => {
  button.onclick = () => {
    viewMode = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === viewMode)));
    $('pixel-info').textContent = '—'; debugLegend(); schedule();
  };
});
function inspectPixel(e) {
  if (viewMode === 'normal') return;
  const p = point(e), x = Math.floor(p.x), y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= model.width || y >= model.height) { $('pixel-info').textContent = '—'; return; }
  const pixel = model.sample(x, y);
  $('pixel-info').textContent = '(' + x + ', ' + y + ') · ' + (pixel ? 'ID ' + pixel.id + ' / ランプ ' + pixel.position + ' / α ' + pixel.alpha : '透明');
}
canvas.addEventListener('pointermove', inspectPixel);
canvas.addEventListener('pointerdown', inspectPixel);
canvas.addEventListener('pointerleave', () => { $('pixel-info').textContent = '—'; });
model.setPalette(1, ['#49364a', '#9b6574', '#df9e87', '#efc1a0', '#fff0ce']);
model.setPalette(2, ['#203c46', '#3c716c', '#72a98f', '#b0cbb0', '#e8ebcb']);
model.setPalette(3, ['#342f56', '#635a91', '#9b8bbd', '#c9b3d6', '#f0dce6']);
function paint() {
  pending = false;
  const start = performance.now();
  if (viewMode === 'normal') model.render(frame.data);
  else { syncDebugColors(); model.renderDebug(frame.data, viewMode, debugColors); }
  context.putImageData(frame, 0, 0);
  const elapsed = performance.now() - start;
  $('timing').textContent = `${viewMode === 'normal' ? 'LUT変換' : 'デバッグ変換'}＋転送 ${elapsed.toFixed(2)} ms`;
  $('undo').disabled = !undo.length || !!active; $('redo').disabled = !redo.length || !!active;
}
function schedule() { if (!pending) { pending = true; requestAnimationFrame(paint); } }
function gradient(colors) { return `linear-gradient(to right, ${colors.join(',')})`; }
function updateSelection() {
  $('position').value = position;
  const p = model.palettes.get(paletteId);
  $('ramp').style.background = gradient(p.colors);
}
function paletteList() {
  debugLegend();
  $('palettes').replaceChildren();
  for (const [id, p] of model.palettes) {
    const button = document.createElement('button'); button.className = 'palette-button';
    button.title = `パレット ${id}を選択`; button.setAttribute('aria-label', button.title); button.setAttribute('aria-pressed', String(id === paletteId));
    const ramp = document.createElement('span'); ramp.className = 'mini-ramp'; ramp.style.background = gradient(p.colors); button.append(ramp);
    button.onclick = () => { paletteId = id; editor(); }; $('palettes').append(button);
  }
  updateSelection();
}
function editor() {
  paletteList(); $('colors').replaceChildren();
  const colors = model.palettes.get(paletteId).colors;
  colors.forEach((color, index) => {
    const label = document.createElement('label'); label.title = `色 ${index + 1}を編集`;
    const input = document.createElement('input'); input.type = 'color'; input.value = color; input.setAttribute('aria-label', `色 ${index + 1}を編集`);
    input.oninput = () => { const next = [...model.palettes.get(paletteId).colors]; next[index] = input.value; model.setPalette(paletteId, next); paletteList(); schedule(); };
    label.append(input); $('colors').append(label);
  });
  $('removeColor').disabled = colors.length <= 2; $('addColor').disabled = colors.length >= 12;
}
$('addColor').onclick = () => { const colors = model.palettes.get(paletteId).colors; if (colors.length >= 12) return; model.setPalette(paletteId, [...colors, '#ffffff']); editor(); schedule(); };
$('removeColor').onclick = () => { const colors = model.palettes.get(paletteId).colors; if (colors.length <= 2) return; model.setPalette(paletteId, colors.slice(0, -1)); editor(); schedule(); };
$('addPalette').onclick = () => { const colors = model.palettes.get(paletteId).colors; const id = Math.max(...model.palettes.keys()) + 1; if (id > 65535) return; model.setPalette(id, colors); paletteId = id; editor(); };
$('position').oninput = () => { position = +$('position').value; updateSelection(); };
function setTool(value) { tool = value; document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool))); }
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
function point(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
function sample(p) {
  const pixel = model.sample(p.x, p.y);
  if (!pixel) return;
  paletteId = pixel.id; position = pixel.position; editor();
}
function draw(e) {
  const p = point(e);
  const pressure = e.type === 'pointerup' ? active.lastPressure : active.pressure && e.pointerType === 'pen' ? Math.max(.1, e.pressure) : 1;
  active.lastPressure = pressure;
  model.line(active.last, p, Math.max(1, active.size * pressure), active.palette, active.position, active.alpha, active.tool === 'eraser');
  active.last = p; inspectPixel(e); schedule();
}
canvas.addEventListener('pointerdown', e => {
  if (active || e.button !== 0) return;
  e.preventDefault();
  if (tool === 'picker' || e.altKey) { sample(point(e)); return; }
  active = { pointer: e.pointerId, last: point(e), before: model.snapshot(), palette: paletteId, position, tool, size: +$('size').value, alpha: Math.round(+$('opacity').value * 2.55), pressure: $('pressure').checked };
  canvas.setPointerCapture(e.pointerId); draw(e);
});
canvas.addEventListener('pointermove', e => {
  if (active?.pointer !== e.pointerId) return;
  e.preventDefault(); const events = e.getCoalescedEvents?.();
  for (const sample of events?.length ? events : [e]) draw(sample);
});
function finish(e, cancel = false) {
  if (active?.pointer !== e.pointerId) return;
  if (cancel) model.restore(active.before);
  else {
    // Pointerup often has pressure=0; keep the last sampled width at the endpoint.
    draw(e);
    undo.push(active.before); if (undo.length > 10) undo.shift(); redo.length = 0;
  }
  active = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); schedule();
}
canvas.addEventListener('pointerup', e => finish(e));
canvas.addEventListener('pointercancel', e => finish(e, true));
canvas.addEventListener('lostpointercapture', e => finish(e, true));
function travel(from, to) { if (active || !from.length) return; to.push(model.snapshot()); model.restore(from.pop()); schedule(); }
$('undo').onclick = () => travel(undo, redo); $('redo').onclick = () => travel(redo, undo);
$('export').onclick = () => {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = model.width; exportCanvas.height = model.height;
  const ctx = exportCanvas.getContext('2d'), image = ctx.createImageData(model.width, model.height);
  model.render(image.data); ctx.putImageData(image, 0, 0);
  exportCanvas.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `color-ribbon-lut-${canvas.width}x${canvas.height}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); };
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(key)) { e.preventDefault(); key === 'y' || e.shiftKey ? travel(redo, undo) : travel(undo, redo); }
  else if (!e.ctrlKey && !e.metaKey && !e.altKey && { b: 'pen', e: 'eraser', i: 'picker' }[key]) setTool({ b: 'pen', e: 'eraser', i: 'picker' }[key]);
});
editor(); paint();
