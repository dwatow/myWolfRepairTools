// 元件內圖元寫入 drawing.js：DIAGRAM=<圖> node tools/redraw/add-parts.js
// 讀 tools/redraw/parts-manual.js，只改寫 drawing.js 的 parts 欄位（drawing.js 已手改也可執行，其他欄位原樣保留）
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, DIAGRAM } = require('./lib');
const { replaceFields } = require('./write-drawing');
const file = path.join(PROJECT, 'data', DIAGRAM, 'drawing.js'), text = fs.readFileSync(file, 'utf8'), win = {};
vm.runInNewContext(text, { window: win });
const groups = require('./parts-manual')[DIAGRAM] || {};
const parts = Object.entries(groups).flatMap(([comp, list]) => list.map(p => ({ ...p, comp })));
fs.writeFileSync(file, replaceFields(text, { parts }, ['parts'])); // 只改寫 parts 那一段，其他欄位與手寫註解不動
const by = parts.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {});
console.log(`${DIAGRAM}：${Object.keys(groups).length} 個元件、圖元 ${parts.length}`, by);
