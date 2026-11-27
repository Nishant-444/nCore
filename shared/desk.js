/* desk: a keyboard, two hand skeletons (21-point landmark layout) and a mouse, drawn into any 2D context.
   press(code) / pressChar(ch) make a fingertip reach for the key; pointer activity swaps the right hand onto the mouse. */
import { spring, advance, clamp, finePointer, EM_TOP } from "./common.js";

const ROWS = [
  ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
  ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
  ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"],
  ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
];
const STAGGER = [0, 1.5, 1.8, 2.3];
const LABELS = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
const SHIFTED = { "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0", _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/" };
const FINGER = {};
[
  [0, 4, "Escape Backquote Digit1 KeyQ KeyA KeyZ ShiftLeft"],
  [0, 3, "Digit2 KeyW KeyS KeyX"],
  [0, 2, "Digit3 KeyE KeyD KeyC"],
  [0, 1, "Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB"],
  [1, 1, "Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM"],
  [1, 2, "Digit8 KeyI KeyK Comma"],
  [1, 3, "Digit9 KeyO KeyL Period"],
  [1, 4, "Digit0 Minus Equal KeyP BracketLeft BracketRight Backslash Semicolon Quote Slash ShiftRight Backspace Enter"],
].forEach(([hand, finger, list]) => list.split(" ").forEach((code) => (FINGER[code] = [hand, finger])));
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const IDLE_MS = 2200;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function createDesk({ withMouse = finePointer.matches, idle = IDLE_MS, always = false, sideLabels = false } = {}) {
  let kb = null;
  let hands = [];
  let box = null;
  const desk = { vis: spring(always ? 1 : 0, 0.3, 1), mouse: spring(0, 0.28, 1), ox: spring(0, 0.18, 1), oy: spring(0, 0.18, 1), lastAt: -Infinity, mode: "keys" };
  const pointer = { x: -1, y: -1, at: -Infinity, drift: [0, 0], ghost: null };
  const chars = new Map([[" ", { code: "Space", shift: false }]]);
  ROWS.flat().forEach((code, n) => {
    const ch = LABELS[n];
    if (!chars.has(ch)) chars.set(ch, { code, shift: false });
    const up = ch.toUpperCase();
    if (up !== ch && !chars.has(up)) chars.set(up, { code, shift: true });
  });
  for (const [ch, base] of Object.entries(SHIFTED)) if (!chars.has(ch)) chars.set(ch, { code: ROWS.flat()[LABELS.indexOf(base)], shift: true });

  function place(rect) {
    box = rect;
    const needW = (withMouse ? 470 : 380) + 40;
    const scale = clamp(Math.min(rect.width / needW, rect.height / 190), 0.5, 1.15);
    const px = 21.6 * scale;
    const py = 26 * scale;
    const home = rect.top + rect.height * 0.5 - 0.5 * py;
    const keys = new Map();
    ROWS.forEach((row, k) => row.forEach((code, n) => keys.set(code, { x: (STAGGER[k] + n) * px, y: home + (k - 2) * py })));
    keys.set("Space", { x: 6.4 * px, y: home + 2 * py, wide: 5.6 * px });
    keys.set("ShiftLeft", { x: 0.4 * px, y: home + py });
    keys.set("ShiftRight", { x: 12.8 * px, y: home + py });
    keys.set("Backspace", { x: 13.6 * px, y: home - 2 * py });
    keys.set("Enter", { x: 13.3 * px, y: home });
    keys.set("Escape", { x: -1.1 * px, y: home - 2 * py });
    const mouse = withMouse ? { x: 14.7 * px + 70 * scale, y: home + 0.2 * py, w: 34 * scale, h: 56 * scale } : null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const [code, k] of keys) {
      const half = k.wide ? k.wide / 2 : (code === "Escape" ? 3 : 1) * 3.6 * scale;
      lo = Math.min(lo, k.x - half);
      hi = Math.max(hi, k.x + half);
    }
    if (mouse) {
      lo = Math.min(lo, mouse.x - mouse.w / 2);
      hi = Math.max(hi, mouse.x + mouse.w / 2);
    }
    const shift = rect.left + rect.width / 2 - (lo + hi) / 2;
    for (const k of keys.values()) k.x += shift;
    if (mouse) mouse.x += shift;
    const labels = new Map(ROWS.flat().map((code, n) => [code, LABELS[n]]));
    labels.set("ShiftLeft", "↑").set("ShiftRight", "↑").set("Backspace", "←").set("Enter", "↩").set("Escape", "esc");
    kb = { keys, px, py, scale, home, mouse, labels, glow: new Map(), clicks: [0, 0], top: home - 2 * py - 10 * scale, bottom: home + 2 * py + 3.7 * py };
    hands = [makeHand(0), makeHand(1)];
  }

  function restPose(side) {
    const { keys, px, py, scale: s } = kb;
    const tips = (side === 0 ? ["KeyF", "KeyD", "KeyS", "KeyA"] : ["KeyJ", "KeyK", "KeyL", "Semicolon"]).map((c) => [keys.get(c).x, keys.get(c).y + 3 * s]);
    const center = tips.reduce((sum, [x]) => sum + x, 0) / 4;
    const space = keys.get("Space");
    const thumb = [space.x + (side === 0 ? -1.2 : 1.2) * px, space.y + 2 * s];
    const wrist = [center + (side === 0 ? 10 : -10) * s, tips[0][1] + 3.7 * py];
    const cmc = [wrist[0] + (side === 0 ? 26 : -26) * s, wrist[1] - 16 * s];
    const base = [cmc[0] + (thumb[0] - cmc[0]) * 0.4, cmc[1] + (thumb[1] - cmc[1]) * 0.4 + 4 * s];
    const pose = [wrist, cmc, base, lerp(base, thumb, 0.55), thumb];
    tips.forEach((tip, f) => {
      const knuckle = [tip[0] * 0.82 + center * 0.18, tip[1] + 1.55 * py - Math.abs(f - 1.5) * 3 * s];
      pose.push(knuckle, lerp(knuckle, tip, 0.42), lerp(knuckle, tip, 0.74), tip);
    });
    return pose;
  }

  function mousePose(mx, my) {
    const { w, h } = kb.mouse;
    const at = (u, v) => [mx + u * w, my + v * h];
    const pose = [at(0.1, 1.05), at(-0.45, 0.7), at(-0.62, 0.42), at(-0.7, 0.18), at(-0.66, -0.02)];
    for (const [k, t] of [[at(-0.2, 0.2), at(-0.2, -0.38)], [at(0.08, 0.18), at(0.2, -0.38)], [at(0.32, 0.26), at(0.52, -0.08)], [at(0.46, 0.4), at(0.66, 0.16)]]) pose.push(k, lerp(k, t, 0.42), lerp(k, t, 0.74), t);
    return pose;
  }

  function makeHand(side) {
    const rest = restPose(side);
    return { side, rest, points: rest.map((p) => [...p]), tips: [0, 1, 2, 3, 4].map((f) => ({ x: spring(rest[4 + f * 4][0], 0.07, 0.82), y: spring(rest[4 + f * 4][1], 0.07, 0.82), until: 0 })), shift: { x: spring(0, 0.2, 1), y: spring(0, 0.2, 1) } };
  }

  function reach(hand, finger, k, now, hold) {
    const tip = hand.tips[finger];
    const [rx, ry] = hand.rest[4 + finger * 4];
    tip.x.target = k.x;
    tip.y.target = k.y + 3 * kb.scale;
    tip.until = now + hold;
    hand.shift.x.target = (k.x - rx) * 0.22;
    hand.shift.y.target = (k.y + 3 * kb.scale - ry) * 0.22;
  }

  function press(code, shift = false) {
    if (!kb) return;
    const k = kb.keys.get(code);
    if (!k) return;
    const now = performance.now();
    desk.lastAt = now;
    desk.mode = "keys";
    kb.glow.set(code, now);
    const [side, finger] = code === "Space" ? [1, 0] : FINGER[code] || [1, 4];
    reach(hands[side], finger, k, now, 120);
    if (shift) {
      const sk = side === 0 ? "ShiftRight" : "ShiftLeft";
      kb.glow.set(sk, now);
      reach(hands[1 - side], 4, kb.keys.get(sk), now, 160);
    }
  }
  const pressChar = (ch) => {
    const hit = chars.get(ch);
    if (hit) press(hit.code, hit.shift);
  };

  function pointerMove(x, y) {
    if (pointer.x >= 0) {
      pointer.drift[0] += (x - pointer.x) * 0.35;
      pointer.drift[1] += (y - pointer.y) * 0.35;
    }
    pointer.x = x;
    pointer.y = y;
    pointer.at = performance.now();
    desk.lastAt = pointer.at;
    desk.mode = "mouse";
  }
  function click(button = 0) {
    if (kb) kb.clicks[button === 2 ? 1 : 0] = performance.now() + 160;
    desk.lastAt = performance.now();
    desk.mode = "mouse";
  }

  function step(now, dt) {
    let moving = false;
    for (const hand of hands) {
      if (hand.tips.every((t) => now > t.until + 250)) {
        hand.shift.x.target = 0;
        hand.shift.y.target = 0;
      }
      if (!advance(hand.shift.x, dt)) moving = true;
      if (!advance(hand.shift.y, dt)) moving = true;
      const pts = hand.rest.map(([x, y]) => [x + hand.shift.x.value, y + hand.shift.y.value]);
      hand.tips.forEach((tip, f) => {
        const [rx, ry] = hand.rest[4 + f * 4];
        if (now > tip.until) {
          tip.x.target = rx + hand.shift.x.target;
          tip.y.target = ry + hand.shift.y.target;
        }
        if (!advance(tip.x, dt)) moving = true;
        if (!advance(tip.y, dt)) moving = true;
        if (now < tip.until) moving = true;
        const t = [tip.x.value, tip.y.value];
        pts[4 + f * 4] = t;
        if (f === 0) pts[3] = lerp(pts[2], t, 0.55);
        else {
          const kn = pts[1 + f * 4];
          pts[2 + f * 4] = lerp(kn, t, 0.42);
          pts[3 + f * 4] = lerp(kn, t, 0.74);
        }
      });
      hand.points = pts;
    }
    return moving;
  }

  function drawKeys(g, vis, now, c) {
    g.font = `${12 * kb.scale}px "Plex Mono", ui-monospace, monospace`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    for (const [code, k] of kb.keys) {
      const at = kb.glow.get(code);
      const glow = at === undefined ? 0 : clamp(1 - (now - at) / 260, 0, 1);
      g.fillStyle = `rgba(${glow > 0 ? c.accent : c.ink},${((0.2 + 0.75 * glow) * vis).toFixed(3)})`;
      if (k.wide) g.fillRect(Math.round(k.x - k.wide / 2), Math.round(k.y) - (glow > 0 ? 1 : 0), Math.round(k.wide), glow > 0 ? 2 : 1);
      else g.fillText(kb.labels.get(code) || "", k.x, k.y + 1 + 12 * kb.scale * (EM_TOP - 0.5));
    }
    g.textAlign = "left";
  }

  function frameOf(pts) {
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    return [Math.min(...xs) - 6, Math.min(...ys) - 6, Math.max(...xs) + 6, Math.max(...ys) + 6];
  }

  function drawHand(g, pts, vis, now, tips, label, side, c) {
    g.lineWidth = 0.75;
    g.strokeStyle = `rgba(${c.ink},${(0.4 * vis).toFixed(3)})`;
    g.beginPath();
    for (const [a, b] of BONES) {
      g.moveTo(pts[a][0], pts[a][1]);
      g.lineTo(pts[b][0], pts[b][1]);
    }
    g.stroke();
    pts.forEach(([x, y], k) => {
      const tip = tips && k > 0 && k % 4 === 0 ? tips[k / 4 - 1] : null;
      const on = tip && now < tip.until;
      const s = on ? 4 : 2;
      g.fillStyle = on ? `rgba(${c.accent},${vis.toFixed(3)})` : `rgba(${c.ink},${(0.8 * vis).toFixed(3)})`;
      g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    });
    const b = frameOf(pts);
    g.strokeStyle = `rgba(${c.ink},${(0.28 * vis).toFixed(3)})`;
    g.strokeRect(Math.round(b[0]) + 0.5, Math.round(b[1]) + 0.5, Math.round(b[2] - b[0]), Math.round(b[3] - b[1]));
    g.font = `8px "Plex Mono", ui-monospace, monospace`;
    const w = g.measureText(label).width;
    g.fillStyle = `rgba(${c.ink},${(0.7 * vis).toFixed(3)})`;
    if (sideLabels) {
      // outside the box, level with the home row: left hand's label to its left, right hand's to its right
      const y = Math.round(Math.max(b[1] + 8, kb.home + 3 * kb.scale));
      g.fillText(label, Math.round(side === 0 ? b[0] - 8 - w : b[2] + 8), y);
    } else g.fillText(label, Math.round(side === 0 ? b[0] : b[2] - w), Math.round(b[1] - 5));
  }

  function drawMouse(g, vis, now, c, W, H) {
    const m = kb.mouse;
    const mx = m.x + desk.ox.value;
    const my = m.y + desk.oy.value;
    const { w, h } = m;
    const a = vis * (0.35 + 0.65 * desk.mouse.value);
    g.lineWidth = 0.9;
    g.strokeStyle = `rgba(${c.ink},${(0.55 * a).toFixed(3)})`;
    g.beginPath();
    g.roundRect(mx - w / 2, my - h / 2, w, h, w / 2);
    g.stroke();
    g.beginPath();
    g.moveTo(mx, my - h / 2);
    g.lineTo(mx, my - h * 0.1);
    g.moveTo(mx - w / 2, my - h * 0.1);
    g.lineTo(mx + w / 2, my - h * 0.1);
    g.stroke();
    for (let side = 0; side < 2; side++) {
      if (kb.clicks[side] <= now) continue;
      g.fillStyle = `rgba(${c.accent},${(0.55 * a).toFixed(3)})`;
      g.beginPath();
      if (side === 0) g.roundRect(mx - w / 2 + 1, my - h / 2 + 1, w / 2 - 1.5, h * 0.4 - 1.5, [w / 2, 0, 0, 0]);
      else g.roundRect(mx + 0.5, my - h / 2 + 1, w / 2 - 1.5, h * 0.4 - 1.5, [0, w / 2, 0, 0]);
      g.fill();
    }
    g.fillStyle = `rgba(${c.ink},${(0.6 * a).toFixed(3)})`;
    g.fillRect(Math.round(mx - 1), Math.round(my - h * 0.36), 2, Math.round(h * 0.12));
    const shown = pointer.ghost && now - pointer.ghost.at < 1600 ? pointer.ghost : pointer;
    if (desk.mouse.value > 0.4 && shown.x >= 0) {
      g.font = `8px "Plex Mono", ui-monospace, monospace`;
      g.fillStyle = `rgba(${c.ink},${(0.7 * a * desk.mouse.value).toFixed(3)})`;
      [`['mouse:u'] ${(shown.x / W).toFixed(7)}`, (shown.y / H).toFixed(7)].forEach((line, k) => g.fillText(line, Math.round(mx + w / 2 + 12), Math.round(my - h / 2 + 6 + k * 9)));
    }
    return [mx, my];
  }

  /* returns true while anything is still moving or visible */
  function draw(g, now, dt, c, W, H) {
    if (!kb) return false;
    const active = always || now - desk.lastAt < idle;
    desk.vis.target = active ? 1 : 0;
    desk.mouse.target = kb.mouse && desk.mode === "mouse" && now - desk.lastAt < idle ? 1 : 0;
    let moving = !advance(desk.vis, dt);
    if (!advance(desk.mouse, dt)) moving = true;
    pointer.drift = pointer.drift.map((v) => v * Math.pow(0.02, dt));
    desk.ox.target = clamp(pointer.drift[0], -28, 28) * kb.scale;
    desk.oy.target = clamp(pointer.drift[1], -16, 16) * kb.scale;
    if (!advance(desk.ox, dt) || !advance(desk.oy, dt)) moving = true;
    if (step(now, dt)) moving = true;
    const vis = desk.vis.value;
    if (vis < 0.01) return moving || active;
    drawKeys(g, vis, now, c);
    const mouseAt = kb.mouse ? drawMouse(g, vis, now, c, W, H) : null;
    const [left, right] = hands;
    drawHand(g, left.points, vis, now, left.tips, `['hand0:u'] ${(left.points[0][0] / W).toFixed(7)}`, 0, c);
    let pts = right.points;
    if (mouseAt && desk.mouse.value > 0.001) {
      const pose = mousePose(mouseAt[0], mouseAt[1]);
      pts = pts.map((p, k) => lerp(p, pose[k], desk.mouse.value));
    }
    drawHand(g, pts, vis, now, desk.mouse.value > 0.5 ? null : right.tips, `['hand1:u'] ${(pts[0][0] / W).toFixed(7)}`, 1, c);
    return moving || active;
  }

  return {
    place,
    press,
    pressChar,
    pressCode: press,
    pointerMove,
    click,
    draw,
    ghostPointer(x, y) {
      pointer.ghost = { x, y, at: performance.now() };
      desk.mode = "mouse";
      desk.lastAt = performance.now();
    },
    nudge(dx, dy) {
      pointer.drift[0] += dx;
      pointer.drift[1] += dy;
      desk.lastAt = performance.now();
    },
    keysMode() {
      desk.mode = "keys";
    },
    get layout() {
      return kb;
    },
    get visible() {
      return desk.vis.value;
    },
  };
}
