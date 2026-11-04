// 經使用者確認的個別例外：新舊線路網比對（tools/redraw/compare.js）中允許不一致的舊線路網
// pick 是該舊線路網上的一點（整條線路例外），reason 寫原因與確認日期
const CABLE = '粗電纜雙線外框殘段，電纜已以路徑表示，不畫（2026-11-04 使用者確認）';
const outlines = [[2506, 1508], [2653, 1688], [2671, 1691], [2923, 1618]].map(pick => ({ pick, reason: CABLE }));
// segment：只放過某一段（段落中點座標），用在舊辨識把元件筆畫併進導線的情況
const cdiTab = { segment: [2004, 299], reason: 'CDI 4P 卡榫框左邊框被舊辨識併進 G 線路，改由元件圖元畫（2026-11-04 使用者要求導線與零件接合處切齊）' };
module.exports = {
  PA12B: [...outlines, cdiTab],
  PA12C: [...outlines, cdiTab],
};
