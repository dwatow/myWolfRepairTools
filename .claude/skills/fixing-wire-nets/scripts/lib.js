// 共用：專案路徑、工作目錄、底圖解碼、以 data/<圖>/fixes.js 的 dots／links 跑 analyzeNets，再套上 cables（同 app.js 的 addCables）
// 工作目錄 WORK（預設 $TMPDIR/wolf-nets）需先 `npm i jpeg-js@0.4.4`
// 哪張線路圖由環境變數 DIAGRAM 決定（預設 PA12B），各圖的資料在 data/<圖>/
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { createRequire } = require('module');
const PROJECT = path.resolve(__dirname, '../../../..');
const WORK = process.env.WORK || path.join(os.tmpdir(), 'wolf-nets');
const DIAGRAM = process.env.DIAGRAM || 'PA12B';
const DATA = `data/${DIAGRAM}`;
// 各圖的接線單元匯出檔：PA12B 沿用原檔名
const SELECTIONS = path.join(PROJECT, DIAGRAM === 'PA12B' ? 'wolf125-selections.json' : `wolf125-${DIAGRAM}-selections.json`);

function loadWindow(files, dir = PROJECT) {
  const win = {}, ctx = { window: win }; vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
  return win;
}

// 7 條橫條上下拼接後逆時針轉 90°（與 app.js init 相同），結果依圖快取在 WORK/<圖>[-<雜湊>].raw
// 快取以 strips.js 的路徑、修改時間與大小為準：底圖改過就重新解碼
// dir：讀哪個資料夾的 data/<圖>/strips.js（預設專案；比對改底圖前後時傳備份）
function loadImage(dir = PROJECT) {
  const file = path.join(dir, DATA, 'strips.js'), st = fs.statSync(file), stamp = `${file}:${st.mtimeMs}:${st.size}`;
  const tag = dir === PROJECT ? DIAGRAM : `${DIAGRAM}-${require('crypto').createHash('md5').update(file).digest('hex').slice(0, 8)}`;
  const raw = path.join(WORK, `${tag}.raw`), meta = path.join(WORK, `${tag}.json`);
  if (fs.existsSync(raw) && fs.existsSync(meta)) {
    const { IW, IH, stamp: s0 } = JSON.parse(fs.readFileSync(meta));
    if (s0 === stamp) return { data: new Uint8Array(fs.readFileSync(raw)), width: IW, height: IH };
  }
  const jpeg = createRequire(path.join(WORK, 'x.js'))('jpeg-js');
  const imgs = loadWindow([`${DATA}/strips.js`], dir).WOLF_STRIPS.map(u => jpeg.decode(Buffer.from(u.split(',')[1], 'base64'), { useTArray: true }));
  const W0 = imgs[0].width, IW = imgs.reduce((a, i) => a + i.height, 0), IH = W0, data = new Uint8Array(IW * IH * 4);
  let off = 0;
  for (const im of imgs) {
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
      const s = (y * im.width + x) * 4, d = ((W0 - 1 - x) * IW + off + y) * 4;
      data.set(im.data.subarray(s, s + 3), d); data[d + 3] = 255;
    }
    off += im.height;
  }
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(raw, data); fs.writeFileSync(meta, JSON.stringify({ IW, IH, stamp }));
  return { data, width: IW, height: IH };
}

