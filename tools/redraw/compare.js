// 驗收 1～3（Node）：DIAGRAM=<圖> node tools/redraw/compare.js
// 以影像辨識結果為基準，檢查 data/<圖>/drawing.js 點陣化後：接線一對一、既有參照找得回、線色一致。任一項失敗結束碼 1
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, DIAGRAM, SELECTIONS, loadImage, analyze } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { rasterizeDrawing } = require('../../js/drawing.js');
const { netsToDrawing } = require('./draft');
const { matchNets } = require('./match');
const EXC = require('./exceptions')[DIAGRAM] || [];

const win = {};
for (const f of ['drawing', 'legacy', 'components', 'fixes', 'switches']) {
  const file = path.join(PROJECT, 'data', DIAGRAM, f + '.js');
  if (fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window: win });
}
const img = loadImage(), W = img.width, H = img.height, old = analyze(img);
const half = +(fs.readFileSync(path.join(PROJECT, 'js/app.js'), 'utf8').match(/const CABLE_HALF = (\d+)/) || [0, 7])[1];
const drawing = win.WOLF_DRAWING, neu = rasterizeDrawing(drawing, { cableHalf: half });
const { dropped, outlines } = netsToDrawing(old, { W, H, image: img, components: win.WOLF_COMPONENTS || [], fixes: win.WOLF_FIXES || {} });
// 整批例外的線路不參與比對（它們的筆畫可能碰到別條線的點擊帶，被誤判成合併或部分沒畫到）
const batchSet = new Set([...dropped, ...outlines]);
const m = matchNets({ oldSegs: old.segs.filter(s => !batchSet.has(s.net)), oldLabel: old.label, newLabel: neu.label, W });
const at = (lab, [x, y]) => lab[y * W + x];
const near = (lab, [x, y]) => { for (let d = 0; d <= 2; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const k = lab[(y + dy) * W + x + dx]; if (k >= 0) return k; } return -1; };
// 同 app.js renderSwitches 的 netOf：接腳座標 4 px 內的線路
const near4 = (lab, [x, y]) => { for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const k = lab[(y + dy) * W + x + dx]; if (k >= 0) return k; } return -1; };
const excOf = root => EXC.find(e => near(old.label, e.pick) === root);
const codeOf = new Map(); for (const s of old.segs) if (s.net >= 0 && s.netCode && !codeOf.has(s.net)) codeOf.set(s.net, s.netCode);
const P = ([x, y]) => `(${x}, ${y})`;
let allOk = true;
const report = (name, lines) => {
  const bad = lines.filter(l => !l.ok);
  allOk &&= !bad.length;
  console.log(`${bad.length ? 'FAIL' : 'PASS'} ${name}`);
  for (const l of lines) if (l.text) console.log(`  ${l.ok ? '·' : '✗'} ${l.text}`);
};

// 1. 接線一致
const drop = new Set(dropped), outSet = new Set(outlines), lines1 = [];
const item = (root, text) => { const e = excOf(root); return { ok: !!e, text: e ? `${text}（已確認例外：${e.reason}）` : text }; };
lines1.push({ ok: true, text: `整批例外（整條在元件框內的符號、文字筆畫）：${dropped.length} 條` });
for (const o of outlines) { const s = old.segs.find(s => s.net === o); lines1.push(item(o, `電纜外框殘段（不畫）：舊線路 未標色 ${P([(s.x0 + s.x1) >> 1, (s.y0 + s.y1) >> 1])}`)); }
for (const x of m.missing) lines1.push(item(x.old, `沒畫到：舊線路 ${codeOf.get(x.old) || '未標色'} ${P(x.at)}`));
for (const x of m.splits) lines1.push(item(x.old, `一分為二：舊線路 ${codeOf.get(x.old) || '未標色'} → 新 ${x.news.join('、')}，${x.at.map(P).join('、')}`));
for (const x of m.merges) {
  const olds = x.olds.filter(o => !drop.has(o)); if (olds.length < 2) continue; // 整批例外的筆畫碰到別條線的點擊帶，不算合併
  lines1.push({ ok: olds.every(excOf), text: `併成一條：新 ${x.news} ← 舊 ${olds.map(o => codeOf.get(o) || '未標色').join(' + ')} ${P(x.at)}` + (olds.every(excOf) ? `（已確認例外：${excOf(olds[0]).reason}）` : '') });
}
const partialBy = new Map(); for (const x of m.partial) if (!partialBy.has(x.old)) partialBy.set(x.old, x);
for (const x of partialBy.values()) lines1.push(item(x.old, `部分線段沒畫到：舊線路 ${codeOf.get(x.old) || '未標色'} ${P(x.at)}（共 ${m.partial.filter(p => p.old === x.old).length} 段）`));
report('接線一致', lines1);

// 2. 既有參照
const lines2 = [];
// 接線單元檔（含同名加數字的舊匯出檔）：舊圖是 1 條的單元，新圖也必須是 1 條；舊圖本來就不是 1 條的只列出
const selFiles = fs.readdirSync(PROJECT).filter(f => f.startsWith(path.basename(SELECTIONS, '.json')) && f.endsWith('.json'));
for (const f of selFiles) for (const s of JSON.parse(fs.readFileSync(path.join(PROJECT, f), 'utf8')).selections) {
  const count = lab => new Set(s.nets.map(n => at(lab, n.pick)).filter(k => k >= 0)).size;
  const a = count(old.label), b = count(neu.label);
  lines2.push({ ok: a !== 1 || b === 1, text: `${f} ${s.name}：${b} 條` + (a === 1 ? '' : `（舊圖就是 ${a} 條，不列入判定）`) });
}
for (const c of win.WOLF_COMPONENTS || []) for (const p of c.picks || [])
  if (at(neu.label, p) < 0) lines2.push({ ok: false, text: `元件 ${c.name} 的 pick ${P(p)} 沒落在線上` });
for (const s of win.WOLF_SWITCHES || []) for (const [pin, p] of Object.entries(s.pins || {}))
  if (near4(neu.label, p) < 0) lines2.push({ ok: false, text: `開關 ${s.name} 接腳 ${pin} ${P(p)} 4 px 內沒有線` });
const L = win.WOLF_LEGACY;
if (L) {
  let okN = 0, onDropped = 0;
  L.picks.forEach((p, k) => {
    const root = near(old.label, p);
    if (drop.has(root) || outSet.has(root)) { onDropped++; return; }
    const want = m.map.get(root), got = near(neu.label, p);
    if (want !== undefined && want === got) okN++;
    else lines2.push({ ok: false, text: `舊線路 ${k} 的塗色座標 ${P(p)}：應落在新 ${want ?? '（無對應）'}，實際 ${got}` });
  });
  lines2.push({ ok: true, text: `舊塗色座標：${okN} 筆對到同一條線；${onDropped} 筆在整批例外的筆畫上（轉移時略過）` });
} else lines2.push({ ok: false, text: `沒有 data/${DIAGRAM}/legacy.js` });
report('參照', lines2);

// 3. 線色一致
const lines3 = [];
for (const [o, k] of m.map) {
  if (drop.has(o)) continue;
  const a = codeOf.get(o) ?? null, b = drawing.nets[k].code ?? null;
  if (a !== b) lines3.push({ ok: false, text: `新線路 ${k}：舊 ${a ?? 'null'}，新 ${b ?? 'null'}` });
}
report('線色一致', lines3);
console.log(`線路網：舊 ${new Set(old.label.filter(k => k >= 0)).size} → 新 ${drawing.nets.length}`);
process.exitCode = allOk ? 0 : 1;
