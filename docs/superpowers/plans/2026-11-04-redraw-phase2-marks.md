# 以資料重繪線路圖：第 2 階段（接頭與線色文字）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新底圖補上原圖導線上的三種標記：線色文字（`labels`）、單線接頭（`inline`：三角形公端＋帶內框的母端）、多腳接頭方框（`connectors`，例：`3P`），以及圖名（`texts`）。PA12B、PA12C 兩張圖逐區和原圖對照無缺漏。

**Architecture:** 一支 Node 工具從原圖找出「不屬於導線、也不在元件方框內」的墨水塊，依外形分類，並把文字對應到相鄰導線的線色，產生草稿寫進 `drawing.js` 的 `labels`／`inline`／`connectors`。`js/basemap.js` 負責畫出這些標記。草稿產生後以 `?dev=1` 疊原圖逐區對照，人工修正資料。之後 `drawing.js` 以手改為準，產生工具不再覆寫。

**Tech Stack:** 同第 1 階段（原生 JS、Canvas 2D、`node:test`、headless Chrome）。

**Spec:** `docs/superpowers/specs/2026-11-03-redraw-diagram-design.md`（「分階段」第 2 點；資料結構見「資料：新增 `data/<圖>/drawing.js`」）

## Global Constraints

- 第 1 階段的限制全部沿用：座標系統不變、不得引入原廠影像、系統字型、`drawing.nets` 順序就是線路編號。
- 標記只畫、不參與點擊：不寫入 `label`，`compare.js` 的三項驗收必須維持 PASS。
- 線色文字的內容一律等於它所標示那條導線的 `code`；兩者不一致時以原圖為準，並回報給使用者（可能是第 1 階段的線色標錯）。
- 標記的位置沿用原圖座標，不重新排版。
- 在 `redraw-phase2` 分支上做，每個任務 commit；完成後推到 `origin` 並對 `main` 開 PR。

## Review Focus

1. **沒有線色的導線旁卻有線色文字**（例：原圖灰線 `GR`）：草稿不能憑空填字，要列出來由人工看原圖判讀。→ Task 2 的 `無線色導線的文字列入待判讀` 測試。
2. **文字寬度和線色代號長度對不上**（例：`G` 旁的墨水其實是 `G/R`）：要列入待判讀，而不是直接採用相鄰導線的代號。→ Task 2 的 `寬度不符列入待判讀` 測試。
3. **直書文字**（垂直導線旁）：要畫成直書，不能橫著擠在線旁。→ Task 1 的直書截圖檢查。
4. **重跑產生工具會蓋掉人工修正**：`drawing.js` 已標記為手改後，工具必須拒絕覆寫。→ Task 3 的 `已手改拒絕覆寫` 測試。
5. **標記和導線重疊時誤擋點擊**：標記不寫入 `label`。→ Task 3 結束時 `compare.js` 仍 PASS。

---

## 檔案結構

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `js/basemap.js` | 修改 | 畫 `labels`、`inline`、`connectors`、`texts` |
| `tools/redraw/marks.js` | 新增 | 純函式：找墨水塊、分類、對應導線 |
| `tools/redraw/add-marks.js` | 新增 | CLI：產生標記草稿，只改寫 `drawing.js` 的四個標記欄位 |
| `tools/redraw/bootstrap.js` | 修改 | 加上「已手改拒絕覆寫」的保護 |
| `tools/redraw/sheet.js` | 新增 | 逐區對照截圖：原圖、新圖並排輸出 PNG |
| `tools/test/marks.test.js` | 新增 | `node --test 'tools/test/*.test.js'` |
| `data/PA12B/drawing.js`、`data/PA12C/drawing.js` | 修改 | 標記資料 |

## 資料格式（Task 1 定案，寫進 `drawing.js` 檔頭註解）

```js
labels:     [{ text: 'G/R', at: [x, y], vertical: false }],        // at = 文字中心
inline:     [{ kind: 'plug' | 'socket', at: [x, y], dir: 'h' | 'v' }], // at = 符號中心；plug 的尖端朝 +x（h）或 +y（v），flip: true 反向
connectors: [{ label: '3P', box: [x0, y0, x1, y1] }],               // 多腳接頭外框
texts:      [{ text: '野狼傳奇 125 線路圖', at: [x, y], size: 28 }],
```

---

### Task 1：`basemap.js` 畫標記

**Files:**
- Modify: `js/basemap.js`
- Create: `tools/redraw/sheet.js`

