---
name: editing-diagram-image
description: Use when the scanned base image of a wiring diagram in this viewer must change (data/<diagram>/strips.js; 「改底圖」「圖資中的…改成…」) — retitling a model, swapping a component symbol (e.g. 油錶 → 油量指示燈), adding, moving or deleting wires, or porting differences from another model's PDF (e.g. PA12C.pdf) onto the Chinese diagram while keeping its original Chinese text.
---

# 修改底圖（strips.js）

## 核心原則
- 底圖是 `data/<圖>/strips.js` 裡的 7 條 JPEG 橫條，拼接後逆時針轉 90°，才是畫面上的圖（3323×2188）。
- `anchors.js`、`components.js`、`fixes.js` 都用這個轉正後的座標，所以**只做局部修改、不移動既有內容**，這三個檔才不用重做。
- 修改都在 headless Chrome 的畫布上做（和網頁用同一個解碼器），只重新編碼有變動的橫條。

**不適用的情況**：如果底圖沒問題，只是辨識結果斷線或誤連，改用 `fixing-wire-nets`。
**REQUIRED SUB-SKILL:** `fixing-wire-nets`。本流程的看圖（`crop.js`、`labels.js`）、驗收（`acceptance.js`），以及 `$WORK`／`jpeg-js` 的設定，都沿用它。

## 流程
以下路徑都相對於專案根目錄。`$E` 代表 `.claude/skills/editing-diagram-image/scripts`，`$F` 代表 `.claude/skills/fixing-wire-nets/scripts`。

1. **比對差異**
   - 參考圖若是 PDF，先用 `pdfimages -list` 找出內嵌的線路圖，再用 `pdfimages -j` 取出原檔（不要用 `pdftoppm` 重新算圖）。用 `node $E/crop-ref.js <in.jpg> <out.png> x0 y0 x1 y1 [倍率]` 放大來看。
   - 兩張圖的版面間距常常不同（例如 PA12B 中文版和 PA12C 英文版的儀錶組），不能整塊貼過去，要**依接線關係**比對：哪個元件、哪支腳、接到哪條線、交會處有沒有圓點。
2. **量座標**：`DIAGRAM=<圖> node $E/measure.js <模式> …`，各模式見檔頭說明。
   - `rows`、`cols`：找橫線、直線的位置（線寬約 2 px）。
   - `runs`：把字逐字切開。
   - `map`：字元圖。
   - `rgb`：取色。
3. **寫編輯腳本**：建一個 ops.js，使用 `$E/edit-base.js` 提供的工具（見檔頭）：
   - 擦除：`white`；`eraseH` 擦橫線、保留穿過去的直線；`eraseV` 擦直線、保留穿過去的橫線。
   - 搬移：`copy`、`paste`。
   - 畫線：`fill`。
   - 寫字：`fitFont`、`drawText`、`drawCentered`。
4. **預覽**：`DIAGRAM=<圖> node $E/edit-base.js ops.js --preview x,y,w,h,4 --out <預覽.png>`，用 Read 看。
   - 第 5 個數字是放大倍率；看字形用 4 倍，看接線用 1～2 倍、範圍含周邊的線。
   - `--out` 不給時寫到 `$WORK/preview-<圖>.png`，多個工作同時跑會互相覆蓋。
5. **寫回**：
   - 先把 `js/` 和 `data/<圖>/` 複製到一個備份資料夾（第 7 步要用）。
   - 同一個指令加上 `--apply`。改到的橫條會**整條**重新編碼（JPEG 品質 1），所以範圍外也會有 1 px 等級的變化。
6. **同步資料**：線移動或刪除後，修改 `anchors.js` 對應的線色標註（移到新位置，或刪除）。元件改名時，也要檢查 `components.js`。
7. **驗收**（兩步都要做，只改字也一樣）：
   - `DIAGRAM=<圖> node $F/verify.js <備份資料夾>`：修改前用備份的底圖和資料，修改後用專案目前的。每一筆「新合併」和線路網數的增減，都要對得上這次的修改；對不上的用它印出的「接點」座標 crop 看。原本的接線單元要仍然是 1 段。
   - `DIAGRAM=<圖> node $F/acceptance.js x,y=x,y …`：新的線和該接的線屬於同一個線路網，線色代號正確。這張圖若還沒有接線單元匯出檔，就只檢查你給的檢查點。

## 做法速查
| 要做的事 | 做法 |
| --- | --- |
| 換元件符號（例：油錶 → 指示燈） | 從同一張圖裡 `copy` 同類元件（燈泡＋燈座＋規格字），`paste` 過來，讓腳位對齊既有的線 |
| 加接點圓點 | `copy` 現有的圓點，用 `paste(…, true)` 貼上（只貼深色，不蓋掉線） |
| 刪除 T 接點、改成轉角 | 把圓點範圍清白，再從外側取線色，補回兩段線 |
| 改英數字 | 先用 `fitFont` 比對字型（試 `italic bold {size} "Arial Narrow"` 等，可加水平縮放 `sxs`），擦掉原字，在同一個字型原點寫新字 |
| 改中文標籤 | 圖上有大小、粗細都相同的現成字就拼（例：「指示燈」取自同一排的「遠光指示燈」）；大小或粗細不同就不要拼，改寫新字 |
| 寫新的中文字 | `fitFont` 對細筆畫中文不可靠（比對分數只有 0.35～0.71），只拿來縮小字型、字級範圍；實際用 4 倍預覽並排比較幾個候選再決定（這張圖常用 `200 {size} "Hiragino Sans GB"`，約 15 px）。先量舊字範圍、擦掉，再用 `drawCentered(字, f, 舊字範圍)` 寫 |

## 常見錯誤
- **整塊清白，連帶擦斷穿過的線**：曾用 `white` 擦一條直線，結果兩條橫穿過去的線也被擦斷。擦線一律用 `eraseH`／`eraseV`，並預覽確認。
- **取色取到反鋸齒邊緣**：在標籤旁取色會取到淡色，畫出來的線像虛線。要在線段中段取色（`measure.js rgb`），例如 G 線是 `[36, 126, 78]`。
- **JPEG 品質不夠**：
  - 品質 0.92 會多出 1 段線路網。
  - 品質 0.97 時，`links` 修好的線段會位移。
  - 所以只用品質 1，並用 `fixing-wire-nets` 比對修改前後，確認只差 1 px 的端點。
- **寫回後沒跑 `verify.js`**：兩次對照測試（只改一個字）都在寫回後就收工。整條橫條重新編碼，可能讓別處的線斷開或併在一起，只看預覽發現不了。
- **用 `drawText` 換字卻沒置中**：`fitFont` 以左下角對齊比對、`drawText` 以左上角定位，新字和舊字寬高不同時會偏移。換字用 `drawCentered`。
- **忘了同步 `anchors.js`**：線移開後，舊的線色標註落在空白處，新位置的線就變成未標色。
- **畫面座標和橫條座標搞混**：畫面上的 (X, Y) 對應到拼接圖的 (x = W0−1−Y, y = X)。`edit-base.js` 已經處理這層換算，ops.js 裡一律用畫面座標。
