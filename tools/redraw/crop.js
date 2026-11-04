// 放大原圖某點輸出 PNG（紅色十字標出中心），用 Read 看圖
// node crop.js <out.png> <cx> <cy> [半徑=50] [倍率=3]
const fs = require('fs'), zlib = require('zlib');
const { loadImage } = require('./lib');
const [out, cx, cy, r = 50, sc = 3] = [process.argv[2], ...process.argv.slice(3).map(Number)];
const { data: D, width: IW, height: IH } = loadImage();
const w = 2 * r * sc, h = w, raw = Buffer.alloc((w * 3 + 1) * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const X = cx - r + Math.floor(x / sc), Y = cy - r + Math.floor(y / sc);
  let p = [255, 255, 255];
  if (X >= 0 && Y >= 0 && X < IW && Y < IH) { const i = (Y * IW + X) * 4; p = [D[i], D[i + 1], D[i + 2]]; }
  if (X === cx || Y === cy) p = p.map((v, k) => (k === 0 ? 255 : v >> 1));
  raw.set(p, y * (w * 3 + 1) + 1 + x * 3);
}
const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = b => { let c = ~0; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(out);
