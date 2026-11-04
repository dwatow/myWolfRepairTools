# 以資料重繪線路圖：第 3 階段（元件符號）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 兩張圖的 30 個元件改畫成通用電路符號，並照原圖畫出元件內的文字：接腳名稱（例：主開關 `IG`／`BAT1`／`BAT2`／`E`）、規格（例：`(12V 10W)`）、元件上的接頭（例：CDI 的 `4P`、`3P`）、儀錶組內的各燈泡與名稱。

**Architecture:** `drawing.js` 新增一個欄位 `parts`，存放元件內的所有圖元：符號、接腳、文字、接頭、外框。人工判讀寫在 `tools/redraw/parts-manual.js`（PA12B／PA12C 共用，差異另列），由 `tools/redraw/add-parts.js` 只改寫 `drawing.js` 的 `parts` 欄位；`js/basemap.js` 畫出 `parts`。選取元件時的亮顯（`compLayer`）沿用：它讀的是底圖像素，底圖已改由資料畫出，所以會自動亮起新畫的符號。

**Tech Stack:** 同前兩階段。

**Spec:** `docs/superpowers/specs/2026-11-03-redraw-diagram-design.md`（「分階段」第 3 點）

**使用者決定（2026-11-04）:** 符號＋文字都照原圖：接腳名稱、規格文字、元件上的接頭、儀錶組內的燈泡與名稱都畫。

## Global Constraints

- 前兩階段的限制全部沿用：座標系統不變、不得引入原廠影像、系統字型、`nets` 順序就是線路編號、標記不寫入 `label`。
- 符號是**通用電路符號**，不照原圖逐筆描；位置、大小對齊原圖。
- `parts` 的座標是全解析度（和 `drawing.js` 其他欄位一致）；`components.js` 的 `box`、`label` 維持 1800 基準不動。
- 元件方框改為由 `parts` 的 `frame` 決定畫不畫：原圖有外框的才畫。
- `compare.js` 三項、`check-paint.js`、`check-import.js` 維持全過。
- 在 `redraw-phase3` 分支做（從 `redraw-phase2` 分出，PR 疊在第 2 階段之上）。

## Review Focus

1. **接腳名稱寫錯或漏寫**：接腳名稱是修車時最常查的資訊，每個開關類元件（燈光／起動開關、離合器開關、主開關、方向燈／喇叭／遠近光燈開關、前後剎車燈開關、空檔燈開關）的接腳名稱和數量都要和原圖一致。→ Task 4 的接腳清單逐一對照。
2. **符號擋住導線**：符號的白底若蓋過穿進元件的導線，導線看起來會斷掉。→ 符號只描線、不填白（接頭除外），Task 1 截圖檢查。
3. **選取元件時亮顯的範圍**：`compLayer` 依底圖像素亮起元件，新符號要在元件的點擊範圍內才會亮。→ Task 5 在 Chrome 選取 3 個元件截圖。
4. **PA12C 的差異元件**（油量指示燈取代油錶）：不能直接套 PA12B 的判讀。→ Task 5 Step 1。
5. **重跑 `add-parts.js` 覆蓋手改**：它只能改寫 `parts` 欄位，其他欄位原樣保留。→ Task 2 的 `只改寫 parts` 測試。

---

## 資料格式（Task 1 定案，寫進 `drawing.js` 檔頭註解）

```js
parts: [
  { type: 'symbol', kind: 'lamp', box: [x0, y0, x1, y1], dir: 'r' },   // kind 見下表；dir 是燈座／出線方向 l|r|u|d
  { type: 'pin', name: 'BAT2', at: [x, y], vertical: true },           // 接腳：小圓圈＋名稱（名稱在圓圈上方，vertical 時逆轉 90°）
  { type: 'text', text: '(12V 10W)', at: [x, y], size: 18 },           // 規格、子元件名稱（照明燈、油錶…）
  { type: 'connector', label: '4P', box: [x0, y0, x1, y1] },           // 元件上的接頭
  { type: 'frame', box: [x0, y0, x1, y1] },                            // 元件外框（原圖有才畫）
]
```

