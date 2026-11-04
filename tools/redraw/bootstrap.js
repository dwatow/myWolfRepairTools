// 產生 drawing.js 草稿：DIAGRAM=<圖> node tools/redraw/bootstrap.js
// 用現有的影像辨識結果（js/nets.js＋data/<圖>/ 的 anchors、fixes、components）轉換，覆寫 data/<圖>/drawing.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, DIAGRAM, loadImage, analyze } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { netsToDrawing } = require('./draft');
const { assertDraft } = require('./marks');
const { formatDrawing } = require('./write-drawing');

const load = f => { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(PROJECT, 'data', DIAGRAM, f), 'utf8'), c); return c.window; };
const img = loadImage(), r = analyze(img);
const { drawing, dropped, outlines } = netsToDrawing(r, {
  W: img.width, H: img.height, image: img,
  components: load('components.js').WOLF_COMPONENTS || [], fixes: load('fixes.js').WOLF_FIXES || {},
});
const file = path.join(PROJECT, 'data', DIAGRAM, 'drawing.js');
if (fs.existsSync(file)) {
  const old = fs.readFileSync(file, 'utf8');
  try { assertDraft(old, process.argv.includes('--force')); } catch (e) { console.error(e.message); process.exit(2); }
  // 保留既有的標記（add-marks.js 產生或手改的），只重產線路網
  const win = {}; vm.runInNewContext(old, { window: win });
  for (const f of ['connectors', 'inline', 'labels', 'texts']) drawing[f] = win.WOLF_DRAWING[f] || [];
}
fs.writeFileSync(file, formatDrawing(drawing));
const dots = drawing.nets.reduce((a, n) => a + n.dots.length, 0);
console.log(`${DIAGRAM}：線路網 ${drawing.nets.length} 條；整批例外 ${dropped.length} 條；圓點 ${dots} 個`);

// legacy.js：舊線路落在新圖不畫的筆畫（整批例外、電纜外框殘段）上時，座標改成 null，轉移舊塗色時略過
// （否則該點可能剛好在別條新線路上，舊顏色會塗到別條線）
const legacyFile = path.join(PROJECT, 'data', DIAGRAM, 'legacy.js');
if (fs.existsSync(legacyFile)) {
  const L = load('legacy.js').WOLF_LEGACY, gone = new Set([...dropped, ...outlines]), W = img.width;
  const rootAt = ([x, y]) => { for (let d = 0; d <= 2; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const k = r.label[(y + dy) * W + x + dx]; if (k >= 0) return k; } return -1; };
  let n = 0;
  L.picks = L.picks.map(p => p && gone.has(rootAt(p)) ? (n++, null) : p);
  const text = fs.readFileSync(legacyFile, 'utf8');
  fs.writeFileSync(legacyFile, text.replace(/window\.WOLF_LEGACY = .*;\n/, `window.WOLF_LEGACY = ${JSON.stringify(L)};\n`)
    .replace('// 由 tools/redraw/capture-legacy.js 在 Chrome 擷取，不要手改', '// 由 tools/redraw/capture-legacy.js 在 Chrome 擷取；tools/redraw/bootstrap.js 把落在新圖不畫的筆畫上的座標改成 null。不要手改'));
  console.log(`legacy.js：${n} 筆座標落在不畫的筆畫上，改成 null`);
}
