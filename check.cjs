// State-level checks; browser rendering and pointer delivery require browser QA.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(){ this.style={}; this.value='0'; this.children=[]; this.handlers={}; }
  setAttribute(){} append(e){this.children.push(e)} replaceChildren(){this.children=[]}
  querySelector(){return new Element()}
  addEventListener(k,f){this.handlers[k]=f}
}
let pixels=0;
const context={getImageData:()=>({value:pixels,data:[0,0,0,0]}),putImageData:d=>pixels=d.value,beginPath(){},arc(){},fill(){pixels++},stroke(){pixels++},moveTo(){},lineTo(){}};
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
Object.assign(get('canvas'),{getContext:()=>context,width:1024,height:1024,getBoundingClientRect:()=>({left:0,top:0,width:512,height:512}),setPointerCapture(){},hasPointerCapture:()=>false});
const sandbox={document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener(){}},setTimeout,URL,console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),sandbox);
function run(s){return vm.runInContext(s,sandbox)}
function event(id){return {pointerId:id,button:0,clientX:20,clientY:20,preventDefault(){}}}
const c=get('canvas');
for(let i=0;i<12;i++){c.handlers.pointerdown(event(i));c.handlers.pointerup(event(i))}
assert.equal(run('undo.length'),10);
const finished=pixels;
for(let i=0;i<10;i++)run('travel(undo,redo)');
assert.equal(run('undo.length'),0);assert.equal(run('redo.length'),10);
const oldest=pixels;run('travel(undo,redo)');assert.equal(pixels,oldest);
for(let i=0;i<10;i++)run('travel(redo,undo)');assert.equal(pixels,finished);
run('travel(undo,redo)');c.handlers.pointerdown(event(40));c.handlers.pointerup(event(40));assert.equal(run('redo.length'),0);
const beforeCancel=pixels;c.handlers.pointerdown(event(50));c.handlers.pointercancel(event(50));assert.equal(pixels,beforeCancel);
assert.equal(run('active'),null);
assert.equal(run("hsvToHex(0,100,100)"),'#ff0000');
assert.equal(run("hsvToHex(120,100,100)"),'#00ff00');
assert.equal(run("hsvToHex(240,100,100)"),'#0000ff');
assert.equal(run("hsvToHex(0,0,100)"),'#ffffff');
for(const hex of ['#df9e87','#304a49','#000000','#ffffff'])assert.equal(run(`hsvToHex(...(()=>{const [h,s,l]=hexToHsv('${hex}');return [h,s,l]})())`),hex);
run("editBase('#123456')");assert.equal(run('stacks[0][2]'),'#123456');
run('sample({x:1,y:1})');assert.equal(run('ink'),'#ffffff');
run("setTool('picker')");
const beforePick=pixels;
c.handlers.pointerdown(event(60));c.handlers.pointerdown(event(61));
assert.equal(run('tool'),'picker');assert.equal(run('active'),null);assert.equal(pixels,beforePick);
run("setTool('eraser')");assert.equal(run('tool'),'eraser');
run('selectColor(0,0)');
const base=run('stacks[0][2]');
run('ramps[0].shadowDepth=90; regenerate(0)');
assert.equal(run('stacks[0][2]'),base);
assert.equal(run('stacks[0].length'),5);
assert.ok(run('hexToHsv(stacks[0][0])[2] < hexToHsv(stacks[0][2])[2]'));
const paletteBefore=run('JSON.stringify(stacks)');run('sample({x:1,y:1})');assert.equal(run('JSON.stringify(stacks)'),paletteBefore);
console.log('PASS: 10-stroke limit, undo/redo, redo branching, canceled stroke, HSV round trips and ramp invariants, palette edit, transparent sampling');

assert.equal(run('point({clientX:256,clientY:128}).x'),512);
assert.equal(run('point({clientX:256,clientY:128}).y'),256);
get('penSize').oninput({target:{value:'9'}});
get('eraserSize').oninput({target:{value:'42'}});
run("setTool('pen')");c.handlers.pointerdown(event(70));assert.equal(run('active.size'),9);c.handlers.pointerup(event(70));
run("setTool('eraser')");c.handlers.pointerdown(event(71));assert.equal(run('active.size'),42);c.handlers.pointerup(event(71));
console.log('PASS: scaled canvas coordinates and independent pen/eraser sizes');