`kind`（通用符號，畫在 `box` 內並縮放）：

| kind | 用在 | 畫法 |
| --- | --- | --- |
| `lamp` | 方向燈、儀錶組各燈、尾燈 | 圓＋內部燈絲（兩圈）＋燈座矩形朝 `dir` |
| `lamp2` | 頭燈 | 長橢圓＋兩組燈絲 |
| `horn` | 喇叭 | 同心雙圓 |
| `gauge` | 油錶、轉速錶 | 圓＋指針 |
| `resistor` | 油量計 | 矩形內鋸齒 |
| `coil` | 高壓線圈、脈波線圈、起動繼電器內線圈 | 一排半圓 |
| `transformer` | 高壓線圈 | 兩排半圓＋中間兩條鐵芯線 |
| `alternator` | 交流發電機 | 圓＋內部兩排線圈 |
| `motor` | 起動馬達 | 圓＋「M」 |
| `battery` | 電瓶 | 外框＋兩個端子圓 |
| `fuse` | 保險絲 | 矩形＋內部波浪線 |
| `diode` | 矽控整流器 | 三角形＋橫槓 |
| `ground` | 接地 | 三條遞減橫線 |
| `lug` | 接地端子、火星塞 | 圓環＋柄 |
| `plug` | 火星塞電極 | 兩個相對的箭頭 |

---

### Task 1：`basemap.js` 畫 `parts`

**Files:** Modify `js/basemap.js`、`tools/redraw/sample-marks.js`（加入 `parts` 範例）

**Interfaces:**
- Produces：`drawBase` 依上表畫 `parts`；不再自動畫元件方框（改由 `frame`），元件名稱照舊畫在 `label`。
- 線寬 2.5、顏色 `BASE_INK`；符號只描線不填白；`connector` 沿用第 2 階段的畫法（填白＋外框＋文字）。

- [ ] **Step 1：在 `sample-marks.js` 加入每種 `kind` 各一個、`pin`（橫書、直書各一）、`text`、`connector`、`frame`**
- [ ] **Step 2：實作**
- [ ] **Step 3：`node tools/redraw/sheet.js PA12B <前綴> --sample`，Read 看圖**
  Expected：15 種符號都可辨認、在各自 `box` 內；直書接腳名稱逆轉 90°。
- [ ] **Step 4：Commit** `feat(redraw): 底圖畫元件符號、接腳與文字`

---

### Task 2：`add-parts.js` 與元件判讀工具

**Files:**
- Create: `tools/redraw/add-parts.js`、`tools/redraw/parts-manual.js`（先放空結構）、`tools/redraw/comp-sheet.js`
- Modify: `tools/redraw/write-drawing.js`（輸出 `parts`，每筆一行）、`tools/test/marks.test.js`

**Interfaces:**
- `applyParts(drawing, parts) -> drawing`（放在 `write-drawing.js`）：只替換 `parts`，其他欄位不動。
- `DIAGRAM=<圖> node tools/redraw/add-parts.js`：讀 `parts-manual.js`，改寫 `drawing.js` 的 `parts`；`drawing.js` 已手改也可執行（只動自己的欄位）。
- `comp-sheet.js <前綴> <元件序號…>`：每個元件一格，放大顯示原圖，疊上元件內墨水塊（`findMarks`，`skip` 為空、限制在元件 `box` 外擴 20 px 內）的外框與編號，並把各塊座標寫到 `$WORK/<圖>-comp-<序號>.json`，供判讀時取座標。

