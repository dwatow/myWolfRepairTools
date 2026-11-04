// 線路圖資料（data/<圖>/drawing.js 的 WOLF_DRAWING）點陣化：每個像素屬於哪條線路網
// 純函式，Node 與瀏覽器共用。nets 的陣列順序就是線路編號。
// 回傳 label（點擊用，-1 = 不屬於任何線路）、cores[k]（線路 k 的線芯＋圓點像素索引，上色用）、segs（每段折線）
function rasterizeDrawing(drawing, opt = {}) {
  const [W, H] = drawing.size;
  const core = opt.core ?? 1;           // 線芯半寬（px）：亮線、上色的粗細
  const hit = opt.hit ?? 3;             // 點擊帶半寬（px）：已存的座標偏離線芯幾 px 也找得到
  const dot = opt.dot ?? 4;             // 接點圓點半徑（px）
  const cableHalf = opt.cableHalf ?? 7; // 粗電纜預設半寬（px），個別電纜可用 half 覆寫
  const label = new Int32Array(W * H).fill(-1), segs = [];

  const trim = opt.trim ?? 2;           // 自由端（導線接到零件、沒接其他導線）的線芯縮短幾 px：上色時往外擴的外框剛好切齊端點
  // 先檢查折線並整理成線段（點擊帶與 segs 用原始折線；線芯用 wireGeometry 的圓角幾何）
  drawing.nets.forEach((net, k) => {
    (net.wires || []).forEach((wire, wi) => {
      for (let j = 1; j < wire.length; j++) {
        const a = wire[j - 1], b = wire[j];
        if (a[0] !== b[0] && a[1] !== b[1])
          throw new Error(`drawing.js 第 ${k} 條線路網（從 0 起算）的折線必須是水平或垂直：${JSON.stringify([a, b])}`);
        segs.push({ h: a[1] === b[1], x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]), net: k, ch: net.cable ? net.half ?? cableHalf : 0 });
      }
    });
    // 一般線路網另帶的粗電纜（例：保險絲紅線與電瓶正極電纜是同一條線路）
    for (const c of net.cables || []) for (let j = 1; j < c.path.length; j++) {
      const a = c.path[j - 1], b = c.path[j];
      segs.push({ h: a[1] === b[1], x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]), net: k, ch: c.half ?? cableHalf });
    }
  });
  const half = (s, normal) => s.ch || normal; // 電纜段的線芯與點擊帶都是電纜半寬
  // 矩形內的像素逐一交給 fn
  const rect = (x0, y0, x1, y1, fn) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) fn(y * W + x);
  };
  // 1. 所有線路的點擊帶；2. 所有線芯與圓點覆蓋在上面（無圓點的交叉處，點擊帶不會蓋掉另一條的線芯）
  for (const s of segs) { const r = half(s, hit); rect(s.x0 - r, s.y0 - r, s.x1 + r, s.y1 + r, i => { label[i] = s.net; }); }
  const lists = drawing.nets.map(() => []);
  // 電纜段：整寬都是線芯
  for (const s of segs) if (s.ch) rect(s.x0 - s.ch, s.y0 - s.ch, s.x1 + s.ch, s.y1 + s.ch, i => { label[i] = s.net; lists[s.net].push(i); });
  // 一般導線：照 wireGeometry 的直線段與轉角圓弧。自由端往內縮 trim；接到別段（T 字、交叉）的那端外擴 core 補滿；轉角端接圓弧不外擴
  const geo = wireGeometry(drawing, opt.round ?? 6);
  for (const g of geo.lines) {
    const fwd = g.a[0] + g.a[1] <= g.b[0] + g.b[1], [a, b] = fwd ? [g.a, g.b] : [g.b, g.a], ends = fwd ? g.ends : [g.ends[1], g.ends[0]]; // a 為座標較小端
    const h = a[1] === b[1], len = h ? b[0] - a[0] : b[1] - a[1], cut = len > 2 * trim + 2;
    const off = e => e === 'free' ? (cut ? trim : 0) : e === 'joint' ? -core : 0;
    const lo = off(ends[0]), hi = off(ends[1]);
    const box = h ? [a[0] + lo, a[1] - core, b[0] - hi, b[1] + core] : [a[0] - core, a[1] + lo, b[0] + core, b[1] - hi];
    rect(...box, i => { label[i] = g.net; lists[g.net].push(i); });
  }
  for (const g of geo.arcs) {
    const steps = Math.ceil(Math.abs(g.sweep) * g.r) + 2;
    for (let t = 0; t <= steps; t++) {
      const ang = g.a0 + g.sweep * t / steps, x = Math.round(g.c[0] + g.r * Math.cos(ang)), y = Math.round(g.c[1] + g.r * Math.sin(ang));
      rect(x - core, y - core, x + core, y + core, i => { label[i] = g.net; lists[g.net].push(i); });
    }
  }
  drawing.nets.forEach((net, k) => {
    for (const [cx, cy] of net.dots || [])
      rect(cx - dot, cy - dot, cx + dot, cy + dot, i => {
        const dx = (i % W) - cx, dy = ((i / W) | 0) - cy;
        if (dx * dx + dy * dy <= dot * dot) { label[i] = k; lists[k].push(i); }
      });
  });
  const cores = lists.map(L => Int32Array.from(new Set(L)).sort());
  return { label, cores, segs: segs.map(({ ch, ...s }) => s) }; // ch（電纜半寬）只在內部用
}

