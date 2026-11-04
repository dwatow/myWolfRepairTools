# 以資料重繪線路圖：第 1 階段（資料化＋導線）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 網頁改由 `data/<圖>/drawing.js` 畫出導線、圓點、元件方框與名稱，`label`（每像素屬於哪條線路）改由資料點陣化產生，現有功能照常運作；PA12B、PA12C 都通過設計文件的驗收 1～3。

**Architecture:** 一支一次性的 Node 腳本把現有辨識結果（`js/nets.js`＋`fixes`／`anchors`）轉成 `drawing.js` 草稿。新的純函式模組 `js/drawing.js`（Node 與瀏覽器共用，同 `js/nets.js` 的寫法）把資料點陣化成 `label` 與每條線路的像素；`js/basemap.js` 在畫布上畫出底圖。`app.js` 只換掉資料來源，`stamp`、`hitTest`、選取、開關表沿用。塗色改用座標儲存，舊塗色靠事先在 Chrome 擷取的「舊線路編號 → 座標」表轉移。

**Tech Stack:** 原生 JS（無建置）、Canvas 2D、Node 內建 `node:test`／`node:assert`、headless Chrome（`--dump-dom`，同 `acceptance.js`）。

**Spec:** `docs/superpowers/specs/2026-11-03-redraw-diagram-design.md`

**範圍:** 只做設計文件「分階段」的第 1 階段，加上必須同時完成的兩件事：塗色改座標（第 6 點；`label` 一換，舊的線路編號就失效）與淘汰圈選細節（第 7 點；細節依賴辨識像素）。第 2～5 階段另寫計畫。

## Global Constraints

- 靜態網站，無建置步驟；資料檔是 `window.WOLF_* = …` 形式的 `.js`，由 `js/diagrams.js` 的 `DATA_FILES` 動態載入。
- 座標系統不變：全解析度 3323×2188，原點左上；`components.js` 的 `box`、`label` 以圖寬 1800 為基準（乘 3323/1800）。
- 導線折線每段必須是水平或垂直。
- 同一張圖內，`drawing.nets` 的陣列順序就是線路編號。
- 未標線色的線路網 `code: null`，畫成深灰色。
- 不得引入原廠影像；字型用頁面現有的系統字型堆疊。
- 開發用的「疊原圖對照」只在網址帶 `?dev=1` 時出現，第 4 階段移除。
- 舊的 localStorage key（`wolf125-paint-v3*`）保留不刪。
- 所有訊息、註解用繁體中文。
- 在 `redraw-phase1` 分支上做，不直接 commit 到 `master`。
- Node 腳本需要 `$WORK`（預設 `$TMPDIR/wolf-nets`，已裝 `jpeg-js@0.4.4`）；Chrome 路徑同 `acceptance.js`（環境變數 `CHROME` 可覆寫）。

## Review Focus

1. **無圓點的交叉處**：使用者點在兩條線交叉的位置，應該選到「線芯」在那裡的那條，不能被另一條的寬點擊帶蓋掉。→ Task 2 的 `交叉處以線芯優先` 測試。
2. **舊塗色數量對不上**：瀏覽器裡的 `wolf125-paint-v3` 的 `n` 和擷取時的 `WOLF_LEGACY.n` 不同時，不能照編號硬轉（會塗到別條線），要略過並在狀態列說明。→ Task 6 的 `n 不符不轉移` 檢查。
3. **localStorage 裡的舊細節項目**：舊版存的 `kind: 'detail'` 項目要在載入時濾掉，不能讓已存選取清單壞掉或報錯。→ Task 7 的 `載入時濾掉細節` 檢查。
4. **未標線色但原本靠「偏綠」判成接地的線**：改讀資料後，「隱藏接地線」仍要隱藏它們。→ Task 3 的 `偏綠的未標色線路記為接地` 測試。
5. **手改 `drawing.js` 寫出斜線**：要在載入時明確報錯並指出第幾條線路網，而不是畫出怪線或默默錯位。→ Task 2 的 `斜線報錯` 測試。

