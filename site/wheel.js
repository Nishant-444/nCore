/* wheel: project cards on an arc, with a ring of ink grown from a year of daily contributions behind it */
import { reduced, clamp, smooth, rng, make, rgbOf, cssVar, palettes, BRAND_PATHS, TAU } from "../shared/common.js";

const WHEEL = { radius: 520, step: 0.155, reach: 0.82, box: [150, 94], small: 0.64, tilt: 0.55, rim: 96, pad: 150, drag: 64, response: 0.34 };
const INK = { seed: 4712, peaks: 0.62, reach: 48, single: 26, form: 2800, tail: 1.12, sway: 1400, swing: 0.3, reachOut: 1.6, cycles: 2.5 };

/* ---------- the ink model: a band whose width follows each day, splashes at the busiest weeks ---------- */
function inkModel({ cx, cy, R, a0, a1, values }) {
  const rnd = rng(INK.seed);
  const late = rng(INK.seed + 1);
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / 0.58;
  const N = values.length;
  const sorted = values.slice().sort((p, q) => p - q);
  const p90 = sorted[Math.floor(N * 0.9)] || 1;
  const norm = (v) => Math.min(1.5, v / p90);
  const angleOf = (k) => a0 + ((k + 0.5) / Math.max(1, N)) * (a1 - a0);
  const dayArc = Math.abs(a1 - a0) / Math.max(1, N);
  const blur = (r) =>
    values.map((_, i) => {
      let s = 0;
      let w = 0;
      for (let j = -r; j <= r; j++) {
        const k = i + j;
        if (k < 0 || k >= N) continue;
        const ww = Math.exp(-(j * j) / (2 * (r / 2) ** 2));
        s += values[k] * ww;
        w += ww;
      }
      return s / w;
    });
  const daily = blur(2);
  const week = blur(4);
  const quiet = new Uint8Array(N);
  for (let i = 0; i < N; ) {
    if (values[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < N && !values[j]) j++;
    if (j - i >= 3) for (let k = i; k < j; k++) quiet[k] = 1;
    i = j;
  }
  const sw = week.slice().sort((p, q) => p - q);
  const thr = sw[Math.floor(N * INK.peaks)];
  const top = sw[N - 1] || 1;
  const peaks = [];
  for (let i = 1; i < N - 1; i++) if (week[i] >= week[i - 1] && week[i] > week[i + 1] && week[i] > thr) peaks.push(i);
  const kept = peaks.filter((i) => !peaks.some((j) => j !== i && Math.abs(j - i) <= 6 && week[j] > week[i]));
  const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const ring = [];
  const M = N * 8;
  for (let i = 0; i <= M && N; i++) {
    const t = i / M;
    const k = clamp(Math.round(t * N - 0.5), 0, N - 1);
    const noise = 0.5 * Math.sin(t * 41 + ph[0]) + 0.3 * Math.sin(t * 97 + ph[1]) + 0.2 * Math.sin(t * 233 + ph[2]);
    let w = 1.5 + 0.55 * noise + 2.1 * norm(daily[k]);
    const edge = [-1, 0, 1].every((d) => !quiet[clamp(k + d, 0, N - 1)]);
    if (quiet[k]) w = 0;
    else if (!edge) w *= 0.45;
    ring.push({ t, a: a0 + t * (a1 - a0), w, wob: 0.35 * Math.sin(t * 173 + ph[2]) });
  }
  const blobs = [];
  const tendrils = [];
  const drops = [];
  const hairs = [];
  const spray = (day, a, strength, count, reach) => {
    for (let j = 0; j < count; j++) {
      const aa = a + gauss() * dayArc * 2.4 * (0.6 + strength);
      const out = rnd() > 0.2;
      const dir = (out ? aa : aa + Math.PI) + (rnd() - 0.5) * 0.95;
      const base = R + (out ? 1.4 : -1.4);
      const L = (4 + reach * strength) * (0.18 + rnd() ** 1.35) * (out ? 1 : 0.42);
      const td = { day, aa, x0: cx + Math.cos(aa) * base, y0: cy + Math.sin(aa) * base, dir, L, bw: 0.55 + 1.9 * strength * (0.35 + rnd() * 0.65), curl: (rnd() - 0.5) * 0.45 * L, delay: late() * 0.5, twig: null };
      if (L > 15 && rnd() < 0.65) td.twig = { at: 0.35 + rnd() * 0.3, turn: (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.4), L: L * (0.25 + rnd() * 0.3), curl: (rnd() - 0.5) * 3 };
      tendrils.push(td);
      if (L > 10 && rnd() < 0.55) for (let d = 0, m = 1 + Math.floor(rnd() * 3); d < m; d++) drops.push({ td, far: 1.05 + rnd() * 0.35, side: (rnd() - 0.5) * 5, r: 0.35 + rnd() * 1.1 * strength });
      if (out && rnd() < 0.35) hairs.push({ td, length: L * (1.3 + rnd() * 0.8), dir: dir + (rnd() - 0.5) * 0.25, jx: (rnd() - 0.5) * 6, jy: (rnd() - 0.5) * 6 });
    }
  };
  for (const i of kept) {
    const s = clamp((week[i] - thr) / (top - thr || 1), 0.12, 1);
    const a = angleOf(i);
    const rb = 2 + 4.2 * s;
    const rad = Array.from({ length: 22 }, () => rb * (0.55 + rnd() * 0.9));
    blobs.push({ day: i, a, soft: rad.map((r, k) => (r + rad[(k + 1) % 22] + rad[(k + 21) % 22]) / 3) });
    spray(i, a, s, Math.round(10 + 30 * s), INK.reach);
  }
  values.forEach((v, k) => {
    if (v < p90 || kept.some((i) => Math.abs(i - k) <= 3)) return;
    spray(k, angleOf(k), 0.25 + 0.3 * Math.min(1, v / (p90 * 2)), 1 + Math.floor(rnd() * 3), INK.single);
  });
  return { cx, cy, R, a0, a1, N, ring, blobs, tendrils, drops, hairs };
}

function taper(path, x0, y0, dir, L, bw, curl) {
  const dx = Math.cos(dir);
  const dy = Math.sin(dir);
  const qx = x0 + dx * L * 0.5 - dy * curl;
  const qy = y0 + dy * L * 0.5 + dx * curl;
  const P = (t) => {
    const u = 1 - t;
    return [u * u * x0 + 2 * u * t * qx + t * t * (x0 + dx * L), u * u * y0 + 2 * u * t * qy + t * t * (y0 + dy * L)];
  };
  const left = [];
  const right = [];
  for (let s = 0; s <= 8; s++) {
    const t = s / 8;
    const [x, y] = P(t);
    const [x2, y2] = P(Math.min(1, t + 0.02));
    const [x1, y1] = P(Math.max(0, t - 0.02));
    const tl = Math.hypot(x2 - x1, y2 - y1) || 1;
    const hw = (bw / 2) * (1 - t) ** 0.9;
    left.push([x - ((y2 - y1) / tl) * hw, y + ((x2 - x1) / tl) * hw]);
    right.push([x + ((y2 - y1) / tl) * hw, y - ((x2 - x1) / tl) * hw]);
  }
  path.moveTo(...left[0]);
  left.forEach((p) => path.lineTo(...p));
  for (let s = right.length - 1; s >= 0; s--) path.lineTo(...right[s]);
  path.closePath();
  return P;
}

function inkPaths(m, grow = () => 1, shown = () => true, bend = () => 0) {
  const { cx, cy, R } = m;
  const body = new Path2D();
  const hairs = new Path2D();
  const outer = [];
  const inner = [];
  const flush = () => {
    if (outer.length > 1) {
      body.moveTo(...outer[0]);
      outer.forEach((p) => body.lineTo(...p));
      for (let i = inner.length - 1; i >= 0; i--) body.lineTo(...inner[i]);
      body.closePath();
    }
    outer.length = 0;
    inner.length = 0;
  };
  for (const p of m.ring) {
    if (!shown(p)) {
      flush();
      continue;
    }
    outer.push([cx + Math.cos(p.a) * (R + p.w / 2 + p.wob), cy + Math.sin(p.a) * (R + p.w / 2 + p.wob)]);
    inner.push([cx + Math.cos(p.a) * (R - p.w / 2 + p.wob), cy + Math.sin(p.a) * (R - p.w / 2 + p.wob)]);
  }
  flush();
  for (const b of m.blobs) {
    const k = smooth(grow(b.day, 0));
    if (k <= 0) continue;
    const bx = cx + Math.cos(b.a) * R;
    const by = cy + Math.sin(b.a) * R;
    const tx = -Math.sin(b.a);
    const ty = Math.cos(b.a);
    const n = b.soft.length;
    for (let i = 0; i <= n; i++) {
      const t = ((i % n) / n) * TAU;
      const r = b.soft[i % n] * k;
      const x = bx + tx * Math.cos(t) * r * 1.9 + Math.cos(b.a) * Math.sin(t) * r;
      const y = by + ty * Math.cos(t) * r * 1.9 + Math.sin(b.a) * Math.sin(t) * r;
      if (i) body.lineTo(x, y);
      else body.moveTo(x, y);
    }
    body.closePath();
  }
  for (const td of m.tendrils) {
    const k = smooth(grow(td.day, td.delay));
    if (k <= 0) continue;
    const b = bend(td.aa);
    const P = taper(body, td.x0, td.y0, td.dir + b, td.L * k, td.bw, td.curl * k - b * td.L * 0.35);
    if (td.twig && k > 0.5) {
      const [bx, by] = P(td.twig.at);
      taper(body, bx, by, td.dir + td.twig.turn + b * 1.3, td.twig.L * smooth((k - 0.5) * 2), td.bw * 0.5, td.twig.curl);
    }
  }
  for (const d of m.drops) {
    const td = d.td;
    const k = smooth(grow(td.day, td.delay + 0.35));
    if (k <= 0) continue;
    const b = bend(td.aa) * 1.15;
    const dx = Math.cos(td.dir + b);
    const dy = Math.sin(td.dir + b);
    const far = td.L * d.far * (0.6 + 0.4 * k);
    const x = td.x0 + dx * far - dy * d.side;
    const y = td.y0 + dy * far + dx * d.side;
    body.moveTo(x + d.r * k, y);
    body.arc(x, y, d.r * k, 0, TAU);
  }
  for (const h of m.hairs) {
    const td = h.td;
    const k = smooth(grow(td.day, td.delay + 0.2));
    if (k <= 0) continue;
    const len = h.length * k;
    const b = bend(td.aa);
    const mid = h.dir + b * 0.6;
    const tip = h.dir + b * 1.5;
    hairs.moveTo(td.x0, td.y0);
    hairs.quadraticCurveTo(td.x0 + Math.cos(mid) * len * 0.5 + h.jx, td.y0 + Math.sin(mid) * len * 0.5 + h.jy, td.x0 + Math.cos(tip) * len, td.y0 + Math.sin(tip) * len);
  }
  return { body, hairs };
}

function paintInk(g, { body, hairs }, color, alpha = 0.92) {
  g.fillStyle = `rgba(${color},${alpha})`;
  g.fill(body);
  g.lineWidth = 0.4;
  g.strokeStyle = `rgba(${color},${(alpha * 0.46).toFixed(3)})`;
  g.stroke(hairs);
}

/* ---------- painted tiles for the folders ---------- */
function paintTile(kind, c) {
  const [w, h] = WHEEL.box;
  const cv = document.createElement("canvas");
  cv.width = w * 2;
  cv.height = h * 2;
  const g = cv.getContext("2d");
  g.scale(2, 2);
  g.fillStyle = c.paper;
  g.fillRect(0, 0, w, h);
  const mono = (size) => `${size}px "Plex Mono", ui-monospace, monospace`;
  if (kind === "about") {
    g.strokeStyle = `rgba(${c.ink},0.14)`;
    g.lineWidth = 0.6;
    for (let y = 8; y < h - 6; y += 4) {
      g.beginPath();
      g.moveTo(8, y);
      g.lineTo(w - 8, y);
      g.stroke();
    }
    const s = 0.62;
    g.save();
    g.translate((w - 88 * s) / 2, 12);
    g.scale(s, s);
    g.fillStyle = `rgba(${c.ink},0.92)`;
    for (const d of BRAND_PATHS) g.fill(new Path2D(d));
    g.restore();
  } else if (kind === "stack") {
    const names = TOOLKIT.flatMap((t) => t.items).map((s) => s.replace(/\s*\(.*\)/, ""));
    const size = 13;
    const gap = 9;
    const cols = 6;
    const x0 = (w - (cols * size + (cols - 1) * gap)) / 2;
    g.font = mono(8);
    g.textAlign = "center";
    g.textBaseline = "middle";
    names.slice(0, 18).forEach((name, k) => {
      const x = x0 + (k % cols) * (size + gap);
      const y = 10 + Math.floor(k / cols) * (size + gap);
      g.strokeStyle = `rgba(${c.ink},${k < 7 ? 0.9 : 0.6})`;
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      g.fillStyle = `rgba(${c.ink},${k < 7 ? 0.95 : 0.7})`;
      g.fillText(name[0], x + size / 2, y + size / 2 + 0.5);
    });
  } else if (kind === "themes") {
    const list = [...palettes.values()];
    const sw = w / list.length;
    list.forEach((t, k) => {
      g.fillStyle = t.bg;
      g.fillRect(k * sw, 0, Math.ceil(sw), h);
      g.fillStyle = t.accent;
      g.fillRect(k * sw, h * 0.62, Math.ceil(sw), h * 0.16);
      g.fillStyle = t.fg;
      g.fillRect(k * sw + sw * 0.3, h * 0.3, Math.max(1, sw * 0.4), 2);
    });
  } else if (kind === "experience") {
    g.font = mono(8);
    g.textBaseline = "middle";
    const items = EXPERIENCE.map((e) => [e.when.slice(-4) === "sent" ? e.when.slice(4, 8) : e.when.slice(4, 8), e.org.split(" ")[0].toLowerCase(), e.current]);
    g.strokeStyle = `rgba(${c.ink},0.4)`;
    g.beginPath();
    g.moveTo(40, 12);
    g.lineTo(40, 12 + (items.length - 1) * 16);
    g.stroke();
    items.forEach(([year, org, now], k) => {
      const y = 12 + k * 16;
      g.fillStyle = `rgba(${c.ink},0.55)`;
      g.fillText(year, 12, y);
      g.fillStyle = now ? `rgb(${c.accent})` : `rgba(${c.ink},0.9)`;
      g.beginPath();
      g.arc(40, y, now ? 3 : 2, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(${c.ink},${now ? 0.95 : 0.7})`;
      g.fillText(org, 50, y);
    });
  } else if (kind === "oss") {
    g.font = mono(8);
    g.textBaseline = "middle";
    g.strokeStyle = `rgba(${c.ink},0.5)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(22, 12);
    g.lineTo(22, 62);
    g.moveTo(22, 26);
    g.quadraticCurveTo(22, 34, 40, 34);
    g.moveTo(22, 46);
    g.quadraticCurveTo(22, 54, 40, 54);
    g.stroke();
    for (const [x, y, on] of [[22, 12, 0], [40, 34, 1], [40, 54, 1], [22, 62, 0]]) {
      g.fillStyle = on ? `rgb(${c.accent})` : `rgba(${c.ink},0.8)`;
      g.beginPath();
      g.arc(x, y, 2.4, 0, TAU);
      g.fill();
    }
    g.fillStyle = `rgba(${c.ink},0.85)`;
    OPEN_SOURCE.prs.forEach((pr, k) => g.fillText(`#${pr.n} merged`, 48, 34 + k * 20));
    g.fillStyle = `rgba(${c.ink},0.5)`;
    g.fillText("main", 30, 12);
  } else if (kind === "offclock") {
    /* a chessboard corner, a few keys */
    const s = 7;
    for (let r = 0; r < 6; r++) for (let k = 0; k < 6; k++) {
      g.fillStyle = (r + k) % 2 ? `rgba(${c.ink},0.55)` : `rgba(${c.ink},0.12)`;
      g.fillRect(12 + k * s, 10 + r * s, s, s);
    }
    for (let k = 0; k < 9; k++) {
      g.strokeStyle = `rgba(${c.ink},0.6)`;
      g.strokeRect(70.5 + k * 7, 14.5, 7, 30);
    }
    g.fillStyle = `rgba(${c.ink},0.85)`;
    for (const k of [0, 1, 3, 4, 5, 7]) g.fillRect(75 + k * 7, 14, 4, 18);
    g.fillStyle = `rgb(${c.accent})`;
    g.beginPath();
    g.arc(132, 16, 2, 0, TAU);
    g.fill();
  } else if (kind === "links") {
    g.font = mono(9);
    g.textBaseline = "middle";
    ["github", "linkedin", "résumé", "mail"].forEach((t, k) => {
      g.fillStyle = `rgb(${c.accent})`;
      g.fillText("→", 14, 12 + k * 13);
      g.fillStyle = `rgba(${c.ink},0.85)`;
      g.fillText(t, 28, 12 + k * 13);
    });
  }
  return cv.toDataURL("image/png");
}

export function createWheel(host, { items, days, initial = 0, onChange, onCommit, onPick }) {
  const n = items.length;
  const layer = make("canvas", "wheel-ink");
  layer.setAttribute("aria-hidden", "true");
  const cache = document.createElement("canvas");
  const list = make("ul", "wheel-list");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", host.getAttribute("aria-label") || "Projects");
  const mark = make("span", "wheel-mark");
  const hint = make("p", "wheel-hint", "scroll · drag the wheel");
  hint.setAttribute("aria-hidden", "true");
  const nodes = items.map((item, k) => {
    const li = make("li");
    li.setAttribute("role", "none");
    const button = make("button", "wheel-item");
    button.type = "button";
    button.dataset.index = String(k);
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", item.label);
    button.tabIndex = -1;
    const img = make("img");
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    const cap = make("span", "wheel-cap", item.label);
    button.append(img, cap);
    li.append(button);
    list.append(li);
    return { button, img };
  });
  host.replaceChildren(layer, list, mark, hint);

  let W = 0;
  let H = 0;
  let cx = 0;
  let cy = 0;
  let apex = 0;
  let pos = initial;
  let target = initial;
  let vel = 0;
  let raf = 0;
  let last = 0;
  let colors = null;
  let committed = -1;
  let commitTimer = 0;
  let drag = null;
  let moved = false;
  let wheelAcc = 0;
  let foot = null;
  let model = null;
  let full = null;
  let anim = null;
  let inkRaf = 0;
  let wantForm = false;
  let formed = reduced.matches;

  const wrap = (k) => ((Math.round(k) % n) + n) % n;
  const index = () => wrap(target);
  const offOf = (k, p) => {
    let off = (k - p) % n;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    return off;
  };

  /* screenshots sit inside a small window drawn in the current colorscheme */
  const shots = new Map();
  function framed(item, c) {
    const img = shots.get(item.src);
    if (!img?.naturalWidth) return null;
    const [w, h] = WHEEL.box;
    const cv = document.createElement("canvas");
    cv.width = w * 3;
    cv.height = h * 3;
    const g = cv.getContext("2d");
    g.scale(3, 3);
    g.imageSmoothingQuality = "high";
    g.fillStyle = c.paper;
    g.fillRect(0, 0, w, h);
    const bar = 11;
    g.fillStyle = c.line;
    g.fillRect(0, 0, w, bar);
    [5, 10, 15].forEach((x, k) => {
      g.fillStyle = k === 0 ? `rgba(${c.accent},0.9)` : `rgba(${c.dim},0.55)`;
      g.beginPath();
      g.arc(x, bar / 2, 1.6, 0, TAU);
      g.fill();
    });
    g.font = '6.5px "Plex Mono", ui-monospace, monospace';
    g.textBaseline = "middle";
    g.fillStyle = `rgba(${c.dim},0.95)`;
    g.fillText(item.host || "", 22, bar / 2 + 0.5, w - 26);
    const top = bar + 1;
    const scale = Math.max(w / img.naturalWidth, (h - top) / img.naturalHeight);
    const sw = w / scale;
    const sh = (h - top) / scale;
    g.drawImage(img, (img.naturalWidth - sw) / 2, 0, sw, sh, 0, top, w, h - top);
    g.fillStyle = `rgba(${c.dim},0.35)`;
    g.fillRect(0, bar, w, 1);
    return cv.toDataURL("image/webp", 0.9);
  }
  function recolorNow() {
    colors = { ink: rgbOf(cssVar("--ink")), dim: rgbOf(cssVar("--dim")), accent: rgbOf(cssVar("--accent")), paper: cssVar("--bg") || "#0c0c0c", line: cssVar("--line") || "#141414" };
    items.forEach((item, k) => {
      if (item.tile) nodes[k].img.src = paintTile(item.tile, colors);
      else if (item.src) {
        const done = () => {
          const url = framed(item, colors);
          if (url) nodes[k].img.src = url;
        };
        if (shots.has(item.src)) done();
        else {
          const img = new Image();
          img.decoding = "async";
          img.onload = done;
          img.src = item.src;
          shots.set(item.src, img);
        }
      }
    });
  }

  function sized(cv) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = W + WHEEL.pad;
    const w = Math.round(cw * dpr);
    const h = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, WHEEL.pad * dpr, 0);
    g.clearRect(-WHEEL.pad, 0, cw, H);
    return g;
  }

  function rebuild() {
    const R = WHEEL.radius + WHEEL.rim;
    const half = Math.asin(clamp((H / 2 - 30) / R, 0.1, 0.9));
    model = inkModel({ cx, cy, R, a0: Math.PI + half, a1: Math.PI - half, values: days.map((d) => d[1]) });
    full = inkPaths(model);
  }

  function frameInk(g) {
    g.strokeStyle = `rgba(${colors.dim},0.3)`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy, WHEEL.radius, Math.PI - 1.2, Math.PI + 1.2);
    g.stroke();
    if (!days.length || !foot) return;
    const text = days[days.length - 1][0];
    g.save();
    g.font = '9px "Plex Mono", ui-monospace, monospace';
    g.lineJoin = "round";
    g.lineWidth = 3;
    g.strokeStyle = colors.paper;
    g.strokeText(text, foot.x, foot.y);
    g.fillStyle = `rgba(${colors.dim},0.9)`;
    g.fillText(text, foot.x, foot.y);
    g.restore();
  }

  function blit(g) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(cache, 0, 0);
    g.restore();
  }

  function drawInk() {
    layer.style.width = `${W + WHEEL.pad}px`;
    layer.style.height = `${H}px`;
    if (!colors || !W || !H || !model) return void sized(layer);
    const g = sized(cache);
    paintInk(g, full, colors.ink);
    frameInk(g);
    if (!anim) {
      if (formed) blit(sized(layer));
      else sized(layer);
    }
  }

  const swayAt = (a, p, dir) => {
    const d = Math.abs(a - Math.PI) / Math.max(0.001, Math.abs(model.a1 - model.a0) / 2);
    const front = clamp(p * INK.reachOut - d, 0, 1);
    return dir * INK.swing * Math.sin(front * Math.PI * INK.cycles) * (1 - front) * (1 - p);
  };

  function animate(kind, dir = 1) {
    if (reduced.matches || !model || !W) return;
    anim = { kind, dir, start: performance.now() };
    if (!inkRaf) inkRaf = requestAnimationFrame(tickInk);
  }

  function tickInk(now) {
    inkRaf = 0;
    if (!anim || !model || !W) return;
    const g = sized(layer);
    if (anim.kind === "form") {
      const p = (now - anim.start) / INK.form;
      const head = p * model.N;
      frameInk(g);
      paintInk(g, inkPaths(model, (day, delay) => (head - day) / 16 - delay, (q) => q.t * model.N <= head), colors.ink);
      if (p < 1) {
        const a = model.a0 + p * (model.a1 - model.a0);
        g.fillStyle = `rgba(${colors.accent},0.95)`;
        g.beginPath();
        g.arc(cx + Math.cos(a) * model.R, cy + Math.sin(a) * model.R, 2.4, 0, TAU);
        g.fill();
      }
      if (p >= INK.tail) {
        anim = null;
        formed = true;
        blit(sized(layer));
        return;
      }
    } else {
      const p = Math.min(1, (now - anim.start) / INK.sway);
      frameInk(g);
      paintInk(g, inkPaths(model, undefined, undefined, (a) => swayAt(a, p, anim.dir)), colors.ink);
      if (p >= 1) {
        anim = null;
        blit(sized(layer));
        return;
      }
    }
    inkRaf = requestAnimationFrame(tickInk);
  }

  function layout() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const grew = rect.width !== W || rect.height !== H || !model;
    W = rect.width;
    H = rect.height;
    apex = clamp(W * 0.34, 78, 130);
    cx = apex + WHEEL.radius;
    cy = H / 2;
    foot = { x: parseFloat(getComputedStyle(hint).left) || 7, y: hint.offsetTop - 9 };
    if (grew) rebuild();
    drawInk();
    place();
    if (wantForm && !formed && !anim) animate("form");
    return true;
  }

  function place() {
    if (!W) return;
    const [bw, bh] = WHEEL.box;
    const sel = index();
    for (let k = 0; k < n; k++) {
      const off = offOf(k, pos);
      const a = Math.PI - off * WHEEL.step;
      const far = Math.abs(off * WHEEL.step);
      const { button } = nodes[k];
      if (far > WHEEL.reach) {
        button.style.visibility = "hidden";
        continue;
      }
      const x = cx + Math.cos(a) * WHEEL.radius;
      const y = cy + Math.sin(a) * WHEEL.radius;
      const near = clamp(1 - Math.abs(off), 0, 1);
      const s = WHEEL.small + (1 - WHEEL.small) * near;
      button.style.visibility = "visible";
      button.style.transform = `translate(${Math.round(x - bw / 2)}px, ${Math.round(y - bh / 2)}px) rotate(${((a - Math.PI) * WHEEL.tilt).toFixed(4)}rad) scale(${s.toFixed(4)})`;
      button.style.setProperty("--shade", (k === sel ? 0 : 1 - (0.32 + 0.42 * (1 - far / WHEEL.reach) + 0.26 * near)).toFixed(3));
      button.style.zIndex = String(100 - Math.round(Math.abs(off) * 8));
    }
    mark.style.transform = `translate(${(apex + bw / 2 + 4).toFixed(1)}px, ${(cy - 6).toFixed(1)}px)`;
  }

  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!drag) {
      const w = TAU / WHEEL.response;
      vel += (w * w * (target - pos) - 2 * w * vel) * dt;
      pos += vel * dt;
      if (Math.abs(target - pos) < 0.002 && Math.abs(vel) < 0.01) {
        pos = target;
        vel = 0;
      }
    }
    place();
    if (drag || pos !== target) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function kick() {
    if (reduced.matches && !drag) {
      pos = target;
      vel = 0;
      return place();
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function changed() {
    const k = index();
    nodes.forEach(({ button }, j) => {
      button.setAttribute("aria-selected", String(j === k));
      button.tabIndex = j === k ? 0 : -1;
    });
    onChange?.(items[k], k);
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commit, reduced.matches ? 0 : 170);
  }

  function commit() {
    const k = index();
    if (k === committed) return;
    const previous = committed;
    committed = k;
    if (formed && (!anim || anim.kind === "sway")) animate("sway", k > previous ? 1 : -1);
    onCommit?.(items[k], k);
  }

  function step(delta) {
    const next = Math.round(target) + delta;
    if (next === target) return;
    target = next;
    changed();
    kick();
  }

  function select(k) {
    const next = Math.round(target) + offOf(k, Math.round(target));
    if (next === target) return;
    target = next;
    changed();
    kick();
  }

  host.addEventListener("wheel", (e) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
    wheelAcc += (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    const steps = Math.trunc(wheelAcc / 42);
    if (!steps) return;
    wheelAcc -= steps * 42;
    step(clamp(steps, -3, 3));
  }, { passive: false });
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, y: e.clientY, from: pos, v: 0, lastY: e.clientY, lastAt: performance.now() };
    moved = false;
  });
  host.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    if (!moved && Math.abs(dy) < 6) return;
    if (!moved) {
      moved = true;
      host.setPointerCapture?.(e.pointerId);
      host.classList.add("is-dragging");
    }
    const now = performance.now();
    drag.v = 0.7 * drag.v + 0.3 * ((e.clientY - drag.lastY) / Math.max(1, now - drag.lastAt)) * 1000;
    drag.lastY = e.clientY;
    drag.lastAt = now;
    pos = drag.from - dy / WHEEL.drag;
    vel = 0;
    const near = Math.round(pos);
    if (near !== target) {
      target = near;
      changed();
    }
    kick();
  });
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const release = drag.v;
    drag = null;
    host.classList.remove("is-dragging");
    if (!moved) return;
    const project = ((release / 1000) * 0.99) / (1 - 0.99);
    const next = Math.round(pos - project / WHEEL.drag);
    vel = -release / WHEEL.drag;
    if (next !== target) {
      target = next;
      changed();
    }
    kick();
  };
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("click", (e) => {
    const button = e.target.closest?.(".wheel-item");
    if (!button) return;
    if (moved) {
      e.preventDefault();
      moved = false;
      return;
    }
    select(Number(button.dataset.index));
    onPick?.(items[index()], index());
  });
  new ResizeObserver(() => layout()).observe(host);

  recolorNow();
  layout();
  changed();
  clearTimeout(commitTimer);
  document.fonts?.ready.then(() => {
    recolorNow();
    drawInk();
  });

  return {
    step,
    select,
    current: () => ({ item: items[index()], index: index() }),
    centerOf(k = index()) {
      const r = nodes[k]?.button.getBoundingClientRect();
      return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    },
    focus: () => nodes[index()]?.button.focus({ preventScroll: true }),
    commitNow() {
      clearTimeout(commitTimer);
      commit();
    },
    layout,
    form() {
      wantForm = true;
      if (!formed && !anim && W) animate("form");
    },
    recolor() {
      recolorNow();
      drawInk();
    },
  };
}
