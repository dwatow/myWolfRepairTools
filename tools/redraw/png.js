// 開發工具共用：RGB 像素緩衝寫成 PNG、3×5 點陣數字標號
const fs = require('fs'), zlib = require('zlib');
const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = b => { let c = ~0; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
// px：長度 w*h*3 的 RGB Buffer
function writePng(file, px, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
// 在 (x, y) 寫數字 n，每點 s×s
function digits(set, n, x, y, color, s = 3) {
  [...String(n)].forEach((d, k) => { const f = FONT[d]; for (let j = 0; j < 15; j++) if (f[j] === '1') for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) set(x + k * 4 * s + (j % 3) * s + a, y + ((j / 3) | 0) * s + b, color); });
}
module.exports = { writePng, digits };
