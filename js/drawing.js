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
  // 先檢查折線並整理成線段；free 記錄線段兩端（座標較小端、較大端）是不是自由端
  const freeOf = segmentEnds(drawing), free = [];
  drawing.nets.forEach((net, k) => {
    (net.wires || []).forEach((wire, wi) => {
      for (let j = 1; j < wire.length; j++) {
        const a = wire[j - 1], b = wire[j];
        if (a[0] !== b[0] && a[1] !== b[1])
          throw new Error(`drawing.js 第 ${k} 條線路網（從 0 起算）的折線必須是水平或垂直：${JSON.stringify([a, b])}`);
        const fa = j === 1 && freeOf[k][wi][0], fb = j === wire.length - 1 && freeOf[k][wi][1], aFirst = a[0] + a[1] <= b[0] + b[1];
        segs.push({ h: a[1] === b[1], x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]), net: k });
        free.push(aFirst ? [fa, fb] : [fb, fa]);
      }
    });
  });
  const half = (k, normal) => drawing.nets[k].cable ? drawing.nets[k].half ?? cableHalf : normal;
  // 矩形內的像素逐一交給 fn
  const rect = (x0, y0, x1, y1, fn) => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) fn(y * W + x);
  };
  // 1. 所有線路的點擊帶；2. 所有線芯與圓點覆蓋在上面（無圓點的交叉處，點擊帶不會蓋掉另一條的線芯）
  for (const s of segs) { const r = half(s.net, hit); rect(s.x0 - r, s.y0 - r, s.x1 + r, s.y1 + r, i => { label[i] = s.net; }); }
  const lists = drawing.nets.map(() => []);
  segs.forEach((s, j) => {
    const r = half(s.net, core), L = lists[s.net], cable = drawing.nets[s.net].cable;
    // 沿線方向：自由端往內縮 trim（線段夠長時），接到別段的那端照常外擴 r 補滿轉角
    const len = s.h ? s.x1 - s.x0 : s.y1 - s.y0, cut = !cable && len > 2 * trim + 2;
    const lo = cut && free[j][0] ? trim : -r, hi = cut && free[j][1] ? trim : -r;
    const box = s.h ? [s.x0 + lo, s.y0 - r, s.x1 - hi, s.y1 + r] : [s.x0 - r, s.y0 + lo, s.x1 + r, s.y1 - hi];
    rect(...box, i => { label[i] = s.net; L.push(i); });
  });
  drawing.nets.forEach((net, k) => {
    for (const [cx, cy] of net.dots || [])
      rect(cx - dot, cy - dot, cx + dot, cy + dot, i => {
        const dx = (i % W) - cx, dy = ((i / W) | 0) - cy;
        if (dx * dx + dy * dy <= dot * dot) { label[i] = k; lists[k].push(i); }
      });
  });
  const cores = lists.map(L => Int32Array.from(new Set(L)).sort());
  return { label, cores, segs };
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

if (typeof module !== 'undefined') module.exports = { rasterizeDrawing, segmentEnds };
