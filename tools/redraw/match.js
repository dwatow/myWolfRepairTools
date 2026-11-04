// 新舊線路網比對：每條舊線路網取每段的中點，查它在新 label 裡屬於哪條線路
// matchNets({ oldSegs, oldLabel, newLabel, W }) -> { map: Map<舊根, 新編號>, splits, merges, missing, partial }
//   splits：一條舊線路落在 2 條以上新線路；merges：2 條以上舊線路落在同一條新線路
//   missing：整條沒畫到；partial：有對到新線路，但其中某段的中點沒畫到。at 是可拿去 crop 的座標
function matchNets({ oldSegs, oldLabel, newLabel, W }) {
  const H = oldLabel.length / W;
  // 某點 ±1 px 內出現最多的非 -1 值
  const near = (lab, x, y) => {
    const c = new Map();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = lab[yy * W + xx]; if (k >= 0) c.set(k, (c.get(k) || 0) + 1);
    }
    let best = -1, n = 0; for (const [k, v] of c) if (v > n) { best = k; n = v; }
    return best;
  };
  // 沿這段中心線取樣，新 label 中出現最多的值（避開交叉處落到別條線）；中點附近完全沒畫到時回傳 -1
  const along = s => {
    const c = new Map(), cx = (s.x0 + s.x1) >> 1, cy = (s.y0 + s.y1) >> 1;
    const n = Math.max(s.x1 - s.x0, s.y1 - s.y0);
    for (let t = 0; t <= n; t++) {
      const x = s.h ? s.x0 + t : cx, y = s.h ? cy : s.y0 + t;
      if (oldLabel[y * W + x] !== s.net && near(oldLabel, x, y) !== s.net) continue;
      const k = near(newLabel, x, y); if (k >= 0) c.set(k, (c.get(k) || 0) + 1);
    }
    if (near(newLabel, cx, cy) < 0 && ![...c.values()].some(v => v > n / 2)) return -1;
    let best = -1, m = 0; for (const [k, v] of c) if (v > m) { best = k; m = v; }
    return best;
  };
  const byOld = new Map();
  for (const s of oldSegs) {
    if (s.net < 0) continue;
    const x = (s.x0 + s.x1) >> 1, y = (s.y0 + s.y1) >> 1;
    if (near(oldLabel, x, y) !== s.net) continue; // 這段已被清掉（名稱範圍、固定區域）或被別條蓋過
    if (!byOld.has(s.net)) byOld.set(s.net, []);
    byOld.get(s.net).push([x, y, along(s)]);
  }
  const map = new Map(), splits = [], missing = [], partial = [], olds = new Map();
  for (const old of [...byOld.keys()].sort((a, b) => a - b)) {
    const pts = byOld.get(old), news = [...new Set(pts.map(p => p[2]).filter(k => k >= 0))].sort((a, b) => a - b);
    if (!news.length) { missing.push({ old, at: pts[0].slice(0, 2) }); continue; }
    for (const p of pts) if (p[2] < 0) partial.push({ old, at: p.slice(0, 2) });
    if (news.length > 1) {
      const at = news.map(k => pts.find(p => p[2] === k).slice(0, 2));
      splits.push({ old, news, at }); continue;
    }
    map.set(old, news[0]);
    if (!olds.has(news[0])) olds.set(news[0], []); olds.get(news[0]).push(old);
  }
  const merges = [...olds].filter(([, o]) => o.length > 1).map(([news, o]) => ({ news, olds: o, at: byOld.get(o[0])[0].slice(0, 2) }));
  return { map, splits, merges, missing, partial };
}
module.exports = { matchNets };
