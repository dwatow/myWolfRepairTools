// 線路網分析：從點陣電路圖找出水平／垂直線段，依接點規則合併成「線路網」。
// 純函式，Node 與瀏覽器共用。img = { data: RGBA Uint8Array, width, height }
function analyzeNets(img, opt = {}) {
  const { width: W, height: H, data } = img;
  const minRun = opt.minRun ?? 18;      // 線段最短長度（px）
  const maxThick = opt.maxThick ?? 7;   // 線條最大粗細，超過視為實心區塊
  const endTol = opt.endTol ?? 5;       // 判斷「線段在此結束」的容許值
  const gapMax = opt.gapMax ?? 45;      // 水平共線斷點（文字標籤、接頭）可跨越的最大間隙（0 = 不跨越）
  const gapMaxV = opt.gapMaxV ?? 60;    // 垂直方向的直書線色標籤較長
  const dotFill = opt.dotFill ?? 0.8;   // 接點圓點的墨水比例門檻
  const bracketMax = opt.bracketMax ?? 60; // 「ㄈ」形框線的最大長度
  const anchors = opt.anchors ?? [];    // 線色標註點 [x, y, 代號]
  const loose = opt.loose ?? 12;        // 有線色可把關時，間隙門檻可再放寬多少
  const dots = opt.dots ?? [];          // 人工補的接點 [x, y]：圓點偏離交會點中心、自動判斷不到的地方
  const links = opt.links ?? [];        // 人工補的連線 [[x, y], …]：沿圖上實際走線的折線，頭尾兩點所在的線路網視為相連，沿線墨水也歸入（錯位下折等）；只有兩點時只合併不描線（接頭內部跨接、併接）
  const bridgeMax = opt.bridgeMax ?? 140; // 水平穿過接頭（可能連同線色標籤）的缺口上限：兩邊線色都已知且相同才可跨越
  const trackTol = opt.trackTol ?? 2;   // 共線判定容許的錯位（px）
  const erase = opt.erase ?? [];        // 人工抹除 [x0, y0, x1, y1]：元件符號被誤認成導線的筆畫，辨識前就當成空白
  const inkFix = opt.ink ?? [];         // 人工補墨 [x0, y0, x1, y1]：顏色太淡、沒被二值化成墨水的導線，辨識前補成墨水

  // 1. 二值化：深色或有彩度的像素都算墨水（含灰線）
  const ink = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    ink[i] = lum < 185 || mx - mn > 70 ? 1 : 0;
  }
  for (const [rects, v] of [[erase, 0], [inkFix, 1]]) for (const [x0, y0, x1, y1] of rects)
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) ink.fill(v, y * W + Math.max(0, x0), y * W + Math.min(W - 1, x1) + 1);

  // 2. 找線段：逐列（或逐行）找長度 ≥ minRun 的連續墨水，再把相鄰列重疊的 run 合成一條線段
  function segments(horizontal) {
    const outer = horizontal ? H : W, inner = horizontal ? W : H;
    const at = horizontal ? (o, i) => ink[o * W + i] : (o, i) => ink[i * W + o];
    const segs = [];
    let open = []; // 上一列仍在延續的線段
    for (let o = 0; o < outer; o++) {
      const runs = [];
      for (let i = 0; i < inner; ) {
        if (!at(o, i)) { i++; continue; }
        let j = i; while (j < inner && at(o, j)) j++;
        if (j - i >= minRun) runs.push([i, j - 1]);
        i = j;
      }
      const next = [];
      for (const [a, b] of runs) {
        let s = open.find(s => !s.taken && a <= s.b + 2 && b >= s.a - 2);
        if (s) { s.taken = true; s.a = Math.min(s.a, a); s.b = Math.max(s.b, b); s.o1 = o; }
        else { s = { a, b, o0: o, o1: o, horizontal }; segs.push(s); }
        next.push(s);
      }
      for (const s of next) s.taken = false;
      open = next;
    }
    return segs.filter(s => s.o1 - s.o0 + 1 <= maxThick).map(s => horizontal
      ? { h: true, x0: s.a, x1: s.b, y0: s.o0, y1: s.o1 }
      : { h: false, x0: s.o0, x1: s.o1, y0: s.a, y1: s.b });
  }
  // JPEG 雜訊會在粗線內多切出細碎片段，被同向線段完整包住的就丟掉，免得假造出轉角
  const contains = (a, b) => a !== b && a.h === b.h && b.x0 >= a.x0 - 1 && b.x1 <= a.x1 + 1 && b.y0 >= a.y0 - 1 && b.y1 <= a.y1 + 1;
  const raw = [...segments(true), ...segments(false)];
  const segs = raw.filter(b => !raw.some(a => contains(a, b) && (!contains(b, a) || raw.indexOf(a) < raw.indexOf(b))));
  segs.forEach((s, i) => (s.id = i));

  // 3. Union-find
  const parent = segs.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };

  const hs = segs.filter(s => s.h), vs = segs.filter(s => !s.h);
  const inkAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ink[y * W + x];
  // 實心區塊（圓點內部）：7×7 範圍內墨水比例夠高
  const isSolid = (cx, cy) => {
    let n = 0, t = 0;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) { t++; n += inkAt(x, y); }
    return n / t >= dotFill;
  };
  // 接點圓點：交會點四個斜角也有墨水（純交叉的斜角是空白）
  const isDot = (cx, cy) => {
    let n = 0;
    for (let dy = -3; dy <= 3; dy += 6) for (let dx = -3; dx <= 3; dx += 6) n += inkAt(cx + dx, cy + dy) || inkAt(cx + dx * 4 / 3 | 0, cy + dy * 2 / 3 | 0);
    return n >= 4 || dots.some(([x, y]) => Math.abs(x - cx) <= 6 && Math.abs(y - cy) <= 6);
  };

  // 4. 水平 × 垂直交會：兩方都在此結束（L 轉角）或有圓點才相連；純交叉與無點 T 字不相連
  const joins = [];
  for (const h of hs) for (const v of vs) {
    if (v.x1 < h.x0 - endTol || v.x0 > h.x1 + endTol) continue;
    if (h.y1 < v.y0 - endTol || h.y0 > v.y1 + endTol) continue;
    const cx = (v.x0 + v.x1) >> 1, cy = (h.y0 + h.y1) >> 1, reach = endTol + maxThick;
    const hSide = cx - h.x0 <= reach ? 'L' : h.x1 - cx <= reach ? 'R' : '';
    const vSide = cy - v.y0 <= reach ? 'T' : v.y1 - cy <= reach ? 'B' : '';
    if ((hSide && vSide) || isDot(cx, cy)) joins.push({ h, v, hSide, vSide });
  }

  // 5. 方框（接頭、元件外框）不是導線：四個 L 轉角圍成的矩形整個排除，避免把穿過它的線全部連在一起
  const corner = (h, hSide, vSide) => joins.filter(j => j.h === h && j.hSide === hSide && j.vSide === vSide).map(j => j.v);
  const cornerOf = (v, vSide, hSide) => joins.filter(j => j.v === v && j.vSide === vSide && j.hSide === hSide).map(j => j.h);
  for (const top of hs) for (const vl of corner(top, 'L', 'T')) for (const vr of corner(top, 'R', 'T')) {
    const bottoms = cornerOf(vl, 'B', 'L').filter(b => cornerOf(vr, 'B', 'R').includes(b));
    for (const b of bottoms) top.box = vl.box = vr.box = b.box = true;
  }
  // 短的「ㄈ」形邊（兩端轉角朝同一側）也視為框線：接頭方框常因內部凹口而不是完整矩形
  const len = s => (s.h ? s.x1 - s.x0 : s.y1 - s.y0);
  for (const v of vs) if (len(v) <= bracketMax) {
    const t = joins.filter(j => j.v === v && j.vSide === 'T' && j.hSide), b = joins.filter(j => j.v === v && j.vSide === 'B' && j.hSide);
    if (t.some(a => b.some(c => c.hSide === a.hSide))) v.box = true;
  }
  for (const h of hs) if (len(h) <= bracketMax) {
    const l = joins.filter(j => j.h === h && j.hSide === 'L' && j.vSide), r = joins.filter(j => j.h === h && j.hSide === 'R' && j.vSide);
    if (l.some(a => r.some(c => c.vSide === a.vSide))) h.box = true;
  }
  // 6. 候選連接：L 轉角／圓點，以及同向共線的線段（重疊或隔著文字標籤、接頭的斷點）
  const pairs = joins.filter(j => !j.h.box && !j.v.box).map(j => [j.h, j.v, 0, true, true]);
  const sameDir = (list, h) => {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const [aLo, aHi, aP0, aP1, bLo, bHi, bP0, bP1] = h
        ? [a.x0, a.x1, a.y0, a.y1, b.x0, b.x1, b.y0, b.y1]
        : [a.y0, a.y1, a.x0, a.x1, b.y0, b.y1, b.x0, b.x1];
      const off = Math.max(bP0 - aP1, aP0 - bP1);           // 兩線的錯位（≤ 1 視為同軌）
      if (off > trackTol) continue;                         // 不同軌
      const gap = Math.max(bLo - aHi, aLo - bHi);
      if (gap <= Math.max(gapMax, gapMaxV, loose, h ? bridgeMax : 0)) pairs.push([a, b, gap, h, false, off]);
    }
  };
  let wires = segs.filter(s => !s.box);
  sameDir(wires.filter(s => s.h), true); sameDir(wires.filter(s => !s.h), false);
  const within = (gap, h, extra) => gap <= 1 || gap <= (h ? gapMax : gapMaxV) + extra;

  // 7. 線色代號：把標註點的代號套到所在的直線段（只合併重疊的碎段，不跨接點與間隙）；"X" 代表不是導線
  if (anchors.length) {
    for (const [a, b, gap, , isJoin, off = 0] of pairs) if (!isJoin && gap <= 1 && off <= 1) union(a.id, b.id);
    const pieceCode = new Map();
    for (const [x, y, code] of anchors) {
      const s = wires.find(s => x >= s.x0 - 2 && x <= s.x1 + 2 && y >= s.y0 - 2 && y <= s.y1 + 2);
      if (s) pieceCode.set(find(s.id), code);
    }
    for (const s of wires) { s.code = pieceCode.get(find(s.id)) || null; if (s.code === 'X') s.box = true; }
    wires = wires.filter(s => !s.box);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
  }
  // 8. 正式合併：由近到遠合併，門檻放寬 loose，但兩邊線色已知且不同就不連
  const code = new Map(segs.map(s => [s.id, s.code || null]));
  pairs.sort((p, q) => p[2] - q[2]);
  for (const [a, b, gap, h, , off = 0] of pairs) {
    if (a.box || b.box) continue;
    const ra = find(a.id), rb = find(b.id); if (ra === rb) continue;
    const ca = code.get(ra), cb = code.get(rb);
    if (ca && cb && ca !== cb) continue;
    // 一般缺口照門檻；超過門檻但在 bridgeMax 內的水平缺口（穿過接頭），或錯位超過 1 px，要兩邊線色都已知且相同
    const sameKnown = ca && ca === cb;
    if (off > 1 && !sameKnown) continue;
    if (!within(gap, h, anchors.length ? loose : 0) && !(h && gap <= bridgeMax && sameKnown)) continue;
    parent[ra] = rb; code.set(rb, cb || ca);
  }
  // 人工補的連線：折線頭尾兩點各自所在的導線線段合併
  const wireAt = ([x, y]) => wires.find(s => x >= s.x0 - 2 && x <= s.x1 + 2 && y >= s.y0 - 2 && y <= s.y1 + 2);
  const linkSegs = []; // [折線, 頭端線段]：合併完成後，沿折線把墨水像素標進線路網
  for (const path of links) {
    const p = path[0], q = path[path.length - 1];
    const a = wireAt(p), b = wireAt(q);
    if (!a || !b) { if (typeof console !== 'undefined') console.warn('links: 找不到線段', p, q); continue; }
    linkSegs.push([path, a]);
    const ra = find(a.id), rb = find(b.id); if (ra === rb) continue;
    parent[ra] = rb; code.set(rb, code.get(rb) || code.get(ra));
  }

  // 9. 每個像素標上所屬線路網，供點擊查詢與上色
  const label = new Int32Array(W * H).fill(-1);
  for (const s of wires) {
    const r = find(s.id);
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) if (ink[y * W + x]) label[y * W + x] = r;
  }
  // 人工連線的走線（下折、轉折等不夠長、沒被認成線段的筆畫）：折線 ±linkHalf 範圍內尚未歸屬的墨水像素
  // 只有頭尾兩點的連線（接頭內部跨接、併接）只合併、不描線，免得把接頭符號的筆畫塗上線色
  const linkHalf = 3;
  for (const [path, a] of linkSegs) {
    if (path.length === 2) continue;
    const r = find(a.id);
    for (let j = 1; j < path.length; j++) {
      const [ax, ay] = path[j - 1], [bx, by] = path[j], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
      for (let t = 0; t <= n; t++) {
        const cx = Math.round(ax + (bx - ax) * t / n), cy = Math.round(ay + (by - ay) * t / n);
        for (let y = cy - linkHalf; y <= cy + linkHalf; y++) for (let x = cx - linkHalf; x <= cx + linkHalf; x++)
          if (x >= 0 && y >= 0 && x < W && y < H && ink[y * W + x] && label[y * W + x] < 0) label[y * W + x] = r;
      }
    }
  }
  // 接點圓點：把圓點範圍內緊鄰線路網的墨水像素補進去
  for (let pass = 0; pass < 3; pass++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!ink[i] || label[i] >= 0) continue;
    const n = Math.max(label[i - 1], label[i + 1], label[i - W], label[i + W]);
    if (n >= 0 && isSolid(x, y)) label[i] = n;
  }
  for (const s of segs) { s.net = s.box ? -1 : find(s.id); s.netCode = s.box ? null : code.get(s.net) || null; }
  return { segs, label, ink };
}
if (typeof module !== 'undefined') module.exports = { analyzeNets };