---

## 檔案結構

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `tools/redraw/chrome.js` | 新增 | 用 headless Chrome 載入 `index.html`、注入 head／body 腳本、回傳 `<title>` |
| `tools/redraw/capture-legacy.js` | 新增 | 在**改版前**的頁面擷取每條舊線路的代表座標，寫 `data/<圖>/legacy.js` |
| `data/<圖>/legacy.js` | 產生 | `window.WOLF_LEGACY = { n, picks: [[x, y], …] }`，第 k 筆＝舊線路 k |
| `js/drawing.js` | 新增 | 純函式 `rasterizeDrawing`：資料 → `label`、線芯像素、線段 |
| `tools/redraw/draft.js` | 新增 | 純函式 `netsToDrawing`：辨識結果 → `drawing` 物件 |
| `tools/redraw/bootstrap.js` | 新增 | CLI：跑辨識、呼叫 `netsToDrawing`、寫 `data/<圖>/drawing.js` |
| `tools/redraw/match.js` | 新增 | 純函式 `matchNets`：舊／新 `label` 的一對一比對 |
| `tools/redraw/compare.js` | 新增 | CLI：驗收 1～3（Node） |
| `tools/redraw/exceptions.js` | 新增 | 經使用者確認的個別例外 `{ PA12B: [{ pick, reason }], PA12C: [] }` |
| `tools/test/*.test.js` | 新增 | `node --test tools/test` |
| `js/basemap.js` | 新增 | `drawBase(ctx, drawing, components, K)`：畫底圖 |
| `js/diagrams.js` | 修改 | `DATA_FILES` 改成 `drawing, legacy, components, anchors, fixes, switches`（不再預先載入 `strips`） |
| `js/app.js` | 修改 | `init` 換資料來源、`buildNets`／`buildGround` 讀資料、塗色存座標、dev 對照開關、移除細節 |
| `index.html` | 修改 | 加 `js/drawing.js`、`js/basemap.js`；移除細節那一列；加 dev 對照開關 |

---

### Task 1：擷取舊線路編號的代表座標（必須最先做）

舊塗色以 Chrome 裡的線路編號儲存，Node 和 Chrome 的 JPEG 解碼略有差異，所以這張對照表要在**目前版本的頁面、在 Chrome 裡**擷取，`app.js` 改動之後就擷取不到了。

**Files:**
- Create: `tools/redraw/chrome.js`、`tools/redraw/capture-legacy.js`
- Produce: `data/PA12B/legacy.js`、`data/PA12C/legacy.js`

**Interfaces:**
- Produces: `runPage({ diagram, head = '', body = '' }) -> string`（頁面的 `<title>`；`head` 插在 `<head>` 之後、`body` 插在 `</body>` 之前）。`window.WOLF_LEGACY = { n: number, picks: [[x, y], …] }`，`picks.length === n`。

- [ ] **Step 1：建分支** `git switch -c redraw-phase1`
- [ ] **Step 2：寫 `chrome.js`**：沿用 `acceptance.js` 的做法（`<base href>`、`--headless --dump-dom --virtual-time-budget=120000`、`--user-data-dir=$WORK/chrome-prof-redraw`）。
- [ ] **Step 3：寫 `capture-legacy.js`**：`DIAGRAM=<圖> node tools/redraw/capture-legacy.js`。body 探針等 `#loading` 隱藏後，對每個 k 取 `pickOf(k)`，並自我檢查 `label[y*IW+x] === k`；把 `{ n: nets.length, picks, bad }` 以 base64 JSON 放進 title。`bad > 0` 時結束碼 1、不寫檔。
- [ ] **Step 4：跑兩張圖**
  Run: `DIAGRAM=PA12B node tools/redraw/capture-legacy.js && DIAGRAM=PA12C node tools/redraw/capture-legacy.js`
  Expected: 各印出 `PA12B：n=<數字>，bad=0，已寫 data/PA12B/legacy.js`（PA12C 同理）。PA12B 的 n 要等於 `acceptance.js` 印的 `nets:`。
