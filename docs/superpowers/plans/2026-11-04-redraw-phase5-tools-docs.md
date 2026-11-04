# 以資料重繪線路圖：第 5 階段（工具與文件）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工具與文件改成以資料重繪後的流程：修改線路圖時，有一個 skill 教怎麼改 `drawing.js` 與各 `*-manual.js`，專案 CLAUDE.md 記下必跑的檢查。

**Architecture:**
- 舊 skill 裡工具還在用的腳本（`lib.js`、`acceptance.js`、`crop.js`）搬到 `tools/redraw/`。
- 兩個舊 skill（`fixing-wire-nets`、`editing-diagram-image`）刪除，合併成一個新 skill `editing-wiring-drawing`。
- 專案根目錄新增 `CLAUDE.md`，只放精簡規則；工具用法放在 skill 裡。

**Tech Stack:** 同前四階段。

**Spec:** `docs/superpowers/specs/2026-11-03-redraw-diagram-design.md`（「分階段」第 5 點）

**使用者決定（2026-11-04）：**
- 兩個舊 skill 合併成一個新 skill。
- 新 skill 照 superpowers:writing-skills 用 subagent 做情境測試：先跑沒有 skill 的基準，再寫 skill，再測一次。
- 工具用途與必跑檢查記在專案 CLAUDE.md。

## Global Constraints

- 修改後必跑：
  - `node --test 'tools/test/*.test.js'`
  - 兩張圖的 `DIAGRAM=<圖> node tools/redraw/compare.js`
  - `node tools/redraw/check-paint.js`、`node tools/redraw/check-import.js`
- 用 Chrome 的腳本只能一支一支跑。
- 原圖 `data/*/strips.js` 只在本機，不得加回 git。
- 在 `redraw-phase5` 分支做，完成後開 PR 到 `main`。

## Review Focus

1. **搬移腳本後的相對路徑**：`lib.js` 的 `PROJECT` 是用 `__dirname` 往上推算的，搬家後層數不同，路徑錯了會讀錯資料夾。→ Task 1 跑 `compare.js`、`check-paint.js`。
2. **漏改的引用**：還有檔案引用 `.claude/skills/fixing-wire-nets`，執行時就會找不到模組。→ Task 1 的測試掃描全部 `.js`、`.md`，計畫與規格文件除外。
3. **新 skill 指錯指令或檔名**：skill 裡每個指令都要實際跑過。→ Task 2 Step 5。
4. **`adding-switch-tables` 仍指向舊 skill**。→ Task 1 一併更新，並納入 Task 1 的掃描。
5. **`lib.test.js` 受環境變數 `DIAGRAM` 影響**（第 4 階段暫緩的小問題）。→ Task 1 改成明確傳入圖名。

---

### Task 1：共用腳本搬到 `tools/redraw/`

**Files:**
- Move：`.claude/skills/fixing-wire-nets/scripts/{lib,acceptance,crop}.js` → `tools/redraw/`
- Delete：
  - `.claude/skills/fixing-wire-nets/scripts/{verify,diff,labels}.js`：舊辨識的驗收，已由 `compare.js` 取代。
  - `.claude/skills/editing-diagram-image/scripts/`：改原圖像素的工具，原圖已不在 git。
- Modify：
  - 所有 `require('../../.claude/skills/fixing-wire-nets/scripts/lib')` 改成 `require('./lib')`，測試則改成 `require('../redraw/lib')`。
  - `lib.js`：`PROJECT` 改為 `path.resolve(__dirname, '../..')`；第 19 行註解改為「與 `tools/redraw/sheet.js` 相同」。
  - `.claude/skills/adding-switch-tables/SKILL.md`：`crop.js`、`lib.js` 的路徑改到 `tools/redraw/`。
  - `tools/test/lib.test.js`：改成 `loadImage(dir, 'PA12B')`。需要先讓 `loadImage` 接受第二個參數 `diagram`，再傳給 `originalFile`。
- Test：`tools/test/no-original.test.js` 新增測試。

- [ ] **Step 1：寫測試 `沒有檔案引用舊 skill 的腳本`**
  - 範圍：`git ls-files '*.js' '*.md'`，排除 `docs/superpowers/`。
  - 檢查：內容都不含 `fixing-wire-nets/scripts`、`editing-diagram-image/scripts`。
- [ ] **Step 2：跑測試確認失敗**
- [ ] **Step 3：搬移與修改**（`git mv` 保留歷史）
- [ ] **Step 4：跑測試** Expected：全部 PASS
- [ ] **Step 5：實測**
  - 兩張圖的 `compare.js` 三項都 PASS。
  - `check-paint.js` 6/6、`check-import.js` 2/2、`DIAGRAM=PA12C node tools/redraw/acceptance.js` PASS。
  - `node tools/redraw/crop.js <scratch>/c.png 2700 100 80 2` 輸出圖片。
- [ ] **Step 6：Commit** `refactor(redraw): 舊 skill 的共用腳本搬到 tools/redraw，刪除舊辨識與改原圖的腳本`

