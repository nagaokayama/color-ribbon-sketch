'use strict';
// The canvas stores only transparent ink. White is composited for sampling/export.
const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const roles = ['影', '影とベースの中間', 'ベース', 'ベースとハイライトの中間', 'ハイライト'];
const stacks = [
  ['#714d51', '#b3726c', '#df9e87', '#f1c2a3', '#f9e3c4'],
  ['#304a49', '#507765', '#83a77c', '#b6c998', '#e1e7bd'],
  ['#39405c', '#626e96', '#929fc5', '#bec9e2', '#e8eaf3']
];
const rampFields = [
  ['saturation','全体の彩度',0,200,100,'%'],
  ['lightHue','ハイライトの色相移動',-180,180,-15,'°'],
  ['highlight','ハイライトの明るさ',0,100,65,'%'],
  ['highlightSat','ハイライトの彩度',0,200,65,'%'],
  ['shadowHue','影の色相移動',-180,180,20,'°'],
  ['shadowDepth','影の暗さ',0,100,45,'%'],
  ['shadowSat','影の彩度',0,200,115,'%']
];
const newRamp = () => Object.fromEntries(rampFields.map(([key,,,,value])=>[key,value]));
const ramps = stacks.map(newRamp);
const clamp = x => Math.max(0,Math.min(100,x));
function regenerate(i) {
  const [h,s,v]=hexToHsv(stacks[i][2]), r=ramps[i];
  const shadowV=v*(1-r.shadowDepth/100), lightV=v+(100-v)*r.highlight/100;
  stacks[i]=[-1,-0.5,0,0.5,1].map(position=>{
    if(position===0)return stacks[i][2];
    const amount=Math.abs(position), shadow=position<0;
    const hue=h+(shadow?r.shadowHue:r.lightHue)*amount;
    const saturation=s*r.saturation/100*(1+((shadow?r.shadowSat:r.highlightSat)/100-1)*amount);
    return hsvToHex(hue,clamp(saturation),v+((shadow?shadowV:lightV)-v)*amount);
  });
}
stacks.forEach((_,i)=>regenerate(i));
let selected = [0, 2], tool = 'pen', ink = stacks[0][2];
const sizes = { pen: 16, eraser: 16 };
let active = null;
const undo = [], redo = [];
const snapshot = () => ctx.getImageData(0, 0, 1024, 1024);
function historyButtons() {
  $('undo').disabled = !undo.length || active !== null;
  $('redo').disabled = !redo.length || active !== null;
}
function travel(from, to) {
  if (active !== null || !from.length) return;
  to.push(snapshot());
  ctx.putImageData(from.pop(), 0, 0);
  historyButtons();
}
function setTool(value) {
  if (active !== null) return;
  tool = value;
  document.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tool));
}
function hexToHsv(hex) {
  const [r,g,b]=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d)h=(max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60;
  return [h,max?d/max*100:0,max*100];
}
function hsvToHex(h,s,v) {
  h=((h%360)+360)%360;s=clamp(s)/100;v=clamp(v)/100;
  return '#'+[5,3,1].map(n=>{const k=(n+h/60)%6;return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');}).join('');
}
function renderStacks() {
  $('stacks').replaceChildren();
  stacks.forEach((colors, i) => {
    const row = document.createElement('div'); row.className = 'stack';
    row.innerHTML = `<div class="stack-title"><span>SET ${String(i+1).padStart(2,'0')}</span><button class="remove" aria-label="色セット${i+1}を削除" ${stacks.length===1?'disabled':''}>×</button></div><div class="swatches"></div><div class="labels"><span>影</span><span>ベース</span><span>ハイライト</span></div>`;
    row.querySelector('.remove').onclick = () => {
      if (stacks.length===1) return;
      stacks.splice(i,1); ramps.splice(i,1);
      selected[0] = selected[0] === i ? Math.max(0,i-1) : selected[0] > i ? selected[0]-1 : selected[0];
      selectColor(...selected);
    };
    colors.forEach((color,j) => {
      const button = document.createElement('button'); button.className = 'swatch';
      button.style.background = color; button.title = `${roles[j]} ${color}`;
      button.setAttribute('aria-label', `セット${i+1} ${roles[j]} ${color}`);
      button.setAttribute('aria-pressed', selected[0]===i && selected[1]===j);
      button.onclick = () => selectColor(i,j);
      row.querySelector('.swatches').append(button);
    });
    $('stacks').append(row);
  });
}
function updateSliders() {
  const h=+$('h').value,s=+$('s').value,v=+$('v').value;
  $('hValue').textContent=h+'°';$('sValue').textContent=s+'%';$('vValue').textContent=v+'%';
  $('v').style.background='linear-gradient(to right,#000,'+hsvToHex(h,s,100)+')';
  $('s').style.background='linear-gradient(to right,'+hsvToHex(h,0,v)+','+hsvToHex(h,100,v)+')';
}
function showColor(syncSliders=true) {
  const base=stacks[selected[0]][2];
  $('preview').style.background=ink;$('hex').textContent=ink.toUpperCase();$('color').value=base;
  $('role').textContent=roles[selected[1]];
  if(syncSliders){const [h,s,v]=hexToHsv(base);$('h').value=Math.round(h);$('s').value=Math.round(s);$('v').value=Math.round(v);}
  for(const [key,,,,,unit] of rampFields){$(key).value=ramps[selected[0]][key];$(key+'Value').textContent=$(key).value+unit;}
  updateSliders();renderStacks();
}
function selectColor(i,j){selected=[i,j];ink=stacks[i][j];showColor();}
function editBase(color,syncSliders=true){
  stacks[selected[0]][2]=color;regenerate(selected[0]);selected[1]=2;ink=color;showColor(syncSliders);
}
for(const id of ['h','s','v'])$(id).oninput=()=>editBase(hsvToHex(+$('h').value,+$('s').value,+$('v').value),false);
$('color').oninput=e=>editBase(e.target.value);
for(const [key,label,min,max,value,unit] of rampFields){
  const wrapper=document.createElement('label');
  wrapper.innerHTML=label+' <output id="'+key+'Value"></output><input id="'+key+'" type="range" min="'+min+'" max="'+max+'" value="'+value+'">';
  $(key.startsWith('shadow') ? 'shadowControls' : key==='saturation' ? 'ramp' : 'highlightControls').append(wrapper);
  $(key).oninput=()=>{ramps[selected[0]][key]=+$(key).value;regenerate(selected[0]);ink=stacks[selected[0]][selected[1]];showColor(false);};
}
$('add').onclick=()=>{stacks.push([...stacks[selected[0]]]);ramps.push({...ramps[selected[0]]});selectColor(stacks.length-1,2);};
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
for (const name of ['pen','eraser']) $(name+'Size').oninput = e => {
  sizes[name]=+e.target.value; $(name+'SizeValue').textContent=sizes[name]+' px';
};
$('undo').onclick = () => travel(undo,redo); $('redo').onclick = () => travel(redo,undo);
function point(e) { const r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}; }
function sample(p) {
  const [r,g,b,a]=ctx.getImageData(Math.max(0,Math.min(1023,Math.floor(p.x))), Math.max(0,Math.min(1023,Math.floor(p.y))),1,1).data;
  ink='#'+[r,g,b].map(c=>Math.round(c*a/255+255-a).toString(16).padStart(2,'0')).join('');
  $('preview').style.background=ink; $('hex').textContent=ink.toUpperCase(); $('role').textContent='スポイト';

}
function draw(p, first = false) {
  ctx.globalCompositeOperation = active.tool==='eraser'?'destination-out':'source-over';
  ctx.fillStyle=active.ink; ctx.strokeStyle=active.ink; ctx.lineWidth=active.size; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath();
  if (first) {ctx.arc(p.x,p.y,active.size/2,0,Math.PI*2); ctx.fill();}
  else {ctx.moveTo(active.last.x,active.last.y); ctx.lineTo(p.x,p.y); ctx.stroke();}
  active.last=p;
}
canvas.addEventListener('pointerdown', e => {
  if (active !== null || e.button!==0) return;
  e.preventDefault(); const p=point(e);
  if (tool==='picker' || e.altKey) {sample(p);return;}
  active={id:e.pointerId,before:snapshot(),last:p,tool,size:sizes[tool],ink};
  canvas.setPointerCapture(e.pointerId); draw(p,true); historyButtons();
});
canvas.addEventListener('pointermove', e => {
  if (!active || active.id!==e.pointerId) return;
  for (const event of e.getCoalescedEvents?.() || [e]) draw(point(event));
});
function finish(e, cancel=false) {
  if (!active || active.id!==e.pointerId) return;
  if(cancel) ctx.putImageData(active.before,0,0);
  else {draw(point(e)); undo.push(active.before); if(undo.length>10) undo.shift(); redo.length=0;}
  active=null; ctx.globalCompositeOperation='source-over'; historyButtons();
  if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', e=>finish(e));
canvas.addEventListener('pointercancel', e=>finish(e,true));
canvas.addEventListener('lostpointercapture', e=>finish(e,true));
canvas.addEventListener('contextmenu',e=>e.preventDefault());
$('export').onclick = () => {
  const output=document.createElement('canvas'); output.width=output.height=1024;
  const c=output.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,1024,1024); c.drawImage(canvas,0,0);
  output.toBlob(blob=>{ if(!blob) return; const url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download='iro-sketch.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); },'image/png');
};
document.addEventListener('keydown', e=>{
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.isComposing || active) return;
  const key=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&key==='z'){e.preventDefault(); e.shiftKey?travel(redo,undo):travel(undo,redo);}
  else if((e.ctrlKey||e.metaKey)&&key==='y'){e.preventDefault(); travel(redo,undo);}
  else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&{b:1,e:1,i:1}[key])setTool({b:'pen',e:'eraser',i:'picker'}[key]);
});
selectColor(...selected); setTool('pen'); historyButtons();
