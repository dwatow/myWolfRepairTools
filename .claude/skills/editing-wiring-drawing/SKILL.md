---
name: editing-wiring-drawing
description: Use when changing what the redrawn wiring diagram (PA12B, PA12C) shows — a wire gap, protrusion or missing piece (「沒接上」「凸出去」「少一截」「斷掉」), a component symbol, pin, label or wire-color text drawn wrong or misplaced, a connector, or what lights up when a component is clicked — or before editing data/<diagram>/drawing.js, components.js or any tools/redraw/*-manual.js.
---

# 修改重繪的線路圖

## 核心原則
`data/<圖>/drawing.js` 由工具產生。**導線與元件不要直接手改 `drawing.js`**：改對應的 `*-manual.js`，再用工具寫回去，否則下次重跑工具時，手改的內容會被覆蓋或切掉。每次都是先看、再改、最後跑檢查。

## 流程
1. **先看，確認問題真的存在**：`node tools/redraw/sheet.js <圖> <scratch>/s x,y,w,h,倍率`，再用 Read 看圖。
   - 圖的左邊是原圖，右邊是新圖。座標是全解析度（3323×2188）。
   - 原圖 `data/<圖>/strips.js` 只在本機；沒有原圖時改用原廠 PDF，用 `pdftoppm` 裁切。
   - 回報的問題可能已經修好了。沒看到問題就先問使用者，不要先改。
2. **改**：依下表選檔案，兩張圖都要考慮。`SHARED` 是 PA12B、PA12C 共用的部分。
3. **套用**：兩張圖各跑一次。
4. **檢查**：見「必跑檢查」，並且用同一個 `sheet.js` 區域再看一次。

| 要改的東西 | 改哪裡 | 套用 |
| --- | --- | --- |
| 導線：補、刪、併、改端點 | `tools/redraw/nets-manual.js` 的 `add`、`remove`、`merge` | `DIAGRAM=<圖> node tools/redraw/recut.js` |
| 元件符號、接腳、元件內文字 | `tools/redraw/parts-manual.js` | `DIAGRAM=<圖> node tools/redraw/add-parts.js` |
| 線色文字、單線接頭、多腳接頭 | `tools/redraw/marks-manual.js`，並同步手改 `drawing.js` 的 `labels`、`inline`、`connectors` | 改完跑 `recut.js` |
| 元件被點擊時的亮起範圍、連到的線路 | `data/<圖>/components.js` 的 `box`（以圖寬 1800 為基準）、`picks` | 用 `comp-highlight.js` 確認 |
| 刻意和舊辨識不同的地方 | `tools/redraw/exceptions.js`：`segment`、`pick`，整條不畫的加 `drop: true` | 先問使用者，附上原因與日期 |

## 導線的陷阱
- **`recut.js` 只會切，不會補**：文字或接頭移位後，已切掉的那段導線不會自己長回來。要用 `nets-manual.js` 的 `add` 補回。
- **`add` 要寫切完缺口後的座標**：接頭的範圍會把端點再切掉 1 px。重跑 `recut.js` 後，若又印出「補導線」，表示座標沒對上；要改成切完後的值，重跑才不會重補。
- **導線接到零件時要切齊**：自由端寫在零件邊框的座標上，例如三角形底邊 x 是 428，導線就停在 427。
- 不要跑 `add-marks.js --force`：它會讓文字位置偏移 1～4 px。
- **移動自動萃取的線色文字**：
  - `marks-manual.js` 要同時改兩處：`removeLabels` 加舊座標，`labels` 加新的一筆。只加 `labels` 的話，日後重產標記時會多出一筆。
  - `drawing.js` 的 `labels` 直接改座標。
  - 缺口變寬的那一側，用 `nets-manual.js` 的 `add` 把導線補回來。

## 必跑檢查
```
node --test 'tools/test/*.test.js'          # 要用 glob，Node 24 不接受資料夾
DIAGRAM=PA12B node tools/redraw/compare.js   # PA12C 也跑；三項都要 PASS
node tools/redraw/check-paint.js
node tools/redraw/check-import.js
```
- 用 Chrome 的腳本（`sheet.js`、`compare.js`、`check-*`、`comp-highlight.js`）共用暫存頁面，**一次只跑一支**。
- 改了元件的 `box` 或接頭，用 `node tools/redraw/comp-highlight.js <圖> <scratch>/h <元件名>` 看亮起的範圍。
- `compare.js` 回報 FAIL 時，先確認是不是刻意的改動。不要為了讓檢查通過，就直接加例外。