- [ ] **Step 5：Commit** `git add tools/redraw/chrome.js tools/redraw/capture-legacy.js data/*/legacy.js && git commit -m "feat(redraw): 擷取舊線路編號的代表座標供塗色轉移"`

---

### Task 2：`js/drawing.js` 點陣化

**Files:**
- Create: `js/drawing.js`、`tools/test/drawing.test.js`

**Interfaces:**
- Produces: `rasterizeDrawing(drawing, opt = {}) -> { label: Int32Array, cores: Int32Array[], segs: { h, x0, x1, y0, y1, net }[] }`
  - `opt.core`（預設 1）：線芯半寬，畫色用；`opt.hit`（預設 3）：點擊帶半寬；`opt.dot`（預設 4）：圓點半徑；`opt.cableHalf`（預設 7）。
  - 電纜線路網（`cable: true`）的線芯與點擊帶都用 `net.half ?? opt.cableHalf`。
  - `label` 先寫所有線路的點擊帶，再寫所有線芯與圓點（線芯覆蓋點擊帶）；`cores[k]` 是線路 k 的線芯＋圓點像素索引（遞增）。
  - `segs`：每條折線的每一段一筆，`h` 表示水平，座標為左上／右下（`x0<=x1`、`y0<=y1`），`net` 是線路編號。
  - 檔尾 `if (typeof module !== 'undefined') module.exports = { rasterizeDrawing };`（同 `js/nets.js`）。

- [ ] **Step 1：寫測試**（`node:test`，用 `size: [40, 40]` 的小圖）
  - `水平線的線芯與點擊帶`：`nets:[{code:'B',wires:[[[5,10],[30,10]]]}]` → `label[10*40+20] === 0`、`label[13*40+20] === 0`、`label[14*40+20] === -1`；`cores[0]` 含 `9*40+20`、不含 `12*40+20`。
  - `交叉處以線芯優先`：線路 0 水平 `[[0,10],[39,10]]`、線路 1 垂直 `[[20,0],[20,39]]` → `label[10*40+20]` 屬其中之一，且 `label[10*40+22] === 0`、`label[12*40+20] === 1`（另一條的點擊帶不蓋過線芯）。
  - `圓點併入線芯`：同上一條水平線加 `dots:[[20,10]]` → `label[14*40+20] === 0`，且 `cores[0]` 含 `14*40+20`（點擊帶只到 y=13，y=14 來自半徑 4 的圓點）。
  - `電纜用 half`：`{cable:true, half:5, wires:[[[5,20],[30,20]]]}` → `label[25*40+10] === 0`、`label[26*40+10] === -1`。
  - `線段`：`[[5,10],[30,10],[30,30]]` → `segs` 為 `[{h:true,x0:5,x1:30,y0:10,y1:10,net:0},{h:false,x0:30,x1:30,y0:10,y1:30,net:0}]`。
  - `斜線報錯`：`nets[2]` 的折線是 `[[0,0],[5,5]]` → `assert.throws(() => rasterizeDrawing(d), /第 2 條線路網.*水平或垂直/)`。錯誤訊息固定為 `` `drawing.js 第 ${k} 條線路網（從 0 起算）的折線必須是水平或垂直：${JSON.stringify([a, b])}` ``。
- [ ] **Step 2：跑測試確認失敗** Run: `node --test tools/test` Expected: FAIL（`rasterizeDrawing` 不存在）
- [ ] **Step 3：實作 `rasterizeDrawing`**
- [ ] **Step 4：跑測試** Run: `node --test tools/test` Expected: 全部 PASS
- [ ] **Step 5：Commit** `git add js/drawing.js tools/test/drawing.test.js && git commit -m "feat(redraw): 由資料點陣化線路網"`

---

### Task 3：草稿轉換 `netsToDrawing` 與 `bootstrap.js`

