// 目前這張圖的資料（STRIPS、COMPONENTS、ANCHORS、CABLES、DOTS、LINKS）在 init 依 DIAGRAM 載入 data/<id>/ 後才有值
// COMPONENTS 的元件位置：以圖寬 1800 為基準的 [x0, y0, x1, y1]，載入後依實際解析度換算
let STRIPS, COMPONENTS = [], ANCHORS, CABLES, DOTS, LINKS, ERASE, INK, STATIC_AREAS = [];

const COLORS = [
  { hex: '#e5322d', name: '紅' }, { hex: '#f08c00', name: '橘' }, { hex: '#e6c200', name: '黃' },
  { hex: '#2fa84f', name: '綠' }, { hex: '#1f8fd6', name: '藍' }, { hex: '#7b4fd6', name: '紫' },
  { hex: '#e04aa0', name: '粉紅' }, { hex: '#00b3a4', name: '青' },
];
// PA12B 沿用原本的鍵，舊的塗色與儲存的選取不會遺失；其他圖各自分開存
const KEY_SUFFIX = DIAGRAM.id === 'PA12B' ? '' : '-' + DIAGRAM.id;
const STORE_KEY = 'wolf125-paint-v3' + KEY_SUFFIX, SAVED_KEY = 'wolf125-saved-v1' + KEY_SUFFIX;
// 線色代號（依原圖「線色對照表」），雙色線為「主色/條紋色」
const WIRE = {
  B: ['#1b1b1b', '黑'], Y: ['#f5c400', '黃'], L: ['#1f5fd6', '藍'], G: ['#16924a', '綠'], R: ['#e0251b', '紅'], W: ['#ffffff', '白'],
  BR: ['#8a5a2b', '棕'], O: ['#f27b00', '橘'], GR: ['#8f959b', '灰'], SB: ['#5cc6f2', '淺藍'], LG: ['#9be37e', '淺綠'], P: ['#f592bd', '粉紅'],
};
const WIRE_RGB = Object.fromEntries(Object.entries(WIRE).map(([k, [hex]]) => [k, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))]));
const codeName = c => c.split('/').map(p => WIRE[p] ? WIRE[p][1] : p).join('/');
const OUTLINE = [43, 47, 51];
const THIN = 1, THICK = 3;         // 一般線條與選取線條的半徑（像素）
const CABLE_HALF = 7; // 粗電纜預設半寬（像素），個別電纜可用 half 覆寫

const $ = id => document.getElementById(id);
const viewer = $('viewer'), canvas = $('view'), ctx = canvas.getContext('2d'), statusEl = $('status');
let base, baseData, overlay, overlayCtx, groundLayer, selLayer = null, hoverLayer = null;
const showCodes = () => $('show-codes').checked;
let IW = 0, IH = 0, label, nets = [];             // nets[k] = { pixels, x0, y0, x1, y1, ground }
let paint = {};                                    // paint[netIndex] = hex
let selection = null;                              // { kind: 'net', k } | { kind: 'comp', i } | { kind: 'multi', ks }
let saved = [];                                    // 已儲存的選取：{ name, savedAt, picks: [[x, y]] }（以線上一點的座標記錄，線路編號變動也找得回來）
                                                   // 細節：{ name, kind: 'detail', savedAt, rects: [[x0, y0, x1, y1]], pixels: [[x, y]] }，與同名的選取成對
// 圈選細節：在選取的線上框出有問題的筆畫；rects 跟著選取的線走，換選別的線就清空
let detail = { rects: [], key: '', drag: null }, detailLayer = null, detailPixels = [];
let hover = null, view = { s: 1, tx: 0, ty: 0 };
const hideGround = () => $('hide-ground').checked;

// ---- 載入圖片：7 條橫條上下拼接後逆時針轉 90°，讓文字變成正向 ----
const loadImg = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
const loadScript = src => new Promise((ok, err) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('載入失敗 ' + src));
  document.body.append(s);
});
async function init() {
  window.WOLF_SWITCHES = null;
  for (const f of DATA_FILES) await loadScript(f).catch(e => { if (!f.endsWith('/switches.js')) throw e; }); // 開關表可省略
  STRIPS = window.WOLF_STRIPS; COMPONENTS = window.WOLF_COMPONENTS; ANCHORS = window.WOLF_ANCHORS;
  ({ cables: CABLES = [], dots: DOTS = [], links: LINKS = [], erase: ERASE = [], ink: INK = [], staticAreas: STATIC_AREAS = [] } = window.WOLF_FIXES || {});
  const imgs = await Promise.all(STRIPS.map(loadImg));
  const W0 = imgs[0].width, H0 = imgs.reduce((a, i) => a + i.height, 0);
  IW = H0; IH = W0;
  base = document.createElement('canvas'); base.width = IW; base.height = IH;
  const b = base.getContext('2d', { willReadFrequently: true });
  b.translate(0, W0); b.rotate(-Math.PI / 2);
  let y = 0; for (const i of imgs) { b.drawImage(i, 0, y); y += i.height; }
  b.setTransform(1, 0, 0, 1, 0, 0);
  await new Promise(r => setTimeout(r, 30)); // 讓「分析中」先畫出來

  baseData = b.getImageData(0, 0, IW, IH);
  const r = analyzeNets(baseData, { anchors: ANCHORS, dots: DOTS, links: LINKS, erase: ERASE, ink: INK });
  addCables(r);
  // 固定區域與元件名稱文字（含底線）內的筆畫不算線路：點不到、不上色
  const K = IW / 1800, labelAreas = COMPONENTS.filter(c => c.label).map(c => c.label.map(v => Math.round(v * K)));
  for (const [x0, y0, x1, y1] of [...STATIC_AREAS, ...labelAreas])
    for (let y = Math.max(0, y0); y <= Math.min(IH - 1, y1); y++) r.label.fill(-1, y * IW + Math.max(0, x0), y * IW + Math.min(IW - 1, x1) + 1);
  buildNets(r);
  buildComponents(r);
  buildGround();

  overlay = document.createElement('canvas'); overlay.width = IW; overlay.height = IH; overlayCtx = overlay.getContext('2d');
  try { const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); if (saved.n === nets.length) paint = saved.paint || {}; } catch {}
  $('loading').hidden = true;
  try { saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch {}
  renderComps(); renderLegend(); renderSwitches(); rebuildOverlay(); fit(); renderList(); renderSaved();
  select(null); // 開場不選任何東西
}

