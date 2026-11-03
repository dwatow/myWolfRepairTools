// 在 headless Chrome 裡編輯底圖（轉正後的全解析度座標），只重新編碼有變動的橫條
// DIAGRAM=PA12C node edit-base.js <ops.js> [--preview x,y,w,h[,倍率]] [--out 預覽.png] [--apply]
//   ops.js：一段 async 函式本體，可用的工具見下方 HELPERS（white、eraseH、paste、drawText…）
//   --preview：把該範圍的編輯結果輸出成 PNG（倍率預設 1，最近鄰放大），用 Read 看
//   --out：預覽檔路徑，預設 $WORK/preview-<圖>.png（多個工作同時跑時各自指定，避免互相覆蓋）
//   --apply：把有變動的橫條寫回 data/<圖>/strips.js。注意：改到的橫條整條重新編碼（JPEG 品質 1），
//            不只改動的那幾 px；原檔備份到 $WORK/<圖>-strips.<時間>.js（不留在專案裡）
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const PROJECT = path.resolve(__dirname, '../../../..');
const WORK = process.env.WORK || path.join(os.tmpdir(), 'wolf-nets');
const DIAGRAM = process.env.DIAGRAM || 'PA12B';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2), opsFile = args.find((a, i) => !a.startsWith('--') && !['--preview', '--out'].includes(args[i - 1]));
const apply = args.includes('--apply');
const opt = k => args.includes(k) ? args[args.indexOf(k) + 1] : undefined;
const pv = (opt('--preview') || '').split(',').map(Number), pvScale = pv[4] || 1;
const outPng = path.resolve(opt('--out') || path.join(WORK, `preview-${DIAGRAM}.png`));
if (!opsFile) { console.error('用法：DIAGRAM=<圖> node edit-base.js <ops.js> [--preview x,y,w,h[,倍率]] [--out 預覽.png] [--apply]'); process.exit(2); }
const STRIPS = path.join(PROJECT, 'data', DIAGRAM, 'strips.js');

const HELPERS = `
const at = (x, y) => (y * IW + x) * 4;
const get = (x, y) => { const i = at(x, y); return [D[i], D[i + 1], D[i + 2]]; };
const set = (x, y, c) => { const i = at(x, y); D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; };
const lum = (x, y) => { const i = at(x, y); return (D[i] + D[i + 1] + D[i + 2]) / 3; };
const ink = (x, y) => lum(x, y) < 170;
const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
const white = (x0, y0, x1, y1) => fill(x0, y0, x1, y1, [255, 255, 255]);
// 擦橫線：帶狀範圍內的像素清白，但保留上下都有墨水（直穿過去）的直線
const eraseH = (x0, x1, y0, y1) => { const keep = []; for (let x = x0; x <= x1; x++) keep[x] = ink(x, y0 - 3) && ink(x, y1 + 3);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!keep[x]) set(x, y, [255, 255, 255]); };
// 擦直線：保留左右都有墨水（橫穿過去）的橫線
const eraseV = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) if (!(ink(x0 - 3, y) && ink(x1 + 3, y))) for (let x = x0; x <= x1; x++) set(x, y, [255, 255, 255]); };
const copy = (x0, y0, x1, y1) => { const w = x1 - x0 + 1, h = y1 - y0 + 1, a = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.push(get(x0 + x, y0 + y)); return { w, h, a }; };
// onlyInk：只貼深色像素（貼圓點、文字時不蓋掉底下的線）
const paste = (p, dx, dy, onlyInk = false) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const c = p.a[y * p.w + x]; if (!onlyInk || (c[0] + c[1] + c[2]) / 3 < 235) set(dx + x, dy + y, c); } };
const bbox = (x0, y0, x1, y1) => { let a = 1e9, b = 1e9, c = 0, d = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ink(x, y)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
function render(ch, font, size, sx = 1) {
  const c = document.createElement('canvas'); c.width = 200; c.height = 160; const k = c.getContext('2d');
  k.fillStyle = '#fff'; k.fillRect(0, 0, 200, 160); k.fillStyle = '#000'; k.font = font.replace('{size}', size + 'px');
  k.setTransform(sx, 0, 0, 1, 20, 120); k.fillText(ch, 0, 0);
  const d = k.getImageData(0, 0, 200, 160).data, m = []; let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (let y = 0; y < 160; y++) for (let x = 0; x < 200; x++) { const i = (y * 200 + x) * 4; if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 170) { m.push([x, y]); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  return { m, d, x0, y0, x1, y1 };
}
// 找最像原圖某個字的字型：box＝原圖那個字的範圍，ch＝那個字，fonts＝'italic bold {size} "Arial Narrow"' 這類字型樣板
function fitFont(box, ch, fonts, sizes, sxs = [1]) {
  const [bx0, by0, bx1, by1] = bbox(...box), mask = new Set();
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (ink(x, y)) mask.add(x + ',' + y);
  let best = null;
  for (const font of fonts) for (const size of sizes) for (const sx of sxs) {
    const r = render(ch, font, size, sx); if (!r.m.length) continue;
    const ox = bx0 - r.x0, oy = by1 - r.y1; let inter = 0;
    for (const [x, y] of r.m) if (mask.has((x + ox) + ',' + (y + oy))) inter++;
    const iou = inter / (r.m.length + mask.size - inter);
    if (!best || iou > best.iou) best = { font, size, sx, iou };
  }
  return best;
}
// 用 fitFont 的結果寫字：字的墨水範圍左上角對齊 (x, y)，以墨水色疊上（保留反鋸齒）
// 注意 fitFont 比對時是左下角對齊；換字（新字和舊字寬高不同）時改用 drawCentered
function drawText(ch, f, x, y, inkRGB = [20, 20, 20]) {
  const r = render(ch, f.font, f.size, f.sx);
  for (let yy = 0; yy < 160; yy++) for (let xx = 0; xx < 200; xx++) { const i = (yy * 200 + xx) * 4, v = (r.d[i] + r.d[i + 1] + r.d[i + 2]) / 3;
    if (v < 250) { const a = 1 - v / 255, X = x + xx - r.x0, Y = y + yy - r.y0, p = get(X, Y); set(X, Y, p.map((c, k) => Math.round(c * (1 - a) + inkRGB[k] * a))); } }
}
// 把字置中寫進 box＝[x0, y0, x1, y1]（通常是被換掉的舊字範圍，先量好再擦）
function drawCentered(ch, f, box, inkRGB) {
  const r = render(ch, f.font, f.size, f.sx), w = r.x1 - r.x0, h = r.y1 - r.y0;
  drawText(ch, f, Math.round((box[0] + box[2] - w) / 2), Math.round((box[1] + box[3] - h) / 2), inkRGB);
}`;

