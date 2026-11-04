// 在現有 drawing.js（可已手改）上重新切導線缺口：DIAGRAM=<圖> node tools/redraw/recut.js
// 先套用 tools/redraw/nets-manual.js、整理線段（tidyNet）；線色文字兩側留白、單線接頭處切到邊緣、多腳接頭方框內的導線切到框邊；切完一段不剩的未標色線路移除。可重複執行，其他欄位原樣保留
const fs = require('fs'), path = require('path'), vm = require('vm');
const { PROJECT, DIAGRAM } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { cutWires, dropMarkStrokes } = require('./marks');
const { formatDrawing, headerOf } = require('./write-drawing');
const { applyNetsManual, MANUAL } = require('./nets-manual');
const { tidyNet } = require('./draft');
const file = path.join(PROJECT, 'data', DIAGRAM, 'drawing.js'), text = fs.readFileSync(file, 'utf8'), win = {};
vm.runInNewContext(text, { window: win });
const d = win.WOLF_DRAWING, before = d.nets.reduce((a, n) => a + n.wires.length, 0);
for (const line of applyNetsManual(d, MANUAL[DIAGRAM])) console.log('  ' + line); // 線路網的人工修正
for (const net of d.nets) tidyNet(net); // 疊在一起、差 1～2 px 的段落整理成乾淨的轉角
cutWires(d); const dropped = dropMarkStrokes(d);
fs.writeFileSync(file, formatDrawing(d, headerOf(text)));
console.log(`${DIAGRAM}：導線段 ${before} → ${d.nets.reduce((a, n) => a + n.wires.length, 0)}；移除未標色線路 ${dropped} 條；線路網 ${d.nets.length} 條`);
