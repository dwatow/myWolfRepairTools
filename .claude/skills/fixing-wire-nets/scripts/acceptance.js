// 用真的 Chrome（headless）載入 index.html 驗收：瀏覽器的 JPEG 解碼與 Node 有差，最終以這個為準
// node acceptance.js [額外檢查點 x,y=x,y …]  例：1042,831=1050,837 → 兩點須屬同一線路網
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { PROJECT, WORK, DIAGRAM, SELECTIONS } = require('./lib');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// 這張圖還沒有接線單元匯出檔時，只檢查額外的檢查點
const sel = fs.existsSync(SELECTIONS) ? fs.readFileSync(SELECTIONS, 'utf8') : (console.log('（沒有', path.basename(SELECTIONS), '，只檢查檢查點）'), '{"selections":[]}');
const pairs = process.argv.slice(2).map(a => a.split('=').map(p => p.split(',').map(Number)));
const probe = `<script>window.SEL=${sel};window.PAIRS=${JSON.stringify(pairs)};
(function w(){if(!document.getElementById('loading').hidden)return setTimeout(w,200);
const at=([x,y])=>label[y*IW+x];
const o=SEL.selections.map(s=>s.name+':'+new Set(s.nets.map(n=>at(n.pick))).size);
const p=PAIRS.map(([a,b])=>a+'='+b+':'+(at(a)>=0&&at(a)===at(b)));
document.title='RESULT '+o.join(' ')+' | '+p.join(' ')+' | nets:'+nets.length;})();</script></body>`;
const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8')
  .replace('<head>', `<head><base href="file://${PROJECT}/">`).replace('</body>', probe);
fs.mkdirSync(WORK, { recursive: true });
const page = path.join(WORK, 'acceptance.html'); fs.writeFileSync(page, html);
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
  `--user-data-dir=${path.join(WORK, 'chrome-prof')}`, '--virtual-time-budget=120000', '--dump-dom', 'file://' + page + '?d=' + DIAGRAM],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
const t = (dom.match(/<title>([^<]*)/) || [])[1] || '（沒有結果：頁面可能報錯或逾時）';
console.log(t);
const [units = '', checks = ''] = t.replace(/^RESULT /, '').split(' | ');
const ok = t.startsWith('RESULT') && units.split(' ').filter(Boolean).every(u => u.endsWith(':1')) && checks.split(' ').filter(Boolean).every(c => c.endsWith(':true'));
console.log(ok ? 'PASS' : 'FAIL');
process.exitCode = ok ? 0 : 1;
