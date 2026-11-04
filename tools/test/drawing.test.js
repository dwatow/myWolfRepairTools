const test = require('node:test'), assert = require('node:assert');
const { rasterizeDrawing } = require('../../js/drawing.js');
const W = 40, at = (x, y) => y * W + x;
const D = nets => ({ size: [W, 40], nets });

test('水平線的線芯與點擊帶', () => {
  const r = rasterizeDrawing(D([{ code: 'B', wires: [[[5, 10], [30, 10]]] }]));
  assert.equal(r.label[at(20, 10)], 0);
  assert.equal(r.label[at(20, 13)], 0);
  assert.equal(r.label[at(20, 14)], -1);
  assert.ok(r.cores[0].includes(at(20, 9)));
  assert.ok(!r.cores[0].includes(at(20, 12)));
});

test('交叉處以線芯優先', () => {
  const r = rasterizeDrawing(D([{ wires: [[[0, 10], [39, 10]]] }, { wires: [[[20, 0], [20, 39]]] }]));
  assert.ok([0, 1].includes(r.label[at(20, 10)]));
  assert.equal(r.label[at(22, 10)], 0);
  assert.equal(r.label[at(20, 12)], 1);
});

test('圓點併入線芯', () => {
  const r = rasterizeDrawing(D([{ wires: [[[5, 10], [30, 10]]], dots: [[20, 10]] }]));
  assert.equal(r.label[at(20, 14)], 0);
  assert.ok(r.cores[0].includes(at(20, 14)));
});

test('電纜用 half', () => {
  const r = rasterizeDrawing(D([{ code: 'B', cable: true, half: 5, wires: [[[5, 20], [30, 20]]] }]));
  assert.equal(r.label[at(10, 25)], 0);
  assert.equal(r.label[at(10, 26)], -1);
});

test('線段', () => {
  const r = rasterizeDrawing(D([{ wires: [[[5, 10], [30, 10], [30, 30]]] }]));
  assert.deepEqual(r.segs, [
    { h: true, x0: 5, x1: 30, y0: 10, y1: 10, net: 0 },
    { h: false, x0: 30, x1: 30, y0: 10, y1: 30, net: 0 },
  ]);
});

test('斜線報錯', () => {
  const d = D([{ wires: [] }, { wires: [] }, { wires: [[[0, 0], [5, 5]]] }]);
  assert.throws(() => rasterizeDrawing(d), /第 2 條線路網.*水平或垂直/);
});

test('自由端的線芯縮短、轉角不縮', () => {
  const r = rasterizeDrawing(D([{ wires: [[[5, 10], [30, 10]], [[30, 10], [30, 30]]] }]));
  assert.ok(!r.cores[0].includes(at(5, 10)) && !r.cores[0].includes(at(6, 10)), '左端是自由端，縮 2 px');
  assert.ok(r.cores[0].includes(at(7, 10)));
  assert.ok(r.cores[0].includes(at(30, 10)) && r.cores[0].includes(at(31, 10)), '轉角照常');
  assert.ok(!r.cores[0].includes(at(30, 30)) && r.cores[0].includes(at(30, 28)), '下端是自由端');
  assert.equal(r.label[at(5, 10)], 0, '點擊帶不縮');
});

test('segmentEnds 判斷自由端', () => {
  const { segmentEnds } = require('../../js/drawing.js');
  const ends = segmentEnds({ nets: [{ wires: [[[0, 0], [10, 0]], [[5, 0], [5, 9]]], dots: [] }, { wires: [[[0, 20], [10, 20]]], dots: [[10, 20]] }] });
  assert.deepEqual(ends, [[[true, true], [false, true]], [[true, false]]]);
});

test('一般線路網可另帶粗電纜 cables', () => {
  const r = rasterizeDrawing(D([{ code: 'R', wires: [[[5, 10], [30, 10]]], cables: [{ path: [[30, 10], [30, 35]], half: 4 }] }]));
  assert.equal(r.label[at(34, 25)], 0, '電纜半寬 4');
  assert.equal(r.label[at(35, 25)], -1);
  assert.ok(r.cores[0].includes(at(33, 25)), '電纜整寬都是線芯');
});
