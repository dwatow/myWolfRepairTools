# 以資料重繪線路圖：第 4 階段（移除原圖）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 網頁不再載入任何原廠影像，git 的所有歷史都不含 `strips.js`，之後 repo 才能改回公開。

**Architecture:**
- **網頁**：拿掉執行期對原圖的依賴，包括原圖對照開關、`STATIC_AREAS`、`js/nets.js`、`anchors.js`、`fixes.js` 的載入。
- **原圖檔**：和 PDF 一樣只留在本機（`.gitignore`），比對工具照常讀本機檔案；沒有原圖時給清楚的訊息。
- **歷史**：用 `git filter-repo` 把 `strips.js` 從所有 commit 移除，再刪除並重建同名 GitHub repo，推上乾淨的歷史。

**Tech Stack:** 同前三階段；另用 `git filter-repo`（`/opt/homebrew/bin/git-filter-repo`）。

**Spec:** `docs/superpowers/specs/2026-11-03-redraw-diagram-design.md`（「分階段」第 4 點、「驗收」4～6）

**使用者決定（2026-11-04）：**
- 本機原圖：保留在 `data/<圖>/strips.js`，加進 `.gitignore`（同 PDF 的做法）。
- GitHub：改寫歷史後，由 `dwatow` 刪除並重建同名 repo（`refs/pull/*` 會留住舊 commit，force push 清不掉）。PR #1～#5 的討論紀錄會消失。

## Global Constraints

- 網頁不得載入 `strips.js`，也不得以任何方式顯示原廠影像。
- 驗收 6 的檢查方式：`git grep -E 'data:image/[a-z]+;base64,[A-Za-z0-9+/]{100}' $(git rev-list --all)` 無結果。
  - 改用這個寫法，是因為 `edit-base.js` 與設計文件只是以文字提到 `data:image`，不是影像資料。
- `legacy.js` 保留：它只有座標，沒有影像；使用者瀏覽器裡的舊版塗色（v3）要靠它轉移。
- `js/nets.js`、`anchors.js`、`fixes.js` 檔案保留，比對工具（`compare.js`、`bootstrap.js`）還要用；只拿掉網頁的載入。
- 修改後必跑：
  - `node --test 'tools/test/*.test.js'`
  - 兩張圖的 `compare.js`
  - `check-paint.js`、`check-import.js`
- 用 Chrome 的腳本只能一支一支跑。
- **不可逆的步驟先備份再執行**（使用者 2026-11-04 同意）：Task 4 備份後直接執行，跑完一次回報；Task 5 刪除 repo 由使用者操作，刪除前先匯出 PR 紀錄。
- 在 `redraw-phase4` 分支做 Task 1～3，合併後再做 Task 4～5（改寫歷史要在 `main` 上）。

## Review Focus

1. **拿掉 `anchors.js`、`fixes.js` 後網頁壞掉**：執行期若還有地方讀 `WOLF_FIXES`、`WOLF_ANCHORS`，會在載入時出錯。→ Task 1 跑 `check-paint.js`、`check-import.js` 與 PA12C 的 `acceptance.js`。
2. **舊版塗色轉移失效**：使用者瀏覽器裡的 v3 塗色要靠 `legacy.js`。→ Task 1 的 `check-paint.js`「轉移」項。
3. **沒有原圖的人跑比對工具**：應顯示「找不到原圖檔」的說明，而不是 `ENOENT` 堆疊。→ Task 2 的單元測試。
4. **filter-repo 會刪掉工作目錄裡的 `strips.js`**：本機原圖不能因此遺失。→ Task 4 先備份，跑完後比對 md5。
5. **其他 ref 留住舊 commit**：例如 tag、stash、`refs/original`、`refs/remotes`、reflog。→ Task 4 改寫後，掃描 `git for-each-ref` 列出的所有 ref，並 `gc --prune=now`。

---

### Task 1：網頁不再載入原圖與舊辨識資料

**Files:**
- Modify:
  - `js/app.js`：刪除第 3、47 行的 `STATIC_AREAS`、第 281 行的固定區域重畫、第 492～507 行的原圖對照，第 279 行改為不疊原圖。
  - `index.html`：刪除第 27 行原圖對照的勾選框、第 93 行 `js/nets.js`。
  - `js/diagrams.js`：`DATA_FILES` 去掉 `anchors`、`fixes`；第 2 行註解改寫。
