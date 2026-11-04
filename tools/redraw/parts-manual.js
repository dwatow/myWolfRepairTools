// 元件內圖元的人工判讀（看原圖決定），由 add-parts.js 寫進 drawing.js 的 parts。座標是全解析度
// 依元件分組，key 是 components.js 的 name；PA12C 與 PA12B 版面相同的元件共用，差異另外列在 PA12C
const SHARED = {
};
module.exports = { PA12B: SHARED, PA12C: { ...SHARED } };
