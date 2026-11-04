// 元件判讀用：DIAGRAM=<圖> node tools/redraw/comp-sheet.js <輸出前綴> <元件序號…>
// 每個元件輸出一張 PNG：原圖（元件 box 外擴 20 px）放大，疊上墨水塊外框（紅）與編號（藍），
// 墨水塊（不屬於導線的墨水，鄰近的字母併成一塊）座標寫到 $WORK/<圖>-comp-<序號>.json：[{ i, box: [x0, y0, x1, y1], parts }]
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, WORK, DIAGRAM, loadImage } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { rasterizeDrawing } = require('../../js/drawing.js');
const { findMarks } = require('./marks');
const { writePng, digits } = require('./png');
const args = process.argv.slice(2), noMarks = args.includes('--grid-only'), [out, ...ids] = args.filter(a => a !== '--grid-only');
// --grid-only：只畫原圖與座標格線，不疊墨水塊外框（量形狀用）
const win = {};
for (const f of ['components', 'drawing']) vm.runInNewContext(fs.readFileSync(path.join(PROJECT, 'data', DIAGRAM, f + '.js'), 'utf8'), { window: win });
const img = loadImage(), { width: IW, height: IH, data: D } = img, K = IW / 1800;
const { label } = rasterizeDrawing(win.WOLF_DRAWING, { cableHalf: 7 });
const marks = findMarks({ image: img, label, skip: [], bigNoJoin: 60 });
for (const id of ids.map(Number)) {
  const c = win.WOLF_COMPONENTS[id], b = c.box.map(v => Math.round(v * K));
  const R = [Math.max(0, b[0] - 20), Math.max(0, b[1] - 20), Math.min(IW - 1, b[2] + 20), Math.min(IH - 1, b[3] + 20)];
  const ms = marks.filter(m => m.x0 >= R[0] && m.x1 <= R[2] && m.y0 >= R[1] && m.y1 <= R[3]).map((m, i) => ({ i, box: [m.x0, m.y0, m.x1, m.y1], parts: m.parts }));
  fs.writeFileSync(path.join(WORK, `${DIAGRAM}-comp-${id}.json`), JSON.stringify(ms));
  const rw = R[2] - R[0] + 1, rh = R[3] - R[1] + 1, sc = Math.min(4, 1100 / rw, 1100 / rh), w = Math.round(rw * sc), h = Math.round(rh * sc);
  const px = Buffer.alloc(w * h * 3, 255), set = (x, y, col) => { if (x >= 0 && y >= 0 && x < w && y < h) px.set(col, (y * w + x) * 3); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = R[0] + Math.floor(x / sc), Y = R[1] + Math.floor(y / sc), p = (Y * IW + X) * 4; set(x, y, [D[p], D[p + 1], D[p + 2]].map(v => noMarks ? v : 155 + (v * 100 / 255) | 0)); }
  const light = (x, y) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 3] > 225; // 格線只畫在空白處，不蓋住墨水
  // 座標格線：每 10 px 一條淡藍線，每 50 px 一條深一點並標上座標（x 標在上緣、y 標在左緣）
  for (let X = Math.ceil(R[0] / 10) * 10; X <= R[2]; X += 10) { const x = Math.round((X - R[0]) * sc), c = X % 50 ? [215, 230, 250] : [140, 180, 240]; for (let y = 0; y < h; y++) set(x, y, c); if (X % 50 === 0) digits(set, X, x + 2, 2, [20, 120, 20], 2); }
  for (let Y = Math.ceil(R[1] / 10) * 10; Y <= R[3]; Y += 10) { const y = Math.round((Y - R[1]) * sc), c = Y % 50 ? [215, 230, 250] : [140, 180, 240]; for (let x = 0; x < w; x++) set(x, y, c); if (Y % 50 === 0) digits(set, Y, 2, y + 2, [20, 120, 20], 2); }
  for (const m of noMarks ? [] : ms) {
    const [x0, y0, x1, y1] = m.box.map((v, k) => Math.round((v - R[k % 2]) * sc));
    for (let x = x0; x <= x1; x++) { set(x, y0 - 1, [230, 40, 40]); set(x, y1 + 1, [230, 40, 40]); }
    for (let y = y0; y <= y1; y++) { set(x0 - 1, y, [230, 40, 40]); set(x1 + 1, y, [230, 40, 40]); }
    digits(set, m.i, x0, Math.max(0, y0 - 17), [0, 0, 220], 3);
  }
  const f = `${out}-${id}.png`; writePng(f, px, w, h);
  console.log(`${f}  ${c.name}  區域 ${R.join(',')}  墨水塊 ${ms.length}（座標：${path.join(WORK, `${DIAGRAM}-comp-${id}.json`)}）`);
}