- [ ] **Step 1：寫測試 `只改寫 parts`**：`applyParts({ nets: [1], labels: [2], parts: [] }, [{ type: 'text' }])` → `nets`、`labels` 不變、`parts` 是新的；`formatDrawing` 輸出含 `parts:` 且每筆一行。
- [ ] **Step 2：跑測試確認失敗**
- [ ] **Step 3：實作 `applyParts`、`add-parts.js`、`comp-sheet.js`；`formatDrawing` 加入 `parts`**
- [ ] **Step 4：跑測試** Expected：全部 PASS
- [ ] **Step 5：Commit** `feat(redraw): 元件圖元的資料欄位與判讀工具`

---

### Task 3：PA12B 元件判讀（第一批：開關類與接頭類）

**Files:** Modify `tools/redraw/parts-manual.js`、`data/PA12B/drawing.js`

元件（序號同 `components.js`）：0 燈光／起動開關、1 離合器開關、2 前剎車燈開關、3 後剎車燈開關、4 CDI 組、5 調壓整流器、6 方向燈繼電器、17 保險絲、18 起動繼電器、19 方向燈／喇叭／遠近光燈開關、20 主開關、23 矽控整流器、24 空檔燈開關。

- [ ] **Step 1：每個元件跑 `comp-sheet.js`，Read 看圖，寫進 `parts-manual.js`**：符號、每支接腳（名稱照原圖）、規格文字、元件上的接頭、外框。
- [ ] **Step 2：`add-parts.js` 寫入，用 `sheet.js` 並排截圖逐一對照**，修到一致。
- [ ] **Step 3：列出接腳清單**（元件 → 接腳名稱）供 Task 6 回報。
- [ ] **Step 4：驗收** `DIAGRAM=PA12B node tools/redraw/compare.js | grep -E "^(PASS|FAIL)"` Expected：三項 PASS
- [ ] **Step 5：Commit** `feat(redraw): PA12B 開關與接頭類元件`

---

### Task 4：PA12B 元件判讀（第二批：燈、線圈、電源類）

元件：7 油量計、8 接地（車架）、9 右前方向燈、10 儀錶組（含各燈泡、油錶、轉速錶與名稱、規格）、11 頭燈、12 喇叭、13 左前方向燈、14 右後方向燈、15 尾燈／剎車燈、16 左後方向燈、21 高壓線圈、22 火星塞、25 脈波線圈、26 交流發電機、27 起動馬達、28 接地（引擎）、29 電瓶。

- [ ] **Step 1～2：同 Task 3**
- [ ] **Step 3：驗收**：同 Task 3 Step 4；另跑 `check-paint.js`、`check-import.js`。
- [ ] **Step 4：Commit** `feat(redraw): PA12B 燈、線圈與電源類元件`

---

### Task 5：PA12C 與選取亮顯

**Files:** Modify `tools/redraw/parts-manual.js`（`PA12C` 差異）、`data/PA12C/drawing.js`

- [ ] **Step 1：PA12C 逐一比對元件**：用 `comp-sheet.js` 看 PA12C 原圖，和 PA12B 不同的元件（至少儀錶組的油量指示燈、油量計）在 `PA12C` 另列。
- [ ] **Step 2：`add-parts.js` 寫入，並排截圖對照差異處**
- [ ] **Step 3：選取亮顯**：在 Chrome 分別選取主開關、儀錶組、交流發電機，截圖確認符號與文字以原亮度亮起。
- [ ] **Step 4：驗收**：兩張圖 `compare.js` 三項 PASS、`check-paint.js`、`check-import.js` 全過、單元測試全過。
- [ ] **Step 5：Commit** `feat(redraw): PA12C 元件與選取亮顯確認`

---

### Task 6：收尾

- [ ] **Step 1：兩張圖全圖截圖各一，Read 確認**
- [ ] **Step 2：整個分支審查**（fresh reviewer）
- [ ] **Step 3：推分支、提供 PR 網址與說明**（`gh` 帳號無權限時給 `compare` 網址）
- [ ] **Step 4：回報**：接腳清單、和原圖不一致或看不清楚的地方、第 4 階段待辦（移除原圖）。