// 粗電纜當成獨立線路：把路徑範圍內的像素歸給它，並補上線段供元件連線判斷
function addCables(r) {
  CABLES.forEach((c, i) => {
    const root = 10000000 + i;
    for (let j = 1; j < c.path.length; j++) {
      const [ax, ay] = c.path[j - 1], [bx, by] = c.path[j];
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      const hw = c.half ?? CABLE_HALF;
      for (let y = y0 - hw; y <= y1 + hw; y++) for (let x = x0 - hw; x <= x1 + hw; x++)
        if (x >= 0 && y >= 0 && x < IW && y < IH) r.label[y * IW + x] = root;
      r.segs.push({ h: ay === by, x0, x1, y0, y1, net: root, netCode: c.code, ground: !!c.ground });
    }
  });
}

// 依像素把線路網分組，記下外框與平均顏色
function buildNets(r) {
  const count = new Map();
  for (let i = 0; i < r.label.length; i++) if (r.label[i] >= 0) count.set(r.label[i], (count.get(r.label[i]) || 0) + 1);
  const netOfRoot = new Map();
  [...count.keys()].sort((a, c) => a - c).forEach((root, k) => {
    netOfRoot.set(root, k);
    nets.push({ pixels: new Int32Array(count.get(root)), n: 0, x0: IW, y0: IH, x1: 0, y1: 0, rgb: [0, 0, 0], segs: [], code: null });
  });
  label = r.label;
  const d = baseData.data;
  for (let i = 0; i < label.length; i++) if (label[i] >= 0) {
    const k = netOfRoot.get(label[i]), net = nets[k], x = i % IW, y = (i / IW) | 0;
    net.pixels[net.n++] = i; label[i] = k;
    net.rgb[0] += d[i * 4]; net.rgb[1] += d[i * 4 + 1]; net.rgb[2] += d[i * 4 + 2];
    if (x < net.x0) net.x0 = x; if (x > net.x1) net.x1 = x; if (y < net.y0) net.y0 = y; if (y > net.y1) net.y1 = y;
  }
  for (const s of r.segs) if (s.net >= 0 && netOfRoot.has(s.net)) { const net = nets[netOfRoot.get(s.net)]; net.segs.push(s); net.code = s.netCode; }
}

// 元件連到哪些線路：線段端點落在元件框內，而且線路有延伸到元件外面（排除元件符號自己的筆畫）
function buildComponents() {
  const S = IW / 1800, pad = 14;
  const ends = s => s.h ? [[s.x0, (s.y0 + s.y1) >> 1], [s.x1, (s.y0 + s.y1) >> 1]] : [[(s.x0 + s.x1) >> 1, s.y0], [(s.x0 + s.x1) >> 1, s.y1]];
  for (const c of COMPONENTS) {
    const [a, b, cc, d] = c.box.map(v => v * S);
    c.rect = [a, b, cc, d];
    c.labelRect = c.label ? c.label.map(v => v * S) : null;
    // 點擊與外框範圍：元件框＋文字標籤（文字整個在框內就不另外算）
    const L = c.labelRect, inBox = L && L[0] >= a && L[1] >= b && L[2] <= cc && L[3] <= d;
    c.hits = L && !inBox ? [c.rect, L] : [c.rect];
    const inside = (x, y) => x >= a - pad && x <= cc + pad && y >= b - pad && y <= d + pad;
    const far = (x, y) => x < a - 3 * pad || x > cc + 3 * pad || y < b - 3 * pad || y > d + 3 * pad;
    c.nets = [];
    nets.forEach((net, k) => {
      const pts = net.segs.flatMap(ends);
      if (pts.some(p => inside(...p)) && pts.some(p => far(...p))) c.nets.push(k);
    });
    // 人工指定：picks 是線上一點的全解析度座標，該點所在的線路一律算進這個元件（自動規則判斷不到的引線）
    for (const [x, y] of c.picks || []) { const k = label[y * IW + x]; if (k >= 0 && !c.nets.includes(k)) c.nets.push(k); }
  }
}

// 接地線：線色為 G；沒有標到線色的，看平均顏色是否偏綠（圖上 G 線畫成綠色）；再加上接到接地符號的線路
function buildGround() {
  for (const net of nets) {
    const [R, G, B] = net.rgb.map(v => v / net.pixels.length);
    net.ground = net.segs.some(s => s.ground) || (net.code ? net.code === 'G' : G > R + 25 && G > B + 15);
  }
  for (const c of COMPONENTS) if (c.ground) for (const k of c.nets) if (!nets[k].code || nets[k].code === 'G') nets[k].ground = true;
  groundLayer = document.createElement('canvas'); groundLayer.width = IW; groundLayer.height = IH;
  const g = groundLayer.getContext('2d'), img = g.createImageData(IW, IH);
  for (const net of nets) if (net.ground) stamp(img, 0, 0, IW, net, [255, 255, 255], 255, 2);
  g.putImageData(img, 0, 0);
}