const page = `<!doctype html><meta charset="utf-8"><body><pre id="out"></pre>
<script src="file://${STRIPS}"></script>
<script>
(async () => {
const imgs = await Promise.all(WOLF_STRIPS.map(src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; })));
const W0 = imgs[0].width, IW = imgs.reduce((a, i) => a + i.height, 0), IH = W0;
const cv = document.createElement('canvas'); cv.width = IW; cv.height = IH;
const g = cv.getContext('2d', { willReadFrequently: true });
g.translate(0, W0); g.rotate(-Math.PI / 2); let off = 0; for (const i of imgs) { g.drawImage(i, 0, off); off += i.height; } g.setTransform(1, 0, 0, 1, 0, 0);
const orig = g.getImageData(0, 0, IW, IH).data, img = g.getImageData(0, 0, IW, IH), D = img.data, out = { log: [] };
const log = (...a) => out.log.push(a.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' '));
${HELPERS}
${fs.readFileSync(path.resolve(opsFile), 'utf8')}
g.putImageData(img, 0, 0);
${pv.length >= 4 ? `{ const c = document.createElement('canvas'); c.width = ${pv[2] * pvScale}; c.height = ${pv[3] * pvScale}; const k = c.getContext('2d'); k.imageSmoothingEnabled = false; k.drawImage(cv, ${pv[0]}, ${pv[1]}, ${pv[2]}, ${pv[3]}, 0, 0, ${pv[2] * pvScale}, ${pv[3] * pvScale}); out.preview = c.toDataURL('image/png'); }` : ''}
out.strips = {}; off = 0;
imgs.forEach((im, k) => {
  let changed = false;
  for (let x = off; x < off + im.height && !changed; x++) for (let y = 0; y < IH; y++) { const i = at(x, y); if (D[i] !== orig[i] || D[i + 1] !== orig[i + 1] || D[i + 2] !== orig[i + 2]) { changed = true; break; } }
  if (changed) { const s = document.createElement('canvas'); s.width = W0; s.height = im.height; const sg = s.getContext('2d');
    sg.translate(W0, -off); sg.rotate(Math.PI / 2); sg.drawImage(cv, 0, 0); out.strips[k] = s.toDataURL('image/jpeg', 1); }
  off += im.height;
});
document.getElementById('out').textContent = JSON.stringify(out);
})().catch(e => { document.getElementById('out').textContent = JSON.stringify({ error: e.stack }); });
</script>`;

fs.mkdirSync(WORK, { recursive: true });
const html = path.join(WORK, 'edit-base.html'); fs.writeFileSync(html, page);
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
  `--user-data-dir=${path.join(WORK, 'chrome-prof')}`, '--virtual-time-budget=60000', '--dump-dom', 'file://' + html],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
const m = dom.match(/<pre id="out">([^<]*)/);
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const out = m && m[1] ? JSON.parse(unesc(m[1])) : { error: '沒有結果（頁面可能報錯或逾時）' };
if (out.error) { console.error(out.error); process.exit(1); }
for (const l of out.log) console.log(l);
if (out.preview) { fs.writeFileSync(outPng, Buffer.from(out.preview.split(',')[1], 'base64')); console.log('預覽', outPng); }
const changed = Object.keys(out.strips);
console.log('有變動的橫條（0 起算）', changed.length ? changed.join(', ') : '無');
if (apply && changed.length) {
  let src = fs.readFileSync(STRIPS, 'utf8'); const bak = path.join(WORK, `${DIAGRAM}-strips.${Date.now()}.js`); fs.writeFileSync(bak, src);
  const urls = src.match(/"data:image\/[^"]+"/g);
  for (const k of changed) src = src.replace(urls[+k], () => JSON.stringify(out.strips[k]));
  fs.writeFileSync(STRIPS, src); console.log('已寫回', STRIPS, '；備份', bak);
  console.log('下一步：DIAGRAM=' + DIAGRAM + ' node .claude/skills/fixing-wire-nets/scripts/verify.js <寫回前備份的資料夾>，確認只有預期的線路網變化');
}
