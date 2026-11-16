/* blueprint: the about plate. The NS mark rises out of ruled lines; a tree grows into it by space colonisation,
   one attractor per public contribution. A section line follows the pointer; the right panel reads it all back. */
import { reduced, clamp, smooth, rng, rgbOf, fmt, BRAND_PATHS, BRAND_BOX, TAU } from "../shared/common.js";

const SIZE = BRAND_BOX;
const ROOT = [26, 90];
const BOUND = { x0: -16, y0: -16, x1: 104, y1: 100 };
const GROW = { step: 1.1, kill: 1.9, reach: 14, rate: 30, jitter: 0.16, cap: 9000, stall: 4, near: 2 };
const FIELD = { cell: 1, sigma: 1.6, rest: 0.45 };
const ECHO = { ms: 1400, rise: 380, fresh: 450, start: 0.85 };
const RULE = { gap: 4, dx: 3 };
const LOAD = [4, 16, 64, 256];
const WIDTH = [0.5, 0.75, 1.05, 1.45, 1.95];
const ALPHA = [0.5, 0.62, 0.74, 0.86, 0.95];
const MM = 25.4 / 96;

function sampleMark(count, random) {
  const g = document.createElement("canvas").getContext("2d");
  const shapes = BRAND_PATHS.map((d) => new Path2D(d));
  const ax = new Float32Array(count);
  const ay = new Float32Array(count);
  let n = 0;
  for (let guard = 0; n < count && guard < count * 400; guard++) {
    const x = random() * SIZE[0];
    const y = random() * SIZE[1];
    if (shapes.some((p) => g.isPointInPath(p, x, y))) {
      ax[n] = x;
      ay[n] = y;
      n++;
    }
  }
  return { ax: ax.subarray(0, n), ay: ay.subarray(0, n) };
}