// 把線路像素畫成膨脹 r 的色塊；fill 可以是 [r,g,b]、(x, y) => [r,g,b]（雙色條紋），或 null（用原圖顏色）
function stamp(img, ox, oy, w, net, fill, a, r = 1) {
  const d = img.data, h = img.height, src = baseData.data, fn = typeof fill === 'function';
  for (let j = 0; j < net.pixels.length; j++) {
    const p = net.pixels[j], x = (p % IW) - ox, y = ((p / IW) | 0) - oy;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const q = (yy * w + xx) * 4;
      const c = fn ? fill(xx + ox, yy + oy) : fill;
      if (c) { d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = a; }
      else { const s = ((yy + oy) * IW + xx + ox) * 4; d[q] = src[s]; d[q + 1] = src[s + 1]; d[q + 2] = src[s + 2]; d[q + 3] = 255; }
    }
  }
}
// 一條線路要畫的顏色：手動塗色優先，其次是線色代號（雙色線每 14px 夾一段 5px 的條紋色）
function netFill(k) {
  if (paint[k]) return hexRgb(paint[k]);
  const code = showCodes() && nets[k].code;
  if (!code) return null;
  const [main, stripe] = code.split('/').map(c => WIRE_RGB[c]);
  if (!main) return null;
  return stripe ? (x, y) => ((x + y) % 14 < 5 ? stripe : main) : main;
}
// 畫一組線路：先描深色外框，再填線色；r 決定粗細
function drawNets(img, ox, oy, w, ks, r) {
  for (const k of ks) if (netFill(k)) stamp(img, ox, oy, w, nets[k], OUTLINE, 255, r + 1);
  for (const k of ks) { const f = netFill(k); stamp(img, ox, oy, w, nets[k], f, 255, f ? r : 0); }
}
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const visibleNets = ks => ks.filter(k => !(hideGround() && nets[k].ground));
const selectedNets = sel => !sel ? [] : sel.kind === 'net' ? [sel.k] : visibleNets(sel.kind === 'multi' ? sel.ks : COMPONENTS[sel.i].nets);

// 選取或預覽的線路另外畫成粗線
function thickLayer(ks, r) {
  if (!ks.length) return null;
  let x0 = IW, y0 = IH, x1 = 0, y1 = 0;
  for (const k of ks) { const n = nets[k]; x0 = Math.min(x0, n.x0); y0 = Math.min(y0, n.y0); x1 = Math.max(x1, n.x1); y1 = Math.max(y1, n.y1); }
  const m = r + 2; x0 -= m; y0 -= m; const w = x1 - x0 + 2 * m + 1, h = y1 - y0 + 2 * m + 1;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const cx = c.getContext('2d'), img = cx.createImageData(w, h);
  for (const k of ks) stamp(img, x0, y0, w, nets[k], OUTLINE, 255, r + 1);
  for (const k of ks) { const f = netFill(k); stamp(img, x0, y0, w, nets[k], f || [70, 76, 82], 255, r); }
  cx.putImageData(img, 0, 0);
  return { c, x: x0, y: y0 };
}

// ---- 圈選細節 ----
const normRect = ({ x0, y0, x1, y1 }) => {
  const c = (v, m) => Math.min(m - 1, Math.max(0, Math.round(v)));
  return [c(Math.min(x0, x1), IW), c(Math.min(y0, y1), IH), c(Math.max(x0, x1), IW), c(Math.max(y0, y1), IH)];
};
// 選取的線落在任一框內的像素＝待修改的線段，畫成原本顯示顏色的反色
function rebuildDetail() {
  detailPixels = []; detailLayer = null;
  const ks = selectedNets(selection), rects = detail.rects;
  if (rects.length && ks.length) {
    const inside = (x, y) => rects.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
    const hits = [];
    for (const k of ks) { const f = netFill(k);
      for (const p of nets[k].pixels) { const x = p % IW, y = (p / IW) | 0;
        if (inside(x, y)) { detailPixels.push([x, y]); hits.push([x, y, (typeof f === 'function' ? f(x, y) : f) || [70, 76, 82]]); } } }
    if (hits.length) {
      const r = THIN + 1;
      let x0 = IW, y0 = IH, x1 = 0, y1 = 0;
      for (const [x, y] of hits) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      x0 -= r; y0 -= r; const w = x1 - x0 + r + 1, h = y1 - y0 + r + 1;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
      for (const [x, y, col] of hits) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const q = ((y - y0 + dy) * w + x - x0 + dx) * 4;
        d[q] = 255 - col[0]; d[q + 1] = 255 - col[1]; d[q + 2] = 255 - col[2]; d[q + 3] = 255;
      }
      g.putImageData(img, 0, 0); detailLayer = { c, x: x0, y: y0 };
    }
  }
  const has = ks.length > 0;
  $('detail-mode').disabled = !has; if (!has) $('detail-mode').checked = false;
  $('detail-undo').disabled = $('detail-clear').disabled = !rects.length;
}
const detailMode = () => $('detail-mode').checked && selectedNets(selection).length > 0;
$('detail-mode').onchange = () => { rebuildDetail(); saveMsg($('detail-mode').checked ? '在圖上拖曳畫框，框住有問題的線段；可畫多框（此時拖曳不會平移，滾輪仍可縮放）' : ''); };
$('detail-undo').onclick = () => { detail.rects.pop(); rebuildDetail(); updateSaveButtons(); draw(); };
$('detail-clear').onclick = () => { detail.rects = []; rebuildDetail(); updateSaveButtons(); draw(); };

function rebuildOverlay() {
  const img = overlayCtx.createImageData(IW, IH);
  drawNets(img, 0, 0, IW, visibleNets(nets.map((_, k) => k)), THIN);
  overlayCtx.putImageData(img, 0, 0);
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ n: nets.length, paint })); } catch {}
  draw();
}

