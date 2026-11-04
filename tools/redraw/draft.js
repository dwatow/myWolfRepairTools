// 把影像辨識結果（js/nets.js 的 analyzeNets＋fixes 的 cables）轉成 drawing.js 的草稿資料
// 純函式：netsToDrawing(r, { W, H, image, components, fixes }) -> { drawing, dropped }
//   r = { segs, label }：label 已清掉 staticAreas 與元件名稱範圍（同 lib.analyze）
//   dropped：整批例外（所有線段都在某個元件框內，視為元件符號或文字筆畫）的舊線路根編號
//   outlines：粗電纜雙線外框沒被電纜路徑蓋到的殘段（未標色、整條在電纜範圍外擴 OUTLINE_PAD 內），不畫
const MERGE_OFF = 2;   // 共線合併：中心座標差 ≤ 2 px
const MERGE_GAP = 2;   // 共線合併：間隙 ≤ 2 px
const SNAP = 6;        // 端點吸附到同線路垂直方向線段的距離
const DOT_END = 3;     // T 字：端點距另一段兩端都 ≥ 3 px 才算落在內部
const FIX_DOT = 8;     // fixes.dots 投影到中心線的最大距離
const BOX_PAD = 14;    // 元件框外擴（同 app.js 的 buildComponents）
const CABLE_ROOT = 10000000;
const CABLE_HALF = 7;  // 同 app.js 的 CABLE_HALF
const OUTLINE_PAD = 20; // 電纜外框殘段：電纜範圍（半寬）再外擴幾 px（外框圓角會超出路徑末端約 10～25 px）

function netsToDrawing(r, { W, H, image, components = [], fixes = {} }) {
  const K = W / 1800;
  // 有像素的線路根，以及每條的平均顏色
  const sum = new Map();
  for (let i = 0; i < r.label.length; i++) {
    const k = r.label[i]; if (k < 0) continue;
    let s = sum.get(k); if (!s) sum.set(k, s = [0, 0, 0, 0]);
    s[0] += image.data[i * 4]; s[1] += image.data[i * 4 + 1]; s[2] += image.data[i * 4 + 2]; s[3]++;
  }
  const byNet = new Map();
  for (const s of r.segs) if (s.net >= 0 && sum.has(s.net)) { if (!byNet.has(s.net)) byNet.set(s.net, []); byNet.get(s.net).push(s); }
  const boxes = components.map(c => c.box.map(v => v * K)).map(([a, b, c, d]) => [a - BOX_PAD, b - BOX_PAD, c + BOX_PAD, d + BOX_PAD]);
  const cableRects = (fixes.cables || []).flatMap(c => c.path.slice(1).map((q, j) => {
    const p = c.path[j], h = (c.half ?? CABLE_HALF) + OUTLINE_PAD;
    return [Math.min(p[0], q[0]) - h, Math.min(p[1], q[1]) - h, Math.max(p[0], q[0]) + h, Math.max(p[1], q[1]) + h];
  }));
  const inCable = s => cableRects.some(([a, b, c, d]) => s.x0 >= a && s.x1 <= c && s.y0 >= b && s.y1 <= d);
  const inBox = s => boxes.some(([a, b, c, d]) => s.x0 >= a && s.x1 <= c && s.y0 >= b && s.y1 <= d);

  // 3 點以上的人工連線折線，依起點所在的線路歸入
  const extra = new Map();
  for (const path of fixes.links || []) {
    if (path.length < 3) continue;
    const [x, y] = path[0], k = rootNear(r.label, W, H, x, y);
    if (k < 0) continue;
    if (!extra.has(k)) extra.set(k, []); extra.get(k).push(path);
  }

  const nets = [], dropped = [], outlines = [], solid = solidAt(image);
  for (const root of [...byNet.keys()].sort((a, b) => a - b)) {
    const segs = byNet.get(root);
    const code = segs.find(s => s.netCode)?.netCode ?? null;
    if (root >= CABLE_ROOT) {
      const c = (fixes.cables || [])[root - CABLE_ROOT];
      const net = { code: c.code ?? code, cable: true };
      if (c.half !== undefined) net.half = c.half;
      net.ground = !!c.ground || net.code === 'G';
      net.wires = [c.path]; net.dots = [];
      nets.push(net); continue;
    }
    if (segs.every(inBox)) { dropped.push(root); continue; }
    if (code === null && segs.every(inCable)) { outlines.push(root); continue; }
    const [R, G, B, n] = sum.get(root).map((v, i, a) => i < 3 ? v / a[3] : v);
    const ground = segs.some(s => s.ground) || code === 'G' || (code === null && G > R + 25 && G > B + 15);
    const { hs, vs } = centerlines(segs);
    snap(hs, vs); snap(vs, hs);
    const lines = [...hs.map(l => [[l.a, l.c], [l.b, l.c]]), ...vs.map(l => [[l.c, l.a], [l.c, l.b]])];
    const dots = junctions(hs, vs, solid);
    for (const [x, y] of fixes.dots || []) {
      const p = project(hs, vs, x, y); if (p && !dots.some(d => d[0] === p[0] && d[1] === p[1])) dots.push(p);
    }
    nets.push({ code, ground, wires: [...lines, ...(extra.get(root) || [])], dots });
  }
  return { drawing: { size: [W, H], nets, connectors: [], inline: [], labels: [], texts: [] }, dropped, outlines };
}

