// 經使用者確認的個別例外：新舊線路網比對（tools/redraw/compare.js）中允許不一致的舊線路網
// pick 是該舊線路網上的一點（整條線路例外），reason 寫原因與確認日期
const CABLE = '粗電纜雙線外框殘段，電纜已以路徑表示，不畫（2026-11-04 使用者確認）';
const outlines = [[2506, 1508], [2653, 1688], [2671, 1691], [2923, 1618]].map(pick => ({ pick, reason: CABLE }));
// 起動繼電器兩條電纜改停在端子圈下緣後露出的外框殘段（同一類，2026-11-04）
outlines.push(...[[2468, 1536], [2480, 1536], [2519, 1506]].map(pick => ({ pick, reason: CABLE + '；電纜端點改到端子圈下緣後露出' })));
// 保險絲 R 線與電瓶正極電纜合併（tools/redraw/nets-manual.js；使用者 2026-11-04 指出保險絲要接到電瓶）
const fuseBattery = [[2990, 1421], [2931, 1600]].map(pick => ({ pick, reason: '保險絲 R 線與電瓶正極電纜是同一條線路，原圖以斜線相連（使用者 2026-11-04 指出）' }));
// drop：整條舊線路在新圖不畫（改由元件圖元畫），它的舊塗色座標不能落在任何新線路上
const hvGround = [[1391, 1750], [1397, 1749]].map(pick => ({ pick, drop: true, reason: '高壓線圈左側接地符號的引線與直槓，舊辨識當成未標色線路，改由元件圖元畫（2026-11-04 使用者指出接地符號畫錯）' }));
// segment：只放過某一段（段落中點座標），用在舊辨識把元件筆畫併進導線的情況
const cdiTab = { segment: [2004, 299], reason: 'CDI 4P 卡榫框左邊框被舊辨識併進 G 線路，改由元件圖元畫（2026-11-04 使用者要求導線與零件接合處切齊）' };
// PA12C 缺油感應器方框內是空的（原廠 PDF 的 FUEL UNIT），中文底圖沿用 PA12B 油量計的可變電阻與滑臂筆畫，不畫（2026-11-04 使用者指出 PA12C 用缺油感應器）
const fuelUnit = [[2730, 76], [2730, 128], [2714, 98], [2706, 122]].map(segment => ({ segment, reason: 'PA12C 缺油感應器方框內沒有可變電阻，不畫（2026-11-04 使用者指出）' }));
// 頭燈內 G 線：原本從 x 124 往上接到燈絲上方，改成從兩組燈絲中間（x 123、y 868）往下接（2026-11-04 使用者要求導線直接接到燈絲）
const headlightG = { segment: [123, 859], reason: '頭燈內 G 線改成直接接到兩組燈絲中間，原本往上繞的那段不畫（2026-11-04 使用者要求）' };
module.exports = {
  PA12B: [...outlines, cdiTab, ...fuseBattery, ...hvGround, headlightG],
  PA12C: [...outlines, cdiTab, ...fuseBattery, ...fuelUnit, ...hvGround, headlightG],
};