**Files:**
- Create: `tools/redraw/draft.js`、`tools/redraw/bootstrap.js`、`tools/test/draft.test.js`
- Produce: `data/PA12B/drawing.js`、`data/PA12C/drawing.js`

**Interfaces:**
- Consumes: `.claude/skills/fixing-wire-nets/scripts/lib.js` 的 `loadImage()`、`analyze(img)`（回傳 `{ segs, label }`，`label` 已清掉 staticAreas 與元件名稱範圍；`segs[i] = { h, x0, x1, y0, y1, net, netCode, ground? }`，電纜的 `net >= 10000000`）。
- Produces: `netsToDrawing(r, { W, H, image, components, fixes }) -> { drawing, dropped }`
  - `drawing` 符合設計文件的 `window.WOLF_DRAWING` 結構（第 1 階段只填 `size`、`nets`；`connectors`、`inline`、`labels`、`texts` 輸出空陣列）。
  - `dropped`：被整批例外丟掉的舊線路根編號陣列。
  - `image` 是 RGBA 資料（算未標色線路的平均顏色）。

規則（實作者照做；數值是預設，可在檔頭常數調整）：
1. 只處理 `r.label` 裡仍有像素的線路根（`net >= 0`）；依根編號遞增排序，這就是新的線路順序。
2. **整批例外**：線路網所有線段都落在某個元件 `box`（×W/1800，外擴 14 px）內 → 丟掉，記進 `dropped`。
3. 每段取中心線：水平段 `y = round((y0+y1)/2)`、`[[x0,y],[x1,y]]`；垂直段同理。
4. 同線路、同方向、中心座標差 ≤ 2 px、範圍重疊或間隙 ≤ 2 px 的段合併成一段（座標取較長那段的）。
5. **端點吸附**：端點到同線路某條垂直方向線段的中心線距離 ≤ 6 px（且落在那段的範圍 ±6 px 內）時，把端點移到那條中心線上。
6. `fixes.links` 中 3 點以上的折線，加進其起點所在線路網的 `wires`（2 點的只合併不畫，不加）。
7. 電纜：`fixes.cables[i]` 輸出為 `{ code, cable: true, half?, ground, wires: [path], dots: [] }`。
8. `dots`：某段的端點落在同線路另一段內部（距那段兩端都 ≥ 3 px）→ 該點；再加上 `fixes.dots` 中距同線路中心線 ≤ 8 px 的點（投影到中心線上）。去重。
9. `code` = 該線路任一段的 `netCode`（都沒有就 `null`）。
10. `ground` = 任一段 `ground` ‖ `code === 'G'` ‖（`code === null` 且平均顏色 `G > R + 25 && G > B + 15`，同 `app.js` 的 `buildGround`）。元件 `ground: true` 的連帶規則**不**寫進資料，留在執行期。
11. 輸出時折線相鄰兩段若在同一點相接，接成一條折線（減少筆數，非必要）。

`bootstrap.js`：`DIAGRAM=<圖> node tools/redraw/bootstrap.js`，寫 `data/<圖>/drawing.js`，格式為檔頭註解＋`window.WOLF_DRAWING = {…};`，**每條線路網一行**（方便 diff 與手改），印出 `線路網 N 條；整批例外 M 條；圓點 D 個`。

- [ ] **Step 1：寫測試**（合成的小 `r`，不讀真實圖）
  - `中心線與 L 轉角吸附`：水平段 `{h:true,x0:5,x1:30,y0:9,y1:11}`、垂直段 `{h:false,x0:31,x1:33,y0:12,y1:40}` 同線路 → 兩條折線的轉角都在 `[32,10]`。
  - `共線合併`：同線路水平段 `x 5–20, y 9–11` 與 `x 22–40, y 10–12` → 合併成一段 `[[5,y],[40,y]]`。
  - `T 字產生圓點`：垂直段端點落在水平段中間 → `dots` 含該點。
  - `元件框內的線路整批例外`：全部段都在 `components[0].box`（換算後）內 → 不出現在 `nets`、出現在 `dropped`。
  - `偏綠的未標色線路記為接地`：`netCode: null`，`image` 在該線路像素處是 `[40, 160, 60]` → `ground: true`；同樣但灰色 `[90,90,90]` → `ground: false`。
  - `links 折線加入 wires、兩點的不加`。
  - `電纜輸出`：`fixes.cables = [{code:'B', ground:true, half:9, path:[[0,0],[0,20]]}]` → 對應線路網 `{code:'B',cable:true,half:9,ground:true}`。
