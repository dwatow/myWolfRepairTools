// drawing.js 的寫出格式：檔頭註解＋ window.WOLF_DRAWING，線路網與標記每筆一行（方便 diff 與手改）
const J = JSON.stringify;
const HEADER = `// 線路圖資料：以線路網為單位寫明導線（折線，每段水平或垂直）、接點圓點；陣列順序就是線路編號
// 座標是全解析度（3323×2188，原點左上）。code：線色代號（null = 未標線色，畫成深灰色）；ground：接地線；cable：粗電纜（half 為半寬）
// labels：線色文字 { text, at: 中心, vertical }；inline：單線接頭 { kind: 'plug' | 'socket', at: 中心, dir: 'h' | 'v', flip? }（plug 尖端朝 +x／+y，flip 反向）
// connectors：多腳接頭 { label: '3P', box: [x0, y0, x1, y1] }；texts：圖名等 { text, at, size }
// parts：元件內的圖元 { type: 'symbol', kind, box, dir? } | { type: 'pin', name, at, vertical?, textAt? } | { type: 'text', text, at, size, vertical?, bold? }
//        | { type: 'connector', label, box } | { type: 'frame', box }（kind 見 js/basemap.js 的 drawSymbol）
// 草稿由 tools/redraw/bootstrap.js、add-marks.js 從影像辨識結果產生，之後以手改為準`;
function formatDrawing(d, header = HEADER) {
  const list = (name, arr, note) => [`  ${name}: [`, ...arr.map((x, k) => `    ${J(x)},${note ? ` // ${k}` : ''}`), '  ],'];
  return `${header}
window.WOLF_DRAWING = {
  size: ${J(d.size)},
${[...list('nets', d.nets, true), ...['connectors', 'inline', 'labels', 'texts', 'parts'].flatMap(f => list(f, d[f] || []))].join('\n')}
};
`;
}
// 讀出既有檔案的檔頭（window.WOLF_DRAWING 之前的註解）
const headerOf = text => text.slice(0, text.indexOf('window.WOLF_DRAWING')).trimEnd();
// 只替換 parts（元件內的圖元，tools/redraw/add-parts.js 擁有這個欄位），其他欄位不動
const applyParts = (d, parts) => Object.assign(d, { parts });
// 線路網以外、由人工判讀產生的欄位：bootstrap.js 重產線路網時原樣保留
const KEEP_FIELDS = ['connectors', 'inline', 'labels', 'texts', 'parts'];
module.exports = { formatDrawing, headerOf, HEADER, applyParts, KEEP_FIELDS };
