// 待判讀標記的縮圖總表：DIAGRAM=<圖> node tools/redraw/review-sheet.js <輸出前綴> [種類…]
// 讀 $WORK/<圖>-marks-review.json（環境變數 REVIEW 可指定別的檔），每格是原圖該標記外擴 30 px（紅框標出標記），每張 6×5 格，格子左上角寫序號（點陣數字）
const fs = require('fs'), path = require('path');
const { WORK, DIAGRAM, loadImage } = require('./lib');
const [out, ...kinds] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(process.env.REVIEW || path.join(WORK, `${DIAGRAM}-marks-review.json`), 'utf8')).map((x, i) => ({ ...x, i }));
const items = kinds.length ? all.filter(x => kinds.some(k => x.kind === k || x.reason.includes(k))) : all;
const { data: D, width: IW, height: IH } = loadImage();
const CELL = 180, COLS = 6, ROWS = 5, PAD = 30;
const { writePng, digits } = require('./png');
for (let s = 0; s * COLS * ROWS < items.length; s++) {
  const page = items.slice(s * COLS * ROWS, (s + 1) * COLS * ROWS), w = COLS * CELL, h = ROWS * CELL, px = Buffer.alloc(w * h * 3, 255);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px.set(c, (y * w + x) * 3); };
  page.forEach((it, n) => {
    const ox = (n % COLS) * CELL, oy = ((n / COLS) | 0) * CELL, [x0, y0, x1, y1] = it.box;
    const span = Math.max(x1 - x0, y1 - y0) + 2 * PAD, sc = Math.min(4, (CELL - 4) / span), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (let y = 0; y < CELL - 2; y++) for (let x = 0; x < CELL - 2; x++) {
      const X = Math.round(cx + (x - CELL / 2) / sc), Y = Math.round(cy + (y - CELL / 2) / sc);
      let c = [255, 255, 255]; if (X >= 0 && Y >= 0 && X < IW && Y < IH) { const i = (Y * IW + X) * 4; c = [D[i], D[i + 1], D[i + 2]]; }
      const edge = (X === x0 - 2 || X === x1 + 2) && Y >= y0 - 2 && Y <= y1 + 2 || (Y === y0 - 2 || Y === y1 + 2) && X >= x0 - 2 && X <= x1 + 2;
      set(ox + x, oy + y, edge ? [230, 40, 40] : c);
    }
    for (let x = 0; x < CELL; x++) { set(ox + x, oy + CELL - 1, [120, 120, 120]); set(ox + CELL - 1, oy + x, [120, 120, 120]); }
    digits(set, it.i, ox + 3, oy + 3, [0, 0, 220]);
  });
  const f = `${out}-${s}.png`; writePng(f, px, w, h);
  console.log(f, page.map(x => x.i).join(','));
}
