const test = require('node:test'), assert = require('node:assert');
const { findMarks, classify, attach } = require('../redraw/marks.js');
const W = 200, H = 100;
function canvas() {
  const data = new Uint8Array(W * H * 4).fill(255), label = new Int32Array(W * H).fill(-1);
  const ink = (x, y) => { const p = (y * W + x) * 4; data[p] = data[p + 1] = data[p + 2] = 0; };
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ink(x, y); };
  const frame = (x0, y0, x1, y1, t = 2) => { rect(x0, y0, x1, y0 + t - 1); rect(x0, y1 - t + 1, x1, y1); rect(x0, y0, x0 + t - 1, y1); rect(x1 - t + 1, y0, x1, y1); };
  // 三角形：左邊直邊，兩斜邊收到右邊尖端
  const tri = (x0, cy, len, half) => {
    rect(x0, cy - half, x0 + 1, cy + half);
    for (let i = 0; i <= len; i++) { const d = Math.round(half * (1 - i / len)); ink(x0 + i, cy - d); ink(x0 + i, cy + d); ink(x0 + i, cy - d + 1); ink(x0 + i, cy + d - 1); }
  };
  return { image: { data, width: W, height: H }, label, ink, rect, frame, tri };
}
const one = c => findMarks({ image: c.image, label: c.label, skip: [] });

test('找出不屬於導線的墨水塊', () => {
  const c = canvas();
  c.rect(0, 50, 199, 52); for (let x = 0; x < W; x++) for (let y = 50; y <= 52; y++) c.label[y * W + x] = 0;
  c.rect(100, 10, 109, 29);
  const m = one(c);
  assert.equal(m.length, 1);
  assert.deepEqual([m[0].x0, m[0].y0, m[0].x1, m[0].y1], [100, 10, 109, 29]);
});

test('鄰近的字母併成一個標記', () => {
  const c = canvas();
  c.rect(10, 10, 19, 24); c.rect(25, 10, 34, 24); c.rect(40, 10, 49, 24);
  const m = one(c);
  assert.equal(m.length, 1);
  assert.equal(m[0].parts, 3);
});

test('三角形分類為 plug', () => {
  const c = canvas(); c.tri(50, 40, 30, 11);
  const [m] = one(c);
  assert.equal(classify(m, c.image, c.label).kind, 'plug');
  assert.equal(classify(m, c.image, c.label).flip, false);
});

test('雙框分類為 socket', () => {
  const c = canvas(); c.frame(50, 30, 94, 50); c.frame(61, 38, 83, 43, 1);
  const [m] = one(c);
  assert.equal(classify(m, c.image, c.label).kind, 'socket');
});

test('短字分類為 text', () => {
  const c = canvas(); c.rect(10, 10, 12, 24); c.rect(13, 10, 20, 12); c.rect(13, 22, 20, 24);
  const [m] = one(c);
  assert.equal(classify(m, c.image, c.label).kind, 'text');
});

const drawingWith = code => ({ size: [W, H], nets: [{ code, wires: [[[0, 50], [50, 50]], [[100, 50], [199, 50]]] }] });

test('文字對應旁邊導線的線色', () => {
  const c = canvas(); c.rect(60, 43, 87, 57);
  const r = attach(one(c), drawingWith('BR'), c.image, c.label);
  assert.equal(r.labels.length, 1);
  assert.equal(r.labels[0].text, 'BR');
  assert.equal(r.labels[0].vertical, false);
  assert.deepEqual(r.labels[0].at, [74, 50]);
});

test('無線色導線的文字列入待判讀', () => {
  const c = canvas(); c.rect(60, 43, 87, 57);
  const r = attach(one(c), drawingWith(null), c.image, c.label);
  assert.equal(r.labels.length, 0);
  assert.equal(r.review.length, 1);
  assert.match(r.review[0].reason, /導線沒有線色/);
});

test('寬度不符列入待判讀', () => {
  const c = canvas(); c.rect(50, 43, 94, 57);
  const r = attach(one(c), drawingWith('G'), c.image, c.label);
  assert.equal(r.labels.length, 0);
  assert.match(r.review[0].reason, /寬度/);
});

test('已手改拒絕覆寫', () => {
  const { assertDraft } = require('../redraw/marks.js');
  assert.throws(() => assertDraft('// 已手改（2026-11-04）\nwindow.WOLF_DRAWING = {};', false), /已手改.*--force/);
  assert.doesNotThrow(() => assertDraft('// 已手改\n', true));
  assert.doesNotThrow(() => assertDraft('// 線路圖資料\n', false));
});