export function createBlueprint(host, { points = 0, from = "", owner = "", plate = [] } = {}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const g = canvas.getContext("2d");
  const random = rng(points || 1);
  const { ax, ay } = sampleMark(points, random);
  const N = ax.length;
  const alive = new Uint8Array(N).fill(1);
  const near = new Int32Array(N).fill(-1);
  const nearD2 = new Float32Array(N).fill(Infinity);
  let aliveCount = N;
  const nx = new Float32Array(GROW.cap);
  const ny = new Float32Array(GROW.cap);
  const np = new Int32Array(GROW.cap);
  const nb = new Float64Array(GROW.cap);
  const nd = new Int32Array(GROW.cap);
  const seg = new Float32Array(GROW.cap);
  const load = new Int32Array(GROW.cap);
  const kids = new Int32Array(GROW.cap);
  const px = new Float32Array(GROW.cap);
  const py = new Float32Array(GROW.cap);
  let count = 0;
  let doneAt = 0;
  let stall = 0;
  const tree = { tips: 0, junctions: 0, length: 0, apex: 0 };

  /* grids for attractors and nodes */
  const acols = Math.ceil((BOUND.x1 - BOUND.x0) / GROW.reach) + 1;
  const arows = Math.ceil((BOUND.y1 - BOUND.y0) / GROW.reach) + 1;
  const agrid = Array.from({ length: acols * arows }, () => []);
  const acell = (u, v) => clamp(Math.floor((u - BOUND.x0) / GROW.reach), 0, acols - 1) + clamp(Math.floor((v - BOUND.y0) / GROW.reach), 0, arows - 1) * acols;
  for (let a = 0; a < N; a++) agrid[acell(ax[a], ay[a])].push(a);
  const ncols = Math.ceil((BOUND.x1 - BOUND.x0) / GROW.near) + 1;
  const nrows = Math.ceil((BOUND.y1 - BOUND.y0) / GROW.near) + 1;
  const ngrid = new Map();

  /* a smooth height field of the mark (all points) and of what the tree hasn't reached yet (live) */
  const fcols = Math.ceil((BOUND.x1 - BOUND.x0) / FIELD.cell) + 1;
  const frows = Math.ceil((BOUND.y1 - BOUND.y0) / FIELD.cell) + 1;
  const fAll = new Float32Array(fcols * frows);
  const fLive = new Float32Array(fcols * frows);
  const R = Math.ceil((FIELD.sigma * 2.5) / FIELD.cell);
  const kernel = [];
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const w = Math.exp(-((i * i + j * j) * FIELD.cell ** 2) / (2 * FIELD.sigma ** 2));
    if (w > 0.01) kernel.push(i, j, w);
  }
  const splat = (a, target, sign) => {
    const ci = Math.round((ax[a] - BOUND.x0) / FIELD.cell);
    const cj = Math.round((ay[a] - BOUND.y0) / FIELD.cell);
    for (let k = 0; k < kernel.length; k += 3) {
      const i = ci + kernel[k];
      const j = cj + kernel[k + 1];
      if (i >= 0 && j >= 0 && i < fcols && j < frows) target[j * fcols + i] += sign * kernel[k + 2];
    }
  };
  for (let a = 0; a < N; a++) {
    splat(a, fAll, 1);
    splat(a, fLive, 1);
  }
  const sampled = Array.from(ax, (u, a) => fAll[Math.round((ay[a] - BOUND.y0) / FIELD.cell) * fcols + Math.round((u - BOUND.x0) / FIELD.cell)]).sort((p, q) => p - q);
  const norm = (sampled[Math.floor(sampled.length * 0.5)] || 1) * 0.9;
  function height(u, v) {
    const fx = (u - BOUND.x0) / FIELD.cell;
    const fy = (v - BOUND.y0) / FIELD.cell;
    if (fx < 0 || fy < 0 || fx >= fcols - 1 || fy >= frows - 1) return 0;
    const i = fx | 0;
    const j = fy | 0;
    const tx = fx - i;
    const ty = fy - j;
    const k = j * fcols + i;
    const r = FIELD.rest;
    const q = 1 - r;
    const at = (o) => r * fAll[k + o] + q * Math.max(0, fLive[k + o]);
    return smooth(((at(0) * (1 - tx) + at(1) * tx) * (1 - ty) + (at(fcols) * (1 - tx) + at(fcols + 1) * tx) * ty) / norm);
  }

  let elapsed = 0;
  let acc = 0;
  let done = N === 0;
  let settled = false;
  const clock = () => Math.max(0, elapsed - ECHO.ms * ECHO.start);

  function addNode(x, y, parent) {
    const k = count++;
    nx[k] = x;
    ny[k] = y;
    np[k] = parent;
    nb[k] = clock();
    nd[k] = parent < 0 ? 0 : nd[parent] + 1;
    seg[k] = parent < 0 ? 0 : Math.hypot(x - nx[parent], y - ny[parent]);
    const cell = clamp(Math.floor((y - BOUND.y0) / GROW.near), 0, nrows - 1) * ncols + clamp(Math.floor((x - BOUND.x0) / GROW.near), 0, ncols - 1);
    if (!ngrid.has(cell)) ngrid.set(cell, []);
    ngrid.get(cell).push(k);
    const ci = Math.floor((x - BOUND.x0) / GROW.reach);
    const cj = Math.floor((y - BOUND.y0) / GROW.reach);
    for (let j = Math.max(0, cj - 1); j <= Math.min(arows - 1, cj + 1); j++) for (let i = Math.max(0, ci - 1); i <= Math.min(acols - 1, ci + 1); i++) {
      for (const a of agrid[j * acols + i]) {
        if (!alive[a]) continue;
        const d2 = (ax[a] - x) ** 2 + (ay[a] - y) ** 2;
        if (d2 < GROW.kill ** 2) {
          alive[a] = 0;
          aliveCount--;
          splat(a, fLive, -1);
        } else if (d2 < GROW.reach ** 2 && d2 < nearD2[a]) {
          nearD2[a] = d2;
          near[a] = k;
        }
      }
    }
  }
  function occupied(x, y, r) {
    const ci = Math.floor((x - BOUND.x0) / GROW.near);
    const cj = Math.floor((y - BOUND.y0) / GROW.near);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const list = ngrid.get(j * ncols + i);
      if (list) for (const k of list) if ((nx[k] - x) ** 2 + (ny[k] - y) ** 2 < r * r) return true;
    }
    return false;
  }
  function grow() {
    const pull = new Map();
    for (let a = 0; a < N; a++) {
      if (!alive[a] || near[a] < 0) continue;
      const k = near[a];
      const d = Math.sqrt(nearD2[a]) || 1;
      let v = pull.get(k);
      if (!v) pull.set(k, (v = [0, 0]));
      v[0] += (ax[a] - nx[k]) / d;
      v[1] += (ay[a] - ny[k]) / d;
    }
    let added = 0;
    if (!pull.size && count) {
      /* trunk: climb until the canopy is in reach */
      const k = count - 1;
      if (!occupied(nx[k], ny[k] - GROW.step, GROW.step * 0.45) && ny[k] > 0) {
        addNode(nx[k] + (random() - 0.5) * GROW.jitter, ny[k] - GROW.step, k);
        added++;
      }
    }
    for (const [k, v] of pull) {
      if (count >= GROW.cap) break;
      const len = Math.hypot(v[0], v[1]);
      if (len < 1e-4) continue;
      const x = nx[k] + (v[0] / len) * GROW.step + (random() - 0.5) * GROW.jitter;
      const y = ny[k] + (v[1] / len) * GROW.step + (random() - 0.5) * GROW.jitter;
      if (occupied(x, y, GROW.step * 0.45)) continue;
      addNode(x, y, k);
      added++;
    }
    stall = added ? 0 : stall + 1;
    if (!aliveCount || stall > GROW.stall || count >= GROW.cap) {
      done = true;
      doneAt = clock();
    }
  }
  if (N) addNode(ROOT[0], ROOT[1], -1);

  function measure() {
    kids.fill(0, 0, count);
    load.fill(0, 0, count);
    let length = 0;
    let apex = 0;
    for (let k = 1; k < count; k++) {
      kids[np[k]]++;
      length += seg[k];
      if (nd[k] > nd[apex]) apex = k;
    }
    for (let k = count - 1; k > 0; k--) load[np[k]] += load[k] + 1;
    let tips = 0;
    let junctions = 0;
    for (let k = 0; k < count; k++) {
      if (!kids[k]) tips++;
      else if (kids[k] > 1) junctions++;
    }
    Object.assign(tree, { tips, junctions, length, apex });
  }

  /* ---------- layout & drawing ---------- */
  let W = 0;
  let H = 0;
  let dpr = 1;
  let S = 1;
  let ox = 0;
  let oy = 0;
  let lift = 8;
  let narrow = false;
  let d = { x0: 0, y0: 0, x1: 0, y1: 0, top: 0 };
  let panel = null;
  let chart = null;
  let twin = 0;
  let block = 0;
  let colors = null;
  let raf = 0;
  let last = 0;
  let live = true;
  let secY = 0;
  let secTarget = 0;
  let pointerIn = false;

  function recolor() {
    const s = getComputedStyle(host);
    colors = { ink: rgbOf(s.getPropertyValue("--ink").trim()), dim: rgbOf(s.getPropertyValue("--dim").trim()), accent: rgbOf(s.getPropertyValue("--accent").trim()), paper: s.getPropertyValue("--bg").trim() || "#0c0c0c" };
  }
  const rest = () => oy + 36 * S;
  function layout() {
    const r = host.getBoundingClientRect();
    W = r.width;
    H = r.height;
    if (!W || !H) return false;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    narrow = W < 440;
    if (narrow) {
      panel = null;
      d = { x0: 14, x1: W - 14, y0: 30, y1: H - 26, top: 30 };
      lift = clamp(Math.round((d.y1 - d.y0) * 0.05), 6, 12);
      S = Math.min((d.x1 - d.x0 - 60) / SIZE[0], (d.y1 - d.y0 - lift - 6) / (ROOT[1] + 2));
    } else {
      const pw = clamp(W * 0.36, 170, 252);
      panel = { x0: W - 10 - pw, x1: W - 10 };
      d = { x0: 20, x1: panel.x0 - 16, y0: 36, y1: H - 18, top: 32 };
      lift = clamp(Math.round((d.y1 - d.y0) * 0.05), 6, 16);
      S = Math.min((d.x1 - d.x0 - 40) / SIZE[0], (d.y1 - 4 - (d.y0 + 16) - lift) / ROOT[1]);
      chart = { y0: d.top, h: clamp(Math.round(H * 0.16), 36, 66) };
      twin = chart.y0 + chart.h + 44;
      block = H - 18 - 46;
    }
    ox = d.x0 + (d.x1 - d.x0 - SIZE[0] * S) / 2;
    oy = d.y1 - 4 - ROOT[1] * S;
    secY = secTarget = rest();
    return true;
  }

  const text = (s, x, y, size, color, align = "left") => {
    g.font = `${size}px "Plex Mono", ui-monospace, monospace`;
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(s, x, y);
    g.textAlign = "left";
  };
  function arrow(x, y, dx, dy, color) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - dx * 5 - dy * 1.7, y - dy * 5 + dx * 1.7);
    g.lineTo(x - dx * 5 + dy * 1.7, y - dy * 5 - dx * 1.7);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  function drawFrame() {
    const { dim, ink } = colors;
    g.lineWidth = 1;
    g.strokeStyle = `rgba(${dim},0.5)`;
    g.strokeRect(0.5, 0.5, W - 1, H - 1);
    text("NS", d.x0, 18, 11, `rgba(${ink},0.95)`);
    g.font = '10px "Plex Mono", ui-monospace, monospace';
    const title = `${fmt(N)} points · 1 per contribution`;
    const dated = from ? `${title} · ${from.slice(0, 4)}` : title;
    text(d.x0 + 22 + g.measureText(dated).width <= d.x1 ? dated : title, d.x0 + 22, 18, 10, `rgba(${ink},0.8)`);
    if (narrow) return;
    g.fillStyle = `rgba(${dim},0.55)`;
    for (let k = 0; k <= 8; k++) {
      const x = Math.round((k * (W - 1)) / 8) + 0.5;
      g.fillRect(x - 0.5, 0, 1, 4);
      g.fillRect(x - 0.5, H - 4, 1, 4);
      if (k < 8) text(String(k + 1), x + (W - 1) / 16, H - 5, 8, `rgba(${dim},0.7)`, "center");
    }
  }

  function drawRules() {
    const { ink, paper } = colors;
    const rows = Math.floor((d.y1 - d.top) / RULE.gap) + 1;
    const xs = [];
    for (let x = d.x0; x <= d.x1 + 0.01; x += RULE.dx) xs.push(x);
    const n = xs.length;
    const ys = new Float32Array(n);
    const hs = new Float32Array(n);
    g.lineWidth = 0.75;
    g.lineJoin = "round";
    for (let i = 0; i < rows; i++) {
      const y = d.top + i * RULE.gap;
      const t = (elapsed - (i / rows) * ECHO.ms * ECHO.start) / ECHO.rise;
      if (t <= 0) continue;
      const rise = smooth(t);
      const fade = smooth(t * 1.6);
      const v = (y - oy) / S;
      let peak = 0;
      for (let k = 0; k < n; k++) {
        const h = height((xs[k] - ox) / S, v) * rise;
        hs[k] = h;
        ys[k] = y - h * lift;
        peak = Math.max(peak, h);
      }
      g.beginPath();
      g.moveTo(xs[0], ys[0]);
      for (let k = 1; k < n; k++) g.lineTo(xs[k], ys[k]);
      if (peak > 0.01) {
        g.lineTo(xs[n - 1], y + 0.5);
        g.lineTo(xs[0], y + 0.5);
        g.closePath();
        g.fillStyle = paper;
        g.fill();
        g.beginPath();
        g.moveTo(xs[0], ys[0]);
        for (let k = 1; k < n; k++) g.lineTo(xs[k], ys[k]);
      }
      g.strokeStyle = `rgba(${ink},${(0.11 * fade).toFixed(3)})`;
      g.stroke();
      if (peak > 0.06) {
        g.beginPath();
        let on = false;
        for (let k = 0; k < n; k++) {
          if (hs[k] > 0.06) {
            if (on) g.lineTo(xs[k], ys[k]);
            else g.moveTo(xs[k], ys[k]);
            on = true;
          } else on = false;
        }
        g.strokeStyle = `rgba(${ink},${(0.2 * fade).toFixed(3)})`;
        g.stroke();
      }
    }
  }

  function drawTree() {
    if (count < 2) return;
    const { ink, accent } = colors;
    for (let k = 0; k < count; k++) {
      px[k] = ox + nx[k] * S;
      py[k] = oy + ny[k] * S - height(nx[k], ny[k]) * lift;
    }
    const now = clock();
    const paths = WIDTH.map(() => new Path2D());
    const fresh = [new Path2D(), new Path2D(), new Path2D()];
    for (let k = 1; k < count; k++) {
      const p = np[k];
      const age = now - nb[k];
      if (age < ECHO.fresh && !settled) {
        const b = Math.min(2, Math.floor((age / ECHO.fresh) * 3));
        fresh[b].moveTo(px[p], py[p]);
        fresh[b].lineTo(px[k], py[k]);
        continue;
      }
      const w = load[k] + 1;
      const b = w < LOAD[0] ? 0 : w < LOAD[1] ? 1 : w < LOAD[2] ? 2 : w < LOAD[3] ? 3 : 4;
      paths[b].moveTo(px[p], py[p]);
      paths[b].lineTo(px[k], py[k]);
    }
    g.lineCap = "round";
    paths.forEach((path, b) => {
      g.lineWidth = WIDTH[b];
      g.strokeStyle = `rgba(${ink},${ALPHA[b]})`;
      g.stroke(path);
    });
    fresh.forEach((path, b) => {
      g.lineWidth = 1.1;
      g.strokeStyle = `rgba(${accent},${[0.95, 0.7, 0.4][b]})`;
      g.stroke(path);
    });
    g.lineCap = "butt";
  }

  function callout(x, y, dx, dy, label, value, clear = false) {
    const { ink, dim } = colors;
    g.font = '9px "Plex Mono", ui-monospace, monospace';
    const lw = g.measureText(label).width;
    const vw = value ? g.measureText(value).width + 6 : 0;
    const ex = x + dx;
    const side = dx > 0 ? 1 : -1;
    const run = side * 14;
    const tx = side > 0 ? ex + run + 4 : ex + run - 4 - lw - vw;
    let ey = y + dy;
    if (clear) for (let k = 0; k < count; k++) if (px[k] >= tx - 2 && px[k] <= tx + lw + vw + 2) ey = Math.min(ey, py[k] - 8);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(ex, ey);
    g.lineTo(ex + run, ey);
    g.lineWidth = 0.75;
    g.strokeStyle = `rgba(${dim},0.8)`;
    g.stroke();
    g.beginPath();
    g.arc(x, y, 1.7, 0, TAU);
    g.fillStyle = `rgba(${ink},0.95)`;
    g.fill();
    text(label, tx, ey + 3, 9, `rgba(${ink},0.9)`);
    if (value) text(value, tx + lw + 6, ey + 3, 9, `rgba(${dim},0.95)`);
  }

  function drawDims() {
    if (narrow) return;
    const { dim, paper } = colors;
    const w = SIZE[0] * S;
    const top = oy - lift;
    const y = top - 10;
    const color = `rgba(${dim},0.75)`;
    g.lineWidth = 0.6;
    g.strokeStyle = color;
    g.beginPath();
    g.moveTo(ox, y - 3);
    g.lineTo(ox, top + 12 * S - 3);
    g.moveTo(ox + w, y - 3);
    g.lineTo(ox + w, top - 3);
    g.moveTo(ox, y);
    g.lineTo(ox + w, y);
    g.stroke();
    arrow(ox, y, -1, 0, color);
    arrow(ox + w, y, 1, 0, color);
    const label = `${(w * MM).toFixed(1)} mm`;
    g.font = '9px "Plex Mono", ui-monospace, monospace';
    const tw = g.measureText(label).width + 6;
    g.fillStyle = paper;
    g.fillRect(ox + w / 2 - tw / 2, y - 6, tw, 12);
    text(label, ox + w / 2, y + 3, 9, `rgba(${dim},0.95)`, "center");
  }

  function drawTwin(now) {
    const { ink, dim, accent } = colors;
    const grown = Math.min(clock(), done ? doneAt : Infinity) / 1000;
    const rows = [["members", fmt(Math.max(0, count - 1))], ["tips", fmt(count ? tree.tips : 0)], ["junctions", fmt(tree.junctions)], ["length", `${fmt(tree.length * S * MM)} mm`], ["grown", `${grown.toFixed(1)} s`], ["reached", `${fmt(N - aliveCount)} / ${fmt(N)}`]];
    if (narrow) {
      text([rows[0], rows[1], rows[3]].map(([k, v]) => `${k} ${v}`).join(" · "), d.x0, H - 10, 9, `rgba(${dim},0.95)`);
      return;
    }
    const { x0, x1 } = panel;
    text("numeric twin", x0, twin - 14, 10, `rgba(${ink},0.92)`);
    text("as counts", x1, twin - 14, 9, `rgba(${dim},0.9)`, "right");
    rows.forEach(([label, value], k) => {
      const y = twin + k * 14;
      text(label, x0, y, 9, `rgba(${dim},0.95)`);
      text(value, x1, y, 9, `rgba(${ink},0.92)`, "right");
      g.fillStyle = `rgba(${dim},0.22)`;
      g.fillRect(x0, y + 4, x1 - x0, 1);
    });
    g.lineWidth = 1;
    g.strokeStyle = `rgba(${dim},0.6)`;
    g.strokeRect(x0 + 0.5, block + 0.5, x1 - x0 - 1, 45);
    g.fillStyle = `rgba(${dim},0.6)`;
    g.fillRect(x0, block + 17, x1 - x0, 1);
    text(owner, x0 + 6, block + 12, 10, `rgba(${ink},0.95)`);
    text("scale 1:1", x1 - 6, block + 12, 8, `rgba(${dim},0.95)`, "right");
    /* the plate: an opposite hitter, mid-swing */
    plate.forEach((line, k) => text(line, x0 + 6, block + 29 + k * 10, 8, `rgba(${dim},0.95)`));
    const fx = x1 - 34;
    const fy = block + 42;
    const t = reduced.matches ? 0 : now / 900;
    const lift2 = Math.max(0, Math.sin(t)) * 4;
    const y0 = fy - lift2;
    g.strokeStyle = `rgba(${ink},0.85)`;
    g.lineWidth = 0.9;
    g.lineCap = "round";
    g.beginPath();
    g.arc(fx, y0 - 20, 2.4, 0, TAU);
    g.moveTo(fx, y0 - 17.5);
    g.lineTo(fx - 1, y0 - 9);
    g.lineTo(fx - 5, y0 - 4);
    g.lineTo(fx - 3, y0);
    g.moveTo(fx - 1, y0 - 9);
    g.lineTo(fx + 3, y0 - 4);
    g.lineTo(fx + 2, y0);
    const swing = Math.sin(t * 2) * 0.5;
    g.moveTo(fx, y0 - 16);
    g.lineTo(fx + 5 + swing * 3, y0 - 23);
    g.lineTo(fx + 7 + swing * 4, y0 - 28);
    g.moveTo(fx, y0 - 16);
    g.lineTo(fx - 5, y0 - 13);
    g.stroke();
    g.beginPath();
    g.arc(fx + 11 + swing * 6, y0 - 31 - lift2, 2.2, 0, TAU);
    g.strokeStyle = `rgba(${accent},0.95)`;
    g.stroke();
    g.lineCap = "butt";
  }

  function drawSection() {
    const { ink, dim, accent } = colors;
    const y = Math.round(secY) + 0.5;
    const color = `rgba(${accent},0.85)`;
    g.save();
    g.setLineDash([10, 3, 2, 3]);
    g.lineWidth = 0.8;
    g.strokeStyle = color;
    g.beginPath();
    g.moveTo(d.x0 + 8, y);
    g.lineTo(d.x1 - 8, y);
    g.stroke();
    g.restore();
    for (const [x, side] of [[d.x0, 1], [d.x1, -1]]) {
      g.lineWidth = 2;
      g.strokeStyle = color;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + side * 8, y);
      g.stroke();
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x + side * 4, y);
      g.lineTo(x + side * 4, y - 8);
      g.stroke();
      arrow(x + side * 4, y - 8, 0, -1, color);
      text("A", x + side * 4, y - 16, 9, color, "center");
    }
    if (!panel) return;
    const { x0, x1 } = panel;
    const top = chart.y0;
    const h = chart.h;
    const bw = x1 - x0;
    text("section A–A", x0, top - 8, 10, `rgba(${ink},0.92)`);
    text(pointerIn ? "echo at pointer" : "echo at rest", x1, top - 8, 9, `rgba(${dim},0.9)`, "right");
    g.lineWidth = 1;
    g.strokeStyle = `rgba(${dim},0.45)`;
    g.strokeRect(x0 + 0.5, top + 0.5, bw - 1, h - 1);
    const v = (secY - oy) / S;
    const rows = Math.floor((d.y1 - d.top) / RULE.gap) + 1;
    const r = clamp(Math.round((secY - d.top) / RULE.gap), 0, rows);
    const rise = smooth((elapsed - (r / rows) * ECHO.ms * ECHO.start) / ECHO.rise);
    const floor = top + h - 6;
    const spanH = h - 12;
    g.beginPath();
    g.moveTo(x0 + 1, floor);
    for (let k = 0; k <= 96; k++) {
      const X = d.x0 + ((d.x1 - d.x0) * k) / 96;
      g.lineTo(x0 + 1 + ((bw - 2) * k) / 96, floor - height((X - ox) / S, v) * rise * spanH);
    }
    g.lineTo(x1 - 1, floor);
    g.closePath();
    g.fillStyle = `rgba(${accent},0.14)`;
    g.fill();
    g.strokeStyle = `rgba(${accent},0.9)`;
    g.stroke();
    let cut = 0;
    g.fillStyle = `rgba(${ink},0.8)`;
    for (let k = 1; k < count; k++) {
      const p = np[k];
      if (ny[p] <= v === ny[k] <= v) continue;
      const u = nx[p] + ((v - ny[p]) / (ny[k] - ny[p])) * (nx[k] - nx[p]);
      g.fillRect(x0 + 1 + ((ox + u * S - d.x0) / (d.x1 - d.x0)) * (bw - 2) - 0.5, floor + 1, 1, 3);
      cut++;
    }
    text(`cuts ${fmt(cut)} members`, x0, top + h + 12, 9, `rgba(${dim},0.95)`);
  }

  function paint(now) {
    if (!colors || !W) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    measure();
    drawFrame();
    drawRules();
    if (elapsed >= ECHO.ms * ECHO.start) {
      drawTree();
      drawDims();
      if (count) callout(ox + nx[0] * S, oy + ny[0] * S, 12, -8, "root", count > 1 ? `carries ${fmt(count - 1)}` : "");
      if (!narrow && tree.apex) callout(px[tree.apex], py[tree.apex], px[tree.apex] + 120 < d.x1 ? 16 : -16, -12, "apex", `${fmt(nd[tree.apex])} steps`, true);
    }
    drawTwin(now);
    drawSection();
  }

  function frame(now) {
    raf = 0;
    if (!live) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    elapsed += dt * 1000;
    if (!done && elapsed >= ECHO.ms * ECHO.start) {
      acc += dt * GROW.rate;
      while (acc >= 1 && !done) {
        acc -= 1;
        grow();
      }
    }
    if (done && elapsed > ECHO.ms + 400) settled = true;
    secY += (secTarget - secY) * (reduced.matches ? 1 : 0.18);
    paint(now);
    raf = requestAnimationFrame(frame);
  }

  if (reduced.matches) {
    elapsed = ECHO.ms * 4;
    while (!done) grow();
    settled = true;
  }

  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    pointerIn = inside;
    secTarget = inside ? clamp(e.clientY - r.top, d.top + 8, d.y1 - 4) : rest();
  };
  addEventListener("pointermove", onMove, { passive: true });
  const ro = new ResizeObserver(() => layout());
  ro.observe(host);
  recolor();
  layout();
  raf = requestAnimationFrame(frame);

  return {
    recolor,
    destroy() {
      live = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
    },
  };
}
