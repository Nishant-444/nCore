/* terminal: plays a spec of shell blocks into the buffer — prompt, a typed command, then its output */
import { reduced, narrow, sleep, between, make } from "../shared/common.js";

const PACE = { key: [18, 34], enter: 170, line: 14, gap: 260 };
const RUN = { every: 3800, hold: 8000 };
const CAL = { key: [18, 18], day: 28, month: 350 };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* segments: "text" | [text, className, href] | { node: () => Node } | { letter } */
function fill(parent, segments) {
  for (const s of segments) {
    if (typeof s === "string") parent.append(s);
    else if (s.node) parent.append(s.node());
    else if (!Array.isArray(s)) parent.append(make("span", "t-glyph", (s.letter || "?").slice(0, 1)));
    else {
      const [text, cls, href] = s;
      if (href) {
        const a = make("a", `md-link${cls ? ` ${cls}` : ""}`, text);
        a.href = href;
        if (!href.startsWith("#")) {
          a.target = "_blank";
          a.rel = "noopener";
        }
        parent.append(a);
      } else parent.append(make("span", cls, text));
    }
  }
}
export function row(segments, cls = "") {
  const line = make("div", `ln term${cls ? ` ${cls}` : ""}`);
  const tx = make("span", "tx");
  fill(tx, segments);
  line.append(tx);
  return line;
}
export const prompt = (cwd, branch) => [[SITE.user, "t-user"], [`@${SITE.host}`, "t-host"], " ", [cwd, "t-path"], ...(branch ? [" ", [`(${branch})`, "t-git"]] : [])];

function buildCalendar({ days, done }) {
  const offset = (new Date(`${days[0][0]}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weeks = Math.ceil((days.length + offset) / 7);
  const block = make("div", "t-cal");
  block.setAttribute("aria-hidden", "true");
  block.style.setProperty("--weeks", String(weeks));
  const put = (node, r, c) => {
    node.style.gridRow = String(r);
    node.style.gridColumn = String(c);
    block.append(node);
  };
  WEEKDAYS.forEach((label, r) => put(make("span", "t-cal-day", label), r + 2, 1));
  for (let w = 0; w < weeks; w += 4) put(make("span", "t-cal-week", `W${String(w + 1).padStart(2, "0")}`), 9, w + 2);
  const cells = [];
  const steps = [];
  days.forEach(([date, count, level], k) => {
    const slot = k + offset;
    const cell = make("i", `l${level}`);
    cell.dataset.tip = `${date} · ${count} contribution${count === 1 ? "" : "s"}`;
    put(cell, (slot % 7) + 2, Math.floor(slot / 7) + 2);
    cells.push(cell);
    const month = date.slice(0, 7);
    if (steps.at(-1)?.month !== month) {
      steps.push({ month, first: k, last: k, total: 0, busiest: 0 });
      put(make("span", "t-cal-month", new Date(`${date}T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" })), 1, Math.floor(slot / 7) + 2);
    }
    const st = steps.at(-1);
    st.last = k;
    st.total += count;
    st.busiest = Math.max(st.busiest, count);
  });
  const legend = make("p", "t-cal-legend");
  legend.append("none");
  for (let l = 0; l <= 4; l++) legend.append(make("i", `l${l}`));
  legend.append("more");
  put(legend, 10, `1 / span ${weeks + 1}`);
  const code = make("div", "t-code");
  code.setAttribute("aria-hidden", "true");
  for (const st of steps) code.append(make("span", "t-measure", `renderMonth${monthText(st)} `));
  const live = make("span", "t-live");
  const args = make("span", "t-args");
  live.append(make("span", "t-call", "renderMonth"), args);
  code.append(live);
  return { block, code, live, args, cells, steps, done };
}
function monthParts(st) {
  const syn = (t) => [t, "t-syn"];
  return [syn("("), syn(`"${st.month}"`), syn(", { "), ["total", ""], syn(": "), [String(st.total), ""], syn(", "), ["busiest", ""], syn(": "), [String(st.busiest), ""], syn(" });")];
}
const monthText = (st) => monthParts(st).map(([t]) => t).join("");

