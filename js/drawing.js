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

  // 先檢查折線並整理成線段
  drawing.nets.forEach((net, k) => {
    for (const wire of net.wires || []) for (let j = 1; j < wire.length; j++) {
      const a = wire[j - 1], b = wire[j];
      if (a[0] !== b[0] && a[1] !== b[1])
        throw new Error(`drawing.js 第 ${k} 條線路網（從 0 起算）的折線必須是水平或垂直：${JSON.stringify([a, b])}`);
      segs.push({ h: a[1] === b[1], x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]), net: k });
    }
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
  for (const s of segs) { const r = half(s.net, core), L = lists[s.net]; rect(s.x0 - r, s.y0 - r, s.x1 + r, s.y1 + r, i => { label[i] = s.net; L.push(i); }); }
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

if (typeof module !== 'undefined') module.exports = { rasterizeDrawing };
