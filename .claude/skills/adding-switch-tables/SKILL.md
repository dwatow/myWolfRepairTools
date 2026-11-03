---
name: adding-switch-tables
description: Use when adding or correcting the switch continuity tables (方向燈開關、喇叭開關、主開關… the 開關導通表 panel) for a diagram in this wiring-diagram viewer, i.e. creating or editing data/<diagram>/switches.js — for example PA12C, which has none yet.
---

# 加入開關導通表

## 核心原則
開關表是**資料**，畫面由 `js/app.js` 的 `renderSwitches()` 統一產生。新增一張圖只要寫 `data/<圖>/switches.js`，不要改 `app.js`、`index.html`、`style.css`。

## 流程
1. **找表格位置**：開關表通常在原圖左下角，線色對照表在右下角。用 `.claude/skills/fixing-wire-nets/scripts/crop.js`（在專案根目錄執行） 放大來看（環境變數 `DIAGRAM=<圖>`，第一次使用前照 fixing-wire-nets 的說明在 `$WORK` 安裝 `jpeg-js`）。例：`DIAGRAM=PA12C node .claude/skills/fixing-wire-nets/scripts/crop.js /tmp/t.png 900 2070 450 1`，看完再縮小半徑放大細看。PA12B 的開關表約在 x 400–2180、y 1950–2190（全解析度，圖寬 3323）。
2. **逐張讀表**：表頭是接腳，每列是一個檔位；同一列兩個黑點之間連線，代表這兩支接腳導通。
3. **寫資料**：`data/<圖>/switches.js`，格式如下。
4. **對應接腳到線路**（`pins`，讓點檔位時圖上亮起導通的線）：開關元件在線路圖上的每支接腳都有標籤（如 `HO E LO HI TL R L W`），從接腳往外拉出的導線上取一點的座標。
   - 找座標：用 fixing-wire-nets 的 `lib.js`（`loadImage`／`analyze`）列出端點落在接腳附近的垂直線段，印出 `x0, y0, y1, netCode`；再 crop 接腳標籤，確認接腳和線的對應順序。
   - 取點：選在線段中段、離接腳圓圈幾 px 的地方（例：PA12B 底部接腳用 y=1745）。程式會在 ±4 px 內找最近的線路像素。
   - 同一支接腳可以出現在兩張表（例：燈光開關與起動開關共用 BAT2），座標相同。
5. **驗收**：用 headless Chrome 開 `index.html?d=<圖>`。
   - `--dump-dom`：確認 `id="switches"` 沒有 `hidden`，下拉選單有每個開關的 `<option>`。
   - `--window-size=1400,2600 --screenshot`：截圖看側欄，逐張和原圖比對圓點的位置。
   - 連動：在專案根目錄暫時複製一份 `index.html`，在 `</body>` 前插入測試 script，等 `#loading` 變成 hidden，逐一切換 `#switch-select` 並點每個檔位列（`tr.click()`），把 `#sel-what`、`#switch-msg` 的內容寫進一個 `<pre>`，再用 `--dump-dom` 讀出來。測試頁必須和 `index.html` 放在同一個目錄（`file://` 的相對路徑才會對），**測完要刪掉**。檢查每個檔位亮起的線色和表頭接腳下方的線色代號是否相符。

```js
// 開關導通表：依原圖的開關表判讀。terminals 是表頭的接腳，positions 每個檔位列出導通的接腳組
window.WOLF_SWITCHES = [
  { name: '主開關', terminals: ['BAT1', 'BAT2', 'IG', 'E'],
    pins: { BAT1: [1212, 1745], BAT2: [1257, 1745], IG: [1168, 1745], E: [1297, 1745] }, // 接腳接出的導線上一點
    positions: [
    { label: 'OFF', conn: [['IG', 'E']] },
    { label: 'ON', conn: [['BAT1', 'BAT2']] },
  ] },
];
```

## 判讀規則
| 原圖 | 寫法 |
| --- | --- |
| 同列兩點相連 | `conn: [['A', 'B']]`：寫頭尾兩支接腳，中間被線跨過的接腳**不算**導通 |
| 同列有兩組各自相連 | `conn` 放兩組 |
| 整列沒有點 | `conn: []`，檔位照樣列出（例：N、FREE、OFF） |
| 檔位是圖示 | 轉成文字，可保留符號：➡ 右、⬅ 左、OFF ●、ON ✹、按下（喇叭）、按下（起動） |
| 遠近燈圖示 | 光束斜線＝近燈；水平線＝遠燈 |
| 接腳名稱 | 照表頭原文的大小寫（`Hi`、`LO`、`TL`），`terminals` 要和 `conn` 的名稱完全一致 |

## 常見錯誤
- **少一張開關表**：檔位全都不導通的開關（例如只有 OFF/ON 兩列，但 OFF 沒點）也要寫進去，不能因為「沒資料」就跳過。
- **把中間的接腳算成導通**：主開關 ON 的 BAT1–BAT2 不經過 IG，但如果有一條線從 BAT1 拉到 IG，中間跨過的 BAT2 也不算導通。只有頭尾兩點畫了圓點的接腳才算。
- **改 `app.js` 來適應某張圖**：表格的欄數、列數都由資料決定；遇到畫不出來的情況，先確認資料格式是否正確。
- **`pins` 對錯接腳**：接腳標籤是直書，順序容易看錯。一定要對照接出的線色（例：PA12B 主開關 IG＝B/W、BAT1＝R、BAT2＝B、E＝G），且表頭接腳下方顯示的線色要合理。
- **`pins` 點在元件框線上**：框線不屬於任何線路網，或屬於別的網。點要取在接腳外、導線本身上。
- **沒有開關表的圖**：不用建空檔。`switches.js` 可以省略，載入失敗會被忽略，側欄這一區會自動隱藏。
