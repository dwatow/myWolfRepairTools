// 塗色以座標儲存與舊資料轉移的檢查（headless Chrome、每個情境用全新的瀏覽器設定檔）：node tools/redraw/check-paint.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { rasterizeDrawing } = require('../../js/drawing.js');
const { evalInPage } = require('./chrome');

const D = 'PA12B', win = {};
for (const f of ['drawing', 'legacy']) vm.runInNewContext(fs.readFileSync(path.join(PROJECT, 'data', D, f + '.js'), 'utf8'), { window: win });
const L = win.WOLF_LEGACY, W = win.WOLF_DRAWING.size[0], lab = rasterizeDrawing(win.WOLF_DRAWING, { cableHalf: 7 }).label;
const k = L.picks.findIndex(([x, y]) => lab[y * W + x] >= 0), want = lab[L.picks[k][1] * W + L.picks[k][0]];
const V3 = 'wolf125-paint-v3', V4 = 'wolf125-paint-v4';
const head = items => `<script>localStorage.clear();${Object.entries(items).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(JSON.stringify(v))});`).join('')}</script>`;
const probe = () => ({ paint, status: document.getElementById('status').textContent, v3: localStorage.getItem('wolf125-paint-v3'), v4: localStorage.getItem('wolf125-paint-v4') });

let ok = true;
const check = (name, cond, got) => { ok &&= cond; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : '：' + JSON.stringify(got).slice(0, 300)}`); };

let r = evalInPage(probe, { diagram: D, fresh: true, head: head({ [V3]: { n: L.n, paint: { [k]: '#ff0000' } } }) });
check('轉移', JSON.stringify(r.paint) === JSON.stringify({ [want]: '#ff0000' }) && r.v3 !== null && JSON.parse(r.v4 || '[]').length === 1 && r.status.includes('已把舊塗色轉成新格式'), r);

r = evalInPage(probe, { diagram: D, fresh: true, head: head({ [V3]: { n: L.n + 1, paint: { [k]: '#ff0000' } } }) });
check('n 不符不轉移', Object.keys(r.paint).length === 0 && r.status.includes('沒有轉移') && r.v4 === null, r);

r = evalInPage(probe, { diagram: D, fresh: true, head: head({ [V4]: [{ pick: L.picks[k], color: '#00ff00' }] }) });
check('v4 往返', JSON.stringify(r.paint) === JSON.stringify({ [want]: '#00ff00' }), r);

process.exitCode = ok ? 0 : 1;
