// 標記繪製的目視檢查用資料：四種標記各一，含直書文字與反向的 plug（tools/redraw/sheet.js --sample 使用）
module.exports = {
  size: [400, 260],
  nets: [
    { code: 'G/R', wires: [[[10, 40], [60, 40]], [[200, 40], [260, 40]]] },
    { code: 'Y/R', wires: [[[300, 10], [300, 60]], [[300, 150], [300, 250]]] },
    { code: 'B', wires: [[[10, 200], [120, 200]], [[180, 200], [260, 200]], [[10, 160], [120, 160]], [[180, 160], [260, 160]]] },
  ],
  labels: [{ text: 'G/R', at: [85, 40], vertical: false }, { text: 'Y/R', at: [300, 100], vertical: true }],
  inline: [{ kind: 'plug', at: [130, 40], dir: 'h' }, { kind: 'socket', at: [170, 40], dir: 'h' }, { kind: 'plug', at: [350, 220], dir: 'v', flip: true }],
  connectors: [{ label: '2P', box: [125, 140, 175, 220] }],
  texts: [{ text: '圖名測試', at: [200, 110], size: 28 }],
};
