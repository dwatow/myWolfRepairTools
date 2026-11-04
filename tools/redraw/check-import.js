// 圈選細節淘汰後的匯入／載入檢查（headless Chrome、全新設定檔）：node tools/redraw/check-import.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT } = require('./lib');
const { evalInPage } = require('./chrome');

const D = 'PA12B', win = {};
vm.runInNewContext(fs.readFileSync(path.join(PROJECT, 'data', D, 'legacy.js'), 'utf8'), { window: win });
const pick = win.WOLF_LEGACY.picks.find(p => p); // null = 新圖不畫的筆畫
let ok = true;
const check = (name, cond, got) => { ok &&= cond; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : '：' + JSON.stringify(got).slice(0, 300)}`); };

const file = { diagram: D, selections: [{ name: 't', nets: [{ pick }] }], details: [{ name: 't', rects: [[0, 0, 1, 1]], pixels: [[0, 0]] }] };
let r = evalInPage(new Function(`return (async () => {
  document.getElementById('import-file').onchange({ target: { files: [new File([${JSON.stringify(JSON.stringify(file))}], 'x.json')], value: '' } });
  for (let i = 0; i < 50 && !document.getElementById('save-msg').textContent; i++) await new Promise(r => setTimeout(r, 50));
  return { msg: document.getElementById('save-msg').textContent, n: saved.length };
})()`), { diagram: D, fresh: true });
check('匯入略過細節', r.msg.includes('匯入 1 筆') && r.msg.includes('略過 1 筆細節') && r.n === 1, r);

const stored = [{ name: 'a', picks: [pick] }, { name: 'a', kind: 'detail', rects: [], pixels: [] }];
r = evalInPage(() => ({ n: saved.length, stored: JSON.parse(localStorage.getItem('wolf125-saved-v1')).length, ui: !!document.getElementById('detail-mode') }),
  { diagram: D, fresh: true, head: `<script>localStorage.clear();localStorage.setItem('wolf125-saved-v1',${JSON.stringify(JSON.stringify(stored))});</script>` });
check('載入時濾掉細節', r.n === 1 && r.stored === 1 && !r.ui, r);
process.exitCode = ok ? 0 : 1;