test('三角形接母端拆成 plug 與 socket', () => {
  const c = canvas(); c.tri(40, 40, 30, 10); c.frame(71, 30, 115, 50); c.frame(82, 38, 104, 42, 1);
  const r = attach(one(c), { size: [W, H], nets: [] }, c.image, c.label);
  assert.deepEqual(r.inline.map(x => [x.kind, x.dir, !!x.flip]), [['plug', 'h', false], ['socket', 'h', false]]);
  assert.ok(Math.abs(r.inline[0].at[0] - 55) <= 2 && Math.abs(r.inline[1].at[0] - 93) <= 2, JSON.stringify(r.inline));
});

test('母端在左、三角形朝左', () => {
  const c = canvas(); c.frame(40, 30, 84, 50); c.frame(51, 38, 73, 42, 1);
  // 朝左的三角形：右邊直邊、尖端在左（接到母端右框）
  c.rect(114, 30, 115, 50); for (let i = 0; i <= 30; i++) { const d = Math.round(10 * (1 - i / 30)); c.ink(115 - i, 40 - d); c.ink(115 - i, 40 + d); c.ink(115 - i, 41 - d); c.ink(115 - i, 39 + d); }
  const r = attach(one(c), { size: [W, H], nets: [] }, c.image, c.label);
  assert.deepEqual(r.inline.map(x => [x.kind, !!x.flip]), [['socket', false], ['plug', true]]);
});

test('細線碎片（底線、接頭外框殘段）忽略', () => {
  const c = canvas(); c.rect(20, 20, 180, 22); c.rect(100, 50, 101, 74);
  const r = attach(one(c), { size: [W, H], nets: [] }, c.image, c.label);
  assert.equal(r.review.length + r.labels.length + r.inline.length + r.connectors.length, 0);
});

test('單字母離導線端點 20 px 仍對得上', () => {
  const c = canvas(); c.rect(70, 43, 80, 57);
  const r = attach(one(c), { size: [W, H], nets: [{ code: 'B', wires: [[[0, 50], [50, 50]], [[100, 50], [199, 50]]] }] }, c.image, c.label);
  assert.deepEqual(r.labels.map(l => l.text), ['B']);
});

test('文字與接頭處的導線切開留缺口', () => {
  const { cutWires } = require('../redraw/marks.js');
  const d = { size: [W, H], nets: [{ code: 'SB', wires: [[[0, 50], [199, 50]], [[100, 0], [100, 99]]] }],
    labels: [{ text: 'SB', at: [60, 50], vertical: false }], inline: [{ kind: 'plug', at: [150, 50], dir: 'h' }] };
  cutWires(d);
  const h = d.nets[0].wires.filter(w => w[0][1] === 50 && w[1][1] === 50).map(w => [w[0][0], w[1][0]]);
  // SB 寬約 28 → 46..74 兩側各再留 6 px；plug 長 30 → 135..165 不留白
  assert.deepEqual(h, [[0, 39], [81, 134], [166, 199]]);
  assert.ok(d.nets[0].wires.some(w => w[0][0] === 100 && w[1][0] === 100), '垂直線不受影響');
});

test('切開後太短的殘段丟掉', () => {
  const { cutWires } = require('../redraw/marks.js');
  const d = { size: [W, H], nets: [{ code: 'G', wires: [[[50, 50], [70, 50]]] }], labels: [{ text: 'G', at: [60, 50], vertical: false }], inline: [] };
  cutWires(d);
  assert.deepEqual(d.nets[0].wires, []);
});

test('整條在接頭或標記範圍內的未標色線路移除', () => {
  const { dropMarkStrokes } = require('../redraw/marks.js');
  const d = { size: [W, H], nets: [
    { code: null, wires: [[[52, 40], [70, 40]]] },       // 接頭框內的筆畫
    { code: 'B', wires: [[[0, 45], [60, 45]]] },          // 穿進接頭的導線（有線色、延伸到框外）
    { code: null, wires: [[[52, 80], [120, 80]]] },       // 未標色但延伸到框外
  ], connectors: [{ label: '', box: [50, 30, 80, 60] }], labels: [], inline: [] };
  assert.equal(dropMarkStrokes(d), 1);
  assert.deepEqual(d.nets.map(n => n.code), ['B', null]);
});

test('切缺口後沒有導線的未標色線路移除', () => {
  const { dropMarkStrokes } = require('../redraw/marks.js');
  const d = { size: [W, H], nets: [{ code: null, wires: [] }, { code: 'B', wires: [[[0, 45], [60, 45]]] }], connectors: [], labels: [], inline: [] };
  assert.equal(dropMarkStrokes(d), 1);
  assert.deepEqual(d.nets.map(n => n.code), ['B']);
});
