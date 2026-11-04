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
