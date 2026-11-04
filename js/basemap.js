// 由資料畫出線路圖底圖（取代原廠掃描圖）：白底、導線（深灰）、粗電纜（雙線外框）、接點圓點、元件名稱與元件圖元（parts）、導線上的標記
// drawing：WOLF_DRAWING；components：WOLF_COMPONENTS（box、label 以圖寬 1800 為基準）；K = 圖寬 / 1800
const BASE_INK = '#3a3f44', BASE_BOX = '#6b7176';
function drawBase(ctx, drawing, components, K) {
  const [W, H] = drawing.size;
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
  // 座標是像素中心：+0.5 讓奇數線寬對齊像素格
  const path = wire => { ctx.beginPath(); wire.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + 0.5, y + 0.5)); };
  const geo = wireGeometry(drawing); // 導線的直線段與轉角圓弧（同 js/drawing.js 點陣化）
  drawing.nets.forEach((net, k) => {
    // 粗電纜：雙線外框（外圈深色、內圈白）。cable 線路網的 wires，以及一般線路網另帶的 cables
    // 轉彎照 cableGeometry 畫成圓弧（同 js/drawing.js 點陣化）；頭尾 square 線端
    const tubePath = (w, half) => {
      const g = cableGeometry(w, half); ctx.beginPath(); ctx.moveTo(g.lines[0][0][0] + 0.5, g.lines[0][0][1] + 0.5);
      g.lines.forEach(([, b], j) => { ctx.lineTo(b[0] + 0.5, b[1] + 0.5); const a = g.arcs[j]; if (a) ctx.arc(a.c[0] + 0.5, a.c[1] + 0.5, a.r, a.a0, a.a0 + a.sweep, a.sweep < 0); });
    };
    const tube = (w, half) => { tubePath(w, half); ctx.strokeStyle = BASE_INK; ctx.lineWidth = 2 * half + 1; ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * half - 3; ctx.stroke(); };
    for (const c of net.cables || []) tube(c.path, c.half ?? 7);
    if (net.cable) {
      for (const w of net.wires) tube(w, net.half ?? 7);
    } else {
      // 照 wireGeometry：平頭線端，自由端切齊端點、接到別段（T 字、交叉）那端延長半個線寬；轉角畫圓弧
      ctx.strokeStyle = BASE_INK; ctx.lineWidth = 3; ctx.lineCap = 'butt';
      const ext = (p, q, e) => { if (e !== 'joint') return p; const d = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1; return [p[0] + (p[0] - q[0]) / d * 1.5, p[1] + (p[1] - q[1]) / d * 1.5]; };
      for (const g of geo.lines) if (g.net === k) { path([ext(g.a, g.b, g.ends[0]), ext(g.b, g.a, g.ends[1])]); ctx.stroke(); }
      for (const g of geo.arcs) if (g.net === k) { ctx.beginPath(); ctx.arc(g.c[0] + 0.5, g.c[1] + 0.5, g.r, g.a0, g.a0 + g.sweep, g.sweep < 0); ctx.stroke(); }
      ctx.lineCap = 'square';
    }
    ctx.fillStyle = BASE_INK;
    for (const [x, y] of net.dots || []) { ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, 4.5, 0, 2 * Math.PI); ctx.fill(); }
  });
  // 元件方框與名稱
  const font = getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of components) {
    const [a, b, cc, d] = c.box.map(v => v * K);
    // 有 parts 時外框由 parts 的 frame 決定（原圖有外框才畫）；沒有 parts（或是空的）就照舊畫元件方框
    if (!drawing.parts?.length) { ctx.strokeStyle = BASE_BOX; ctx.lineWidth = 1.5; ctx.strokeRect(a, b, cc - a, d - b); }
    const [x0, y0, x1, y1] = c.label ? c.label.map(v => v * K) : [a + 4, b + 4, cc - 4, b + 26];
    // 名稱範圍可能含規格那一行（原圖名稱下方的「(12V 10W)」），名稱字級上限 24、靠範圍上緣
    // 名稱結尾的全形括號是 components.js 用來區分同名元件的（例：接地（引擎）），原圖沒有，不畫
    const name = c.name.replace(/（[^）]*）$/, '');
    ctx.fillStyle = BASE_INK;
    if (y1 - y0 > 1.5 * (x1 - x0)) {
      // 直的名稱範圍（例：脈波線圈）：同原圖逆時針轉 90°
      let size = Math.min(24, (x1 - x0) * 0.9); ctx.font = `${size}px ${font}`;
      const w = ctx.measureText(name).width; if (w > y1 - y0) { size *= (y1 - y0) / w; ctx.font = `${size}px ${font}`; }
      ctx.save(); ctx.translate((x0 + x1) / 2, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(name, 0, 0); ctx.restore();
      continue;
    }
    let size = Math.min(24, (y1 - y0) * 0.9);
    ctx.font = `${size}px ${font}`;
    const w = ctx.measureText(name).width;
    if (w > x1 - x0) { size *= (x1 - x0) / w; ctx.font = `${size}px ${font}`; }
    ctx.fillText(name, (x0 + x1) / 2, y0 + size / 2 + 1);
  }
  drawParts(ctx, drawing.parts || [], font);
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

// 元件內的圖元（drawing.parts）：通用符號、接腳、文字、元件上的接頭、外框。符號只描線不填白（免得蓋住穿進元件的導線）
function drawParts(ctx, parts, font) {
  ctx.save();
  ctx.strokeStyle = BASE_INK; ctx.fillStyle = BASE_INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = (t, x, y, size, vertical, bold) => {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
    if (!vertical) return ctx.fillText(t, x, y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); ctx.fillText(t, 0, 0); ctx.restore();
  };
  for (const p of parts) {
    if (p.type === 'frame') { const [a, b, c, d] = p.box; ctx.save(); ctx.lineWidth = p.w || 2.5; ctx.strokeRect(a, b, c - a, d - b); ctx.restore(); }
    else if (p.type === 'text') text(p.text, p.at[0], p.at[1], p.size || 18, p.vertical, p.bold);
    else if (p.type === 'pin') {
      const [x, y] = p.at, r = 11; // 同原圖接腳圓圈；+0.5 同導線對齊像素中心，圓心才會對著線中心
      ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, 2 * Math.PI); ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore(); ctx.stroke();
      // 名稱預設在圓圈上方；textAt 可指定位置
      ctx.font = `bold 20px ${font}`; const len = ctx.measureText(p.name).width;
      const [tx, ty] = p.textAt || (p.vertical ? [x, y - r - 5 - len / 2] : [x, y - r - 14]);
      text(p.name, tx, ty, 20, p.vertical, true);
    } else if (p.type === 'connector') {
      const [x0, y0, x1, y1] = p.box;
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore(); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      if (p.label) { ctx.font = `16px ${font}`; const vert = ctx.measureText(p.label).width + 6 > x1 - x0; text(p.label, (x0 + x1) / 2, (y0 + y1) / 2, 16, vert); }
    } else if (p.type === 'symbol') { ctx.save(); drawSymbol(ctx, p, font); ctx.restore(); }
    else if (SHAPES[p.type]) { ctx.save(); if (p.w) ctx.lineWidth = p.w; SHAPES[p.type](ctx, p); ctx.restore(); }
  }
  ctx.restore();
}