// 某點 ±2 px 內的線路根
function rootNear(label, W, H, x, y) {
  for (let d = 0; d <= 2; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
    const k = label[yy * W + xx]; if (k >= 0) return k;
  }
  return -1;
}

// 線段 → 中心線 { c: 中心座標, a, b: 沿線範圍, len }，並合併共線的
function centerlines(segs) {
  const hs = [], vs = [];
  for (const s of segs) {
    if (s.h) hs.push({ c: Math.round((s.y0 + s.y1) / 2), a: s.x0, b: s.x1 });
    else vs.push({ c: Math.round((s.x0 + s.x1) / 2), a: s.y0, b: s.y1 });
  }
  return { hs: merge(hs), vs: merge(vs) };
}
function merge(ls) {
  for (const l of ls) l.len = l.b - l.a;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < ls.length && !changed; i++) for (let j = i + 1; j < ls.length && !changed; j++) {
      const p = ls[i], q = ls[j];
      if (Math.abs(p.c - q.c) > MERGE_OFF || q.a > p.b + MERGE_GAP || q.b < p.a - MERGE_GAP) continue;
      const c = p.len >= q.len ? p.c : q.c;
      ls[i] = { c, a: Math.min(p.a, q.a), b: Math.max(p.b, q.b), len: Math.max(p.len, q.len) }; ls.splice(j, 1); changed = true;
    }
  }
  return ls;
}
// 端點吸附：lines 的端點靠近垂直方向的 other 線時，移到它的中心線上，並把它延伸到端點的位置
function snap(lines, other) {
  for (const l of lines) for (const end of ['a', 'b']) {
    const t = other.find(o => Math.abs(o.c - l[end]) <= SNAP && l.c >= o.a - SNAP && l.c <= o.b + SNAP);
    if (!t) continue;
    l[end] = t.c;
    if (l.c < t.a) t.a = l.c; if (l.c > t.b) t.b = l.c;
  }
}
// 接點：一段的端點落在另一段內部（T 字）；兩段都穿過交會點（十字）時，原圖該處要有實心圓點才算
function junctions(hs, vs, solid) {
  const out = [], add = (x, y) => { if (!out.some(d => d[0] === x && d[1] === y)) out.push([x, y]); };
  const inside = (l, v) => v >= l.a + DOT_END && v <= l.b - DOT_END;
  const on = (l, v) => v >= l.a && v <= l.b;
  for (const h of hs) for (const v of vs) {
    if (!on(h, v.c) || !on(v, h.c)) continue;
    const ih = inside(h, v.c), iv = inside(v, h.c);
    if (ih !== iv || (ih && iv && solid(v.c, h.c))) add(v.c, h.c);
  }
  return out;
}
// 原圖在 (x, y) 半徑 3 內的深色像素比例 ≥ 0.8（同 js/nets.js 的 dotFill）
function solidAt(image) {
  return (x, y) => {
    let n = 0, t = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 9) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) continue;
      const p = (yy * image.width + xx) * 4, d = image.data;
      t++; if (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2] < 185 || Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]) > 70) n++;
    }
    return t > 0 && n / t >= 0.8;
  };
}
// 把 fixes.dots 的點投影到最近的中心線上（距離 ≤ FIX_DOT）
function project(hs, vs, x, y) {
  let best = null, bd = FIX_DOT + 1;
  for (const h of hs) if (x >= h.a && x <= h.b && Math.abs(y - h.c) < bd) { bd = Math.abs(y - h.c); best = [x, h.c]; }
  for (const v of vs) if (y >= v.a && y <= v.b && Math.abs(x - v.c) < bd) { bd = Math.abs(x - v.c); best = [v.c, y]; }
  return best;
}

module.exports = { netsToDrawing };
