// 待判讀標記的縮圖總表：DIAGRAM=<圖> node tools/redraw/review-sheet.js <輸出前綴> [種類…]
// 讀 $WORK/<圖>-marks-review.json（環境變數 REVIEW 可指定別的檔），每格是原圖該標記外擴 30 px（紅框標出標記），每張 6×5 格，格子左上角寫序號（點陣數字）
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { WORK, DIAGRAM, loadImage } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const [out, ...kinds] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(process.env.REVIEW || path.join(WORK, `${DIAGRAM}-marks-review.json`), 'utf8')).map((x, i) => ({ ...x, i }));
const items = kinds.length ? all.filter(x => kinds.some(k => x.kind === k || x.reason.includes(k))) : all;
const { data: D, width: IW, height: IH } = loadImage();
const CELL = 180, COLS = 6, ROWS = 5, PAD = 30;
// 3×5 點陣數字
const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = b => { let c = ~0; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
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
    [...String(it.i)].forEach((d, k) => { const f = FONT[d]; for (let j = 0; j < 15; j++) if (f[j] === '1') for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) set(ox + 3 + k * 12 + (j % 3) * 3 + a, oy + 3 + ((j / 3) | 0) * 3 + b, [0, 0, 220]); });
  });
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  const f = `${out}-${s}.png`; fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log(f, page.map(x => x.i).join(','));
}
