// drawing.js 的寫出格式：檔頭註解＋ window.WOLF_DRAWING，線路網與標記每筆一行（方便 diff 與手改）
const J = JSON.stringify;
const HEADER = `// 線路圖資料：以線路網為單位寫明導線（折線，每段水平或垂直）、接點圓點；陣列順序就是線路編號
// 座標是全解析度（3323×2188，原點左上）。code：線色代號（null = 未標線色，畫成深灰色）；ground：接地線；cable：粗電纜（half 為半寬）
// labels：線色文字 { text, at: 中心, vertical }；inline：單線接頭 { kind: 'plug' | 'socket', at: 中心, dir: 'h' | 'v', flip? }（plug 尖端朝 +x／+y，flip 反向）
// connectors：多腳接頭 { label: '3P', box: [x0, y0, x1, y1] }；texts：圖名等 { text, at, size }
// parts：元件內的圖元 { type: 'symbol', kind, box, dir? } | { type: 'pin', name, at, vertical?, textAt? } | { type: 'text', text, at, size, vertical?, bold? }
//        | { type: 'connector', label, box } | { type: 'frame', box }（kind 見 js/basemap.js 的 drawSymbol）
// 草稿由 tools/redraw/bootstrap.js、add-marks.js 從影像辨識結果產生，之後以手改為準`;
// 一個欄位的寫法：`  name: [`、每筆一行、`  ],`；線路網加上編號註解
const list = (name, arr, note = name === 'nets') => [`  ${name}: [`, ...arr.map((x, k) => `    ${J(x)},${note ? ` // ${k}` : ''}`), '  ],'];
function formatDrawing(d, header = HEADER) {
  return `${header}
window.WOLF_DRAWING = {
  size: ${J(d.size)},
${[...list('nets', d.nets), ...['connectors', 'inline', 'labels', 'texts', 'parts'].flatMap(f => list(f, d[f] || []))].join('\n')}
};
`;
}
// 讀出既有檔案的檔頭（window.WOLF_DRAWING 之前的註解）
const headerOf = text => text.slice(0, text.indexOf('window.WOLF_DRAWING')).trimEnd();
// 只替換 parts（元件內的圖元，tools/redraw/add-parts.js 擁有這個欄位），其他欄位不動
const applyParts = (d, parts) => Object.assign(d, { parts });
// 線路網以外、由人工判讀產生的欄位：bootstrap.js 重產線路網時原樣保留
const KEEP_FIELDS = ['connectors', 'inline', 'labels', 'texts', 'parts'];
// 在既有檔案文字上只替換 fields 這幾個欄位（整段 `  name: [` … `  ],`），其他欄位與手寫註解原樣保留；檔案裡沒有該欄位就加在結尾 `};` 前
function replaceFields(text, d, fields) {
  for (const f of fields) {
    const block = list(f, d[f] || []).join('\n') + '\n';
    const re = new RegExp(`^  ${f}: \\[\\n[\\s\\S]*?^  \\],\\n`, 'm');
    text = re.test(text) ? text.replace(re, () => block) : text.replace(/^};\s*$/m, () => block + '};');
  }
  return text;
}
module.exports = { formatDrawing, headerOf, HEADER, applyParts, KEEP_FIELDS, replaceFields };
