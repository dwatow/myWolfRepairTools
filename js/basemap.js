// 由資料畫出線路圖底圖（取代原廠掃描圖）：白底、導線（深灰）、粗電纜（雙線外框）、接點圓點、元件方框與名稱
// drawing：WOLF_DRAWING；components：WOLF_COMPONENTS（box、label 以圖寬 1800 為基準）；K = 圖寬 / 1800
const BASE_INK = '#3a3f44', BASE_BOX = '#6b7176';
function drawBase(ctx, drawing, components, K) {
  const [W, H] = drawing.size;
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
  // 座標是像素中心：+0.5 讓奇數線寬對齊像素格
  const path = wire => { ctx.beginPath(); wire.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + 0.5, y + 0.5)); };
  for (const net of drawing.nets) {
    if (net.cable) {
      const half = net.half ?? 7;
      for (const w of net.wires) {
        path(w); ctx.strokeStyle = BASE_INK; ctx.lineWidth = 2 * half + 1; ctx.stroke();
        path(w); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * half - 3; ctx.stroke();
      }
    } else {
      ctx.strokeStyle = BASE_INK; ctx.lineWidth = 3;
      for (const w of net.wires) { path(w); ctx.stroke(); }
    }
    ctx.fillStyle = BASE_INK;
    for (const [x, y] of net.dots || []) { ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 4.5, 0, 2 * Math.PI); ctx.fill(); }
  }
  // 元件方框與名稱
  const font = getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of components) {
    const [a, b, cc, d] = c.box.map(v => v * K);
    ctx.strokeStyle = BASE_BOX; ctx.lineWidth = 1.5; ctx.strokeRect(a, b, cc - a, d - b);
    const [x0, y0, x1, y1] = c.label ? c.label.map(v => v * K) : [a + 4, b + 4, cc - 4, b + 26];
    let size = Math.min(28, (y1 - y0) * 0.9);
    ctx.font = `${size}px ${font}`;
    const w = ctx.measureText(c.name).width;
    if (w > x1 - x0) { size *= (x1 - x0) / w; ctx.font = `${size}px ${font}`; }
    ctx.fillStyle = BASE_INK; ctx.fillText(c.name, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.restore();
}
