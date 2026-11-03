// 裁切、放大外部參考圖（例如 pdfimages -j 從 PDF 取出的 JPEG），輸出 PNG 用 Read 看
// node crop-ref.js <in.jpg> <out.png> <x0> <y0> <x1> <y1> [倍率=1]
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
const WORK = process.env.WORK || path.join(os.tmpdir(), 'wolf-nets');
const jpeg = require('module').createRequire(path.join(WORK, 'x.js'))('jpeg-js');
const [inp, out, x0, y0, x1, y1, sc = 1] = [process.argv[2], process.argv[3], ...process.argv.slice(4).map(Number)];
if (!inp || !out || isNaN(y1)) { console.error('用法：node crop-ref.js <in.jpg> <out.png> x0 y0 x1 y1 [倍率]'); process.exit(2); }
const im = jpeg.decode(fs.readFileSync(inp), { useTArray: true });
const w = Math.round((x1 - x0) * sc), h = Math.round((y1 - y0) * sc), raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const X = x0 + Math.floor(x / sc), Y = y0 + Math.floor(y / sc), i = (Y * im.width + X) * 4;
  const p = X >= 0 && Y >= 0 && X < im.width && Y < im.height ? [im.data[i], im.data[i + 1], im.data[i + 2]] : [255, 255, 255];
  raw.set(p, y * (w * 3 + 1) + 1 + x * 3);
}
const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = b => { let c = ~0; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out, `（原圖 ${im.width}×${im.height}）`);
