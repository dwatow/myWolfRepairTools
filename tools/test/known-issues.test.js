const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');

test('partProblems：元件圖元缺座標時列出哪一筆缺什麼', () => {
  const { partProblems } = require('../../js/drawing.js');
  assert.deepEqual(partProblems([{ type: 'frame', box: [0, 0, 1, 1], comp: 'A' }, { type: 'line', pts: [[0, 0], [1, 0]] }]), []);
  assert.deepEqual(partProblems([{ type: 'frame', comp: '調壓整流器' }, { type: 'text', text: 'x' }, { type: 'circle', c: [1, 1] }]), [
    'parts 第 0 筆（調壓整流器，frame）缺少 box',
    'parts 第 1 筆（text）缺少 at',
    'parts 第 2 筆（circle）缺少 r',
  ]);
});

test('codeChars：線色代號的字寬，/ 算半個字', () => {
  const { codeChars } = require('../redraw/marks.js');
  assert.equal(codeChars('GR'), 2);
  assert.equal(codeChars('G/R'), 2.5);
  assert.equal(codeChars('B'), 1);
});

test('replaceFields：只替換指定欄位，其他欄位的手寫註解保留', () => {
  const { replaceFields } = require('../redraw/write-drawing.js');
  const text = `// 檔頭
window.WOLF_DRAWING = {
  size: [10,10],
  nets: [
    {"code":"B"}, // 0
  ],
  labels: [
    {"text":"B","at":[1,1]}, // 人工：原圖寫法
  ],
  parts: [
    {"type":"frame","box":[0,0,1,1]},
  ],
};
`;
  const out = replaceFields(text, { parts: [{ type: 'frame', box: [0, 0, 2, 2] }] }, ['parts']);
  assert.ok(out.includes('// 人工：原圖寫法'));
  assert.ok(out.includes('{"type":"frame","box":[0,0,2,2]}'));
  assert.ok(!out.includes('[0,0,1,1]'));
  assert.ok(out.startsWith('// 檔頭\nwindow.WOLF_DRAWING = {\n  size: [10,10],\n  nets: [\n    {"code":"B"}, // 0'));
});

test('電纜預設半寬只定義在 js/drawing.js', () => {
  const { CABLE_HALF } = require('../../js/drawing.js');
  assert.equal(CABLE_HALF, 7);
  assert.ok(!/\?\? 7\b/.test(read('js/basemap.js')), 'basemap.js 不應寫死 ?? 7');
  assert.ok(!/const CABLE_HALF/.test(read('js/app.js')), 'app.js 不應另外定義 CABLE_HALF');
});
