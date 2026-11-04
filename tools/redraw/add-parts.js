// 元件內圖元寫入 drawing.js：DIAGRAM=<圖> node tools/redraw/add-parts.js
// 讀 tools/redraw/parts-manual.js，只改寫 drawing.js 的 parts 欄位（drawing.js 已手改也可執行，其他欄位原樣保留）
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, DIAGRAM } = require('./lib');
const { formatDrawing, headerOf, applyParts } = require('./write-drawing');
const file = path.join(PROJECT, 'data', DIAGRAM, 'drawing.js'), text = fs.readFileSync(file, 'utf8'), win = {};
vm.runInNewContext(text, { window: win });
const groups = require('./parts-manual')[DIAGRAM] || {};
const parts = Object.entries(groups).flatMap(([comp, list]) => list.map(p => ({ ...p, comp })));
fs.writeFileSync(file, formatDrawing(applyParts(win.WOLF_DRAWING, parts), headerOf(text)));
const by = parts.reduce((a, p) => (a[p.type] = (a[p.type] || 0) + 1, a), {});
console.log(`${DIAGRAM}：${Object.keys(groups).length} 個元件、圖元 ${parts.length}`, by);
