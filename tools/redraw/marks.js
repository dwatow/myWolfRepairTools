// 從原圖萃取導線上的標記（線色文字、單線接頭、多腳接頭），產生 drawing.js 的 labels／inline／connectors 草稿
// 純函式，Node 用。image = { data: RGBA, width, height }；label = 新圖點陣化的 label（導線範圍 >= 0）
const MIN_AREA = 6;               // 小於這個面積的墨水塊忽略（雜點）
const JOIN_X = 8, JOIN_Y = 6;     // 相距在此以內的塊併成一個標記（字母之間）
const NEAR = 24;                  // 文字外框外擴多少 px 內找導線（單字母離導線端點約 20 px）
const ALIGN = 8;                  // 文字中心和導線中心線的最大偏移
const CHAR_MIN = 9, CHAR_MAX = 17; // 每個字元沿書寫方向的寬度範圍（px）

const isInk = (d, p) => { const r = d[p], g = d[p + 1], b = d[p + 2]; return 0.299 * r + 0.587 * g + 0.114 * b < 185 || Math.max(r, g, b) - Math.min(r, g, b) > 70; };

// 不屬於導線（label < 0）、不在 skip 矩形內的墨水連通塊，鄰近的併成一個標記
// bigNoJoin：長邊超過這個值的塊（外框、長線）不和別的塊合併（元件判讀用，免得框內所有字被併成一塊）
function findMarks({ image, label, skip = [], bigNoJoin = Infinity }) {
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
    if (Math.max(a.x1 - a.x0, a.y1 - a.y0) > bigNoJoin || Math.max(c.x1 - c.x0, c.y1 - c.y0) > bigNoJoin) continue;
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

// 分類：{ kind: 'plug' | 'socket' | 'pair' | 'line' | 'text' | 'connector' | 'other', dir?, flip?, socketFirst? }
//   pair：三角形公端接母端併成一塊；line：細線碎片（元件名稱底線、被導線切斷的接頭外框），不畫
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
  if (short <= 3) return { kind: 'line' };
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
  if (long >= 66 && long <= 100 && short >= 16 && short <= 26) {
    // 母端的外框邊緣（第一列）整段都是墨水，三角形只有底邊一點：比較兩端 20 欄的邊緣墨水量
    const edge = t => dir === 'h' ? at(m.x0 + t, m.y0) + at(m.x0 + t, m.y1) : at(m.x0, m.y0 + t) + at(m.x1, m.y0 + t);
    let a = 0, b = 0; for (let t = 0; t < 20; t++) { a += edge(t); b += edge(long - 1 - t); }
    return { kind: 'pair', dir, socketFirst: a > b };
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
    if (c.kind === 'line') continue;
    if (c.kind === 'pair') {
      const h = c.dir === 'h', a0 = h ? m.x0 : m.y0, a1 = h ? m.x1 : m.y1, cross = h ? at[1] : at[0];
      const pt = v => h ? [v, cross] : [cross, v], P = 15, S = 22; // 三角形、母端沿線方向的半長
      if (c.socketFirst) inline.push({ kind: 'socket', at: pt(a0 + S), dir: c.dir }, { kind: 'plug', at: pt(a1 - P), dir: c.dir, flip: true });
      else inline.push({ kind: 'plug', at: pt(a0 + P), dir: c.dir }, { kind: 'socket', at: pt(a1 - S), dir: c.dir });
      continue;
    }
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

// drawing.js 第一行含「// 已手改」時，產生工具（bootstrap.js、add-marks.js）不覆寫，除非加 --force
function assertDraft(text, force) {
  if (!force && /^\/\/ 已手改/.test(text)) throw new Error('drawing.js 已手改，產生工具不會覆寫；確定要重產請加 --force');
}

// 文字與單線接頭所在的導線切開留缺口（同原圖；舊辨識把字母的橫筆畫連進了線段）
// 文字大小以 basemap.js 的粗體 21px 估計：每字 14 px、「/」7 px，高 16，沿線方向兩側再留 CUT_PAD；
// plug 30×22、socket 45×21 不留白（同原圖，導線直接接到接頭邊緣）；多腳接頭方框切到框邊。markRects 回傳 [x0, y0, x1, y1, 留白]
const CUT_PAD = 6, MIN_PIECE = 6;
function markRects(d) {
  const rects = [];
  for (const l of d.labels || []) {
    const w = [...l.text].reduce((a, ch) => a + (ch === '/' ? 7 : 14), 0), h = 16;
    const [hw, hh] = l.vertical ? [h / 2, w / 2] : [w / 2, h / 2];
    rects.push([...[l.at[0] - hw, l.at[1] - hh, l.at[0] + hw, l.at[1] + hh].map(Math.round), CUT_PAD]);
  }
  for (const m of d.inline || []) {
    const [len, wid] = m.kind === 'plug' ? [30, 22] : [45, 21], [hw, hh] = m.dir === 'v' ? [wid / 2, len / 2] : [len / 2, wid / 2];
    rects.push([...[m.at[0] - hw, m.at[1] - hh, m.at[0] + hw, m.at[1] + hh].map(Math.round), 0]);
  }
  // 多腳接頭方框（導線上的與元件上的）：框內的導線切掉，導線停在框邊線上（留白 −1 = 切到框邊為止）
  for (const c of [...(d.connectors || []), ...(d.parts || []).filter(p => p.type === 'connector')]) rects.push([...c.box, -1]);
  return rects;
}
function cutWires(d) {
  const rects = markRects(d);
  for (const net of d.nets) {
    if (net.cable) continue;
    const out = [];
    for (const wire of net.wires) {
      const segs = wire.slice(1).map((b, j) => [wire[j], b]);
      const hit = segs.some(([a, b]) => rects.some(r => crosses(a, b, r)));
      if (!hit) { out.push(wire); continue; }
      for (const [a, b] of segs) {
        const h = a[1] === b[1], c = h ? a[1] : a[0];
        let pieces = [[Math.min(h ? a[0] : a[1], h ? b[0] : b[1]), Math.max(h ? a[0] : a[1], h ? b[0] : b[1])]];
        for (const r of rects) {
          const [lo, hi, c0, c1] = h ? [r[0], r[2], r[1], r[3]] : [r[1], r[3], r[0], r[2]];
          if (c < c0 || c > c1) continue;
          const pad = r[4];
          pieces = pieces.flatMap(([p, q]) => q < lo - pad || p > hi + pad ? [[p, q]] : [[p, lo - pad - 1], [hi + pad + 1, q]].filter(([u, v]) => v >= u));
        }
        for (const [p, q] of pieces) if (q - p >= MIN_PIECE) out.push(h ? [[p, c], [q, c]] : [[c, p], [c, q]]);
      }
    }
    net.wires = out;
  }
  return d;
}
// 線段 a→b 沿著自己的方向穿過矩形 r（中心線落在矩形的橫向範圍內）
function crosses(a, b, r) {
  const h = a[1] === b[1];
  if (h) return a[1] >= r[1] && a[1] <= r[3] && Math.max(a[0], b[0]) >= r[0] && Math.min(a[0], b[0]) <= r[2];
  return a[0] >= r[0] && a[0] <= r[2] && Math.max(a[1], b[1]) >= r[1] && Math.min(a[1], b[1]) <= r[3];
}

// 未標色、所有折線點都在標記或接頭外框（外擴 STROKE_PAD）內的線路：是接頭符號的筆畫，不是導線，從 nets 移除；沒有導線的未標色線路也移除。回傳移除幾條
const STROKE_PAD = 4;
function strokeRects(d) {
  return [...markRects(d).map(r => r.slice(0, 4)), ...(d.connectors || []).map(c => c.box)].map(([a, b, c, e]) => [a - STROKE_PAD, b - STROKE_PAD, c + STROKE_PAD, e + STROKE_PAD]);
}
function dropMarkStrokes(d) {
  const rects = strokeRects(d), n0 = d.nets.length;
  // 每一段都要整段落在同一個框內（同 compare.js 的標記筆畫判斷），兩端各在一個框、中段在外的不算
  const segIn = (p, q) => rects.some(([a, b, c, e]) => Math.min(p[0], q[0]) >= a && Math.max(p[0], q[0]) <= c && Math.min(p[1], q[1]) >= b && Math.max(p[1], q[1]) <= e);
  const wireIn = w => w.length === 1 ? segIn(w[0], w[0]) : w.slice(1).every((q, j) => segIn(w[j], q));
  // 切缺口後一段都不剩的（文字、接頭之間的短線）也移除
  d.nets = d.nets.filter(n => n.code !== null || n.cable || !(!n.wires.length || n.wires.every(wireIn)));
  return n0 - d.nets.length;
}

module.exports = { findMarks, classify, attach, assertDraft, cutWires, markRects, strokeRects, dropMarkStrokes };
