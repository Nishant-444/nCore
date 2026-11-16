/* watch: one overlay canvas for the eye in the corner, the desk under the bar, and the worm.
   The worm eats words out of the buffer; the ghost notices and types them back. */
import { reduced, finePointer, narrow, sleep, clamp, between, rgbOf, cssVar, TAU } from "../shared/common.js";
import { createDesk } from "../shared/desk.js";
import { createEye } from "../shared/eye.js";

const FOCUS_MS = 1400;
const POINTER_MS = 2500;
const WORD = /[A-Za-z][\w.+#-]*[A-Za-z0-9]/g;
const STOP = new Set("the and for with you this that from are can into your all not has its our was but use via one out any how".split(" "));
const BODY = { segments: 22, gap: 4.2, radius: 4.2, speed: 95 };
const REPAIR = { idle: 1200, wait: [4000, 6500] };

export function createWatch({ layer, deskHost, eyeHost, buffer, onState, den, wormOn = false }) {
  const g = layer.getContext("2d");
  const colors = { ink: "216,212,180", accent: "216,212,180", bg: "#0c0c0c", worm: "104,158,128" };
  const desk = createDesk({ idle: 2200 });
  const eye = createEye({ text: "·" });
  const pointer = { x: -1, y: -1, at: -Infinity };
  const focus = { x: 0, y: 0, at: -Infinity };
  let W = 0;
  let H = 0;
  let raf = 0;
  let last = 0;
  let stateKey = "";
  let repairing = false;
  let typedAt = -Infinity;
  let externalAt = -Infinity;
  let flashes = [];
  let caret = null;

  /* ---------------- the worm ---------------- */
  const eaten = typeof Highlight === "function" && CSS.highlights ? new Highlight() : null;
  if (eaten) CSS.highlights.set("worm-eaten", eaten);
  const bites = []; // { range, ch, at }
  const worm = { on: wormOn, state: wormOn ? "lurking" : "asleep", seg: [], target: null, label: "", nextAt: 0, ate: 0 };

  function denPoint() {
    const r = den?.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + 4 } : { x: W - 40, y: H - 220 };
  }
  function findWord() {
    const box = buffer.getBoundingClientRect();
    const walker = document.createTreeWalker(buffer, NodeFilter.SHOW_TEXT);
    const found = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest(".t-cmd, .t-cal, .t-code, a")) continue;
      for (const m of node.data.matchAll(WORD)) {
        if (m[0].length < 4 || STOP.has(m[0].toLowerCase())) continue;
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const r = range.getBoundingClientRect();
        if (!r.width || r.top < box.top + 8 || r.bottom > box.bottom - 8 || r.right > box.right - 6) continue;
        if (bites.some((b) => b.range.startContainer === node && b.range.startOffset >= m.index && b.range.startOffset < m.index + m[0].length)) continue;
        found.push({ node, start: m.index, word: m[0], rect: r });
      }
    }
    return found.length ? found[Math.floor(Math.random() * Math.min(found.length, 40))] : null;
  }
  function wake(now) {
    worm.on = true;
    const p = denPoint();
    worm.seg = Array.from({ length: BODY.segments }, (_, k) => ({ x: p.x, y: p.y + k * 0.5 }));
    worm.state = "crawling";
    worm.nextAt = now;
    worm.target = null;
    loop();
  }
  function sleepWorm() {
    worm.on = false;
    if (worm.state !== "asleep") worm.state = "going home";
    worm.target = { home: true, ...denPoint() };
    loop();
  }
  function stepWorm(now, dt) {
    if (worm.state === "asleep" || !worm.seg.length) return false;
    const head = worm.seg[0];
    if (worm.state === "crawling" && !worm.target && now >= worm.nextAt) {
      const w = findWord();
      if (w) {
        worm.target = { x: w.rect.left - 2, y: w.rect.top + w.rect.height / 2, word: w };
        worm.label = `hunting "${w.word}"`;
      } else worm.nextAt = now + 1500;
    }
    let tx = head.x + Math.cos(now / 700) * 20;
    let ty = head.y + Math.sin(now / 900) * 12;
    if (worm.target) {
      tx = worm.target.x;
      ty = worm.target.y;
    }
    const dx = tx - head.x;
    const dy = ty - head.y;
    const dist = Math.hypot(dx, dy);
    const speed = BODY.speed * (worm.state === "eating" ? 0.25 : 1) * (reduced.matches ? 4 : 1);
    if (dist > 1) {
      const step = Math.min(dist, speed * dt);
      const wig = Math.sin(now / 110) * 0.5;
      head.x += (dx / dist) * step - (dy / dist) * wig;
      head.y += (dy / dist) * step + (dx / dist) * wig;
    }
    for (let k = 1; k < worm.seg.length; k++) {
      const a = worm.seg[k - 1];
      const b = worm.seg[k];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      if (l > BODY.gap) {
        b.x = a.x + ((b.x - a.x) / l) * BODY.gap;
        b.y = a.y + ((b.y - a.y) / l) * BODY.gap;
      }
    }
    if (worm.target?.home && dist < 2) {
      worm.state = "asleep";
      worm.seg = [];
      worm.target = null;
      worm.label = "";
      return false;
    }
    if (worm.state === "crawling" && worm.target?.word && dist < 3) {
      worm.state = "eating";
      worm.label = `eating "${worm.target.word.word}"`;
      eat(worm.target.word);
    }
    return true;
  }
  async function eat(w) {
    for (let k = 0; k < w.word.length; k++) {
      if (worm.state !== "eating") return;
      const range = document.createRange();
      try {
        range.setStart(w.node, w.start + k);
        range.setEnd(w.node, w.start + k + 1);
      } catch {
        break;
      }
      bites.push({ range, ch: w.word[k], at: performance.now() });
      eaten?.add(range);
      const r = range.getBoundingClientRect();
      if (worm.target) worm.target.x = r.right + 1;
      await sleep(reduced.matches ? 0 : between(110, 190));
    }
    if (worm.state !== "eating") return;
    worm.ate++;
    worm.target = null;
    worm.label = "";
    worm.state = "crawling";
    worm.nextAt = performance.now() + between(900, 2200);
  }
  function drawWorm(now) {
    if (!worm.seg.length) return;
    const n = worm.seg.length;
    for (let k = n - 1; k >= 0; k--) {
      const s = worm.seg[k];
      const t = k / (n - 1);
      const r = BODY.radius * (k === 0 ? 1.05 : 1 - 0.65 * t) * (1 + 0.08 * Math.sin(now / 160 - k * 0.7));
      g.fillStyle = `rgba(${colors.worm},${(0.95 - 0.35 * t).toFixed(3)})`;
      g.beginPath();
      g.arc(s.x, s.y, r, 0, TAU);
      g.fill();
      if (k % 3 === 1) {
        g.strokeStyle = `rgba(${colors.bg},0.55)`;
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(s.x, s.y, r * 0.7, 0, TAU);
        g.stroke();
      }
    }
    const h = worm.seg[0];
    const nx = worm.seg[1] || h;
    const a = Math.atan2(h.y - nx.y, h.x - nx.x);
    g.fillStyle = colors.bg;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(h.x + Math.cos(a + side * 0.7) * 2.2, h.y + Math.sin(a + side * 0.7) * 2.2, 0.9, 0, TAU);
      g.fill();
    }
  }

  /* the ghost types eaten letters back */
  async function repair() {
    if (repairing || !bites.length || document.hidden) return;
    const now = performance.now();
    if (now - externalAt < REPAIR.idle || now - pointer.at < REPAIR.idle) return;
    const due = bites.filter((b) => now - b.at > between(...REPAIR.wait));
    if (!due.length) return;
    const node = due[0].range.startContainer;
    const word = bites.filter((b) => b.range.startContainer === node).sort((p, q) => p.range.startOffset - q.range.startOffset);
    repairing = true;
    report(performance.now());
    const first = word[0].range.getBoundingClientRect();
    if (desk.layout?.mouse) {
      desk.ghostPointer(first.left, first.top + first.height / 2);
      for (let k = 0; k < 4; k++) {
        desk.nudge((k % 2 ? -1 : 1) * between(6, 14), between(-5, 5));
        await sleep(90);
      }
      desk.click(0);
    }
    caret = { range: word[0].range, before: true };
    setFocus(first.left, first.top + first.height / 2);
    await sleep(420);
    desk.keysMode();
    for (const b of word) {
      desk.pressChar(b.ch);
      eaten?.delete(b.range);
      bites.splice(bites.indexOf(b), 1);
      flashes.push({ range: b.range, ch: b.ch, at: performance.now() });
      caret = { range: b.range, before: false };
      const r = b.range.getBoundingClientRect();
      setFocus(r.right + 2, r.top + r.height / 2);
      typedAt = performance.now();
      await sleep(between(70, 150) + (Math.random() < 0.12 ? between(200, 420) : 0));
    }
    await sleep(320);
    caret = null;
    repairing = false;
    loop();
  }
  function drawRepair(now) {
    flashes = flashes.filter((f) => now - f.at < 650);
    if (!flashes.length && !caret) return false;
    g.font = `12px "Plex Mono", ui-monospace, monospace`;
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    for (const f of flashes) {
      const r = f.range.getBoundingClientRect();
      if (!r.width) continue;
      g.fillStyle = `rgba(${colors.accent},${(1 - (now - f.at) / 650).toFixed(3)})`;
      g.fillText(f.ch, r.left, r.top + 12 * 1.025);
    }
    if (caret) {
      const r = caret.range.getBoundingClientRect();
      if (r.width && (now - typedAt < 500 || Math.floor(now / 530) % 2 === 0)) {
        g.fillStyle = `rgba(${colors.accent},0.95)`;
        g.fillRect(Math.round(caret.before ? r.left : r.right), Math.round(r.top + (r.height - 13) / 2), 1.5, 13);
      }
    }
    return true;
  }

  /* ---------------- eye, desk, frame ---------------- */
  function recolor() {
    colors.ink = rgbOf(cssVar("--ink"));
    colors.accent = rgbOf(cssVar("--accent"));
    colors.bg = cssVar("--bg") || "#0c0c0c";
    const ink = cssVar("--ink");
    const pick = ["--num", "--kw", "--ty", "--fn", "--str"].map((n) => cssVar(n)).find((v) => v && v.toLowerCase() !== ink.toLowerCase() && v.toLowerCase() !== cssVar("--accent").toLowerCase());
    colors.worm = rgbOf(pick || ink);
    den?.style.setProperty("--worm", colors.worm);
    loop();
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    layer.width = Math.round(W * dpr);
    layer.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = deskHost.getBoundingClientRect();
    if (r.width && r.height) desk.place(r);
    loop();
  }
  function eyeBox() {
    const r = eyeHost.getBoundingClientRect();
    if (r.width < 60 || r.height < 36) return null;
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
  }
  function setFocus(x, y) {
    focus.x = x;
    focus.y = y;
    focus.at = performance.now();
    loop();
  }

  function report(now) {
    const sight = eye.state === "closed" ? "closed" : now - focus.at < FOCUS_MS ? "focused" : "tracking";
    const hot = worm.state === "eating";
    const next = [worm.state, worm.label, sight, repairing].join("|");
    if (next === stateKey) return;
    stateKey = next;
    onState?.({ worm: { text: worm.state, hot, label: worm.label }, eye: { text: sight, hot: false }, ghost: repairing ? "repairing" : "idle" });
  }

  function tick(now) {
    raf = 0;
    if (document.hidden) {
      last = 0;
      return;
    }
    const dt = last ? clamp((now - last) / 1000, 0, 0.1) : 1 / 60;
    last = now;
    g.clearRect(0, 0, W, H);
    const box = eyeBox();
    eye.setOpen(Boolean(box) && (finePointer.matches || now - pointer.at > 6000));
    const hasFocus = now - focus.at < FOCUS_MS;
    const hunting = finePointer.matches && pointer.x >= 0 && now - pointer.at < POINTER_MS;
    const head = worm.seg[0];
    const aim = hasFocus ? [focus.x, focus.y] : hunting ? [pointer.x, pointer.y] : head ? [head.x, head.y] : null;
    const eyeBusy = eye.step(box, now, dt, aim, hasFocus);
    const wormBusy = stepWorm(now, dt);
    drawWorm(now);
    const repairBusy = drawRepair(now);
    if (box) {
      eye.draw(g, box, now, colors);
      const targets = [];
      if (hasFocus) targets.push({ x: focus.x, y: focus.y });
      if (hunting) targets.push({ x: pointer.x, y: pointer.y });
      if (!narrow.matches) eye.drawTrack(g, box, now, colors, { targets, W, H });
    }
    const deskBusy = deskHost.getBoundingClientRect().height > 0 ? desk.draw(g, now, dt, colors, W, H) : false;
    report(now);
    if (eyeBusy || wormBusy || repairBusy || deskBusy || flashes.length) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  function loop() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.at = performance.now();
    desk.pointerMove(e.clientX, e.clientY);
    loop();
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") desk.click(e.button);
    loop();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => (pointer.at = -Infinity));
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", loop);
  new ResizeObserver(resize).observe(deskHost);
  buffer.addEventListener("scroll", loop, { passive: true });
  setInterval(loop, 1500);
  setInterval(repair, 500);
  recolor();
  resize();
  if (wormOn) wake(performance.now());

  return {
    pressKey(code, shift = false) {
      externalAt = performance.now();
      desk.press(code, shift);
      loop();
    },
    pressChar(ch) {
      externalAt = performance.now();
      desk.pressChar(ch);
      loop();
    },
    focus: setFocus,
    setText(value) {
      eye.setText(value);
      for (const b of bites.splice(0)) eaten?.delete(b.range);
      if (worm.state === "eating") {
        worm.state = "crawling";
        worm.target = null;
        worm.label = "";
      }
      loop();
    },
    recolor,
    setWorm(on) {
      if (on) wake(performance.now());
      else sleepWorm();
    },
  };
}