**Interfaces:**
- Produces: `drawBase` 依上方格式畫出四種標記。尺寸（px，全解析度）：
  - 線色文字：粗體，字高 22，顏色 `BASE_INK`；直書時逐字由上往下排，`/` 轉 90°。
  - `plug`：等腰三角形，底邊 26、高 30，空心，線寬 2.5。
  - `socket`：外框 44×20、內框 22×8（置中），線寬 2。
  - `connector`：外框線寬 2.5；`label` 以字高 18 寫在框內中央，框比字窄時改直書。
- `sheet.js`：`node tools/redraw/sheet.js <圖> <輸出前綴> x,y,w,h …`，每個區域輸出一張左右並排的 PNG（左：原圖、右：新圖），用 Task 1 第 1 階段的 `evalInPage` 和 `?dev=1` 載入原圖。

- [ ] **Step 1：寫一份測試用的 `drawing` 物件**（`tools/redraw/sample-marks.js`）：四種標記各一，含一個直書文字、一個 `flip` 的 `plug`。
- [ ] **Step 2：實作四種標記的繪製**。
- [ ] **Step 3：用 `evalInPage` 在頁面上以測試物件呼叫 `drawBase` 截圖，Read 看圖**
  Expected：四種標記形狀正確；直書文字由上往下；`flip` 的三角形朝反方向。
- [ ] **Step 4：Commit** `feat(redraw): 底圖畫線色文字、接頭與圖名`

---

### Task 2：標記萃取 `marks.js`

**Files:**
- Create: `tools/redraw/marks.js`、`tools/test/marks.test.js`

**Interfaces:**
- Consumes: `rasterizeDrawing`（第 1 階段）。
- Produces:
  - `findMarks({ image, label, skip }) -> [{ x0, y0, x1, y1, n, parts }]`：墨水（同 `nets.js` 的二值化）中 `label < 0`、不在 `skip` 矩形內的連通塊；面積 < 6 px 的忽略；相距 ≤ 8 px（垂直方向 ≤ 6 px）的塊併成一個標記，`parts` 是併入的塊數。
  - `classify(mark, image) -> 'plug' | 'socket' | 'text' | 'connector' | 'other'`：
    - `plug`：單一塊，外框 24～38 × 22～36，墨水比例 < 0.35，且沿尖端方向每欄（列）墨水高度遞減。
    - `socket`：外框長邊 38～52、短邊 16～26，四邊都有墨水且中央有內框。
    - `connector`：外框長邊 ≥ 60，與 ≥ 2 條導線的端點相鄰。
    - `text`：其餘外框短邊 ≤ 34 者。
    - 其他為 `other`。
  - `attach(marks, drawing) -> { labels, inline, connectors, review }`：
    - `text` 對應「外框外擴 12 px 內、方向和文字一致（橫書配水平線、直書配垂直線）的最近導線」，`text = net.code`。
    - `review` 收集：對應導線 `code === null`、寬度和代號長度不符（每個字元 9～17 px，`/` 算一個字元）、找不到導線、`other`、`connector`（接腳數字由人工讀）。

- [ ] **Step 1：寫測試**（在 200×100 的合成 RGBA 圖上畫形狀）
  - `找出不屬於導線的墨水塊`：畫一條 `label` 已標記的線和一塊 10×20 的墨水 → 只回傳那一塊。
  - `鄰近的字母併成一個標記`：三塊相距 5 px → 1 個標記、`parts === 3`。
  - `三角形分類為 plug`、`雙框分類為 socket`、`短字分類為 text`。
  - `文字對應旁邊導線的線色`：水平線 `code: 'BR'`，文字塊寬 28 → `labels[0].text === 'BR'`、`vertical === false`。
  - `無線色導線的文字列入待判讀`：導線 `code: null` → `labels` 空、`review` 一筆，原因含「導線沒有線色」。
  - `寬度不符列入待判讀`：`code: 'G'`、文字塊寬 45 → `review` 一筆，原因含「寬度」。
- [ ] **Step 2：跑測試確認失敗** Run: `node --test 'tools/test/*.test.js'` Expected：marks 測試 FAIL
- [ ] **Step 3：實作**
- [ ] **Step 4：跑測試** Expected：全部 PASS
- [ ] **Step 5：Commit** `feat(redraw): 從原圖萃取線色文字與接頭標記`

---

### Task 3：產生標記草稿並保護手改