- Test: Create `tools/test/no-original.test.js`

**Interfaces:**
- Produces：網頁只載入 `drawing`、`legacy`、`components`、`switches` 四個資料檔。

- [ ] **Step 1：寫測試 `網頁不載入原圖與舊辨識資料`**
  - 讀檔案文字後檢查：
    - `index.html` 不含 `nets.js`、`dev-original`。
    - `js/app.js` 不含 `strips.js`、`STATIC_AREAS`、`WOLF_FIXES`、`WOLF_ANCHORS`、`dev-original`。
    - `js/diagrams.js` 的 `DATA_FILES` 陣列字面值等於 `["drawing", "legacy", "components", "switches"]`。
- [ ] **Step 2：跑測試確認失敗**
  `node --test tools/test/no-original.test.js`
  Expected：FAIL
- [ ] **Step 3：實作**（`ANCHORS` 變數一併移除）
- [ ] **Step 4：跑測試**
  `node --test 'tools/test/*.test.js'`
  Expected：全部 PASS
- [ ] **Step 5：頁面驗收**
  - 依序跑 `node tools/redraw/check-paint.js`、`node tools/redraw/check-import.js`。
  - 再跑 `DIAGRAM=PA12C node .claude/skills/fixing-wire-nets/scripts/acceptance.js`。
  - Expected：6/6、2/2、PASS。
- [ ] **Step 6：Commit** `feat(redraw): 網頁不再載入原圖、舊辨識程式與 anchors／fixes`

---

### Task 2：比對工具自己載入本機原圖

**Files:**
- Modify:
  - `.claude/skills/fixing-wire-nets/scripts/lib.js`（`loadImage`）
  - `tools/redraw/sheet.js`（不再用網頁的原圖對照，改用注入的腳本載入原圖）
- Test: Create `tools/test/lib.test.js`

**Interfaces:**
- Produces：
  - `loadImage(dir = PROJECT)`：檔案不存在時丟出 `Error`，訊息為 `找不到 data/<圖>/strips.js（原廠掃描圖不在 git 內，比對原圖的工具需要本機的原圖檔）`。
  - `sheet.js` 的指令格式不變。

- [ ] **Step 1：寫測試 `loadImage：沒有原圖時給清楚的訊息`**
  ```js
  const os = require('os'), fs = require('fs'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-strips-'));
  assert.throws(() => loadImage(dir), /找不到 data\/PA12B\/strips\.js（原廠掃描圖不在 git 內/);
  ```
- [ ] **Step 2：跑測試確認失敗**（目前丟的是 `ENOENT`）
- [ ] **Step 3：實作**
  - `loadImage`：在 `statSync` 前先檢查檔案是否存在。
  - `sheet.js`：
    - 頁面腳本改成自己載入 `data/<圖>/strips.js`（`loadScript` 已在頁面上），再組出原圖畫布。
    - 組法照搬目前 `app.js` 第 499～503 行：7 條橫條上下拼接後，逆時針轉 90°。
    - 載入前先在 Node 端用 `fs.existsSync` 檢查，沒有原圖時給同樣的訊息。
- [ ] **Step 4：跑測試** Expected：全部 PASS
- [ ] **Step 5：實測**
  `node tools/redraw/sheet.js PA12B <scratch>/t 2640,20,170,260,3`
  Expected：輸出左原圖、右新圖的 PNG，和改之前一樣（Read 看圖）。
- [ ] **Step 6：Commit** `feat(redraw): 比對工具改從本機原圖檔載入，沒有時給清楚的訊息`

---

### Task 3：原圖移出 git 追蹤

**Files:**
- Modify:
  - `.gitignore`：加 `data/*/strips.js`，並附註解：原廠掃描圖，只留在本機。
  - `docs/redraw-backlog.md`：第 4 階段改為進度。
- Remove from index：`data/PA12B/strips.js`、`data/PA12C/strips.js`（`git rm --cached`，本機檔案保留）