// ---- 選取與預覽 ----
function describe(sel) {
  if (sel.kind === 'multi') {
    const codes = [...new Set(sel.ks.map(k => nets[k].code || '未標'))];
    if (sel.fromLegend) { const n = visibleNets(sel.ks).length, hidden = sel.ks.length - n;
      return { what: sel.title, meta: `共 ${n} 條線路` + (hidden ? `（另有 ${hidden} 條接地線已隱藏）` : '') + '。再點一次標籤取消。' }; }
    if (sel.title) return { what: sel.title, meta: '線色：' + codes.join('、') };
    return { what: `已選 ${sel.ks.length} 條線路`, meta: '線色：' + codes.join('、') + '。Shift＋點可再加入或移除。' };
  }
  if (sel.kind === 'comp') {
    const c = COMPONENTS[sel.i], n = visibleNets(c.nets).length, hidden = c.nets.length - n;
    return { what: c.name, meta: `連到 ${n} 條線路` + (hidden ? `（另有 ${hidden} 條接地線已隱藏）` : '') };
  }
  const net = nets[sel.k], linked = COMPONENTS.filter(c => c.nets.includes(sel.k)).map(c => c.name);
  const title = net.code ? `${net.code}（${codeName(net.code)}）` : '線路 ' + sel.k + '（未標線色）';
  return { what: title + (net.ground ? ' 接地' : ''), meta: linked.length ? '連接：' + linked.join('、') : '沒有偵測到連接的元件' };
}
function select(sel) {
  if (sel && sel.kind === 'comp' && sel.i < 0) sel = null;
  selection = sel;
  if (!sel || !sel.fromSwitch) $('switch-table').querySelectorAll('.on').forEach(el => el.classList.remove('on')); // 改選別的就取消開關表的反白
  selLayer = sel ? thickLayer(selectedNets(sel), THIN) : null;
  const key = selectedNets(sel).slice().sort((a, b) => a - b).join(',');
  if (key !== detail.key) { detail.key = key; detail.rects = []; detail.drag = null; }
  rebuildDetail();
  const d = sel && describe(sel);
  $('sel-what').textContent = d ? d.what : '無';
  $('sel-meta').textContent = d ? d.meta : '點圖上的元件或線條，或從下方元件清單挑一個。';
  $('sel-actions').hidden = $('sel-actions2').hidden = !sel;
  updateSaveButtons();
  $('comps').querySelectorAll('.comp').forEach((b, i) => b.setAttribute('aria-pressed', String(!!sel && sel.kind === 'comp' && sel.i === i)));
  $('legend').querySelectorAll('li').forEach(li => li.setAttribute('aria-pressed', String(!!sel && sel.fromLegend === li.dataset.code)));
  draw();
}
function setHover(h) {
  const key = h ? h.kind + (h.k ?? h.i) : '';
  if (key === (hover ? hover.key : '')) return;
  hover = h ? { ...h, key } : null;
  hoverLayer = h && h.kind === 'net' ? thickLayer([h.k], 2) : null;
  statusEl.textContent = !h ? '滑過元件或線條可預覽'
    : h.kind === 'comp' ? `${COMPONENTS[h.i].name}：點一下亮起相關線路`
    : (nets[h.k].code ? nets[h.k].code + '　' : '') + '點一下只選這條線';
  draw();
}

// 點擊位置對應到什麼：先找線條（元件框內要點得很準），找不到再看是不是元件
function hitTest(cx, cy) {
  if (!label) return null;
  const x = (cx - view.tx) / view.s, y = (cy - view.ty) / view.s;
  const ci = COMPONENTS.findIndex(c => c.hits.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]));
  const r = ci >= 0 ? 2 : Math.max(3, Math.round(8 / view.s));
  let best = -1, bd = Infinity;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = Math.round(x) + dx, yy = Math.round(y) + dy; if (xx < 0 || yy < 0 || xx >= IW || yy >= IH) continue;
    const k = label[yy * IW + xx], d = dx * dx + dy * dy;
    if (k >= 0 && d < bd && !(hideGround() && nets[k].ground) && (ci < 0 || COMPONENTS[ci].nets.includes(k))) { bd = d; best = k; }
  }
  if (best >= 0) return { kind: 'net', k: best };
  return ci >= 0 ? { kind: 'comp', i: ci } : null;
}

// ---- 繪製 ----
function resize() {
  const r = viewer.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  draw();
}
function outline(rect, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width / view.s;
  ctx.strokeRect(rect[0] - 4, rect[1] - 4, rect[2] - rect[0] + 8, rect[3] - rect[1] + 8);
}
// 元件本身的筆畫（框內不屬於線路的墨水、完全落在框內的線路、連到元件的線路）＋名稱文字；穿過框的其他線路不算
const compLayers = new Map();
function compLayer(i) {
  if (compLayers.has(i)) return compLayers.get(i);
  const c = COMPONENTS[i], pad = 14, own = new Set(c.nets);
  const [a, b, cc, d] = c.rect;
  nets.forEach((n, k) => { if (n.x0 >= a - pad && n.x1 <= cc + pad && n.y0 >= b - pad && n.y1 <= d + pad) own.add(k); });
  let x0 = IW, y0 = IH, x1 = 0, y1 = 0;
  for (const r of c.hits) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(IW - 1, Math.ceil(x1)); y1 = Math.min(IH - 1, Math.ceil(y1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), src = baseData.data;
  const inHits = (x, y) => c.hits.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * IW + x, k = label[i];
    if (!inHits(x, y) || (k >= 0 ? !own.has(k) : !(src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2] < 600))) continue;
    const q = ((y - y0) * w + x - x0) * 4;
    img.data[q] = src[i * 4]; img.data[q + 1] = src[i * 4 + 1]; img.data[q + 2] = src[i * 4 + 2]; img.data[q + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const L = { c: cv, x: x0, y: y0 }; compLayers.set(i, L); return L;
}
function draw() {
  if (!base) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s * dpr, 0, 0, view.s * dpr, view.tx * dpr, view.ty * dpr);
  ctx.imageSmoothingEnabled = view.s < 2;
  // 有選取時，其他線條與底圖淡化，只有選取的線保持不透明
  ctx.globalAlpha = selection ? 0.18 : $('dim').checked ? 0.3 : 1; ctx.drawImage(base, 0, 0); ctx.globalAlpha = 1;
  // 固定區域：以原圖亮度重畫，不隨選取變暗
  for (const [x0, y0, x1, y1] of STATIC_AREAS) { const w = x1 - x0 + 1, h = y1 - y0 + 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, y0, w, h); ctx.drawImage(base, x0, y0, w, h, x0, y0, w, h); }
  // 選取的元件：符號筆畫與名稱文字以原圖亮度疊上
  if (selection && selection.kind === 'comp') { const L = compLayer(selection.i); if (L) ctx.drawImage(L.c, L.x, L.y); }
  if (hideGround()) ctx.drawImage(groundLayer, 0, 0);
  ctx.globalAlpha = selection ? 0.22 : 1; ctx.drawImage(overlay, 0, 0); ctx.globalAlpha = 1;
  if (selLayer) ctx.drawImage(selLayer.c, selLayer.x, selLayer.y);
  if (detailLayer) ctx.drawImage(detailLayer.c, detailLayer.x, detailLayer.y);
  const boxes = detail.drag ? [...detail.rects, normRect(detail.drag)] : detail.rects;
  if (boxes.length) {
    ctx.save(); ctx.setLineDash([6 / view.s, 4 / view.s]); ctx.strokeStyle = '#e04aa0'; ctx.lineWidth = 1.5 / view.s;
    for (const [x0, y0, x1, y1] of boxes) ctx.strokeRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    ctx.restore();
  }
  if (hoverLayer && !(selection && selection.kind === 'net' && selection.k === hover.k)) ctx.drawImage(hoverLayer.c, hoverLayer.x, hoverLayer.y);
  if (selection && selection.kind === 'comp') for (const r of COMPONENTS[selection.i].hits) outline(r, '#2b2f33', 3);
  if (hover && hover.kind === 'comp' && !(selection && selection.kind === 'comp' && selection.i === hover.i)) for (const r of COMPONENTS[hover.i].hits) outline(r, 'rgba(43,47,51,.45)', 1.5);
}
function fit() {
  if (!base) return;
  const r = viewer.getBoundingClientRect();
  view.s = Math.min(r.width / IW, r.height / IH); view.tx = (r.width - IW * view.s) / 2; view.ty = (r.height - IH * view.s) / 2; draw();
}
function zoomAt(f, cx, cy) {
  const s = Math.min(6, Math.max(0.1, view.s * f)); f = s / view.s;
  view.tx = cx - (cx - view.tx) * f; view.ty = cy - (cy - view.ty) * f; view.s = s; draw();
}
function zoomTo([x0, y0, x1, y1]) {
  const r = viewer.getBoundingClientRect(), pad = 60;
  const s = Math.min(3, (r.width - pad) / (x1 - x0 + 1), (r.height - pad) / (y1 - y0 + 1));
  view.s = s; view.tx = r.width / 2 - (x0 + x1) / 2 * s; view.ty = r.height / 2 - (y0 + y1) / 2 * s; draw();
}

