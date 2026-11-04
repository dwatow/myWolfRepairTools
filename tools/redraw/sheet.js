// 逐區對照截圖：node tools/redraw/sheet.js <圖> <輸出前綴> x,y,w,h[,倍率] …
//   每區輸出 <前綴>-<i>.png，左原圖、右新圖（新圖含依線色上色）。--sample：改畫 tools/redraw/sample-marks.js（只有新圖）
const fs = require('fs');
const { evalInPage } = require('./chrome');
const [D, out, ...rest] = process.argv.slice(2), sample = rest.includes('--sample'), regions = rest.filter(a => a !== '--sample');
const fn = sample
  ? new Function(`return (() => { const d = ${JSON.stringify(require('./sample-marks'))};
      const c = document.createElement('canvas'); c.width = d.size[0] * 3; c.height = d.size[1] * 3;
      const g = c.getContext('2d'); g.scale(3, 3); drawBase(g, d, [], 1); return [c.toDataURL()]; })()`)
  : new Function(`return (async () => {
      const cb = document.getElementById('dev-original'); cb.checked = true; await cb.onchange();
      return ${JSON.stringify(regions)}.map(r => { const [x, y, w, h, s = 1] = r.split(',').map(Number);
        const c = document.createElement('canvas'); c.width = 2 * w * s + 10; c.height = h * s;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#c33'; g.fillRect(w * s, 0, 10, h * s);
        g.drawImage(original, x, y, w, h, 0, 0, w * s, h * s);
        g.drawImage(base, x, y, w, h, w * s + 10, 0, w * s, h * s); g.drawImage(overlay, x, y, w, h, w * s + 10, 0, w * s, h * s);
        return c.toDataURL(); });
    })()`);
const urls = evalInPage(fn, { diagram: D, query: '&dev=1', fresh: true });
urls.forEach((u, i) => { const f = `${out}-${i}.png`; fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f); });
