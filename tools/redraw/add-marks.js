// 產生標記草稿：DIAGRAM=<圖> node tools/redraw/add-marks.js [--force]
// 從原圖找出導線上的線色文字、單線接頭、多腳接頭，改寫 data/<圖>/drawing.js 的 connectors／inline／labels／texts（nets 不動）
// 無法自動判定的寫到 $WORK/<圖>-marks-review.json，由人工看原圖補上
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, WORK, DIAGRAM, loadImage } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { rasterizeDrawing } = require('../../js/drawing.js');
const { findMarks, attach, assertDraft, cutWires, dropMarkStrokes } = require('./marks');
const { formatDrawing, headerOf } = require('./write-drawing');
// 人工判讀見 tools/redraw/marks-manual.js

const TITLE = [85, 45, 560, 110]; // 原圖左上角的型號標題（PA12B SERIES）
const file = path.join(PROJECT, 'data', DIAGRAM, 'drawing.js'), text = fs.readFileSync(file, 'utf8');
try { assertDraft(text, process.argv.includes('--force')); } catch (e) { console.error(e.message); process.exit(2); }
const win = {};
for (const f of ['components', 'fixes']) vm.runInNewContext(fs.readFileSync(path.join(PROJECT, 'data', DIAGRAM, f + '.js'), 'utf8'), { window: win });
vm.runInNewContext(text, { window: win });
const drawing = win.WOLF_DRAWING, img = loadImage(), K = img.width / 1800;
const { label } = rasterizeDrawing(drawing, { cableHalf: 7 });
const comps = win.WOLF_COMPONENTS || [];
const skip = [TITLE, ...(win.WOLF_FIXES.staticAreas || []), ...comps.map(c => c.box.map(v => v * K)), ...comps.filter(c => c.label).map(c => c.label.map(v => v * K))];
const marks = findMarks({ image: img, label, skip });
const r = attach(marks, drawing, img, label);
// 人工判讀：接頭外框整份取代；框內的自動文字（接腳數字、框邊被誤認）移除；補上漏掉的標記
const manual = require('./marks-manual')[DIAGRAM] || {};
const boxes = (manual.connectors || r.connectors).map(c => c.box);
const inside = ([x, y]) => boxes.some(([a, b, c, d]) => x >= a - 4 && x <= c + 4 && y >= b - 4 && y <= d + 4);
const near = (p, q) => Math.abs(p[0] - q[0]) <= 25 && Math.abs(p[1] - q[1]) <= 12;
const extra = manual.inline || [];
Object.assign(drawing, {
  labels: [...r.labels.filter(l => !inside(l.at) && !(manual.removeLabels || []).some(p => Math.abs(p[0] - l.at[0]) <= 3 && Math.abs(p[1] - l.at[1]) <= 3)), ...(manual.labels || [])],
  inline: [...r.inline.filter(m => !inside(m.at) && !extra.some(e => near(e.at, m.at))), ...extra],
  connectors: manual.connectors || r.connectors,
  texts: [{ text: `${DIAGRAM} SERIES`, at: [Math.round((TITLE[0] + TITLE[2]) / 2), Math.round((TITLE[1] + TITLE[3]) / 2)], size: 52 }],
});
cutWires(drawing); // 文字與單線接頭處的導線切開留缺口
const strokes = dropMarkStrokes(drawing); // 接頭符號的筆畫（未標色、整條在標記或接頭外框內）不當導線畫
fs.writeFileSync(file, formatDrawing(drawing, headerOf(text)));
fs.mkdirSync(WORK, { recursive: true });
const rv = path.join(WORK, `${DIAGRAM}-marks-review.json`);
fs.writeFileSync(rv, JSON.stringify(r.review, null, 1));
const by = r.review.reduce((a, x) => (a[x.reason.replace(/\d+ px.*/, '寬度不符')] = (a[x.reason.replace(/\d+ px.*/, '寬度不符')] || 0) + 1, a), {});
console.log(`${DIAGRAM}：標記 ${marks.length}；線色文字 ${r.labels.length}、單線接頭 ${r.inline.length}（plug ${r.inline.filter(x => x.kind === 'plug').length}）、多腳接頭 ${r.connectors.length}；移除接頭筆畫 ${strokes} 條；待判讀 ${r.review.length}`, by);
console.log('待判讀清單：' + rv);
