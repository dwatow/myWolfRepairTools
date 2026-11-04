# CLAUDE.md

## 修改後必跑的檢查
任何修改（`js/`、`data/`、`tools/`）都要跑：
```
node --test 'tools/test/*.test.js'          # 要用 glob，Node 24 不接受資料夾
DIAGRAM=PA12B node tools/redraw/compare.js   # PA12C 也跑
node tools/redraw/check-paint.js
node tools/redraw/check-import.js
```
- 用 Chrome 的腳本（`tools/redraw/` 裡呼叫 `chrome.js` 的）共用暫存頁面，一次只能跑一支，不能平行。

## 線路圖
- 修改線路圖畫面或資料時，用 `editing-wiring-drawing` skill。
- 原廠資料有版權，不得進 git：PDF，以及原廠掃描圖 `data/*/strips.js`。兩者都只留在本機，給比對工具用。
