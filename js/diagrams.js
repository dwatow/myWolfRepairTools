// 線路圖清單：每張圖的資料各放在 data/<id>/（drawing、legacy、components、anchors、fixes、switches），彼此獨立；legacy、switches 可省略
// strips.js（原廠掃描圖）只在開發用的原圖對照（?dev=1）才載入
// 用網址參數 ?d=<id> 切換，沒有指定時開上次看的那張
const DIAGRAMS = [
  {
    id: "PA12B",
    title: "野狼傳奇 125 線路圖",
    source: "WOLF125.pdf 野狼傳奇 125 線路圖",
  },
  {
    id: "PA12C",
    title: "野狼傳奇R 125 線路圖",
    source: "WOLF125.pdf 野狼傳奇R 125 線路圖",
  },
];
const DIAGRAM = (() => {
  const want = new URLSearchParams(location.search).get("d");
  let last = null;
  try {
    last = localStorage.getItem("wolf125-diagram");
  } catch {}
  return (
    DIAGRAMS.find((d) => d.id === want) ||
    DIAGRAMS.find((d) => d.id === last) ||
    DIAGRAMS[0]
  );
})();
try {
  localStorage.setItem("wolf125-diagram", DIAGRAM.id);
} catch {}
const DATA_FILES = ["drawing", "legacy", "components", "anchors", "fixes", "switches"].map(
  (f) => `data/${DIAGRAM.id}/${f}.js`,
);
