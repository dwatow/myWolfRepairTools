const test = require('node:test'), assert = require('node:assert');
const { matchNets } = require('../redraw/match.js');
const W = 20;
// 舊：segs 範圍內標成 net；新：rects [[x0,y0,x1,y1,k]] 範圍內標成 k
function mk(oldSegs, rects) {
  const oldLabel = new Int32Array(W * W).fill(-1), newLabel = new Int32Array(W * W).fill(-1);
  for (const s of oldSegs) for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) oldLabel[y * W + x] = s.net;
  for (const [x0, y0, x1, y1, k] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) newLabel[y * W + x] = k;
  return matchNets({ oldSegs, oldLabel, newLabel, W });
}
const h = (net, x0, x1, y) => ({ h: true, x0, x1, y0: y, y1: y, net });

test('一對一', () => {
  const m = mk([h(7, 0, 10, 2), h(7, 0, 10, 8), h(9, 0, 10, 15)], [[0, 1, 10, 9, 0], [0, 14, 10, 16, 1]]);
  assert.deepEqual([...m.map], [[7, 0], [9, 1]]);
  assert.deepEqual([m.splits, m.merges, m.missing, m.partial], [[], [], [], []]);
});
test('一分為二回報 splits', () => {
  const m = mk([h(7, 0, 10, 2), h(7, 0, 10, 8)], [[0, 1, 10, 3, 0], [0, 7, 10, 9, 1]]);
  assert.equal(m.splits.length, 1);
  assert.deepEqual(m.splits[0].news, [0, 1]);
});
test('兩條併成一條回報 merges', () => {
  const m = mk([h(7, 0, 10, 2), h(9, 0, 10, 8)], [[0, 1, 10, 9, 0]]);
  assert.deepEqual(m.merges.map(x => [x.news, x.olds]), [[0, [7, 9]]]);
});
test('找不到回報 missing', () => {
  const m = mk([h(7, 0, 10, 2)], []);
  assert.deepEqual(m.missing.map(x => x.old), [7]);
});
test('部分線段沒畫到回報 partial', () => {
  const m = mk([h(7, 0, 10, 2), h(7, 0, 10, 8)], [[0, 1, 10, 3, 0]]);
  assert.deepEqual(m.partial.map(x => [x.old, x.at]), [[7, [5, 8]]]);
  assert.equal(m.map.get(7), 0);
});
