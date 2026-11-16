/* eye: rendered as fine glyphs taken from a scrolling text, inside an almond with lids, iris fibres and a pupil.
   step() moves it, draw() paints it into a 2D context at a box {cx, cy, w, h} (viewport px). */
import { spring, advance, clamp, between, reduced, EM_TOP } from "./common.js";

const SHAPE = { upper: 0.47, lower: 0.37, iris: 0.33, reach: 0.5, rise: 0.14 };
const ZOOM = { near: 0.92, far: 1.15, span: 2000, locked: 0.9, pulse: 1.12, pulseMs: 320 };
const TONE = { floor: 0.04, range: 0.9, gamma: 1.2, base: 0.05, bold: 0.55 };
export const GLYPH_PX = 5.5;
const FW = GLYPH_PX * 0.6;
const FH = GLYPH_PX * 1.08;

export function createEye({ text = "·", open = false } = {}) {
  const t = {
    state: open ? "open" : "closed",
    lid: spring(open ? 1 : 0, 0.45, 1),
    gx: spring(0, 0.35, 1),
    gy: spring(0, 0.35, 1),
    dil: spring(0.45, 0.5, 1),
    iz: spring(ZOOM.near, 0.8, 1),
    spin: 0,
    openNow: open ? 1 : 0,
    blinkAt: -Infinity,
    nextBlink: performance.now() + between(2600, 6400),
    born: performance.now(),
    offset: 0,
    pulseUntil: 0,
    locked: null,
    levels: null,
    pupil: null,
    text: text.replace(/\s+/g, " ") || "·",
  };

  function setText(value) {
    const next = String(value || "").replace(/\s+/g, " ").replace(/[^\x21-\x7e ]/g, "").trim();
    if (!next || next === t.text) return;
    t.text = next;
    t.offset = Math.floor(Math.random() * next.length);
    if (t.state === "open") t.blinkAt = performance.now();
  }

  function setOpen(want) {
    if (want && (t.state === "closed" || t.state === "closing")) {
      t.state = "opening";
      t.lid.target = 1;
      t.lid.response = 0.45;
    } else if (!want && (t.state === "open" || t.state === "opening")) {
      t.state = "closing";
      t.lid.target = 0;
      t.lid.response = 0.3;
    }
  }

  /* aim: [x, y] or null; focused: a locked typing target (iris narrows) */
  function step(box, now, dt, aim, focused = false) {
    if (t.state === "opening" && t.lid.value > 0.97) t.state = "open";
    if (t.state === "closing" && t.lid.value < 0.01) t.state = "closed";
    if (focused && aim && (!t.locked || Math.hypot(aim[0] - t.locked[0], aim[1] - t.locked[1]) > 60)) t.pulseUntil = now + ZOOM.pulseMs;
    t.locked = focused && aim ? aim : null;
    if (box) {
      const far = aim ? Math.hypot(aim[0] - box.cx, aim[1] - box.cy) / ZOOM.span : 0;
      t.iz.target = now < t.pulseUntil ? ZOOM.pulse : focused ? ZOOM.locked : clamp(ZOOM.near + far, ZOOM.near, ZOOM.far);
      t.gx.target = aim ? clamp((aim[0] - box.cx) / 360, -1, 1) : 0.25 * Math.sin(now / 2300);
      t.gy.target = aim ? clamp((aim[1] - box.cy) / 260, -1, 1) : 0.2 * Math.sin(now / 1700);
    }
    t.dil.target = focused ? 0.25 : 0.5 + 0.2 * Math.sin(now / 1430);
    let moving = !advance(t.lid, dt);
    for (const s of [t.iz, t.gx, t.gy, t.dil]) if (!advance(s, dt)) moving = true;
    t.spin += dt * (reduced.matches ? 0 : focused ? 0.5 : 0.12);
    if (!reduced.matches && t.state === "open" && now >= t.nextBlink) {
      t.blinkAt = now;
      t.nextBlink = now + between(2600, 6400);
    }
    const blink = now - t.blinkAt < 170 ? Math.sin(((now - t.blinkAt) / 170) * Math.PI) : 0;
    t.openNow = clamp(t.lid.value, 0, 1) * (1 - 0.96 * blink);
    return moving || t.state !== "closed";
  }

  function pupilOf(box) {
    const ri = box.h * SHAPE.iris * t.iz.value;
    return { x: box.cx + t.gx.value * box.w * 0.47 * SHAPE.reach, y: box.cy + t.gy.value * box.h * SHAPE.rise, ri, rp: ri * (0.24 + 0.26 * t.dil.value) };
  }

  function sample(box, x, y) {
    const u = (x - box.cx) / (box.w * 0.47);
    if (u <= -1 || u >= 1) return -1;
    const k = 1 - u * u;
    const top = box.cy - box.h * SHAPE.upper * t.openNow * k ** 0.8;
    const bottom = box.cy + box.h * SHAPE.lower * t.openNow * k ** 1.15;
    const rim = Math.max(Math.max(0, 1 - Math.abs(y - top) / 1.7) * 0.95 * Math.sqrt(k), Math.max(0, 1 - Math.abs(y - bottom) / 1.3) * 0.5 * Math.sqrt(k));
    if (y < top || y > bottom) return rim > 0.05 ? rim : -1;
    const p = t.pupil;
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy);
    let v;
    if (d < p.rp) v = 0;
    else if (d < p.ri) {
      const rr = (d - p.rp) / (p.ri - p.rp);
      const a = Math.atan2(dy, dx) + t.spin;
      const fibre = 0.5 + 0.5 * Math.sin(a * 29 + 2.1 * Math.sin(a * 5)) * Math.cos(a * 13 - rr * 4);
      const collar = 0.38 * Math.exp(-((rr - 0.3) ** 2) / 0.012);
      const limbus = rr > 0.8 ? (rr - 0.8) / 0.2 : 0;
      v = (0.26 + 0.46 * fibre * (1 - 0.45 * rr) + collar) * (1 - 0.8 * limbus);
      if (rr < 0.07) v = Math.max(v, 0.9);
    } else v = 0.34 * (1 - 0.6 * u * u) * (0.5 + 0.5 * Math.min(1, (y - top) / (box.h * 0.18)));
    if (Math.hypot(x - (p.x - p.ri * 0.34), y - (p.y - p.ri * 0.36)) < p.ri * 0.14) v = 1;
    return Math.max(v, rim);
  }

  /* glyphs only; c = { ink } as "r,g,b" */
  function draw(g, box, now, c, { tone = null } = {}) {
    t.pupil = pupilOf(box);
    if (t.openNow <= 0.001) return;
    const x0 = box.cx - box.w / 2;
    const y0 = box.cy - box.h / 2;
    const cols = Math.ceil(box.w / FW);
    const rows = Math.ceil(box.h / FH);
    if (!t.levels || t.levels.length !== cols * rows) t.levels = new Int8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const v = sample(box, x0 + (k + 0.5) * FW, y0 + (r + 0.5) * FH);
        t.levels[r * cols + k] = v < 0 ? -1 : Math.round(clamp((v - TONE.floor) / TONE.range, 0, 1) ** TONE.gamma * 13);
      }
    }
    const scroll = reduced.matches ? 0 : Math.floor((now - t.born) / 420);
    const ink = tone || c.ink;
    const text = t.text;
    g.font = `${GLYPH_PX}px "Plex Mono", ui-monospace, monospace`;
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    for (let level = 1; level <= 13; level++) {
      const s = level / 13;
      g.fillStyle = `rgba(${ink},${(TONE.base + (1 - TONE.base) * s).toFixed(3)})`;
      for (let r = 0; r < rows; r++) {
        const from = t.offset + (r + scroll) * cols;
        let line = "";
        let any = false;
        for (let k = 0; k < cols; k++) {
          if (t.levels[r * cols + k] === level) {
            line += text[(from + k) % text.length];
            any = true;
          } else line += " ";
        }
        if (!any) continue;
        const y = y0 + r * FH + GLYPH_PX * EM_TOP;
        g.fillText(line, x0, y);
        if (s > TONE.bold) g.fillText(line, x0 + 0.45, y);
      }
    }
  }

  /* pupil box, the 4-line readout under the eye, and dashed sight lines to targets */
  function drawTrack(g, box, now, c, { targets = [], label = true, W = innerWidth, H = innerHeight } = {}) {
    if (t.openNow <= 0.6 || !t.pupil) return;
    const p = t.pupil;
    const alpha = clamp((t.openNow - 0.6) / 0.3, 0, 1);
    const s = p.rp + 4;
    g.lineWidth = 0.75;
    g.font = `8px "Plex Mono", ui-monospace, monospace`;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.strokeStyle = `rgba(${c.ink},${(0.7 * alpha).toFixed(3)})`;
    g.strokeRect(Math.round(p.x - s) + 0.5, Math.round(p.y - s) + 0.5, Math.round(2 * s), Math.round(2 * s));
    if (label) {
      const area = ((Math.PI * p.rp * p.rp) / (box.w * box.h)).toFixed(10);
      const lines = [`['pupil:u'] ${((p.x - (box.cx - box.w / 2)) / box.w).toFixed(7)}`, ((p.y - (box.cy - box.h / 2)) / box.h).toFixed(7), area, "None"];
      const lw = Math.max(...lines.map((l) => g.measureText(l).width));
      const lx = clamp(box.cx - lw / 2, 8, W - lw - 8);
      const ly = box.cy + box.h / 2 + 10;
      if (ly + lines.length * 9 < H - 8) {
        g.fillStyle = `rgba(${c.ink},${(0.86 * alpha).toFixed(3)})`;
        lines.forEach((l, k) => g.fillText(l, Math.round(lx), Math.round(ly) + k * 9 + 8 * EM_TOP));
        g.strokeStyle = `rgba(${c.ink},${(0.22 * alpha).toFixed(3)})`;
        g.beginPath();
        g.moveTo(p.x, p.y + s);
        g.lineTo(lx + lw / 2, ly - 2);
        g.stroke();
      }
    }
    for (const target of targets) {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(dx ? (11 * len) / Math.abs(dx) : Infinity, dy ? (7 * len) / Math.abs(dy) : Infinity, len);
      g.lineCap = "round";
      g.setLineDash([3, 4]);
      g.lineDashOffset = reduced.matches ? 0 : -now / 45;
      g.strokeStyle = `rgba(${c.accent},${(0.35 * alpha).toFixed(3)})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(target.x - (dx / len) * k, target.y - (dy / len) * k);
      g.stroke();
      g.setLineDash([]);
      g.lineCap = "butt";
      g.lineWidth = 0.75;
      g.strokeStyle = `rgba(${c.ink},${(0.45 * alpha).toFixed(3)})`;
      g.strokeRect(Math.round(target.x - 11) + 0.5, Math.round(target.y - 7) + 0.5, 22, 14);
    }
  }

  return {
    step,
    draw,
    drawTrack,
    setText,
    setOpen,
    pupil: (box) => pupilOf(box),
    get openNow() {
      return t.openNow;
    },
    get state() {
      return t.state;
    },
    blink() {
      t.blinkAt = performance.now();
    },
  };
}
