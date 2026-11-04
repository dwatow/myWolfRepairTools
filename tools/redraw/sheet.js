// 逐區對照截圖：node tools/redraw/sheet.js <圖> <輸出前綴> x,y,w,h[,倍率] …
//   每區輸出 <前綴>-<i>.png，左原圖、右新圖（新圖含依線色上色）。--sample：改畫 tools/redraw/sample-marks.js（只有新圖）
const fs = require('fs');
const { evalInPage } = require('./chrome');
const { originalFile } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const [D, out, ...rest] = process.argv.slice(2), sample = rest.includes('--sample'), regions = rest.filter(a => a !== '--sample');
const fn = sample
  ? new Function(`return (() => { const d = ${JSON.stringify(require('./sample-marks'))};
      const c = document.createElement('canvas'); c.width = d.size[0] * 3; c.height = d.size[1] * 3;
      const g = c.getContext('2d'); g.scale(3, 3); drawBase(g, d, [], 1); return [c.toDataURL()]; })()`)
  : new Function(`return (async () => {
      // 原圖：本機的 data/<圖>/strips.js（不在 git 內），7 條橫條上下拼接後逆時針轉 90°
      await loadScript('data/' + DIAGRAM.id + '/strips.js');
      const imgs = await Promise.all(window.WOLF_STRIPS.map(src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; })));
      const W0 = imgs[0].width, original = document.createElement('canvas'); original.width = imgs.reduce((a, i) => a + i.height, 0); original.height = W0;
      { const g = original.getContext('2d'); g.translate(0, W0); g.rotate(-Math.PI / 2); let y = 0; for (const i of imgs) { g.drawImage(i, 0, y); y += i.height; } }
      return ${JSON.stringify(regions)}.map(r => { const [x, y, w, h, s = 1] = r.split(',').map(Number);
        const c = document.createElement('canvas'); c.width = 2 * w * s + 10; c.height = h * s;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#c33'; g.fillRect(w * s, 0, 10, h * s);
        g.drawImage(original, x, y, w, h, 0, 0, w * s, h * s);
        g.drawImage(base, x, y, w, h, w * s + 10, 0, w * s, h * s); g.drawImage(overlay, x, y, w, h, w * s + 10, 0, w * s, h * s);
        return c.toDataURL(); });
    })()`);
if (!sample) originalFile(undefined, D); // 沒有本機原圖時先給說明
const urls = evalInPage(fn, { diagram: D, fresh: true });
urls.forEach((u, i) => { const f = `${out}-${i}.png`; fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64')); console.log(f); });
