const test = require('node:test'), assert = require('node:assert');
const { netsToDrawing } = require('../redraw/draft.js');
const W = 100, H = 100;
// 合成辨識結果：segs 的矩形範圍內的像素標成該線路根編號；image 預設灰色
function mk(segs, { rgb = [90, 90, 90], components = [], fixes = {} } = {}) {
  const label = new Int32Array(W * H).fill(-1), data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) data.set([...rgb, 255], i * 4);
  for (const s of segs) for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) label[y * W + x] = s.net;
  return netsToDrawing({ segs, label }, { W, H, image: { data, width: W, height: H }, components, fixes });
}
const seg = (net, x0, y0, x1, y1, extra = {}) => ({ h: x1 - x0 >= y1 - y0, x0, y0, x1, y1, net, netCode: 'B', ...extra });
const wiresOf = d => d.nets.flatMap(n => n.wires);

test('中心線與 L 轉角吸附', () => {
  const { drawing } = mk([seg(5, 5, 9, 30, 11), seg(5, 31, 12, 33, 40)]);
  const w = wiresOf(drawing);
  assert.equal(w.length, 2);
  for (const wire of w) assert.ok(wire.some(p => p[0] === 32 && p[1] === 10), JSON.stringify(wire));
});

test('共線合併', () => {
  const { drawing } = mk([seg(5, 5, 9, 20, 11), seg(5, 22, 10, 40, 12)]);
  const w = wiresOf(drawing);
  assert.equal(w.length, 1);
  assert.deepEqual([w[0][0][0], w[0][1][0]], [5, 40]);
});

test('T 字產生圓點', () => {
  const { drawing } = mk([seg(5, 5, 9, 60, 11), seg(5, 29, 12, 31, 50)]);
  assert.deepEqual(drawing.nets[0].dots, [[30, 10]]);
});

test('元件框內的線路整批例外', () => {
  // box 以圖寬 1800 為基準：W=100 時 K=100/1800，box [0,0,900,900] → [0,0,50,50]
  const { drawing, dropped } = mk([seg(5, 10, 10, 30, 12), seg(7, 60, 70, 90, 72)], { components: [{ name: 'X', box: [0, 0, 900, 900] }] });
  assert.equal(drawing.nets.length, 1);
  assert.deepEqual(dropped, [5]);
});

test('偏綠的未標色線路記為接地', () => {
  const s = [seg(5, 5, 9, 60, 11, { netCode: null })];
  assert.equal(mk(s, { rgb: [40, 160, 60] }).drawing.nets[0].ground, true);
  assert.equal(mk(s, { rgb: [90, 90, 90] }).drawing.nets[0].ground, false);
  assert.equal(mk(s).drawing.nets[0].code, null);
});

test('links 折線加入 wires、兩點的不加', () => {
  const links = [[[10, 10], [10, 30], [20, 30]], [[10, 10], [80, 80]]];
  const { drawing } = mk([seg(5, 5, 9, 60, 11)], { fixes: { links } });
  assert.equal(drawing.nets[0].wires.length, 2);
  assert.deepEqual(drawing.nets[0].wires[1], links[0]);
});

test('電纜輸出', () => {
  const fixes = { cables: [{ code: 'B', ground: true, half: 9, path: [[0, 0], [0, 20]] }] };
  const { drawing } = mk([{ h: false, x0: 0, x1: 0, y0: 0, y1: 20, net: 10000000, netCode: 'B', ground: true }], { fixes });
  assert.deepEqual(drawing.nets[0], { code: 'B', cable: true, half: 9, ground: true, wires: [[[0, 0], [0, 20]]], dots: [] });
});

test('電纜外框殘段另列 outlines、不畫', () => {
  const fixes = { cables: [{ code: 'B', half: 9, path: [[50, 10], [50, 60]] }] };
  const segs = [{ h: false, x0: 50, x1: 50, y0: 10, y1: 60, net: 10000000, netCode: 'B' }, seg(8, 41, 55, 42, 72, { netCode: null })];
  const { drawing, outlines } = mk(segs, { fixes });
  assert.equal(drawing.nets.length, 1);
  assert.deepEqual(outlines, [8]);
});

test('nets-manual：移除、補線、合併', () => {
  const { applyNetsManual } = require('../redraw/nets-manual.js');
  const d = { size: [100, 100], nets: [
    { code: 'G', ground: false, wires: [[[0, 0], [50, 0]], [[5, 0], [5, 9]]], dots: [] },
    { code: 'R', ground: false, wires: [[[0, 50], [40, 50]]], dots: [] },
    { code: 'R', cable: true, half: 7, ground: false, wires: [[[60, 50], [60, 90]]], dots: [] },
  ] };
  const log = applyNetsManual(d, {
    remove: [[[5, 0], [5, 9]]],
    add: [{ at: [40, 50], wires: [[[40, 50], [60, 50]]] }],
    merge: [{ at: [[20, 50], [60, 70]], reason: 'x' }],
  });
  assert.deepEqual(d.nets[0].wires, [[[0, 0], [50, 0]]]);
  assert.equal(d.nets.length, 2);
  assert.deepEqual(d.nets[1].wires, [[[0, 50], [40, 50]], [[40, 50], [60, 50]]]);
  assert.deepEqual(d.nets[1].cables, [{ path: [[60, 50], [60, 90]], half: 7 }]);
  assert.equal(log.length, 3);
  applyNetsManual(d, { remove: [[[5, 0], [5, 9]]], add: [{ at: [40, 50], wires: [[[40, 50], [60, 50]]] }], merge: [{ at: [[20, 50], [60, 70]] }] });
  assert.equal(d.nets[1].wires.length, 2, '重複套用不會重複補線');
});

test('tidyNet：疊在一起的補線與線段整理成乾淨的轉角', () => {
  const { tidyNet } = require('../redraw/draft.js');
  const net = { code: 'G', wires: [[[340, 330], [1201, 330]], [[340, 363], [376, 363]], [[360, 330], [341, 330], [341, 362], [355, 362]]], dots: [] };
  tidyNet(net);
  const ws = net.wires.map(w => JSON.stringify(w)).sort();
  assert.deepEqual(ws, ['[[341,330],[1201,330]]', '[[341,330],[341,363]]', '[[341,363],[376,363]]'].sort());
});

test('tidyNet：缺口大於 2 px 的同線段不合併（文字缺口保留）', () => {
  const { tidyNet } = require('../redraw/draft.js');
  const net = { code: 'B', wires: [[[0, 10], [40, 10]], [[60, 10], [90, 10]]], dots: [] };
  tidyNet(net);
  assert.equal(net.wires.length, 2);
});