// 一般導線（非電纜）的繪製幾何：每條線路的折線拆成直線段，同線路兩段在端點相接且互相垂直（沒有第三段、沒有接點圓點）時，
// 轉角改成半徑 R 的圓弧（線段太短時縮小半徑，小於 3 px 就維持直角）。
// 回傳 { lines: [{ net, a, b, ends: [頭, 尾] }], arcs: [{ net, c, r, a0, sweep }] }；ends 為 'free'（自由端）／'joint'（接到別段）／'corner'（接圓弧）
function wireGeometry(drawing, R = 6) {
  const lines = [], arcs = [];
  drawing.nets.forEach((net, k) => {
    if (net.cable) return;
    const segs = [];
    for (const w of net.wires || []) for (let j = 1; j < w.length; j++) segs.push({ a: w[j - 1].slice(), b: w[j].slice() });
    const key = p => p[0] + ',' + p[1], at = new Map();
    segs.forEach((s, i) => ['a', 'b'].forEach(e => { const kk = key(s[e]); if (!at.has(kk)) at.set(kk, []); at.get(kk).push([i, e]); }));
    const dots = net.dots || [];
    const hasDot = p => dots.some(d => Math.abs(d[0] - p[0]) <= 1 && Math.abs(d[1] - p[1]) <= 1);
    // p 落在其他段的內部或端點旁（容許 1 px，不含 skip 那幾段）
    const touches = (p, skip) => segs.some((s, i) => !skip.includes(i) && p[0] >= Math.min(s.a[0], s.b[0]) - 1 && p[0] <= Math.max(s.a[0], s.b[0]) + 1 && p[1] >= Math.min(s.a[1], s.b[1]) - 1 && p[1] <= Math.max(s.a[1], s.b[1]) + 1);
    const ends = segs.map(() => ({ a: 'joint', b: 'joint' })), orig = segs.map(s => ({ a: s.a.slice(), b: s.b.slice() }));
    for (const [kk, list] of at) {
      const p = kk.split(',').map(Number), idx = list.map(x => x[0]);
      if (hasDot(p)) continue;
      if (list.length === 1 && !touches(p, idx)) { ends[idx[0]][list[0][1]] = 'free'; continue; }
      if (list.length !== 2 || touches(p, idx)) continue;
      const [[i, ei], [j, ej]] = list, oi = ei === 'a' ? 'b' : 'a', oj = ej === 'a' ? 'b' : 'a';
      const qa = orig[i][oi], qb = orig[j][oj];
      const ua = [Math.sign(qa[0] - p[0]), Math.sign(qa[1] - p[1])], ub = [Math.sign(qb[0] - p[0]), Math.sign(qb[1] - p[1])];
      if (ua[0] * ub[0] + ua[1] * ub[1] !== 0) continue; // 不垂直（同向接續）
      const la = Math.abs(qa[0] - p[0]) + Math.abs(qa[1] - p[1]), lb = Math.abs(qb[0] - p[0]) + Math.abs(qb[1] - p[1]);
      const r = Math.min(R, Math.floor(la / 2), Math.floor(lb / 2));
      if (r < 3) continue;
      segs[i][ei] = [p[0] + r * ua[0], p[1] + r * ua[1]]; segs[j][ej] = [p[0] + r * ub[0], p[1] + r * ub[1]];
      ends[i][ei] = ends[j][ej] = 'corner';
      const c = [p[0] + r * (ua[0] + ub[0]), p[1] + r * (ua[1] + ub[1])];
      const a0 = Math.atan2(segs[i][ei][1] - c[1], segs[i][ei][0] - c[0]), a1 = Math.atan2(segs[j][ej][1] - c[1], segs[j][ej][0] - c[0]);
      let sweep = a1 - a0; while (sweep > Math.PI) sweep -= 2 * Math.PI; while (sweep < -Math.PI) sweep += 2 * Math.PI;
      arcs.push({ net: k, c, r, a0, sweep });
    }
    segs.forEach((s, i) => lines.push({ net: k, a: s.a, b: s.b, ends: [ends[i].a, ends[i].b] }));
  });
  return { lines, arcs };
}

// 每條折線頭尾兩端是不是自由端：[[[頭, 尾], …每條折線], …每條線路網]
// 端點落在同一線路網其他折線上（含端點、內部，容許 1 px）或有接點圓點，就不是自由端
function segmentEnds(drawing) {
  return drawing.nets.map(net => {
    const wires = net.wires || [], dots = net.dots || [];
    const onWire = (p, skip) => wires.some((w, wi) => wi !== skip && w.slice(1).some((b, j) => {
      const a = w[j], x0 = Math.min(a[0], b[0]) - 1, x1 = Math.max(a[0], b[0]) + 1, y0 = Math.min(a[1], b[1]) - 1, y1 = Math.max(a[1], b[1]) + 1;
      return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
    }));
    const isFree = (p, wi) => !onWire(p, wi) && !dots.some(d => Math.abs(d[0] - p[0]) <= 1 && Math.abs(d[1] - p[1]) <= 1);
    return wires.map((w, wi) => [isFree(w[0], wi), isFree(w[w.length - 1], wi)]);
  });
}

if (typeof module !== 'undefined') module.exports = { rasterizeDrawing, segmentEnds, wireGeometry };
