// 從原圖萃取導線上的標記（線色文字、單線接頭、多腳接頭），產生 drawing.js 的 labels／inline／connectors 草稿
// 純函式，Node 用。image = { data: RGBA, width, height }；label = 新圖點陣化的 label（導線範圍 >= 0）
const MIN_AREA = 6;               // 小於這個面積的墨水塊忽略（雜點）
const JOIN_X = 8, JOIN_Y = 6;     // 相距在此以內的塊併成一個標記（字母之間）
const NEAR = 12;                  // 文字外框外擴多少 px 內找導線
const ALIGN = 8;                  // 文字中心和導線中心線的最大偏移
const CHAR_MIN = 9, CHAR_MAX = 17; // 每個字元沿書寫方向的寬度範圍（px）

const isInk = (d, p) => { const r = d[p], g = d[p + 1], b = d[p + 2]; return 0.299 * r + 0.587 * g + 0.114 * b < 185 || Math.max(r, g, b) - Math.min(r, g, b) > 70; };

// 不屬於導線（label < 0）、不在 skip 矩形內的墨水連通塊，鄰近的併成一個標記
function findMarks({ image, label, skip = [] }) {
  const { width: W, height: H, data } = image, seen = new Uint8Array(W * H), blobs = [];
  const skipped = (x, y) => skip.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
  const free = i => isInk(data, i * 4) && label[i] < 0;
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || !free(i)) continue;
    seen[i] = 1;
    if (skipped(i % W, (i / W) | 0)) continue;
    const st = [i], b = { x0: W, y0: H, x1: 0, y1: 0, n: 0 };
    while (st.length) {
      const p = st.pop(), x = p % W, y = (p / W) | 0; b.n++;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) if (q >= 0 && q < W * H && !seen[q] && free(q)) { seen[q] = 1; st.push(q); }
    }
    if (b.n >= MIN_AREA) blobs.push(b);
  }
  const par = blobs.map((_, i) => i), f = i => par[i] === i ? i : (par[i] = f(par[i]));
  for (let i = 0; i < blobs.length; i++) for (let j = i + 1; j < blobs.length; j++) {
    const a = blobs[i], c = blobs[j];
    if (a.x0 - JOIN_X <= c.x1 && c.x0 - JOIN_X <= a.x1 && a.y0 - JOIN_Y <= c.y1 && c.y0 - JOIN_Y <= a.y1) par[f(i)] = f(j);
  }
  const out = new Map();
  blobs.forEach((b, i) => {
    const r = f(i), m = out.get(r) || { x0: W, y0: H, x1: 0, y1: 0, n: 0, parts: 0 };
    m.x0 = Math.min(m.x0, b.x0); m.y0 = Math.min(m.y0, b.y0); m.x1 = Math.max(m.x1, b.x1); m.y1 = Math.max(m.y1, b.y1); m.n += b.n; m.parts++;
    out.set(r, m);
  });
  return [...out.values()].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

