// 擷取舊線路編號的代表座標：DIAGRAM=<圖> node tools/redraw/capture-legacy.js
// 必須在網頁改由 drawing.js 產生線路「之前」、在 Chrome 裡執行（舊塗色存的是 Chrome 裡的線路編號，Node 解碼略有差異）
// 輸出 data/<圖>/legacy.js：window.WOLF_LEGACY = { n, picks }，picks[k] 是舊線路 k 上的一點
const fs = require('fs'), path = require('path');
const { PROJECT, DIAGRAM } = require('../../.claude/skills/fixing-wire-nets/scripts/lib');
const { evalInPage } = require('./chrome');

const out = evalInPage(() => {
  const picks = nets.map((_, k) => pickOf(k));
  const bad = picks.filter(([x, y], k) => label[y * IW + x] !== k).length;
  return { n: nets.length, picks, bad };
}, { diagram: DIAGRAM });
const file = path.join(PROJECT, 'data', DIAGRAM, 'legacy.js');
if (out.bad > 0 || out.picks.length !== out.n) { console.log(`${DIAGRAM}：n=${out.n}，bad=${out.bad}，不寫檔`); process.exit(1); }
fs.writeFileSync(file, `// 舊版（影像辨識）線路編號 k → 該線路上一點的座標，只用來把舊塗色（wolf125-paint-v3）轉成以座標儲存
// 由 tools/redraw/capture-legacy.js 在 Chrome 擷取，不要手改
window.WOLF_LEGACY = ${JSON.stringify({ n: out.n, picks: out.picks })};
`);
console.log(`${DIAGRAM}：n=${out.n}，bad=${out.bad}，已寫 data/${DIAGRAM}/legacy.js`);
