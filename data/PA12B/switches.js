// 開關導通表：依原圖左下角的開關表判讀。terminals 是表頭的接腳，positions 每個檔位列出導通的接腳組（頭尾，中間的接腳不算導通）
// pins：每支接腳在線路圖上接出的導線上一點（全解析度座標），用來找出接腳連到哪條線路
window.WOLF_SWITCHES = [
  { name: '方向燈開關', terminals: ['R', 'W', 'L'], pins: { R: [1000, 1745], W: [1087, 1745], L: [1047, 1745] }, positions: [
    { label: '➡ 右', conn: [['R', 'W']] },
    { label: 'N', conn: [] },
    { label: '⬅ 左', conn: [['W', 'L']] },
  ] },
  { name: '喇叭開關', terminals: ['HO', 'E'], pins: { HO: [787, 1745], E: [831, 1745] }, positions: [
    { label: 'FREE', conn: [] },
    { label: '按下（喇叭）', conn: [['HO', 'E']] },
  ] },
  { name: '遠近燈開關', terminals: ['Hi', 'LO', 'TL'], pins: { Hi: [913, 1745], LO: [876, 1745], TL: [958, 1745] }, positions: [
    { label: '近燈', conn: [['LO', 'TL']] },
    { label: '遠燈', conn: [['Hi', 'TL']] },
  ] },
  { name: '燈光開關', terminals: ['BAT2', 'TL'], pins: { BAT2: [799, 160], TL: [838, 160] }, positions: [
    { label: 'OFF ●', conn: [] },
    { label: 'ON ✹', conn: [['BAT2', 'TL']] },
  ] },
  { name: '起動開關', terminals: ['ST', 'BAT2'], pins: { ST: [884, 160], BAT2: [799, 160] }, positions: [
    { label: 'FREE', conn: [] },
    { label: '按下（起動）', conn: [['ST', 'BAT2']] },
  ] },
  { name: '主開關', terminals: ['BAT1', 'BAT2', 'IG', 'E'], pins: { BAT1: [1212, 1745], BAT2: [1257, 1745], IG: [1168, 1745], E: [1297, 1745] }, positions: [
    { label: 'OFF', conn: [['IG', 'E']] },
    { label: 'ON', conn: [['BAT1', 'BAT2']] },
  ] },
];
