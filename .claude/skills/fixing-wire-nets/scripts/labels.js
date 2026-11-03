// 印出區域內每個像素屬於哪個線路網：. 空白、# 有墨水但不屬任何線路網、A/B/… 各線路網
// node labels.js <x0> <y0> <x1> <y1>
const { loadImage, analyze } = require('./lib');
const [x0, y0, x1, y1] = process.argv.slice(2).map(Number);
const img = loadImage(), r = analyze(img), W = img.width, ids = new Map();
for (let y = y0; y <= y1; y++) {
  let row = '';
  for (let x = x0; x <= x1; x++) {
    const i = y * W + x, l = r.label[i];
    if (l >= 0 && !ids.has(l)) ids.set(l, String.fromCharCode(65 + ids.size));
    row += !r.ink[i] ? '.' : l < 0 ? '#' : ids.get(l);
  }
  console.log(String(y).padStart(4), row);
}
for (const [net, ch] of ids) console.log(ch, 'net', net, 'code', r.segs.find(s => s.net === net)?.netCode ?? null);
