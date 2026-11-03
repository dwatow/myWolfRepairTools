// 副作用：以座標逐段比對修改前後的線段（不需要接線單元檔，任何圖都能跑）
//   列出：線色或「是否為導線」改變的線段、消失的線段、新增的線段
//   改底圖、改 js/nets.js 規則時線段數會不同，也照樣比對
// node diff.js <修改前的基準：git ref（HEAD、`git stash create` 的快照）或資料夾>
const fs = require('fs'), path = require('path');
const { DIAGRAM, loadImage, analyze, countNets, resolveBase } = require('./lib');
if (!process.argv[2]) { console.error('用法：node diff.js <git ref 或修改前的資料夾>'); process.exit(2); }
const base = resolveBase(process.argv[2]), img = loadImage();
// 基準有底圖就用基準的底圖算修改前（同 verify.js）
const oldImg = fs.existsSync(path.join(base, 'data', DIAGRAM, 'strips.js')) ? loadImage(base) : img;
const a = analyze(oldImg, base), b = analyze(img);
console.log(`${DIAGRAM} 線路網：${countNets(a)} → ${countNets(b)}；線段：${a.segs.length} → ${b.segs.length}`);
const key = s => `${s.h ? 'H' : 'V'} ${s.x0},${s.y0}-${s.x1},${s.y1}`;
const tag = s => s.net < 0 ? '(非導線)' : s.netCode || '(未標色)';
const bm = new Map(b.segs.map(s => [key(s), s])), am = new Map(a.segs.map(s => [key(s), s]));
const changed = [], gone = [], added = [];
for (const s of a.segs) { const t = bm.get(key(s)); if (!t) gone.push(`  − ${key(s)}  ${tag(s)}`); else if (tag(s) !== tag(t)) changed.push(`  ${key(s)}  ${tag(s)} → ${tag(t)}`); }
for (const t of b.segs) if (!am.has(key(t))) added.push(`  ＋ ${key(t)}  ${tag(t)}`);
// 重新編碼造成的端點 1 px 偏移：方向、線色相同，四個座標都只差 ≤ 1 px，視為同一段，只計數
const near = (s, t) => s.h === t.h && tag(s) === tag(t) && ['x0', 'y0', 'x1', 'y1'].every(c => Math.abs(s[c] - t[c]) <= 1);
const goneS = a.segs.filter(s => !bm.has(key(s))), addedS = b.segs.filter(t => !am.has(key(t))), used = new Set();
let jitter = 0;
for (const s of goneS) { const t = addedS.find(t => !used.has(t) && near(s, t)); if (t) { used.add(t); used.add(s); jitter++; } }
gone.length = 0; added.length = 0;
for (const s of goneS) if (!used.has(s)) gone.push(`  − ${key(s)}  ${tag(s)}`);
for (const t of addedS) if (!used.has(t)) added.push(`  ＋ ${key(t)}  ${tag(t)}`);
if (jitter) console.log(`端點只偏移 ≤ 1 px 的線段：${jitter}（重新編碼的正常誤差，不列出）`);
const show = (title, rows) => rows.length && console.log(`${title}（${rows.length}）\n${rows.join('\n')}`);
show('線色改變', changed); show('消失的線段', gone); show('新增的線段', added);
console.log(changed.length + gone.length + added.length ? '逐一確認都是預期的修改；不確定的用 crop.js 看' : '線段與線色沒有任何改變');
