// 副作用：逐段比對修改前後每條線段的線色與是否為導線（不需要接線單元檔，任何圖都能跑）
// node diff.js <修改前的資料夾（含 js/、data/<圖>/）>
const path = require('path');
const { DIAGRAM, loadImage, analyze } = require('./lib');
if (!process.argv[2]) { console.error('用法：node diff.js <修改前的資料夾>'); process.exit(2); }
const base = path.resolve(process.argv[2]), img = loadImage();
// 備份有底圖就用備份的底圖算修改前（同 verify.js）
const oldImg = require('fs').existsSync(path.join(base, 'data', DIAGRAM, 'strips.js')) ? loadImage(base) : img;
const a = analyze(oldImg, base), b = analyze(img);
const nets = r => new Set(r.segs.filter(s => s.net >= 0).map(s => s.net)).size;
console.log(`${DIAGRAM} 線路網：${nets(a)} → ${nets(b)}`);
if (a.segs.length !== b.segs.length) { console.log(`線段數不同（${a.segs.length} → ${b.segs.length}），js/nets.js 的偵測規則或底圖有變，無法逐段比對；改用 verify.js`); process.exit(1); }
let n = 0;
a.segs.forEach((s, i) => {
  const t = b.segs[i], was = s.net < 0 ? '(非導線)' : s.netCode || '(未標色)', now = t.net < 0 ? '(非導線)' : t.netCode || '(未標色)';
  if (was !== now) { n++; console.log(`  ${s.h ? 'H' : 'V'} ${s.x0},${s.y0}-${s.x1},${s.y1}  ${was} → ${now}`); }
});
console.log(n ? `共 ${n} 段改變，逐一確認都是預期的修改` : '線色沒有任何改變');