- [ ] **Step 2：跑測試確認失敗** Run: `node --test tools/test` Expected: draft 測試 FAIL
- [ ] **Step 3：實作 `netsToDrawing` 與 `bootstrap.js`**
- [ ] **Step 4：跑測試** Run: `node --test tools/test` Expected: 全部 PASS
- [ ] **Step 5：產生兩張圖的草稿**
  Run: `DIAGRAM=PA12B node tools/redraw/bootstrap.js && DIAGRAM=PA12C node tools/redraw/bootstrap.js`
  Expected: 各印出統計列；`data/<圖>/drawing.js` 可被 `node -e "require('vm')…"` 載入（Task 4 的 compare 會實際載入）。
- [ ] **Step 6：Commit** `git add tools/redraw/draft.js tools/redraw/bootstrap.js tools/test/draft.test.js data/*/drawing.js && git commit -m "feat(redraw): 從辨識結果產生 drawing.js 草稿"`

---

### Task 4：Node 驗收 `compare.js`（驗收 1～3）

**Files:**
- Create: `tools/redraw/match.js`、`tools/redraw/compare.js`、`tools/redraw/exceptions.js`、`tools/test/match.test.js`

**Interfaces:**
- Consumes: `rasterizeDrawing`（Task 2）、`lib.analyze`／`loadImage`、`data/<圖>/legacy.js`（Task 1）。
- Produces: `matchNets({ oldSegs, oldLabel, newLabel, W }) -> { map: Map<oldRoot, newK>, splits: [{ old, news, at }], merges: [{ news: newK, olds, at }], missing: [{ old, at }] }`
  - 每條舊線路取它每一段的中點，查 `newLabel`（取該點 ±1 px 內出現最多的非 -1 值）；全部落在同一條新線路 → `map`；落在 2 條以上 → `splits`；全部是 -1 → `missing`。
  - 兩條以上舊線路對到同一條新線路 → `merges`。`at` 是可拿去 crop 的座標。

`compare.js`：`DIAGRAM=<圖> node tools/redraw/compare.js`，依序印出並在任一項失敗時結束碼 1：
1. `接線一致`：`missing` 中屬於 `dropped`（重算：完全在元件框內）的只計數；其餘 `splits`／`merges`／`missing` 逐條列出，`exceptions.js` 中 pick 落在該舊線路的標成「已確認例外：<reason>」不算失敗。
2. `參照`：接線單元檔每個單元的 pick 落在 1 條新線路；`components[].picks`、`WOLF_SWITCHES[].pins` 的每個值（物件 `{ 接腳: [x, y] }`）都落在新線路（`newLabel >= 0`）；`legacy.picks[k]` 落在的新線路 ＝ `map.get(舊 label 在該點的根)`。
3. `線色一致`：`map` 中每對 `old → new`，舊 `netCode`（無則 `null`）＝ 新 `drawing.nets[new].code`。

- [ ] **Step 1：寫 `match.test.js`**：用兩個 20×20 的手寫 `label`／`segs` 測 `一對一`、`一分為二回報 splits`、`兩條併成一條回報 merges`、`找不到回報 missing`。
- [ ] **Step 2：跑測試確認失敗** Run: `node --test tools/test` Expected: match 測試 FAIL
- [ ] **Step 3：實作 `matchNets`、`compare.js`，`exceptions.js` 先放空陣列**
- [ ] **Step 4：跑測試** Run: `node --test tools/test` Expected: 全部 PASS
- [ ] **Step 5：對兩張圖跑 compare，修草稿規則直到只剩真正需要人判斷的例外**
  Run: `DIAGRAM=PA12B node tools/redraw/compare.js | tail -40`
  處理方式：先調 `draft.js` 規則（吸附距離、合併門檻）並重跑 Task 3 Step 5；規則改不動的個案，記下座標與原因（用 `crop.js` 看原圖），**暫不寫進 `exceptions.js`**。
