// 用 headless Chrome 載入 index.html：head 腳本插在 <head> 後、body 腳本插在 </body> 前，回傳頁面的 <title>
// 同 tools/redraw/acceptance.js 的做法；fresh = true 時用全新的瀏覽器設定檔（localStorage 是空的）
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const { PROJECT, WORK } = require('./lib');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 等頁面載入完成（#loading 隱藏）再執行 fn 的 body 腳本外殼；fn 的回傳值以 base64 JSON 寫進 title
const whenLoaded = fn => `<script>(function w(){if(!document.getElementById('loading').hidden)return setTimeout(w,200);
Promise.resolve((${fn})()).then(v=>{document.title='OUT '+btoa(unescape(encodeURIComponent(JSON.stringify(v))));},
e=>{document.title='ERR '+e.message;});})();</script>`;

function runPage({ diagram = process.env.DIAGRAM || 'PA12B', head = '', body = '', query = '', fresh = false }) {
  const html = fs.readFileSync(path.join(PROJECT, 'index.html'), 'utf8')
    .replace('<head>', `<head><base href="file://${PROJECT}/">${head}`).replace('</body>', body + '</body>');
  fs.mkdirSync(WORK, { recursive: true });
  const page = path.join(WORK, 'redraw-page.html'); fs.writeFileSync(page, html);
  const prof = fresh ? fs.mkdtempSync(path.join(os.tmpdir(), 'wolf-prof-')) : path.join(WORK, 'chrome-prof-redraw');
  try {
    const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
      `--user-data-dir=${prof}`, '--virtual-time-budget=120000', '--dump-dom', `file://${page}?d=${diagram}${query}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
    return (dom.match(/<title>([^<]*)/) || [])[1] || '';
  } finally { if (fresh) fs.rmSync(prof, { recursive: true, force: true }); }
}

// 執行 fn（在頁面載入完成後）並取回它的回傳值；頁面報錯或逾時就丟出錯誤
function evalInPage(fn, opt = {}) {
  const t = runPage({ ...opt, body: (opt.body || '') + whenLoaded(fn) });
  if (t.startsWith('OUT ')) return JSON.parse(Buffer.from(t.slice(4), 'base64').toString('utf8'));
  throw new Error(t.startsWith('ERR ') ? '頁面腳本錯誤：' + t.slice(4) : '沒有結果：頁面可能報錯或逾時（title=' + t.slice(0, 80) + '）');
}

module.exports = { runPage, evalInPage, CHROME };
