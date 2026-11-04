// 標記的人工判讀（看原圖決定），由 add-marks.js 套用在自動萃取結果之上：
//   connectors：多腳接頭與特殊接頭的外框，整份取代自動結果（自動只抓到外框碎片）；框內的自動線色文字一併移除
//   inline、labels：補上自動萃取漏掉或判不準的；removeLabels：自動結果中要移除的文字
// PA12C 與 PA12B 版面相同，共用同一份；差異處另外列在 PA12C
const SHARED = {
  connectors: [
    { label: '3P', box: [592, 1215, 634, 1298] },
    { label: '3P', box: [1482, 496, 1524, 592] },
    { label: '9P', box: [1483, 666, 1524, 947] },
    { label: '4P', box: [1482, 995, 1524, 1125] },
    { label: '3P', box: [1482, 1157, 1524, 1253] },
    { label: '4P', box: [1482, 1292, 1524, 1423] },
    { label: '2P', box: [1769, 256, 1821, 298] },
    { label: '6P', box: [2062, 1351, 2241, 1392] },
    { label: '2P', box: [2467, 1285, 2516, 1327] },
    { label: '2P', box: [2533, 256, 2584, 298] },
    { label: '2P', box: [2688, 146, 2747, 186] }, // 油量計下方：和油量計外框同寬、上緣切齊外框底邊
    { label: '2P', box: [2695, 256, 2746, 298] },
    { label: '', box: [457, 352, 503, 392] },     // 前接頭：兩支 G 腳在框內以圓點跨接
    { label: '', box: [458, 1351, 504, 1391] },   // 喇叭旁併接接頭：兩支 B 腳併成一條
    { label: '', box: [2936, 1130, 2982, 1169] }, // 左後方向燈：L 形雙母端
  ],
  inline: [
    { kind: 'plug', at: [442, 362], dir: 'h' }, { kind: 'plug', at: [442, 381], dir: 'h' },
    { kind: 'plug', at: [443, 1361], dir: 'h' }, { kind: 'plug', at: [443, 1380], dir: 'h' },
    { kind: 'plug', at: [2921, 1140], dir: 'h' }, { kind: 'plug', at: [2997, 1160], dir: 'h', flip: true },
    { kind: 'plug', at: [1472, 627], dir: 'h' }, { kind: 'socket', at: [1510, 627], dir: 'h' }, // GR 線：文字與接頭併成一塊
  ],
  // 自動結果中要移除的線色文字（at 相距 ≤ 3 px 視為同一筆）
  removeLabels: [
    [379, 1372], // 喇叭旁上下兩個 B 相距 5 px 被併成一個，改列在 labels
  ],
  labels: [
    { text: 'B', at: [379, 1361], vertical: false }, { text: 'B', at: [379, 1380], vertical: false },
    { text: 'GR', at: [1432, 627], vertical: false },
    // 原圖寫「G1」，導線線色是 G：使用者決定改寫成 G
    { text: 'G', at: [3064, 731], vertical: false },
    { text: 'G', at: [314, 874], vertical: false },
  ],
};
module.exports = { PA12B: SHARED, PA12C: SHARED };