- [ ] **Step 6：把剩下的例外整理成清單交給使用者確認**（每條：座標、舊線色、現象、建議處理）。使用者確認後寫進 `exceptions.js`，再跑一次 compare。
  Expected: 兩張圖都印 `PASS 接線一致`、`PASS 參照`、`PASS 線色一致`。
- [ ] **Step 7：Commit** `git add tools/redraw/match.js tools/redraw/compare.js tools/redraw/exceptions.js tools/test/match.test.js tools/redraw/draft.js data/*/drawing.js && git commit -m "feat(redraw): 新舊線路網比對驗收"`

---

### Task 5：網頁改由資料繪製

**Files:**
- Create: `js/basemap.js`
- Modify: `js/diagrams.js`（`DATA_FILES`）、`index.html`（script 標籤）、`js/app.js`（`init`、`buildNets`、`buildGround`、移除 `addCables` 的呼叫）

**Interfaces:**
- Consumes: `rasterizeDrawing`（Task 2）、`window.WOLF_DRAWING`（Task 3）。
- Produces: `drawBase(ctx, drawing, components, K)`：白底；每條線路網的折線用 `#3a3f44`、線寬 3 px、`lineCap/lineJoin: 'square'/'miter'` 畫；電纜畫成寬 `2*half+1` 的雙線外框（外框 `#3a3f44`、內填白）；圓點半徑 4 實心；元件 `box×K` 以 `#6b7176` 1.5 px 方框；元件名稱以 `label×K` 範圍置中、字級取能塞進範圍的最大值（上限 28 px），沒有 `label` 時寫在方框上緣內側。
- `app.js` 執行期資料：`nets[k] = { pixels: cores[k], n, x0, y0, x1, y1, segs, code, ground }`（`x0…y1` 由 `pixels` 算；`rgb` 欄位移除）。

- [ ] **Step 1：改 `DATA_FILES`** 為 `['drawing', 'legacy', 'components', 'anchors', 'fixes', 'switches']`；`legacy` 也設成可省略（同 `switches`）。`index.html` 在 `js/app.js` 前加 `js/drawing.js`、`js/basemap.js`。
- [ ] **Step 2：改 `init`**：`base` 畫布改用 `drawBase` 畫；`baseData = getImageData(...)`；`const r = rasterizeDrawing(window.WOLF_DRAWING, { cableHalf: CABLE_HALF })`；`label = r.label`；用 `r.cores`／`r.segs` 與資料的 `code`、`ground` 建 `nets`。不再呼叫 `analyzeNets`、`addCables`、清除 STATIC_AREAS／名稱範圍（資料裡本來就沒有那些線）。
- [ ] **Step 3：改 `buildGround`**：`net.ground` 直接用資料；保留元件 `ground: true` 的連帶規則。
- [ ] **Step 4：Chrome 驗收**
  Run: `node .claude/skills/fixing-wire-nets/scripts/acceptance.js | tail -3`
  Expected: `RESULT … | | nets:<N>`，所有單元 `:1`、`PASS`；N ＝ `data/PA12B/drawing.js` 的線路網數。PA12C 同樣跑一次（`DIAGRAM=PA12C`）。
- [ ] **Step 5：截圖目視**：用 headless Chrome `--screenshot` 開兩張圖各一張全圖、各兩處放大（儀錶組、主開關附近），Read 看圖確認導線、圓點、方框、名稱都有畫出且位置合理。
- [ ] **Step 6：Commit** `git add js/basemap.js js/diagrams.js js/app.js index.html && git commit -m "feat(redraw): 網頁改由 drawing.js 畫底圖與產生線路"`