// 通用電路符號：畫在 box 內（全解析度座標），依 box 大小縮放
function drawSymbol(ctx, p, font) {
  const [x0, y0, x1, y1] = p.box, w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke(); };
  const line = (...pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); };
  // 一排半圓（線圈）：從 (ax, ay) 到 (bx, by)，n 個，凸向 side（1 / -1）
  const humps = (ax, ay, bx, by, n, side = 1) => {
    const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), r = len / n / 2;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.beginPath();
    for (let i = 0; i < n; i++) ctx.arc(r * (2 * i + 1), 0, r, Math.PI, 0, side < 0);
    ctx.stroke(); ctx.restore();
  };
  // 燈絲：兩個小圈
  const filament = (x, y, s) => { humps(x - s, y, x + s, y, 2, 1); line([x - s, y], [x - s, y + s * 0.8]); line([x + s, y], [x + s, y + s * 0.8]); };
  switch (p.kind) {
    case 'lamp': {
      // 燈泡圓在 dir 的反側，燈座矩形朝 dir
      const dir = p.dir || 'r', hor = dir === 'l' || dir === 'r', r = Math.min(hor ? h : w, (hor ? w : h) * 0.6) / 2;
      const c = { r: [x0 + r, cy], l: [x1 - r, cy], d: [cx, y0 + r], u: [cx, y1 - r] }[dir];
      circle(c[0], c[1], r); filament(c[0], c[1] - r * 0.15, r * 0.4);
      const bh = r * 0.9;
      if (dir === 'r') ctx.strokeRect(c[0] + r, cy - bh / 2, x1 - c[0] - r, bh);
      if (dir === 'l') ctx.strokeRect(x0, cy - bh / 2, c[0] - r - x0, bh);
      if (dir === 'd') ctx.strokeRect(cx - bh / 2, c[1] + r, bh, y1 - c[1] - r);
      if (dir === 'u') ctx.strokeRect(cx - bh / 2, y0, bh, c[1] - r - y0);
      break;
    }
    case 'lamp2': {
      ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * Math.PI); ctx.stroke();
      filament(cx - w * 0.18, cy, h * 0.18); filament(cx + w * 0.18, cy, h * 0.18);
      break;
    }
    case 'horn': { const r = Math.min(w, h) / 2; circle(cx, cy, r); circle(cx, cy, r * 0.55); circle(cx, cy, r * 0.2); break; }
    case 'gauge': { const r = Math.min(w, h) / 2; circle(cx, cy, r); line([cx - r * 0.5, cy + r * 0.5], [cx + r * 0.6, cy - r * 0.6]); break; }
    case 'resistor': {
      ctx.strokeRect(x0, y0, w, h);
      const n = 6, pts = [[cx, y0 + h * 0.15]];
      for (let i = 1; i <= n; i++) pts.push([cx + (i % 2 ? 1 : -1) * w * 0.25, y0 + h * 0.15 + (h * 0.7) * i / (n + 1)]);
      pts.push([cx, y1 - h * 0.15]); line(...pts);
      break;
    }
    case 'coil': { if (w >= h) humps(x0, cy, x1, cy, Math.max(3, Math.round(w / h * 1.5))); else humps(cx, y0, cx, y1, Math.max(3, Math.round(h / w * 1.5))); break; }
    case 'transformer': {
      humps(x0, cy - h * 0.12, x1, cy - h * 0.12, 4, 1); humps(x0, cy + h * 0.12, x1, cy + h * 0.12, 4, -1);
      line([x0, cy - h * 0.04], [x1, cy - h * 0.04]); line([x0, cy + h * 0.04], [x1, cy + h * 0.04]);
      break;
    }
    case 'alternator': {
      const r = Math.min(w, h) / 2; circle(cx, cy, r);
      humps(cx - r * 0.3, cy - r * 0.55, cx - r * 0.3, cy + r * 0.55, 4, -1); humps(cx + r * 0.3, cy - r * 0.55, cx + r * 0.3, cy + r * 0.55, 4, -1);
      break;
    }
    case 'motor': { const r = Math.min(w, h) / 2; circle(cx, cy, r); ctx.font = `${Math.round(r)}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', cx, cy); break; }
    case 'battery': {
      ctx.strokeRect(x0, y0 + h * 0.25, w, h * 0.75);
      const r = Math.min(w * 0.12, h * 0.12); circle(x0 + w * 0.3, y0 + h * 0.25, r); circle(x0 + w * 0.7, y0 + h * 0.25, r);
      ctx.font = `bold ${Math.round(r * 1.4)}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('−', x0 + w * 0.3, y0 + h * 0.25); ctx.fillText('+', x0 + w * 0.7, y0 + h * 0.25);
      break;
    }
    case 'fuse': {
      ctx.strokeRect(x0, y0, w, h);
      ctx.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, x = x0 + w * (0.15 + 0.7 * t), y = cy - Math.sin(t * 2 * Math.PI) * h * 0.25; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      break;
    }
    case 'diode': {
      const s = Math.min(w, h) * 0.4;
      line([cx - s / 2, cy - s / 2], [cx + s / 2, cy], [cx - s / 2, cy + s / 2], [cx - s / 2, cy - s / 2]); line([cx + s / 2, cy - s / 2], [cx + s / 2, cy + s / 2]);
      line([x0, cy], [cx - s / 2, cy]); line([cx + s / 2, cy], [x1, cy]);
      break;
    }
    case 'ground': { for (let i = 0; i < 3; i++) { const half = w / 2 * (1 - i * 0.33), y = y0 + h * i / 2.5; line([cx - half, y], [cx + half, y]); } break; }
    case 'lug': { const r = Math.min(w / 2, h * 0.3); circle(cx, y0 + r, r); circle(cx, y0 + r, r * 0.4); line([cx - r * 0.4, y0 + 2 * r], [cx - r * 0.4, y1]); line([cx + r * 0.4, y0 + 2 * r], [cx + r * 0.4, y1]); break; }
    case 'term': {
      // 電瓶端子：圓圈內畫 −（sign: '-'）或 ＋（sign: '+'）
      const r = Math.min(w, h) / 2; circle(cx, cy, r); line([cx - r * 0.6, cy], [cx + r * 0.6, cy]);
      if (p.sign === '+') line([cx, cy - r * 0.6], [cx, cy + r * 0.6]);
      break;
    }
    case 'button': {
      // 按鈕開關（煞車燈開關）：下方兩個接點圓圈，上方橫桿與按柄
      const r = Math.min(w * 0.13, h * 0.2); circle(x0 + w * 0.27, y1 - r, r); circle(x0 + w * 0.73, y1 - r, r);
      line([x0, y0 + h * 0.45], [x1, y0 + h * 0.45]); line([cx, y0], [cx, y0 + h * 0.45]);
      break;
    }
    case 'plug': {
      const s = h / 2;
      line([x0, cy - s], [x0 + w * 0.4, cy], [x0, cy + s], [x0, cy - s]);
      line([x1, cy - s], [x1 - w * 0.4, cy], [x1, cy + s], [x1, cy - s]);
      break;
    }
  }
}