// Shift＋點：線條切換加入／移除，元件則把它的線全部加入
function addToSelection(hit) {
  const ks = new Set(selectedNets(selection));
  if (hit.kind === 'net') { if (ks.has(hit.k)) ks.delete(hit.k); else ks.add(hit.k); }
  else for (const k of visibleNets(COMPONENTS[hit.i].nets)) ks.add(k);
  const list = [...ks];
  select(!list.length ? null : list.length === 1 ? { kind: 'net', k: list[0] } : { kind: 'multi', ks: list });
}

// ---- 指標操作：拖曳平移、點擊選取、雙指縮放 ----
const pts = new Map(); let moved = false, pinch = null;
const local = e => { const r = viewer.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const toImage = ([cx, cy]) => [(cx - view.tx) / view.s, (cy - view.ty) / view.s];
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); moved = false;
  // 圈選細節：單指／左鍵拖曳畫框（不平移）
  if (pts.size === 1 && e.button === 0 && detailMode()) { const [x, y] = toImage(local(e)); detail.drag = { id: e.pointerId, x0: x, y0: y, x1: x, y1: y }; }
  else if (detail.drag) { detail.drag = null; draw(); }
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; } });
canvas.addEventListener('pointermove', e => {
  const p = local(e);
  if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') setHover(hitTest(...p)); return; }
  const prev = pts.get(e.pointerId); pts.set(e.pointerId, p);
  if (detail.drag && detail.drag.id === e.pointerId) { [detail.drag.x1, detail.drag.y1] = toImage(p); draw(); return; }
  if (pts.size === 2 && pinch) {
    const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAt(d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch.d = d; moved = true; return;
  }
  const dx = p[0] - prev[0], dy = p[1] - prev[1];
  if (moved || Math.abs(dx) + Math.abs(dy) > 3) { moved = true; viewer.classList.add('panning'); view.tx += dx; view.ty += dy; draw(); }
});
const end = e => {
  if (detail.drag && detail.drag.id === e.pointerId) {
    const r = normRect(detail.drag); detail.drag = null;
    // 太小的框視為誤觸；圈選模式下單純點擊不改變選取，免得框好的範圍被清掉
    if (e.type === 'pointerup' && r[2] - r[0] >= 2 && r[3] - r[1] >= 2) {
      const before = detailPixels.length;
      detail.rects.push(r); rebuildDetail();
      if (detailPixels.length === before) { detail.rects.pop(); rebuildDetail(); saveMsg('框內沒有選取的線段（或已框過），換個位置再框', true); }
      else saveMsg(`已圈選 ${detail.rects.length} 框，共 ${detailPixels.length} 個線段像素`);
      updateSaveButtons();
    }
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null; draw(); return;
  }
  if (pts.has(e.pointerId) && !moved && pts.size === 1 && e.type === 'pointerup') {
    const hit = hitTest(...local(e));
    if (e.shiftKey && hit) addToSelection(hit);
    else {
      const same = hit && selection && hit.kind === selection.kind && (hit.k ?? hit.i) === (selection.k ?? selection.i);
      select(same ? null : hit);
    }
  }
  pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) viewer.classList.remove('panning');
};
canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
canvas.addEventListener('pointerleave', () => { if (!pts.size) setHover(null); });
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), ...local(e)); }, { passive: false });
$('zoom-in').onclick = () => { const r = viewer.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); };
$('zoom-out').onclick = () => { const r = viewer.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); };
$('zoom-fit').onclick = fit;
$('dim').onchange = draw;
$('hide-ground').onchange = () => {
  rebuildOverlay();
  if (selection && selection.kind === 'net' && nets[selection.k].ground && hideGround()) select(null); else select(selection);
};
$('show-codes').onchange = () => { rebuildOverlay(); select(selection); };
$('sel-clear').onclick = () => select(null);
$('sel-zoom').onclick = () => {
  if (!selection) return;
  const rects = selectedNets(selection).map(k => [nets[k].x0, nets[k].y0, nets[k].x1, nets[k].y1]);
  if (selection.kind === 'comp') rects.push(...COMPONENTS[selection.i].hits);
  zoomTo([0, 1, 2, 3].map(i => (i < 2 ? Math.min : Math.max)(...rects.map(r => r[i]))));
};

