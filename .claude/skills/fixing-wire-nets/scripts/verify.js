// 驗收＋副作用：每個接線單元的 pick 落在幾段線路網；與修改前相比新增了哪些合併
// node verify.js [修改前的資料夾（含 js/、data/<圖>/）]
//   備份有 data/<圖>/strips.js 時，修改前用備份的底圖（可比對改底圖前後）；沒有就兩邊都用專案目前的底圖
//   新合併印出「接點」：被併在一起的兩段舊線路網之間最近的位置，用 crop.js 看這裡
const fs = require('fs'), path = require('path');
const { SELECTIONS, DIAGRAM, loadImage, analyze } = require('./lib');
const base = process.argv[2] && path.resolve(process.argv[2]);
const img = loadImage(), W = img.width, neu = analyze(img);
const oldImg = base && fs.existsSync(path.join(base, 'data', DIAGRAM, 'strips.js')) ? loadImage(base) : img;
const old = base && analyze(oldImg, base);
if (base) console.log(`修改前：${oldImg === img ? '專案目前的底圖' : '備份的底圖'}＋備份的資料`);
const sel = fs.existsSync(SELECTIONS) ? require(SELECTIONS) : (console.log(`（沒有 ${path.basename(SELECTIONS)}，只比對合併）`), { selections: [] });
const count = (r, s) => new Set(s.nets.map(([x, y]) => r.label[y * W + x]).filter(k => k >= 0)).size;
let ok = true;
for (const s of sel.selections) {
  s.nets = s.nets.map(n => n.pick);
  const n = count(neu, s); ok &&= n === 1;
  console.log(`${n === 1 ? 'PASS' : 'FAIL'} ${s.name}: ${n} 段${old ? `（修改前 ${count(old, s)} 段）` : ''}`);
}
const roots = r => new Set(r.segs.filter(s => s.net >= 0).map(s => s.net)).size;
console.log(`線路網：${old ? roots(old) + ' → ' : ''}${roots(neu)}`);
if (old) {
  // 新線路網 → { 舊線路網 → 落在其中的舊線段 }
  const key = s => [s.x0, s.y0, s.x1, s.y1].join();
  const om = new Map(old.segs.map(s => [key(s), s])), grp = new Map();
  for (const s of neu.segs) {
    const o = s.net >= 0 && om.get(key(s)); if (!o || o.net < 0) continue;
    if (!grp.has(s.net)) grp.set(s.net, new Map());
    const g = grp.get(s.net); if (!g.has(o.net)) g.set(o.net, []); g.get(o.net).push(o);
  }
  // 兩組線段之間最近的位置（線段是水平或垂直的矩形，取間隙中點）
  const gap = (A, B) => {
    let best = null;
    for (const a of A) for (const b of B) {
      const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1), d = Math.hypot(dx, dy);
      if (best && d >= best.d) continue;
      const mid = (a0, a1, b0, b1) => Math.round(a1 < b0 ? (a1 + b0) / 2 : b1 < a0 ? (b1 + a0) / 2 : (Math.max(a0, b0) + Math.min(a1, b1)) / 2);
      best = { d, x: mid(a.x0, a.x1, b.x0, b.x1), y: mid(a.y0, a.y1, b.y0, b.y1) };
    }
    return best;
  };
  for (const m of grp.values()) if (m.size > 1) {
    const groups = [...m.values()], codes = groups.map(g => g[0].netCode ?? '未標色');
    const warn = new Set(codes).size > 1 || codes.includes('未標色') ? '⚠ ' : '';
    const joints = groups.slice(1).map(g => { const p = gap(groups[0], g); return `(${p.x}, ${p.y}) 距 ${p.d.toFixed(0)} px`; });
    console.log(`${warn}新合併 ${codes.join(' + ')}  接點：${joints.join('；')}`);
  }
}
process.exitCode = ok ? 0 : 1;
