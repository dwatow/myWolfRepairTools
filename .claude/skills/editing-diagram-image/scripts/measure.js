// 量底圖（轉正後座標）上的線與字：找出要擦、要貼的確切像素位置
// DIAGRAM=<圖> node measure.js rows x0 x1 y0 y1   橫線：該範圍內墨水覆蓋超過一半的列
// DIAGRAM=<圖> node measure.js cols x0 x1 y0 y1   直線：墨水覆蓋超過 6 成的欄
// DIAGRAM=<圖> node measure.js runs x0 x1 y0 y1   字或符號的欄區段（逐字切開，回報各段 x 範圍與整體 y 範圍）
// DIAGRAM=<圖> node measure.js map  x0 y0 x1 y1 [step=1]   字元圖：+ 綠線、# 深色、: 淺灰、. 空白
// DIAGRAM=<圖> node measure.js rgb  x y            該點顏色（取線色要取線段中段）
const { loadImage } = require('../../fixing-wire-nets/scripts/lib');
const [mode, ...a] = process.argv.slice(2); const n = a.map(Number);
const { data: D, width: W } = loadImage();
const rgb = (x, y) => { const i = (y * W + x) * 4; return [D[i], D[i + 1], D[i + 2]]; };
const ink = (x, y) => { const [r, g, b] = rgb(x, y); return (r + g + b) / 3 < 170; };
const ch = (x, y) => { const [r, g, b] = rgb(x, y); if (g > r + 30 && g < 200) return '+'; const l = (r + g + b) / 3; return l < 110 ? '#' : l < 200 ? ':' : '.'; };
if (mode === 'rows') { const [x0, x1, y0, y1] = n, o = [];
  for (let y = y0; y <= y1; y++) { let c = 0; for (let x = x0; x <= x1; x++) c += ink(x, y); if (c > (x1 - x0 + 1) / 2) o.push(`${y}(${c})`); } console.log(o.join(' ') || '無');
} else if (mode === 'cols') { const [x0, x1, y0, y1] = n, o = [];
  for (let x = x0; x <= x1; x++) { let c = 0; for (let y = y0; y <= y1; y++) c += ink(x, y); if (c > (y1 - y0 + 1) * 0.6) o.push(`${x}(${c})`); } console.log(o.join(' ') || '無');
} else if (mode === 'runs') { const [x0, x1, y0, y1] = n, runs = []; let cur = null, top = 1e9, bot = 0;
  for (let x = x0; x <= x1; x++) { let any = false; for (let y = y0; y <= y1; y++) if (ink(x, y)) { any = true; top = Math.min(top, y); bot = Math.max(bot, y); }
    if (any) { if (!cur) cur = [x, x]; else cur[1] = x; } else if (cur) { runs.push(cur); cur = null; } }
  if (cur) runs.push(cur); console.log('x 區段', JSON.stringify(runs), ' y 範圍', top + '-' + bot);
} else if (mode === 'map') { const [x0, y0, x1, y1, st = 1] = n;
  for (let y = y0; y <= y1; y += st) { let s = ''; for (let x = x0; x <= x1; x += st) s += ch(x, y); console.log(String(y).padStart(4), s); }
} else if (mode === 'rgb') console.log(rgb(n[0], n[1]));
else { console.error('模式：rows | cols | runs | map | rgb（見檔頭說明）'); process.exit(2); }
