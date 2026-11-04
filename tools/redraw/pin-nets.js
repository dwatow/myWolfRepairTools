// 開關接腳 → 線路：node tools/redraw/pin-nets.js <圖>
//   依 data/<圖>/switches.js 的 pins，用重繪資料（drawing.js 點陣化）找每支接腳 ±4 px 內的線路（同 js/app.js renderSwitches 的 netOf）
//   列出接腳與線色；有接腳找不到線路時結束碼 1。不需要原圖
const fs = require('fs'), path = require('path'), vm = require('vm');
const { rasterizeDrawing } = require('../../js/drawing.js');

function pinNets(drawing, switches) {
  const { label } = rasterizeDrawing(drawing), [W, H] = drawing.size;
  const netAt = ([x0, y0]) => {
    for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = x0 + dx, y = y0 + dy, k = x >= 0 && y >= 0 && x < W && y < H ? label[y * W + x] : -1;
      if (k >= 0) return k;
    }
    return -1;
  };
  return switches.flatMap(sw => Object.entries(sw.pins || {}).map(([pin, at]) => {
    const k = netAt(at);
    return { sw: sw.name, pin, at, k, code: k >= 0 ? drawing.nets[k].code ?? null : null };
  }));
}

if (require.main === module) {
  const D = process.argv[2] || process.env.DIAGRAM || 'PA12B', win = {};
  for (const f of ['drawing', 'switches']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../data', D, f + '.js'), 'utf8'), { window: win });
  const rows = pinNets(win.WOLF_DRAWING, win.WOLF_SWITCHES || []);
  for (const r of rows) console.log(`${r.k < 0 ? '✗' : ' '} ${r.sw} ${r.pin} ${JSON.stringify(r.at)} → ${r.k < 0 ? '找不到線路' : `線路 ${r.k}（${r.code ?? '未標線色'}）`}`);
  if (rows.some(r => r.k < 0)) process.exit(1);
}
module.exports = { pinNets };
