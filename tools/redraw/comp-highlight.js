// 元件被點擊時亮起的範圍（app.js 的 compLayer）：node tools/redraw/comp-highlight.js <圖> <輸出前綴> <元件名…>
//   每個元件輸出 <前綴>-<i>.png（放大 3 倍），並印出點擊範圍 hits、連到的線路線色
const fs = require('fs');
const { evalInPage } = require('./chrome');
const [D, out, ...names] = process.argv.slice(2);
const fn = new Function(`return (() => ${JSON.stringify(names)}.map(n => {
  const i = COMPONENTS.findIndex(c => c.name === n), c = COMPONENTS[i], L = compLayer(i);
  const cv = document.createElement('canvas'); cv.width = L.c.width * 3; cv.height = L.c.height * 3;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false; g.drawImage(L.c, 0, 0, cv.width, cv.height);
  return { name: n, hits: c.hits, nets: c.nets.map(k => nets[k].code), at: [L.x, L.y], url: cv.toDataURL() };
}))()`);
for (const [j, r] of evalInPage(fn, { diagram: D, fresh: true }).entries()) {
  const f = `${out}-${j}.png`; fs.writeFileSync(f, Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(r.name, JSON.stringify(r.hits), r.nets.join(','), JSON.stringify(r.at), f);
}