// 照原圖近似的基本圖形（座標為全解析度；w 覆寫線寬，預設 2.5）
//   line { pts, close?, fill? }：折線；fill: true 實心。rect、circle 加 bg: true 會先填白，蓋住先畫的圖形
//   rect { box, fill? }、circle { c, r, fill? }、ellipse { c, rx, ry, a0?, a1? }（a0／a1 為角度，畫圓弧；0° 朝右、順時針）
//   loops { from, to, n, h, side? }：沿 from→to 的線圈環圈（擺線），n 圈、環圈高 h；起點在環圈那一側，side = -1 時整個翻到另一側
//   hatch { pts, gap? }：多邊形外框＋斜線填充（火星塞箭頭）
const SHAPES = {
  line(ctx, p) {
    ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (p.close || p.fill) ctx.closePath();
    if (p.fill) ctx.fill(); else ctx.stroke();
  },
  rect(ctx, p) {
    const [a, b, c, d] = p.box;
    if (p.fill) return ctx.fillRect(a, b, c - a, d - b);
    if (p.bg) { ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(a, b, c - a, d - b); ctx.restore(); } // bg：先填白蓋住後面的線
    ctx.strokeRect(a, b, c - a, d - b);
  },
  circle(ctx, p) {
    ctx.beginPath(); ctx.arc(p.c[0], p.c[1], p.r, 0, 2 * Math.PI);
    if (p.fill) return ctx.fill();
    if (p.bg) { ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore(); }
    ctx.stroke();
  },
  ellipse(ctx, p) {
    const rad = d => d * Math.PI / 180;
    ctx.beginPath(); ctx.ellipse(p.c[0], p.c[1], p.rx, p.ry ?? p.rx, 0, rad(p.a0 ?? 0), rad(p.a1 ?? 360)); ctx.stroke();
  },
  loops(ctx, p) {
    // 長幅擺線：u = a·t − b·sin t、v = −b·cos t（b > a 時出現環圈），t 從 0 到 2πn，沿線方向總長 = 2πn·a
    // from→to 連線是線圈的底邊；環圈在左側（水平向右時在上方），高 h，同原圖的燈絲、線圈
    const [ax, ay] = p.from, [bx, by] = p.to, L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
    const n = p.n, a = L / (2 * Math.PI * n), b = Math.max(p.h / 2, a * 1.05), side = p.side || 1, steps = 60 * n;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.beginPath();
    // 從 t = π 開始到 π + 2πn：起點、終點都在連接弧的最低點（沿線速度最快，曲線不會超出兩端），環圈 n 個
    const ph = Math.PI, u0 = a * ph - b * Math.sin(ph);
    for (let i = 0; i <= steps; i++) {
      const t = ph + 2 * Math.PI * n * i / steps, u = a * t - b * Math.sin(t) - u0, v = side * -b * (Math.cos(t) + 1); // from→to 連線在線圈底部，環圈往上高 2b
      i ? ctx.lineTo(u, v) : ctx.moveTo(u, v);
    }
    ctx.stroke(); ctx.restore();
  },
  hatch(ctx, p) {
    // 路徑不在 save/restore 的狀態內：裁切用一次、最後描外框再建一次
    const poly = () => { ctx.beginPath(); p.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
    poly(); ctx.save(); ctx.clip();
    const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), g = p.gap || 6;
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let k = x0 - (y1 - y0); k <= x1; k += g) { ctx.moveTo(k, y1); ctx.lineTo(k + (y1 - y0), y0); }
    ctx.stroke(); ctx.restore(); poly(); ctx.stroke();
  },
};
