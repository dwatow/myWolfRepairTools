// 底圖繪製的目視檢查用資料（tools/redraw/sheet.js --sample 使用）：標記四種，元件圖元每種 kind 各一
const kinds = ['lamp', 'lamp2', 'horn', 'gauge', 'resistor', 'coil', 'transformer', 'alternator', 'motor', 'battery', 'fuse', 'diode', 'ground', 'lug', 'plug'];
module.exports = {
  size: [800, 560],
  nets: [
    { code: 'G/R', wires: [[[10, 40], [60, 40]], [[200, 40], [260, 40]]] },
    { code: 'Y/R', wires: [[[300, 10], [300, 60]], [[300, 150], [300, 250]]] },
    { code: 'B', wires: [[[10, 200], [120, 200]], [[180, 200], [260, 200]], [[10, 160], [120, 160]], [[180, 160], [260, 160]]] },
  ],
  labels: [{ text: 'G/R', at: [85, 40], vertical: false }, { text: 'Y/R', at: [300, 100], vertical: true }],
  inline: [{ kind: 'plug', at: [130, 40], dir: 'h' }, { kind: 'socket', at: [170, 40], dir: 'h' }, { kind: 'plug', at: [350, 220], dir: 'v', flip: true }],
  connectors: [{ label: '2P', box: [125, 140, 175, 220] }],
  texts: [{ text: '圖名測試', at: [200, 110], size: 28 }],
  parts: [
    ...kinds.map((kind, i) => ({ type: 'symbol', kind, box: [20 + (i % 5) * 150, 280 + Math.floor(i / 5) * 90, 20 + (i % 5) * 150 + (kind === 'lamp2' || kind === 'coil' || kind === 'transformer' || kind === 'fuse' ? 120 : 70), 280 + Math.floor(i / 5) * 90 + 60], dir: 'r' })),
    ...kinds.map((kind, i) => ({ type: 'text', text: kind, at: [55 + (i % 5) * 150, 350 + Math.floor(i / 5) * 90], size: 12 })),
    { type: 'pin', name: 'BAT2', at: [480, 120], vertical: true }, { type: 'pin', name: 'E', at: [520, 120] },
    { type: 'text', text: '(12V 10W)', at: [620, 60], size: 18 },
    { type: 'connector', label: '4P', box: [600, 100, 660, 120] },
    { type: 'frame', box: [450, 20, 700, 150] },
  ],
};