**Files:**
- Create: `tools/redraw/add-marks.js`
- Modify: `tools/redraw/bootstrap.js`、`tools/test/marks.test.js`

**Interfaces:**
- `DIAGRAM=<圖> node tools/redraw/add-marks.js [--force]`：只改寫 `drawing.js` 的 `connectors`／`inline`／`labels`／`texts` 四行，`nets` 原樣保留；`texts` 預設放一筆圖名（`DIAGRAMS` 的 `title`，位置取原圖標題區中心、字高 40）。`review` 寫到 `$WORK/<圖>-marks-review.json`，並輸出各類計數。
- 共用的保護函式 `assertDraft(text, force)`（放在 `marks.js`）：`drawing.js` 第一行含 `// 已手改` 時丟出錯誤 `drawing.js 已手改，產生工具不會覆寫；確定要重產請加 --force`；`bootstrap.js` 與 `add-marks.js` 都先呼叫它。

- [ ] **Step 1：加測試 `已手改拒絕覆寫`**：`assertDraft('// 已手改\n…', false)` 丟錯、`force = true` 不丟。
- [ ] **Step 2：跑測試確認失敗**
- [ ] **Step 3：實作 `assertDraft`、`add-marks.js`，`bootstrap.js` 加保護**
- [ ] **Step 4：產生兩張圖的草稿**
  Run: `for D in PA12B PA12C; do DIAGRAM=$D node tools/redraw/add-marks.js; DIAGRAM=$D node tools/redraw/compare.js | grep -E "^(PASS|FAIL)"; done`
  Expected：印出各類計數；`compare.js` 三項 PASS。
- [ ] **Step 5：Commit** `feat(redraw): 產生標記草稿；drawing.js 手改後禁止覆寫`

---

### Task 4：PA12B 逐區對照與人工修正

**Files:** Modify `data/PA12B/drawing.js`

- [ ] **Step 1：處理待判讀清單**：對 `$WORK/PA12B-marks-review.json` 每筆用 `crop.js` 看原圖，補上正確的 `labels`／`inline`／`connectors`（接腳數字照原圖），或判定為非標記（元件外的符號、雜點）不畫。
  - 文字和導線 `code` 不一致的，**不改導線**，記下座標與兩邊的值，在 Step 4 回報使用者。
- [ ] **Step 2：逐區對照**：把全圖切成 8 區（4×2），每區跑 `sheet.js` 並排截圖，Read 比對，補漏、刪錯、調位置。每區修完重截一次確認。
- [ ] **Step 3：標成手改**：`drawing.js` 第一行加 `// 已手改（2026-11-04 第 2 階段起），產生工具不再覆寫`。
- [ ] **Step 4：驗收**
  Run: `DIAGRAM=PA12B node tools/redraw/compare.js | grep -E "^(PASS|FAIL)" && node tools/redraw/check-paint.js && node --test 'tools/test/*.test.js' 2>&1 | grep -E "^ℹ (pass|fail)"`
  Expected：全部 PASS。
- [ ] **Step 5：Commit** `feat(redraw): PA12B 補齊接頭與線色文字`

---

### Task 5：PA12C 逐區對照與人工修正

**Files:** Modify `data/PA12C/drawing.js`

- [ ] **Step 1**：同 Task 4 Step 1～3，對象換成 PA12C；兩張圖相同的區域可直接比對 PA12B 已修好的資料，只看差異處（油量指示燈一帶）。
- [ ] **Step 2：驗收**：同 Task 4 Step 4（`DIAGRAM=PA12C`）。
- [ ] **Step 3：Commit** `feat(redraw): PA12C 補齊接頭與線色文字`

---

### Task 6：收尾

- [ ] **Step 1：全套驗收**：第 1 階段 Task 8 Step 1 的指令全部 PASS，加上 `node tools/redraw/check-import.js`。
- [ ] **Step 2：兩張圖全圖截圖各一張**，Read 確認整體觀感。
- [ ] **Step 3：推分支並開 PR**：`git push -u origin redraw-phase2`，`gh pr create --base main`。`gh` 目前的帳號看不到這個私人 repo，所以要先請使用者切換到 `dwatow` 帳號，或授權 `chris-wang-furuke` 存取；權限不足時，改給使用者 GitHub 建立 PR 的網址。
- [ ] **Step 4：回報**：截圖、例外與「文字和線色不一致」清單、第 3 階段待辦（元件符號）。
