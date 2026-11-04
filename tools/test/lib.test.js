const test = require('node:test'), assert = require('node:assert');
const os = require('os'), fs = require('fs'), path = require('path');
const { loadImage } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');

test('loadImage：沒有原圖時給清楚的訊息', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-strips-'));
  assert.throws(() => loadImage(dir), /找不到 data\/PA12B\/strips\.js（原廠掃描圖不在 git 內/);
});