---

### Task 6：塗色改用座標儲存、開發用原圖對照

**Files:**
- Modify: `js/app.js`（`STORE_KEY` 一帶、`rebuildOverlay` 的儲存、`init` 的載入）、`index.html`（dev 開關）
- Create: `tools/redraw/check-paint.js`

**Interfaces:**
- Consumes: `window.WOLF_LEGACY`（Task 1）、`pickOf(k)`。
- Produces：
  - 新 key：`'wolf125-paint-v4' + KEY_SUFFIX`，值為 `[{ pick: [x, y], color: '#rrggbb' }]`。記憶體裡仍是 `paint[k] = hex`。
  - 存：`rebuildOverlay` 改寫 v4（`pick = pickOf(k)`）；不再寫 v3。
  - 讀（`init`）：有 v4 → 每筆 `label` 查到 k 就設 `paint[k]`，查不到的計數。沒有 v4 而有 v3 → `v3.n === WOLF_LEGACY.n` 時以 `WOLF_LEGACY.picks[k]` 轉成 v4 寫入；`n` 不符或沒有 `WOLF_LEGACY` 時不轉移。v3 一律不刪。
  - 狀態列訊息：轉移成功 `已把舊塗色轉成新格式（N 條）`；`n` 不符 `舊塗色的線路數（a）和記錄（b）不符，沒有轉移`；有對不到線路的 v4 項目 `有 N 筆塗色找不到對應的線`。
  - dev 對照：網址有 `dev=1` 時顯示 `<label class="toggle"><input type="checkbox" id="dev-original"> 疊原圖對照（開發用）</label>`；第一次勾選時才 `loadScript('data/<圖>/strips.js')` 並組出原圖畫布（沿用原本 `init` 的旋轉拼接），之後 `draw()` 在底圖之上以 `globalAlpha 0.4` 疊上。

- [ ] **Step 1：寫 `check-paint.js`**（用 Task 1 的 `runPage`，開乾淨的 profile）三個情境，各自在 head 腳本先設 localStorage：
  - `轉移`：v4 移除、v3 = `{ n: WOLF_LEGACY.n, paint: { [k]: '#ff0000' } }`（k 取 `legacy.picks` 中第一個落在新線路的）→ 載入後 `paint` 只有一筆，key 等於 `label` 在 `legacy.picks[k]` 的值；localStorage 有 v4、v3 仍在。
  - `n 不符不轉移`：v3.n = `WOLF_LEGACY.n + 1` → `paint` 為空、狀態列含 `沒有轉移`、沒有寫 v4。
  - `v4 往返`：v4 = `[{ pick: legacy.picks[k], color: '#00ff00' }]` → `paint` 對到同一條線。
  （head 腳本在 `wolf125-…` 之外不動其他 key；PA12B 用空的 `KEY_SUFFIX`。）
- [ ] **Step 2：跑確認失敗** Run: `node tools/redraw/check-paint.js` Expected: `轉移` 與 `v4 往返` FAIL
- [ ] **Step 3：實作儲存／讀取／轉移與 dev 對照開關**
- [ ] **Step 4：跑檢查** Run: `node tools/redraw/check-paint.js` Expected: 三個情境 PASS
- [ ] **Step 5：dev 對照截圖**：`?dev=1` 勾選對照後截一張放大圖，Read 確認新舊線條重疊。
- [ ] **Step 6：Commit** `git add js/app.js index.html tools/redraw/check-paint.js && git commit -m "feat(redraw): 塗色改用座標儲存並轉移舊資料；開發用原圖對照"`

---

### Task 7：淘汰圈選細節

**Files:**
- Modify: `index.html:53-56`（細節那一列）、`js/app.js`（`detail*`、`rebuildDetail`、`putDetail`、`detailNote`、`isDetail` 相關、匯入／匯出的 details、指標事件中的畫框分支、`draw()` 的虛線框）、`css/style.css:145`（`.detail-row`）
- Create: `tools/redraw/check-import.js`