// ---- 色票：把目前選取的線路塗色 ----
const swatchBox = $('swatches');
for (const c of [...COLORS, { hex: null, name: '清除顏色' }]) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'swatch' + (c.hex ? '' : ' eraser');
  b.title = c.name; b.setAttribute('aria-label', c.hex ? '塗成' + c.name : c.name);
  if (c.hex) b.style.background = c.hex; else b.textContent = '✕';
  b.onclick = () => {
    for (const k of selectedNets(selection)) { if (c.hex) paint[k] = c.hex; else delete paint[k]; }
    rebuildOverlay(); renderList(); select(selection);
  };
  swatchBox.append(b);
}

// ---- 開關導通表：下拉選單切換開關，一次顯示一張表；點檔位列標出導通的接腳 ----
function renderSwitches() {
  const list = window.WOLF_SWITCHES || [];
  $('switches').hidden = !list.length;
  if (!list.length) return;
  const sel = $('switch-select'), key = 'wolf125-switch' + KEY_SUFFIX;
  sel.replaceChildren(...list.map((sw, i) => new Option(sw.name, i)));
  try { const v = localStorage.getItem(key); if (v !== null && list[+v]) sel.value = v; } catch {}
  const show = () => {
    try { localStorage.setItem(key, sel.value); } catch {}
    const sw = list[+sel.value], table = $('switch-table');
    // 接腳 → 線路：取接腳座標附近的線路像素
    const netOf = t => {
      const p = sw.pins && sw.pins[t]; if (!p) return -1;
      for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = p[0] + dx, y = p[1] + dy, k = x >= 0 && y >= 0 && x < IW && y < IH ? label[y * IW + x] : -1;
        if (k >= 0) return k;
      }
      return -1;
    };
    const pinName = t => { const k = netOf(t); return k >= 0 && nets[k].code ? `${t}（${nets[k].code}）` : t; };
    const light = (ks, title, onEl) => {
      table.querySelectorAll('.on').forEach(el => el.classList.remove('on'));
      ks = [...new Set(ks.filter(k => k >= 0))];
      select(ks.length ? { kind: 'multi', ks, title, fromSwitch: true } : null);
      if (onEl) onEl.classList.add('on');
    };
    const head = document.createElement('tr'), corner = document.createElement('th');
    corner.className = 'corner'; corner.innerHTML = '<span>接腳</span><span>檔位</span>';
    head.append(corner, ...sw.terminals.map(t => {
      const th = document.createElement('th'), k = netOf(t);
      th.scope = 'col'; th.textContent = t;
      if (k >= 0) {
        if (nets[k].code) { const c = document.createElement('small'); c.textContent = nets[k].code; th.append(c); }
        th.tabIndex = 0; th.title = '在線路圖上亮起這支接腳的線';
        const go = () => { light([k], `${sw.name} ${pinName(t)}`, th); $('switch-msg').textContent = `${pinName(t)} 的線已在圖上亮起。`; };
        th.onclick = go; th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      }
      return th;
    }));
    const rows = sw.positions.map(pos => {
      const tr = document.createElement('tr'), th = document.createElement('th');
      th.scope = 'row'; th.textContent = pos.label;
      const cells = sw.terminals.map(() => document.createElement('td'));
      for (const [a, b] of pos.conn) {
        const [i, j] = [sw.terminals.indexOf(a), sw.terminals.indexOf(b)].sort((p, q) => p - q);
        for (let k = i; k <= j; k++) cells[k].classList.add(k === i ? 'start' : k === j ? 'end' : 'mid');
      }
      tr.tabIndex = 0;
      tr.setAttribute('aria-label', pos.label + '：' + (pos.conn.length ? pos.conn.map(c => c.join(' 與 ')).join('、') + ' 導通' : '不導通'));
      const pick = () => {
        light(pos.conn.flat().map(netOf), `${sw.name}：${pos.label}`, tr);
        $('switch-msg').textContent = `${pos.label}：` + (pos.conn.length ? pos.conn.map(c => c.map(pinName).join(' ↔ ')).join('、') + ' 導通，已在圖上亮起' : '全部不導通');
      };
      tr.onclick = pick; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
      tr.append(th, ...cells);
      return tr;
    });
    table.replaceChildren(head, ...rows);
    $('switch-msg').textContent = sw.pins ? '點檔位，圖上會亮起導通的線；點表頭接腳，亮起那支接腳的線。' : '點一個檔位，看哪些接腳導通。';
  };
  sel.onchange = show; show();
}

// ---- 側欄清單 ----
function renderLegend() {
  const used = new Set(nets.map(n => n.code).filter(Boolean));
  const box = $('legend');
  for (const code of [...used].sort((a, c) => a.length - c.length || a.localeCompare(c))) {
    const [m, st] = code.split('/').map(c => WIRE[c] && WIRE[c][0]);
    if (!m) continue;
    const li = document.createElement('li'), bar = document.createElement('span'), t = document.createElement('span');
    bar.className = 'bar';
    bar.style.background = st ? `repeating-linear-gradient(90deg, ${m} 0 6px, ${st} 6px 9px)` : m;
    t.innerHTML = `<span class="code"></span> `; t.firstChild.textContent = code; t.append(codeName(code));
    li.append(bar, t); box.append(li);
    // 點標籤：亮起這個線色的所有線路；再點一次取消
    li.dataset.code = code; li.tabIndex = 0; li.setAttribute('role', 'button'); li.setAttribute('aria-pressed', 'false');
    li.title = `亮起所有 ${code} 線`;
    const pick = () => {
      if (selection && selection.fromLegend === code) return select(null);
      const ks = nets.map((n, k) => n.code === code ? k : -1).filter(k => k >= 0);
      select({ kind: 'multi', ks, title: `${code}（${codeName(code)}）全部線路`, fromLegend: code });
    };
    li.onclick = pick; li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
  }
}
function renderComps() {
  const box = $('comps');
  COMPONENTS.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'comp' + (c.ground ? ' ground' : ''); b.textContent = c.name;
    b.onclick = e => {
      if (e.shiftKey) return addToSelection({ kind: 'comp', i }); const same = selection && selection.kind === 'comp' && selection.i === i; select(same ? null : { kind: 'comp', i }); };
    box.append(b);
  });
}
function renderList() {
  const list = $('list'); list.replaceChildren();
  const entries = Object.entries(paint).sort((a, c) => a[1].localeCompare(c[1]) || a[0] - c[0]);
  for (const [k, hex] of entries) {
    const li = document.createElement('li'), chip = document.createElement('span'), name = document.createElement('span');
    chip.className = 'chip'; chip.style.background = hex;
    name.className = 'name'; name.textContent = '線路 ' + k;
    const go = document.createElement('button'); go.className = 'icon-btn'; go.type = 'button'; go.textContent = '選取';
    go.onclick = () => select({ kind: 'net', k: +k });
    const rm = document.createElement('button'); rm.className = 'icon-btn'; rm.type = 'button'; rm.textContent = '移除';
    rm.onclick = () => { delete paint[k]; rebuildOverlay(); renderList(); select(selection); };
    li.append(chip, name, go, rm); list.append(li);
  }
  $('empty').hidden = entries.length > 0;
  $('clear').hidden = entries.length === 0;
}
$('clear').onclick = () => { paint = {}; rebuildOverlay(); renderList(); select(selection); };