// 分類：{ kind: 'plug' | 'socket' | 'text' | 'connector' | 'other', dir?, flip? }
function classify(m, image, label) {
  const { width: W, data } = image, w = m.x1 - m.x0 + 1, h = m.y1 - m.y0 + 1;
  const long = Math.max(w, h), short = Math.min(w, h), dir = w >= h ? 'h' : 'v';
  const at = (x, y) => isInk(data, (y * W + x) * 4) && label[y * W + x] < 0 ? 1 : 0;
  let ink = 0; for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) ink += at(x, y);
  const ratio = ink / (w * h);
  // 沿長邊每一欄（列）的墨水跨度（最上到最下的距離）
  const spans = [];
  for (let t = 0; t < long; t++) {
    let lo = -1, hi = -1;
    for (let s = 0; s < short; s++) {
      const v = dir === 'h' ? at(m.x0 + t, m.y0 + s) : at(m.x0 + s, m.y0 + t);
      if (v) { if (lo < 0) lo = s; hi = s; }
    }
    spans.push(lo < 0 ? 0 : hi - lo + 1);
  }
  if (m.parts === 1 && long >= 24 && long <= 40 && short >= 16 && short <= 36 && ratio < 0.35) {
    let dec = 0, inc = 0;
    for (let t = 1; t < spans.length; t++) { if (spans[t] < spans[t - 1]) dec++; else if (spans[t] > spans[t - 1]) inc++; }
    const first = spans.slice(0, 3).reduce((a, b) => a + b, 0), last = spans.slice(-3).reduce((a, b) => a + b, 0);
    if (Math.max(dec, inc) >= 3 * Math.min(dec, inc) + 3) return { kind: 'plug', dir, flip: last > first };
  }
  if (long >= 38 && long <= 52 && short >= 16 && short <= 26) {
    // 外框四邊都有墨水、中央一列在兩端之間還有內框的墨水
    const rowFill = y => { let n = 0; for (let x = m.x0; x <= m.x1; x++) n += at(x, y); return n / w; };
    const colFill = x => { let n = 0; for (let y = m.y0; y <= m.y1; y++) n += at(x, y); return n / h; };
    const edges = dir === 'h' ? [rowFill(m.y0), rowFill(m.y1), colFill(m.x0), colFill(m.x1)] : [colFill(m.x0), colFill(m.x1), rowFill(m.y0), rowFill(m.y1)];
    if (edges.every(v => v > 0.6) && ratio < 0.6) return { kind: 'socket', dir };
  }
  if (long >= 60) return { kind: 'connector', dir };
  if (short <= 34) return { kind: 'text' };
  return { kind: 'other' };
}

// 標記 → drawing 欄位；文字依相鄰導線的線色填字，無法確定的放進 review
function attach(marks, drawing, image, label) {
  const segs = [];
  drawing.nets.forEach((n, k) => { for (const w of n.wires || []) for (let j = 1; j < w.length; j++) segs.push({ k, h: w[j][1] === w[j - 1][1], a: w[j - 1], b: w[j] }); });
  const labels = [], inline = [], connectors = [], review = [];
  const center = m => [Math.round((m.x0 + m.x1) / 2), Math.round((m.y0 + m.y1) / 2)];
  // 和文字共線（中心偏移 ≤ ALIGN）、在外框外擴 NEAR 內的最近導線
  const nearest = m => {
    const [cx, cy] = center(m); let best = null, bd = Infinity;
    for (const s of segs) {
      const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]);
      if (s.h ? Math.abs(y0 - cy) > ALIGN : Math.abs(x0 - cx) > ALIGN) continue;
      const dx = Math.max(0, x0 - m.x1, m.x0 - x1), dy = Math.max(0, y0 - m.y1, m.y0 - y1), d = Math.hypot(dx, dy);
      if (d <= NEAR && d < bd) { bd = d; best = s; }
    }
    return best;
  };
  for (const m of marks) {
    const c = classify(m, image, label), at = center(m), box = [m.x0, m.y0, m.x1, m.y1];
    if (c.kind === 'plug') inline.push(c.flip ? { kind: 'plug', at, dir: c.dir, flip: true } : { kind: 'plug', at, dir: c.dir });
    else if (c.kind === 'socket') inline.push({ kind: 'socket', at, dir: c.dir });
    else if (c.kind === 'connector') { connectors.push({ label: null, box }); review.push({ box, kind: 'connector', reason: '多腳接頭：接腳數字要看原圖' }); }
    else if (c.kind === 'other') review.push({ box, kind: 'other', reason: '分不出是哪種標記' });
    else {
      const s = nearest(m);
      if (!s) { review.push({ box, kind: 'text', reason: '附近找不到共線的導線' }); continue; }
      const code = drawing.nets[s.k].code, vertical = !s.h;
      if (!code) { review.push({ box, kind: 'text', net: s.k, vertical, reason: '導線沒有線色' }); continue; }
      const len = vertical ? m.y1 - m.y0 + 1 : m.x1 - m.x0 + 1, n = code.length;
      if (len < CHAR_MIN * n || len > CHAR_MAX * n) { review.push({ box, kind: 'text', net: s.k, vertical, code, reason: `寬度 ${len} px 和線色 ${code}（${n} 字）不符` }); continue; }
      labels.push({ text: code, at, vertical });
    }
  }
  return { labels, inline, connectors, review };
}

module.exports = { findMarks, classify, attach };