**Interfaces:**
- 匯入：`data.details` 與陣列中 `kind: 'detail'` 的項目一律略過，計數 `d`；訊息在原本內容後加 `，略過 ${d} 筆細節（功能已淘汰）`（d 為 0 時不加）。
- 載入：`saved` 讀出後濾掉 `kind === 'detail'`，有濾掉就寫回 localStorage。
- 匯出：不再輸出 `details` 欄位；`selections` 格式不變。

- [ ] **Step 1：寫 `check-import.js`**（`runPage`）兩個情境：
  - `匯入略過細節`：body 探針等載入後，呼叫 `$('import-file').onchange({ target: { files: [new File([JSON.stringify({ diagram: 'PA12B', selections: [{ name: 't', nets: [{ pick: legacy.picks[k] }] }], details: [{ name: 't', rects: [[0,0,1,1]], pixels: [[0,0]] }] })], 'x.json')], value: '' } })`，等訊息出現 → `#save-msg` 含 `匯入 1 筆` 與 `略過 1 筆細節`。
  - `載入時濾掉細節`：head 先設 `wolf125-saved-v1` = `[{ name:'a', picks:[[…]] }, { name:'a', kind:'detail', rects:[], pixels:[] }]` → 載入後 `saved.length === 1`，localStorage 的陣列也只剩 1 筆；頁面沒有 `#detail-mode`。
- [ ] **Step 2：跑確認失敗** Run: `node tools/redraw/check-import.js` Expected: FAIL
- [ ] **Step 3：移除細節功能並改匯入、載入、匯出**
- [ ] **Step 4：跑檢查與既有驗收**
  Run: `node tools/redraw/check-import.js && node tools/redraw/check-paint.js && node .claude/skills/fixing-wire-nets/scripts/acceptance.js | tail -1 && node --test tools/test 2>&1 | tail -3`
  Expected: 全部 PASS；`grep -n "detail" js/app.js index.html` 只剩匯入略過的那段。
- [ ] **Step 5：Commit** `git add index.html js/app.js css/style.css tools/redraw/check-import.js && git commit -m "feat(redraw): 淘汰圈選細節，匯入時略過並提示"`

---

### Task 8：第 1 階段收尾驗收

**Files:** 無新檔（必要時修 `draft.js` 或 `drawing.js` 資料）

- [ ] **Step 1：全套驗收，兩張圖各跑一次**
  Run:
  ```bash
  node --test tools/test 2>&1 | tail -3
  for D in PA12B PA12C; do
    DIAGRAM=$D node tools/redraw/compare.js | grep -E "^(PASS|FAIL)"
    DIAGRAM=$D node .claude/skills/fixing-wire-nets/scripts/acceptance.js | tail -1
  done
  node tools/redraw/check-paint.js && node tools/redraw/check-import.js
  ```
  Expected: 每一行都是 PASS。
- [ ] **Step 2：手動功能抽查（Chrome）**：點線亮線、點元件亮線、Shift 多選、塗色後重新整理仍在、開關導通表點檔位、線色對照點標籤、隱藏接地線、淡化底圖、PA12B/PA12C 切換。逐項記錄結果。
- [ ] **Step 3：回報使用者**：截圖（兩張圖全圖各一）、驗收輸出摘要、已確認例外清單、第 2 階段的待補項目（接頭、線色文字）。

---

## 不在本計畫內（後續階段另寫計畫）

- 第 2 階段：`connectors`、`inline`、`labels`、`texts` 的資料與繪製。
- 第 3 階段：`components.js` 的 `symbol` 與通用符號；`compLayer` 改為重畫符號。
- 第 4 階段：刪 `strips.js`、`staticAreas`、`js/nets.js` 的執行期載入、dev 對照開關、`legacy.js` 是否保留；驗收 4～6。
- 第 5 階段：改寫或淘汰 `fixing-wire-nets`、`editing-diagram-image`；更新 `js/diagrams.js` 的註解。