---

### Task 2：新 skill `editing-wiring-drawing`

**REQUIRED SUB-SKILL:** superpowers:writing-skills（RED → GREEN → REFACTOR）

**Files:**
- Create：`.claude/skills/editing-wiring-drawing/SKILL.md`
- Delete：`.claude/skills/fixing-wire-nets/`、`.claude/skills/editing-diagram-image/`（兩者都只剩 `SKILL.md`）

**skill 的範圍**（依這次第 1～4 階段實際的修改方式）：

| 要改的東西 | 改哪裡 | 套用 |
| --- | --- | --- |
| 導線（補線、刪線、併線、改端點） | `tools/redraw/nets-manual.js` | `DIAGRAM=<圖> node tools/redraw/recut.js` |
| 線色文字、單線接頭、多腳接頭 | `tools/redraw/marks-manual.js`；`data/<圖>/drawing.js` 同步手改 | 不重跑 `add-marks.js --force`，它會讓文字位置偏移 |
| 元件符號、接腳、文字 | `tools/redraw/parts-manual.js` | `DIAGRAM=<圖> node tools/redraw/add-parts.js` |
| 元件的點擊與亮起範圍 | `data/<圖>/components.js` 的 `box`、`label`、`picks` | — |
| 刻意和舊辨識不同的地方 | `tools/redraw/exceptions.js` | `compare.js` |

要點：
- 先用 `sheet.js` 並排截圖看原圖，原圖只在本機。
- 改完跑必跑檢查。
- `nets-manual.js` 的 `add` 要寫成切缺口之後的座標，重跑才不會重補。
- 移除線路會改變線路編號，但塗色是用座標存的，不受影響。

- [ ] **Step 1（RED）：基準測試**
  - 用 subagent 跑 3 個情境，不給 skill，只給 repo 路徑：
    - (a) 使用者回報「喇叭附近的 B 線沒接上三角形」。
    - (b) 使用者要「高壓線圈的接地符號照空檔燈開關的畫法改」。
    - (c) 使用者要「某個元件被點擊時，旁邊的接頭也要一起亮」。
  - 要求 subagent 只寫出打算改哪些檔案、跑哪些指令，不要真的修改。
  - 逐字記下它們漏掉或做錯的地方，例如直接改 `drawing.js` 的 `nets`、沒跑 `compare.js`、用 `add-marks --force`、沒先看原圖。
- [ ] **Step 2（GREEN）：寫 `SKILL.md`**
  - `description` 只寫觸發情境，不寫流程。
  - 內容針對 Step 1 的失誤，控制在 500 字以內。
- [ ] **Step 3：同樣 3 個情境加上 skill 再跑**
  - Expected：每個情境都選對檔案、套用指令，並列出必跑檢查。
- [ ] **Step 4（REFACTOR）**：補上 Step 3 仍出現的漏洞，再測一次。
- [ ] **Step 5：skill 裡每個指令實際跑一次**，在 scratchpad 輸出、不改資料，確認指令和檔名都正確。
- [ ] **Step 6：刪除兩個舊 skill**
  - Commit `feat(skills): 新增 editing-wiring-drawing，取代 fixing-wire-nets 與 editing-diagram-image`

---

### Task 3：專案 CLAUDE.md 與收尾

**REQUIRED SUB-SKILL:** claude-md-maintenance

**Files:**
- Create：`CLAUDE.md`
- Modify：
  - `docs/redraw-backlog.md`：第 4、5 階段改成已完成。
  - `.gitignore`：補上 `wolf*selections*.json`，涵蓋 `wolf125-selections1.json`。

**CLAUDE.md 的內容**：只放 Claude 從程式碼看不出來、又常需要的規則。
- 必跑檢查：見 Global Constraints。
- 用 Chrome 的腳本只能一支一支跑，因為它們共用暫存頁面。
- 原圖 `data/*/strips.js` 只在本機、不進 git。
  - 從還在追蹤它的舊 commit 切換分支時，git 可能刪掉本機檔案。
  - 備份在 `../wolfElectronic-strips-backup/`。
- 修改線路圖時，用 `editing-wiring-drawing` skill。
- `node --test` 要用 glob（`'tools/test/*.test.js'`），Node 24 不接受資料夾。

- [ ] **Step 1：依 claude-md-maintenance 寫 `CLAUDE.md`**，逐條確認是 Claude 從程式碼看不出來的事。
- [ ] **Step 2：改 `docs/redraw-backlog.md`、`.gitignore`**
  - `git status` 不再列出 `wolf125-selections1.json`。
  - `zing150.jpeg` 是使用者的檔案，不處理。
- [ ] **Step 3：跑必跑檢查** Expected：全過
- [ ] **Step 4：Commit** `docs: 專案 CLAUDE.md；待辦清單更新第 4、5 階段`
- [ ] **Step 5：全分支審查**（全新 reviewer）**後，推分支、開 PR**
