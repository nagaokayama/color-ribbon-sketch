const assert = require('node:assert/strict');
const IndexedCanvas = require('./dist/lut-core.js');
const c = new IndexedCanvas();
c.setPalette(1, ['#000000', '#ffffff']);
c.setPalette(2, ['#ff0000', '#0000ff']);
c.line({x:.5,y:.5}, {x:127.5,y:127.5}, 1, 1, 128, 255);
for (let i=0;i<128;i++) assert.deepEqual(c.sample(i,i), {id:1,position:128,alpha:255});
assert.equal(c.sample(-1,0),null); assert.equal(c.sample(128,0),null);
assert.equal(c.sample(0,1),null);
assert.deepEqual([...c.render().slice(0,4)], [128,128,128,255]);
const before=c.snapshot();
c.setPalette(1,['#ff0000','#00ff00','#0000ff']);
assert.deepEqual(c.snapshot(),before);
assert.deepEqual([...c.render().slice(0,4)],[0,254,1,255]);
assert.deepEqual(c.sample(0,0),{id:1,position:128,alpha:255});
c.line({x:.5,y:.5},{x:.5,y:.5},1,2,255,100);
assert.deepEqual([...c.render().slice(0,4)],[0,0,255,100]);
c.line({x:.5,y:.5},{x:.5,y:.5},1,1,0,0);
assert.deepEqual(c.sample(0,0),{id:2,position:255,alpha:100});
c.line({x:.5,y:.5},{x:.5,y:.5},1,1,0,255,true);
assert.equal(c.sample(0,0),null);
c.restore(before);
assert.deepEqual([...c.render().slice(0,4)],[0,254,1,255]);
for(const colors of [['#112233','#aabbcc'],['#112233','#ffffff','#000000','#aabbcc']]) {
  c.setPalette(1,colors);
  assert.deepEqual([...c.palettes.get(1).lut.slice(0,3)],[17,34,51]);
  assert.deepEqual([...c.palettes.get(1).lut.slice(-3)],[170,187,204]);
  assert.deepEqual(c.snapshot(),before);
}
const start=performance.now(), target=new Uint8ClampedArray(128*128*4);
for(let i=0;i<1000;i++)c.render(target);
console.log('PASS: palette reference, 128px stroke continuity, recoloring, variable color count, exact sampling, alpha replacement, erasing, snapshot restoration');
console.log(`CPU LUT render: ${((performance.now()-start)/1000).toFixed(3)} ms/frame (1000 iterations; Node, not iPad)`);

// Debug views must preserve source data and expose values without alpha blending.
const debug = new IndexedCanvas(4, 1);
debug.setPalette(1, ['#000000','#ffffff']); debug.setPalette(2, ['#ff0000','#0000ff']);
debug.ids.set([1,1,2,0]); debug.positions.set([0,128,255,0]); debug.alpha.set([255,10,255,0]);
const original = debug.snapshot(), normal = debug.render();
const colors = new Map([[1,[20,40,60]],[2,[90,80,70]]]);
const output = new Uint8ClampedArray(16);
debug.renderDebug(output, 'palette', colors);
assert.deepEqual([...output], [20,40,60,255,20,40,60,255,90,80,70,255,0,0,0,0]);
debug.renderDebug(output, 'position', colors);
assert.deepEqual([...output], [0,0,0,255,128,128,128,255,255,255,255,255,0,0,0,0]);
assert.deepEqual(debug.snapshot(), original); assert.deepEqual(debug.render(), normal);
assert.deepEqual(debug.sample(1,0), {id:1,position:128,alpha:10});
console.log('PASS: debug palette mapping, grayscale endpoints, transparency, data preservation, normal rendering');