// ---- 已儲存的選取 ----
const storeSaved = () => { try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch {} };
const pickOf = k => { const p = nets[k].pixels[nets[k].pixels.length >> 1]; return [p % IW, (p / IW) | 0]; };
const netsOf = entry => [...new Set(entry.picks.map(([x, y]) => label[y * IW + x]).filter(k => k >= 0))];
// 名稱決定能做什麼：新名稱只能新增；已存在的名稱只能修改（覆蓋）或刪除
// 選取與細節同名成對，各算一筆：savedIndex 找選取、detailIndex 找細節
const isDetail = e => e.kind === 'detail';
const savedIndex = name => saved.findIndex(e => e.name === name && !isDetail(e));
const detailIndex = name => saved.findIndex(e => e.name === name && isDetail(e));
const detailEntry = name => detailPixels.length
  ? { name, kind: 'detail', savedAt: new Date().toISOString(), rects: detail.rects.map(r => [...r]), pixels: detailPixels.map(p => [...p]) }
  : null;
// 寫入（或移除）name 的細節：目前沒有圈選就刪掉舊的
function putDetail(name) {
  const e = detailEntry(name), i = detailIndex(name);
  if (e && i >= 0) saved[i] = e; else if (e) saved.splice(savedIndex(name) + 1, 0, e); else if (i >= 0) saved.splice(i, 1);
  return e;
}
const detailNote = e => e ? `＋細節 ${e.rects.length} 框／${e.pixels.length} 像素` : '';
function updateSaveButtons() {
  const name = $('save-name').value.trim(), exists = name && savedIndex(name) >= 0, has = selectedNets(selection).length > 0;
  $('add-btn').disabled = !has || exists;
  $('update-btn').disabled = !has || !exists;
  $('delete-btn').disabled = !exists;
}
function saveMsg(text, error) { const m = $('save-msg'); m.textContent = text; m.classList.toggle('error', !!error); }
$('save-name').oninput = () => { updateSaveButtons(); saveMsg(''); };
$('add-btn').onclick = () => {
  const ks = selectedNets(selection); if (!ks.length) return;
  const name = $('save-name').value.trim() || (selection.kind === 'comp' ? COMPONENTS[selection.i].name : describe(selection).what);
  if (savedIndex(name) >= 0) return saveMsg(`「${name}」已經存在，要覆蓋請按「修改」`, true);
  saved.push({ name, savedAt: new Date().toISOString(), picks: ks.map(pickOf) });
  const de = putDetail(name);
  $('save-name').value = name; storeSaved(); renderSaved(); updateSaveButtons(); saveMsg(`已新增「${name}」（${ks.length} 條線路${detailNote(de)}）`);
};
$('update-btn').onclick = () => {
  const ks = selectedNets(selection), name = $('save-name').value.trim(), i = savedIndex(name);
  if (!ks.length || i < 0) return;
  saved[i] = { name, savedAt: new Date().toISOString(), picks: ks.map(pickOf) };
  const de = putDetail(name);
  storeSaved(); renderSaved(); saveMsg(`已修改「${name}」（${ks.length} 條線路${detailNote(de)}）`);
};
$('delete-btn').onclick = () => {
  const name = $('save-name').value.trim(), i = savedIndex(name);
  if (i < 0 || !confirm(`刪除「${name}」${detailIndex(name) >= 0 ? '（含細節）' : ''}？`)) return;
  saved = saved.filter(e => e.name !== name); $('save-name').value = '';
  storeSaved(); renderSaved(); updateSaveButtons(); saveMsg(`已刪除「${name}」`);
};
$('save-name').onkeydown = e => {
  if (e.key !== 'Enter') return;
  if (!$('add-btn').disabled) $('add-btn').click(); else if (!$('update-btn').disabled) $('update-btn').click();
};
function renderSaved() {
  const list = $('saved'); list.replaceChildren();
  saved.forEach(entry => {
    const li = document.createElement('li'), name = document.createElement('span'), count = document.createElement('span');
    name.className = 'name'; name.textContent = entry.name;
    count.className = 'count';
    count.textContent = isDetail(entry) ? ` 細節 ${entry.rects.length} 框／${entry.pixels.length} 像素` : ` ${entry.picks.length} 條`; name.append(count);
    const go = document.createElement('button'); go.className = 'icon-btn'; go.type = 'button'; go.textContent = '載入';
    // 選取與細節一起載入：先選線，再放回圈選的框
    go.onclick = () => {
      const si = savedIndex(entry.name), di = detailIndex(entry.name);
      const ks = si >= 0 ? netsOf(saved[si]) : [];
      $('save-name').value = entry.name;
      select(!ks.length ? null : ks.length === 1 ? { kind: 'net', k: ks[0] } : { kind: 'multi', ks });
      if (di >= 0 && ks.length) { detail.rects = saved[di].rects.map(r => [...r]); rebuildDetail(); updateSaveButtons(); draw(); }
      saveMsg(`已載入「${entry.name}」${di >= 0 ? `（含細節 ${saved[di].rects.length} 框）` : ''}，可再 Shift＋點或勾「圈選細節」調整後按「修改」`);
    };
    li.append(name, go); list.append(li);
  });
  $('saved-empty').hidden = saved.length > 0;
  $('export-btn').disabled = $('wipe-btn').disabled = saved.length === 0;
}
// 清空：刪掉這張圖所有已儲存的選取（localStorage 一併移除）；其他圖與塗色不受影響
$('wipe-btn').onclick = () => {
  if (!confirm(`清空 ${DIAGRAM.id} 全部 ${saved.length} 筆已儲存的選取？此動作無法復原，需要的話先「匯出 JSON」備份。`)) return;
  saved = []; try { localStorage.removeItem(SAVED_KEY); } catch {}
  $('save-name').value = ''; renderSaved(); updateSaveButtons(); saveMsg(`已清空 ${DIAGRAM.id} 的已儲存選取`);
};

