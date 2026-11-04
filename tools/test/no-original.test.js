const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');

test('網頁不載入原圖與舊辨識資料', () => {
  const html = read('index.html'), app = read('js/app.js'), diagrams = read('js/diagrams.js');
  for (const s of ['nets.js', 'dev-original']) assert.ok(!html.includes(s), `index.html 不應含 ${s}`);
  for (const s of ['strips.js', 'STATIC_AREAS', 'WOLF_FIXES', 'WOLF_ANCHORS', 'dev-original']) assert.ok(!app.includes(s), `js/app.js 不應含 ${s}`);
  const m = diagrams.match(/const DATA_FILES = (\[[^\]]*\])/);
  assert.ok(m, 'js/diagrams.js 要有 DATA_FILES 陣列');
  assert.deepEqual(JSON.parse(m[1]), ['drawing', 'legacy', 'components', 'switches']);
});