export function createTerminal(buffer, { watch, lightbox, onTyping }) {
  let token = 0;
  let viewer = null;
  let hero = null;
  let mounts = [];

  function stopViewer() {
    viewer?.observer.disconnect();
  }

  function pace() {
    if (!viewer) return;
    viewer.run.firstChild.style.animationPlayState = viewer.hover || !viewer.visible || document.hidden ? "paused" : "running";
  }
  function restart(hold) {
    const { run, shots } = viewer;
    if (shots.length < 2 || reduced.matches) return;
    run.classList.remove("is-running");
    void run.offsetWidth;
    run.style.setProperty("--run", `${hold ? RUN.hold : RUN.every}ms`);
    run.classList.add("is-running");
    pace();
  }
  function go(k, manual) {
    if (!viewer || viewer.shots.length < 2) return false;
    const n = viewer.shots.length;
    showShot(((k % n) + n) % n);
    restart(manual);
    return true;
  }

  function buildViewer(shots) {
    const fig = make("figure", "term-shot");
    const cap = make("figcaption");
    const name = make("span", "t-name");
    const count = make("span", "t-count");
    const help = make("span", "t-help", shots.length > 1 ? (matchMedia("(pointer: fine)").matches ? "←→ shot" : "swipe") : "");
    cap.append(name, count, help);
    const frame = make("div", "frame");
    const imgs = [make("img"), make("img")];
    for (const img of imgs) {
      img.decoding = "async";
      img.draggable = false;
      img.alt = "";
      frame.append(img);
    }
    const run = make("span", "t-run");
    run.append(make("i"));
    const dots = make("p", "t-dots");
    const buttons = shots.map((_, k) => {
      const b = make("button", "t-dot", String(k + 1));
      b.type = "button";
      b.setAttribute("aria-label", `Shot ${k + 1} of ${shots.length}`);
      b.addEventListener("click", () => go(k, true));
      dots.append(b);
      return b;
    });
    fig.append(cap, frame);
    if (shots.length > 1) fig.append(run, dots);
    const v = { fig, name, count, frame, imgs, front: 0, run, buttons, shots, at: -1, hover: false, visible: true, observer: null };
    frame.addEventListener("click", () => v.at >= 0 && lightbox?.open(v.shots[v.at]));
    frame.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") {
        v.hover = true;
        pace();
      }
    });
    frame.addEventListener("pointerleave", () => {
      v.hover = false;
      pace();
    });
    let swipe = null;
    frame.addEventListener("pointerdown", (e) => e.pointerType !== "mouse" && (swipe = { x: e.clientX, y: e.clientY }));
    frame.addEventListener("pointerup", (e) => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4 && viewer === v) go(v.at + (dx < 0 ? 1 : -1), true);
    });
    run.addEventListener("animationend", () => viewer === v && go(v.at + 1, false));
    v.observer = new IntersectionObserver(([en]) => {
      v.visible = en.isIntersecting;
      pace();
    });
    v.observer.observe(frame);
    return v;
  }

  function showShot(k) {
    const v = viewer;
    if (!v || !v.shots[k] || v.at === k) return;
    v.at = k;
    const shot = v.shots[k];
    const back = v.imgs[1 - v.front];
    const front = v.imgs[v.front];
    const reveal = () => {
      back.onload = back.onerror = null;
      if (viewer !== v || v.at !== k) return;
      back.alt = shot.alt;
      front.alt = "";
      back.classList.add("is-on");
      front.classList.remove("is-on");
      v.front = 1 - v.front;
    };
    if (back.getAttribute("src") === shot.file && back.complete && back.naturalWidth) reveal();
    else {
      back.onload = back.onerror = reveal;
      back.src = shot.file;
    }
    v.name.textContent = shot.name;
    v.count.textContent = v.shots.length > 1 ? `${k + 1}/${v.shots.length}` : "";
    v.buttons.forEach((b, j) => b.setAttribute("aria-current", String(j === k)));
  }
  document.addEventListener("visibilitychange", pace);

  async function type(target, text, mine, p = PACE.key) {
    for (let n = 1; n <= text.length; n++) {
      if (mine !== token) return false;
      target.textContent = text.slice(0, n);
      watch()?.pressChar(text[n - 1]);
      const r = target.getBoundingClientRect();
      if (r.width) watch()?.focus(r.right + 3, r.top + r.height / 2);
      await sleep(between(...p));
    }
    return mine === token;
  }

  async function calendar(cal, mine, instant) {
    if (instant) {
      cal.cells.forEach((c) => c.classList.add("is-on"));
      cal.live.replaceChildren(make("span", "t-done", cal.done));
      return true;
    }
    let head = null;
    for (const st of cal.steps) {
      cal.args.replaceChildren();
      cal.code.classList.add("is-typing");
      for (const [text, cls] of monthParts(st)) {
        const part = make("span", cls);
        cal.args.append(part);
        if (!(await type(part, text, mine, CAL.key))) return false;
      }
      cal.code.classList.remove("is-typing");
      for (let k = st.first; k <= st.last; k++) {
        if (mine !== token) return false;
        head?.classList.remove("is-head");
        head = cal.cells[k];
        head.classList.add("is-on", "is-head");
        const r = head.getBoundingClientRect();
        if (r.width) watch()?.focus(r.left + r.width / 2, r.top + r.height / 2);
        await sleep(CAL.day);
      }
      await sleep(CAL.month);
    }
    head?.classList.remove("is-head");
    if (mine === token) cal.live.replaceChildren(make("span", "t-done", cal.done));
    return mine === token;
  }

  async function play(spec, mine) {
    const instant = reduced.matches;
    if (!instant) onTyping?.(true);
    try {
      for (const block of spec.blocks) {
        if (mine !== token) return;
        buffer.append(row(prompt(spec.cwd, spec.branch), "t-prompt-row"));
        const cmd = make("span", "t-cmd");
        const line = row([["› ", "t-caret"]]);
        line.firstChild.append(cmd);
        buffer.append(line);
        if (instant) cmd.textContent = block.cmd;
        else {
          await sleep(PACE.gap);
          if (!(await type(cmd, block.cmd, mine))) return;
          await sleep(PACE.enter);
          if (mine !== token) return;
          watch()?.pressKey("Enter");
        }
        if (block.link) {
          cmd.replaceChildren(block.cmd.slice(0, block.cmd.length - block.link.text.length));
          fill(cmd, [[block.link.text, "", block.link.href]]);
        }
        for (const out of block.out || []) {
          if (mine !== token) return;
          buffer.append(row(out.segments, out.className));
          if (!instant) await sleep(PACE.line);
        }
        if (block.mount && mine === token) {
          const host = make("div", "t-mount");
          buffer.append(host);
          mounts.push(block.mount(host));
        }
        if (block.calendar && mine === token) {
          const cal = buildCalendar(block.calendar);
          buffer.append(cal.code, cal.block);
          if (!(await calendar(cal, mine, instant))) return;
        }
        if (block.viewer && viewer && mine === token) {
          buffer.append(viewer.fig);
          showShot(0);
          restart(false);
        }
      }
      if (mine !== token) return;
      buffer.append(row(prompt(spec.cwd, spec.branch), "t-prompt-row"), row([["› ", "t-caret"], ["", "t-cursor"]], "t-idle"));
    } finally {
      if (mine === token) onTyping?.(false);
    }
  }

  function destroy() {
    token++;
    onTyping?.(false);
    stopViewer();
    for (const stop of mounts) stop?.();
    mounts = [];
    hero?.destroy?.();
    hero = null;
    viewer = null;
  }

  return {
    show(spec) {
      destroy();
      const mine = token;
      viewer = spec.shots?.length ? buildViewer(spec.shots) : null;
      buffer.replaceChildren();
      if (spec.hero) {
        const host = make("div", "wave");
        buffer.append(host);
        hero = spec.hero(host);
      }
      for (const out of spec.head || []) buffer.append(row(out.segments, out.className));
      play(spec, mine);
      return hero;
    },
    step: (d) => (viewer?.at >= 0 ? go(viewer.at + d, true) : false),
    zoom: () => (viewer?.at >= 0 ? (lightbox?.open(viewer.shots[viewer.at]), true) : false),
    recolor: () => hero?.recolor?.(),
    destroy,
  };
}