// dir：含 js/nets.js、data/<圖>/ 的資料夾（預設專案本身；比對時傳 resolveBase 取出的基準）
// 舊版備份沒有 data/<圖>/fixes.js，改從 js/app.js 的 DOTS／LINKS 讀
function analyze(img, dir = PROJECT) {
  let fixes;
  if (fs.existsSync(path.join(dir, DATA, 'fixes.js'))) fixes = loadWindow([`${DATA}/fixes.js`], dir).WOLF_FIXES;
  else {
    const app = fs.readFileSync(path.join(dir, 'js/app.js'), 'utf8');
    const arr = name => { const m = app.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]);`)); return m ? eval(m[1]) : []; };
    fixes = { dots: arr('DOTS'), links: arr('LINKS'), cables: arr('CABLES') };
  }
  const file = path.join(dir, 'js/nets.js'); delete require.cache[file];
  // 線色標註也從 dir 讀（比對時才會用到修改前的 anchors.js）；舊備份沒有就退回專案本身
  const anchorDir = fs.existsSync(path.join(dir, DATA, 'anchors.js')) ? dir : PROJECT;
  const anchors = loadWindow([`${DATA}/anchors.js`], anchorDir).WOLF_ANCHORS;
  const r = require(file).analyzeNets(img, { anchors, dots: fixes.dots || [], links: fixes.links || [], erase: fixes.erase || [], ink: fixes.ink || [] });
  addCables(r, fixes.cables || [], img.width, img.height, dir);
  // 同 app.js：固定區域（staticAreas）與元件名稱文字範圍內的像素不算線路
  const compDir = fs.existsSync(path.join(dir, DATA, 'components.js')) ? dir : PROJECT;
  const comps = loadWindow([`${DATA}/components.js`], compDir).WOLF_COMPONENTS || [], K = img.width / 1800;
  const areas = [...(fixes.staticAreas || []), ...comps.filter(c => c.label).map(c => c.label.map(v => Math.round(v * K)))];
  for (const [x0, y0, x1, y1] of areas)
    for (let y = Math.max(0, y0); y <= Math.min(img.height - 1, y1); y++) r.label.fill(-1, y * img.width + Math.max(0, x0), y * img.width + Math.min(img.width - 1, x1) + 1);
  return r;
}

// 線路網數：有像素的線路網（與 app.js 的 nets.length、acceptance.js 的 nets: 相同算法）
function countNets(r) { const s = new Set(); for (const k of r.label) if (k >= 0) s.add(k); return s.size; }

// 粗電纜：路徑範圍內的像素整塊歸給該電纜（與 js/app.js 的 addCables 相同；半寬預設讀 app.js 的 CABLE_HALF）
function addCables(r, cables, IW, IH, dir) {
  const m = fs.readFileSync(path.join(dir, 'js/app.js'), 'utf8').match(/const CABLE_HALF = (\d+)/);
  const HALF = m ? +m[1] : 7;
  cables.forEach((c, i) => {
    const root = 10000000 + i;
    for (let j = 1; j < c.path.length; j++) {
      const [ax, ay] = c.path[j - 1], [bx, by] = c.path[j];
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by), hw = c.half ?? HALF;
      for (let y = y0 - hw; y <= y1 + hw; y++) for (let x = x0 - hw; x <= x1 + hw; x++)
        if (x >= 0 && y >= 0 && x < IW && y < IH) r.label[y * IW + x] = root;
      r.segs.push({ h: ay === by, x0, x1, y0, y1, net: root, netCode: c.code, ground: !!c.ground });
    }
  });
}

// 修改前的基準：可以是資料夾，或 git ref（HEAD、commit、`git stash create` 的快照）
// git ref 會用 git archive 把 js/ 和 data/<圖>/ 取到 WORK/base-<commit>（commit 不會變，取過就重用）
function resolveBase(arg) {
  if (!arg) return null;
  if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) return path.resolve(arg);
  const { execFileSync } = require('child_process'), git = (...a) => execFileSync('git', ['-C', PROJECT, ...a], { encoding: 'utf8' }).trim();
  let sha; try { sha = git('rev-parse', '--verify', '--quiet', arg + '^{commit}'); } catch { console.error(`找不到資料夾或 git ref：${arg}`); process.exit(2); }
  const dir = path.join(WORK, `base-${sha.slice(0, 12)}`);
  if (!fs.existsSync(path.join(dir, DATA))) {
    fs.mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['-C', PROJECT, 'archive', sha, 'js', DATA], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
  }
  return dir;
}

module.exports = { PROJECT, WORK, DIAGRAM, SELECTIONS, loadImage, analyze, countNets, resolveBase };
