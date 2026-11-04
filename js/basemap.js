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
  drawMarks(ctx, drawing, font);
  ctx.restore();
}

// 導線上的標記：線色文字、單線接頭（plug 三角形公端、socket 帶內框的母端）、多腳接頭方框、圖名
// 尺寸以原圖實測為準（全解析度 px）
const MARK = { text: 21, plugLen: 30, plugBase: 22, sockW: 45, sockH: 21, sockInW: 22, sockInH: 6, connText: 18 };
function drawMarks(ctx, drawing, font) {
  ctx.save();
  ctx.strokeStyle = BASE_INK; ctx.fillStyle = BASE_INK; ctx.lineJoin = 'miter';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // 直書：同原圖，整段文字逆時針轉 90°（由下往上讀）
  const vText = (text, x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); ctx.fillText(text, 0, 0); ctx.restore(); };
  for (const l of drawing.labels || []) {
    ctx.font = `bold ${MARK.text}px ${font}`;
    if (l.vertical) vText(l.text, l.at[0], l.at[1]); else ctx.fillText(l.text, l.at[0], l.at[1]);
  }
  for (const m of drawing.inline || []) {
    ctx.save(); ctx.translate(m.at[0] + 0.5, m.at[1] + 0.5);
    if (m.dir === 'v') ctx.rotate(Math.PI / 2);
    if (m.flip) ctx.scale(-1, 1);
    if (m.kind === 'plug') {
      const L = MARK.plugLen / 2, B = MARK.plugBase / 2;
      ctx.fillStyle = '#ffffff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-L, -B); ctx.lineTo(L, 0); ctx.lineTo(-L, B); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      const w = MARK.sockW / 2, h = MARK.sockH / 2;
      ctx.fillStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.fillRect(-w, -h, 2 * w, 2 * h); ctx.strokeRect(-w, -h, 2 * w, 2 * h);
      ctx.strokeRect(-MARK.sockInW / 2, -MARK.sockInH / 2, MARK.sockInW, MARK.sockInH);
    }
    ctx.restore();
  }
  for (const c of drawing.connectors || []) {
    const [x0, y0, x1, y1] = c.box;
    ctx.fillStyle = '#ffffff'; ctx.lineWidth = 2.5;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    if (c.label) {
      ctx.fillStyle = BASE_INK; ctx.font = `${MARK.connText}px ${font}`;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (ctx.measureText(c.label).width + 6 > x1 - x0) vText(c.label, cx, cy); else ctx.fillText(c.label, cx, cy);
    }
  }
  for (const t of drawing.texts || []) {
    ctx.fillStyle = BASE_INK; ctx.font = `bold ${t.size || 28}px ${font}`;
    ctx.fillText(t.text, t.at[0], t.at[1]);
  }
  ctx.restore();
}