// 匯入：接受「匯出 JSON」的檔案（也接受 localStorage 的原始陣列），與現有的聯集
// 同名且內容相同就略過；同名但內容不同時保留現有的，匯入的改名為「名稱（匯入）」
const samePicks = (a, b) => JSON.stringify([...a].map(String).sort()) === JSON.stringify([...b].map(String).sort());
const validPick = p => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] < IW && p[1] < IH;
$('import-btn').onclick = () => $('import-file').click();
$('import-file').onchange = async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  let entries, details;
  try {
    const data = JSON.parse(await file.text());
    if (data.diagram && data.diagram !== DIAGRAM.id) throw new Error(`這是 ${data.diagram} 的選取，目前開的是 ${DIAGRAM.id}`);
    const list = Array.isArray(data) ? data : data.selections;
    if (!Array.isArray(list)) throw new Error('找不到 selections');
    entries = list.filter(x => !isDetail(x)).map(x => ({
      name: String(x.name || '').trim(), savedAt: x.savedAt || new Date().toISOString(),
      picks: (x.picks || (x.nets || []).map(n => n.pick)).filter(validPick),
    })).filter(x => x.name && x.picks.length);
    // 細節：匯出檔放在 details，localStorage 原始陣列則混在同一個陣列（kind: 'detail'）
    const validRect = r => Array.isArray(r) && r.length === 4 && validPick(r.slice(0, 2)) && validPick(r.slice(2));
    details = [...(data.details || []), ...list.filter(isDetail)].map(x => ({
      name: String(x.name || '').trim(), kind: 'detail', savedAt: x.savedAt || new Date().toISOString(),
      rects: (x.rects || []).filter(validRect), pixels: (x.pixels || []).filter(validPick),
    })).filter(x => x.name && x.rects.length && x.pixels.length);
  } catch (err) { return saveMsg(`匯入失敗：${err.message}`, true); }
  let added = 0, skipped = 0, renamed = 0;
  const rename = new Map(); // 匯入的選取若同名改名，成對的細節跟著改
  for (const entry of entries) {
    const i = savedIndex(entry.name), orig = entry.name;
    if (i >= 0 && samePicks(saved[i].picks, entry.picks)) { skipped++; continue; }
    if (i >= 0) {
      let name = `${entry.name}（匯入）`, n = 2;
      while (savedIndex(name) >= 0) name = `${entry.name}（匯入 ${n++}）`;
      entry.name = name; renamed++;
    }
    rename.set(orig, entry.name);
    saved.push(entry); added++;
  }
  // 細節只跟著新加入的選取進來；選取已存在（略過）時保留現有的細節
  for (const d of details) {
    if (!rename.has(d.name)) { skipped++; continue; }
    d.name = rename.get(d.name);
    const i = detailIndex(d.name); if (i >= 0) saved[i] = d; else saved.splice(savedIndex(d.name) + 1, 0, d);
    added++;
  }
  storeSaved(); renderSaved(); updateSaveButtons();
  saveMsg(`匯入 ${added} 筆` + (renamed ? `（其中 ${renamed} 筆同名改名）` : '') + (skipped ? `，${skipped} 筆已存在略過` : ''));
};

// 匯出：每條線附上線色、外框、線段座標與連接的元件，方便離開這個頁面後判讀
$('export-btn').onclick = () => {
  const out = {
    source: DIAGRAM.source, diagram: DIAGRAM.id, imageSize: [IW, IH], exportedAt: new Date().toISOString(),
    // 細節另放 details（與同名的 selections 成對），selections 維持原格式，驗收腳本照舊可讀
    details: saved.filter(isDetail).map(e => ({
      name: e.name, savedAt: e.savedAt, rects: e.rects, pixelCount: e.pixels.length,
      nets: [...new Set(e.pixels.map(([x, y]) => label[y * IW + x]).filter(k => k >= 0))].map(k => ({ id: k, code: nets[k].code, pick: pickOf(k) })),
      pixels: e.pixels,
    })),
    selections: saved.filter(e => !isDetail(e)).map(entry => ({
      name: entry.name, savedAt: entry.savedAt,
      nets: netsOf(entry).map(k => {
        const n = nets[k];
        return {
          id: k, code: n.code, ground: n.ground, pick: pickOf(k), bbox: [n.x0, n.y0, n.x1, n.y1],
          components: COMPONENTS.filter(c => c.nets.includes(k)).map(c => c.name),
          segments: n.segs.map(s => [s.x0, s.y0, s.x1, s.y1]),
        };
      }),
    })),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = DIAGRAM.id === 'PA12B' ? 'wolf125-selections.json' : `wolf125-${DIAGRAM.id}-selections.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// ---- 切換線路圖：重新載入頁面，各圖的辨識結果、塗色與儲存的選取互不影響 ----
document.title = `${DIAGRAM.title} ${DIAGRAM.id}`;
$('diagram-title').textContent = DIAGRAM.title;
for (const d of DIAGRAMS) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn'; b.textContent = d.id; b.setAttribute('aria-pressed', String(d.id === DIAGRAM.id));
  b.onclick = () => { if (d.id !== DIAGRAM.id) location.search = '?d=' + d.id; };
  $('diagram-switch').append(b);
}

new ResizeObserver(() => { const had = canvas.width > 0; resize(); if (!had) fit(); }).observe(viewer);
init().catch(err => { $('loading').textContent = '圖片載入失敗：' + err.message; });
