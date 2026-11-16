/* status bar: view stats, worm / eye / ghost state, and a sparkline of the last 56 days of contributions */
import { narrow, rgbOf, cssVar, make, fmt } from "../shared/common.js";

export function createBar(host) {
  const cols = host.querySelector(".bar-cols");
  const values = Object.fromEntries([...host.querySelectorAll("[data-k]")].map((n) => [n.dataset.k, n]));
  const hunt = host.querySelector(".hunt");
  const keys = host.querySelector(".keys");
  const graph = host.querySelector(".bar-graph");
  const den = host.querySelector(".den");
  const canvas = graph.querySelector("canvas");
  const span = graph.querySelector(".span");
  const end = graph.querySelector(".end");
  const g = canvas.getContext("2d");
  let typing = false;
  let repairing = false;
  let colors = null;

  const setView = (list) =>
    cols.replaceChildren(
      ...list.map(([name, value]) => {
        const col = make("p", "col");
        col.append(make("span", "label", name), make("span", "value", value));
        return col;
      }),
    );

  function paintGhost() {
    values.ghost.textContent = typing ? "typing" : repairing ? "repairing" : "idle";
    values.ghost.classList.toggle("is-hot", typing || repairing);
  }

  function draw() {
    if (!colors) return;
    const n = narrow.matches ? 28 : 56;
    const days = DAYS.slice(-n).map((d) => d[1]);
    const w = n * 3 - 1;
    const h = 15;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const top = Math.max(1, ...days);
    days.forEach((count, k) => {
      const bar = 1 + (h - 1) * Math.min(1, count / top);
      g.fillStyle = k === days.length - 1 ? `rgba(${colors.accent},0.95)` : `rgba(${colors.dim},0.75)`;
      g.fillRect(k * 3, h - bar, 2, bar);
    });
    span.textContent = narrow.matches ? "CONTRIBS" : `CONTRIBS · ${n} D`;
    end.textContent = fmt(days.reduce((s, v) => s + v, 0));
    graph.dataset.tip = `public contributions per day\n${DAYS.at(-n)[0]} → ${DAYS.at(-1)[0]}`;
  }

  const recolor = () => {
    colors = { dim: rgbOf(cssVar("--dim")), accent: rgbOf(cssVar("--accent")) };
    draw();
  };

  narrow.addEventListener("change", draw);
  if (den) new ResizeObserver(() => (den.style.right = `${graph.offsetWidth + 2}px`)).observe(graph);
  recolor();
  paintGhost();
  return {
    setView,
    setState({ worm, eye, ghost }) {
      values.worm.textContent = worm.text;
      values.worm.classList.toggle("is-hot", worm.hot);
      values.eye.textContent = eye.text;
      values.eye.classList.toggle("is-hot", eye.hot);
      hunt.textContent = worm.label || "";
      repairing = ghost === "repairing";
      paintGhost();
    },
    setTyping(on) {
      typing = on;
      paintGhost();
    },
    setKeys: (text) => (keys.textContent = text),
    recolor,
  };
}
