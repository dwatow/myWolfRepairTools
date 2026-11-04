// 線路網的人工修正（看原圖決定），bootstrap.js 重產線路網後、recut.js 重新切缺口前都會套用；重複套用結果相同
//   remove：要移除的導線（折線完全相同才移除；例：舊辨識把元件筆畫併進導線）
//   add：{ at: 線路上一點, wires: [折線…] } 補進 at 所在的線路網（例：舊辨識漏掉的斜線，改用水平／垂直折線近似）
//   merge：{ at: [點 A, 點 B], reason } 把 B 所在的線路網併進 A（兩條其實是同一條線路）；B 是粗電纜時改放進 A 的 cables
const { rasterizeDrawing } = require('../../js/drawing.js');
const J = JSON.stringify;

function netAt(d, [x, y]) {
  // 用點陣化結果找點所在的線路網（點擊帶內都算）
  const { label } = rasterizeDrawing(d, { cableHalf: 7 }), W = d.size[0];
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const k = label[(y + dy) * W + x + dx]; if (k >= 0) return k; }
  return -1;
}

// 折線 w 的每一段都已在線路的導線上（同一條水平／垂直線、範圍涵蓋）：補過了（tidyNet 會把折線拆段，不能用整條相同判斷）
function covered(net, w) {
  const segs = net.wires.flatMap(x => x.slice(1).map((b, j) => [x[j], b]));
  return w.slice(1).every((q, j) => {
    const p = w[j];
    return segs.some(([a, b]) => p[1] === q[1] ? a[1] === b[1] && a[1] === p[1] && Math.min(a[0], b[0]) <= Math.min(p[0], q[0]) && Math.max(a[0], b[0]) >= Math.max(p[0], q[0])
      : a[0] === b[0] && a[0] === p[0] && Math.min(a[1], b[1]) <= Math.min(p[1], q[1]) && Math.max(a[1], b[1]) >= Math.max(p[1], q[1]));
  });
}

function applyNetsManual(d, m = {}) {
  const log = [];
  for (const w of m.remove || []) for (const net of d.nets) {
    const n0 = net.wires.length; net.wires = net.wires.filter(x => J(x) !== J(w));
    if (net.wires.length < n0) log.push(`移除導線 ${J(w)}`);
  }
  for (const a of m.add || []) {
    const k = netAt(d, a.at); if (k < 0) throw new Error(`nets-manual add：${J(a.at)} 不在任何線路上`);
    for (const w of a.wires) if (!covered(d.nets[k], w)) { d.nets[k].wires.push(w); log.push(`補導線 ${J(w)} 到線路 ${k}（${d.nets[k].code}）`); }
  }
  for (const g of m.merge || []) {
    const a = netAt(d, g.at[0]), b = netAt(d, g.at[1]);
    if (a < 0 || b < 0) throw new Error(`nets-manual merge：${J(g.at)} 有一點不在線路上`);
    if (a === b) continue;
    const A = d.nets[a], B = d.nets[b];
    if ((A.code ?? null) !== (B.code ?? null)) throw new Error(`nets-manual merge：線色不同（${A.code} / ${B.code}），不合併`);
    if (B.cable) A.cables = [...(A.cables || []), ...B.wires.map(path => (B.half !== undefined ? { path, half: B.half } : { path }))];
    else { A.wires.push(...B.wires); if (B.cables) A.cables = [...(A.cables || []), ...B.cables]; }
    A.dots = [...(A.dots || []), ...(B.dots || [])]; A.ground = !!(A.ground || B.ground);
    d.nets.splice(b, 1);
    log.push(`合併線路 ${b} 到 ${a}（${A.code}）：${g.reason || ''}`);
  }
  return log;
}

// 各圖的修正
const SHARED = {
  remove: [
    [[2005, 290], [2005, 309]], // CDI 4P 卡榫框左邊框被舊辨識併進 G 線路（改由元件圖元畫）
    // 高壓線圈左側接地符號：舊辨識把引線與兩條直槓當成兩條未標色線路（含圓點），改由元件圖元畫（朝左的接地符號）
    [[1391, 1749], [1455, 1749]], [[1391, 1740], [1391, 1760]], [[1398, 1735], [1398, 1764]],
  ],
  add: [
    // 保險絲右側 R 線：原圖以斜線接到電瓶正極端子，舊辨識只認水平／垂直線而漏掉；改用折線接到正極端子座右側
    { at: [3003, 1500], wires: [[[3003, 1601], [3003, 1688], [2951, 1688]]] },
    // G/R、G/Y：文字到三角形之間的短導線（舊辨識併進接頭；tools/redraw/marks-manual.js 同時修正三角形位置）
    { at: [1300, 403], wires: [[[1446, 403], [1458, 403]]] },
    { at: [1350, 443], wires: [[[1446, 443], [1458, 443]]] },
    // 右後方向燈 G 線：文字到燈座之間那一小段原圖漏畫（左後方向燈有），補上
    { at: [3020, 732], wires: [[[3086, 732], [3113, 732]]] },
  ],
  merge: [
    { at: [[3003, 1500], [2931, 1600]], reason: '保險絲 R 線與電瓶正極電纜是同一條線路（原圖斜線相連）' },
  ],
};
// PA12C：缺油感應器（原廠 PDF 的 FUEL UNIT）方框內是空的，伸進方框的 G、Y/W 線（PA12B 油量計的可變電阻、滑臂）移除
const PA12C = { ...SHARED, remove: [...SHARED.remove,
  [[2730, 63], [2730, 89]], [[2730, 109], [2730, 145]], [[2707, 98], [2723, 98]], [[2707, 98], [2707, 145]]] };
const MANUAL = { PA12B: SHARED, PA12C };

module.exports = { applyNetsManual, MANUAL };
