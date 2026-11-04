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

test('網頁說明不再提到掃描圖辨識或對照原圖', () => {
  const html = read('index.html');
  for (const s of ['掃描圖', '自動辨識', '對照原圖']) assert.ok(!html.includes(s), `index.html 不應含「${s}」`);
});

test('沒有檔案引用舊 skill 的腳本', () => {
  const { execFileSync } = require('child_process');
  const root = path.join(__dirname, '../..');
  const files = execFileSync('git', ['ls-files', '*.js', '*.md'], { cwd: root, encoding: 'utf8' }).split('\n').filter(f => f && !f.startsWith('docs/superpowers/'));
  const bad = files.filter(f => fs.existsSync(path.join(root, f)) && /fixing-wire-nets\/scripts|editing-diagram-image\/scripts/.test(read(f)));
  assert.deepEqual(bad, []);
});