- [ ] **Step 1：記下兩個原圖檔的 md5**（`md5 data/*/strips.js`），存到 scratchpad。
- [ ] **Step 2：`git rm --cached data/PA12B/strips.js data/PA12C/strips.js`，改 `.gitignore`**
- [ ] **Step 3：驗證**
  - `git ls-files | grep strips` 無結果。
  - `git status --short` 不列出 `strips.js`。
  - 兩個檔案的 md5 和 Step 1 相同。
  - `DIAGRAM=PA12B node tools/redraw/compare.js | grep -E "^(PASS|FAIL)"` 三項 PASS。
- [ ] **Step 4：Commit** `chore(redraw): 原廠掃描圖 strips.js 移出 git，只留在本機`
- [ ] **Step 5：推分支、開 PR 到 `main`，等使用者合併**

---

### Task 4：改寫 git 歷史（本機）

**先備份再執行**（使用者同意，不另外停下來問），跑完一次回報：
- 要刪除的分支：本機的 `master`、`redraw-phase2`、`redraw-phase3`、`redraw-polish`、`redraw-phase4`，以及遠端對應的分支。
- 所有 commit 的 hash 都會改變。

**前提：** Task 3 已合併到 `main`；本機切到 `main` 並拉到最新；`git status` 沒有未 commit 的變更（未追蹤檔不影響）。

- [ ] **Step 1：備份**
  - `git clone --mirror . ../wolfElectronic-backup-2026-11-04.git`
    - 這份備份含原圖，只留本機，不推送。
  - 兩個 `strips.js` 複製到 `../wolfElectronic-strips-backup/`，並記下 md5。
- [ ] **Step 2：刪除已合併的分支**
  - 本機：`git branch -d master redraw-phase2 redraw-phase3 redraw-polish redraw-phase4`。
  - 遠端分支到 Task 5 重建 repo 時自然消失，這裡不推送刪除。
- [ ] **Step 3：改寫**
  `git filter-repo --invert-paths --path data/PA12B/strips.js --path data/PA12C/strips.js --force`
- [ ] **Step 4：還原本機原圖**
  - 從 Step 1 的備份複製回 `data/<圖>/strips.js`，md5 要和備份相同。
  - `git status` 不列出它們，因為已 ignore。
- [ ] **Step 5：清掉留住舊 commit 的 ref**
  - `git for-each-ref` 只剩 `refs/heads/main`；`git stash list` 為空。
  - 執行 `git reflog expire --expire=now --all && git gc --prune=now --aggressive`。
- [ ] **Step 6：驗證**
  - `git log --all --oneline -- 'data/*/strips.js'` 無結果。
  - `git grep -E 'data:image/[a-z]+;base64,[A-Za-z0-9+/]{100}' $(git rev-list --all)` 無結果。
  - 單元測試全過；兩張圖的 `compare.js` 三項 PASS。
  - 本機的 `strips.js` 仍在，比對工具照常可用。
- [ ] **Step 7：`git remote add origin git@github.com:dwatow/myWolfRepairTools.git`**（filter-repo 會移除 remote）

---

### Task 5：重建 GitHub repo

**⚠ 由使用者以 `dwatow` 操作，Claude 不刪除 repo。**

- [ ] **Step 0：匯出 PR 紀錄**
  - `gh pr list -R dwatow/myWolfRepairTools --state all --json number,title,body,state,baseRefName,headRefName,mergedAt,comments,reviews` 寫到 `../wolfElectronic-backup-2026-11-04-prs.json`。
- [ ] **Step 1：請使用者操作**
  1. 刪除 `dwatow/myWolfRepairTools`（Settings → Danger Zone → Delete）。
  2. 建立同名**私人** repo，不要勾選建立 README、.gitignore、license。
  3. 把 `chris-wang-furuke` 加為協作者，Claude 接受邀請。
- [ ] **Step 2：推送**
  `git push -u origin main`
- [ ] **Step 3：驗證遠端**
  - `gh api repos/dwatow/myWolfRepairTools/git/matching-refs/` 只有 `refs/heads/main`。
  - 在 scratchpad 重新 clone 一份，跑 Task 4 Step 6 的兩項掃描，都要無結果。
- [ ] **Step 4：回報**，請使用者改回公開。
  - 待辦清單 `docs/redraw-backlog.md` 的第 4 階段標為完成（在下一個分支 commit）。
