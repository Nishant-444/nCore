/* intro: a quiet wall of code with a ghost at the keyboard. Enter dives into the editor at site/. */
import { reduced, finePointer, sleep, clamp, between, smooth, key, rgbOf, palettes, savedTheme, rememberTheme, mix, spring, advance, EM_TOP } from "./shared/common.js";
import { createDesk } from "./shared/desk.js";
import { createEye } from "./shared/eye.js";
import { createPicker } from "./shared/picker.js";

const CELL_W = 7.2;
const CELL_H = 13;
const FONT_PX = 12;
const GLYPH_Y = 1 + FONT_PX * EM_TOP;
const cellX = (c) => Math.round(c * CELL_W);
const GUTTER = 5;
const VIEW = { cols: 112, top: 0.12, ramp: 2 };
const KIND_ALPHA = { keyword: 0.75, string: 0.66, number: 0.75, function: 0.79, type: 0.7, comment: 0.48, member: 0.35, ident: 0.31, punct: 0.26 };
const KEYWORDS = new Set(
  "import export from as default const let var function return if else for while do switch case break continue new delete typeof instanceof in of true false null undefined this async await yield class extends public private protected static final void bool int char auto namespace include struct std try catch throw def elif pass lambda with not and or is None True False interface type enum package".split(" "),
);
const COMMENT = { python: "#", js: "//", c: "//", text: null };
const GLYPHS = "░▒▓/\\<>+=*#%&@$0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NEAR = { ";": ":", ":": ";", "(": "[", ")": "]", "[": "(", "]": ")", "{": "[", "}": "]", "=": "-", "-": "=", ".": ",", ",": ".", '"': "'", "'": '"', "<": ",", ">": ".", _: "-", "/": "?", "+": "=" };
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const CYCLE = { first: [700, 1100], pause: [1000, 1000], retry: 4000, restart: 7000 };
const BOOT = { command: "nvim ~/Projects", blinks: 3, reveal: 700 };
const DIVE = { count: 6000, phone: 3000, buckets: 10, ms: 1700 };
const TILE = { cols: 40, rows: 13, dwell: 900, life: 9000 };
const FACE = { seed: 280, hold: 6000 };
const MSG_ALPHA = 0.97;
const MESSAGES = INTRO.messages;

const $ = (s) => document.querySelector(s);
const wallCanvas = $(".wall");
const tileCanvas = $(".tile");
const machine = $(".machine");
const statusLine = $(".status:not(.pane-status)");
const cmdLine = $(".cmdline:not(.pane-cmd)");
const paneStatus = $(".pane-status");
const paneCmd = $(".pane-cmd");
const enterLink = $(".enter");
const themeKey = $(".theme-key");
const noteLine = $(".note");
const brandLink = $(".brand");
const switchNav = $(".switch");
const glass = $(".kb-glass");

/* frosted pane behind the keyboard + hands, sized to the desk's key extents */
function placeGlass() {
  if (!glass) return;
  const kb = wall.kb && desk?.layout;
  if (!kb) {
    glass.style.display = "none";
    return;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const k of kb.keys.values()) {
    const half = k.wide ? k.wide / 2 : 3.6 * kb.scale;
    lo = Math.min(lo, k.x - half);
    hi = Math.max(hi, k.x + half);
  }
  // wide enough to sit under the side labels; stops a few rows above the hands' wrists
  const x0 = Math.round(lo - 17 * CELL_W);
  const x1 = Math.round(hi + 17 * CELL_W);
  const y0 = Math.round(kb.top - CELL_H);
  const y1 = Math.round(kb.bottom - 3 * CELL_H);
  Object.assign(glass.style, { display: "block", left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
}

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
// global pace for the ghost: every beat and keystroke runs at half its nominal length
const TEMPO = 0.5;
const beat = (a, b = a) => (reduced.matches ? 0 : between(a, b) * TEMPO);

/* ---------------- theme ---------------- */
const look = { theme: null, tints: {}, ink: "216,212,180", accent: "216,212,180", glow: "216,212,180", note: "168,163,133", bg: "#0c0c0c" };

function liftRgb(hex, light) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const floor = light ? Math.min(l, 0.42) : Math.max(l, 0.62);
  if (floor === l) return rgbOf(hex);
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  const c = (1 - Math.abs(2 * floor - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const m = floor - c / 2;
  return [r1, g1, b1].map((v) => Math.round((v + m) * 255)).join(",");
}

function useTheme(name) {
  const theme = palettes.get(key(name)) || palettes.get("blackmoney");
  const fg = theme.fg || theme.kinds.text;
  look.theme = theme;
  look.tints = Object.fromEntries(Object.entries(theme.kinds).map(([k, v]) => [k, rgbOf(v)]));
  for (const k of ["ident", "member", "punct", "text"]) look.tints[k] ||= rgbOf(fg);
  look.ink = rgbOf(fg);
  look.accent = rgbOf(theme.accent);
  look.glow = liftRgb(theme.accent, theme.light);
  look.note = liftRgb(theme.kinds.comment || fg, theme.light);
  look.bg = theme.bg;
  const s = document.body.style;
  s.setProperty("--bg", theme.bg);
  s.setProperty("--ink", fg);
  s.setProperty("--chrome", mix(fg, theme.bg, 0.3));
  s.setProperty("--dim", theme.kinds.comment || mix(fg, theme.bg, 0.55));
  s.setProperty("--accent", `rgb(${look.glow})`);
  s.setProperty("--line", theme.cursorline || theme.bg);
  s.setProperty("--insert", `rgb(${liftRgb(theme.kinds.string || theme.accent, theme.light)})`);
  document.documentElement.style.colorScheme = theme.light ? "light" : "dark";
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = theme.bg;
  if (wall) {
    restyleRows();
    renderPane();
    paintAll();
  }
}

/* ---------------- source rows ---------------- */
function tokenize(line, lang) {
  const kinds = new Array(line.length).fill("ident");
  const marker = COMMENT[lang];
  const trimmed = line.trimStart();
  if (trimmed.startsWith("/*") || trimmed.startsWith("* ") || trimmed.startsWith("*/")) return kinds.fill("comment");
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`?)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$@][\w$.]*)|(\s+)|([^\sA-Za-z0-9_])/g;
  let m;
  while ((m = re.exec(line))) {
    const [tok, str, num, fn, word, ws] = m;
    if (!str && marker && line.startsWith(marker, m.index)) {
      kinds.fill("comment", m.index);
      break;
    }
    const kind = str ? "string" : num ? "number" : fn ? (KEYWORDS.has(fn) ? "keyword" : "function") : word ? (KEYWORDS.has(word) ? "keyword" : /^@|^[A-Z]/.test(word) ? "type" : word.includes(".") ? "member" : "ident") : ws ? "ident" : "punct";
    kinds.fill(kind, m.index, m.index + tok.length);
  }
  return kinds;
}

const files = INTRO_FILES.map((f) => ({ ...f, count: f.lines.length }));
for (let k = files.length - 1; k > 0; k--) {
  const j = Math.floor(Math.random() * (k + 1));
  [files[k], files[j]] = [files[j], files[k]];
}
function logicalRows() {
  return files.flatMap((file) => {
    const marker = COMMENT[file.lang] || "//";
    const head = [
      { text: `${marker} ── ${file.repo}/${file.path} ──`, num: null },
      { text: "", num: null },
    ].map((r) => ({ ...r, kinds: new Array(r.text.length).fill("comment") }));
    return [...head, ...file.lines.map((text, k) => ({ text, num: file.firstLine + k, kinds: tokenize(text, file.lang) }))].map((r) => ({ ...r, file }));
  });
}
function wrapRows(rows, room) {
  const out = [];
  for (const row of rows) {
    if (row.text.length <= room) {
      out.push(row);
      continue;
    }
    const lead = row.text.length - row.text.trimStart().length;
    let at = 0;
    let first = true;
    while (at < row.text.length) {
      const take = first ? room : room - lead - 2;
      const piece = row.text.slice(at, at + take);
      const kinds = row.kinds.slice(at, at + take);
      out.push(first ? { ...row, text: piece, kinds } : { ...row, num: null, cont: true, text: " ".repeat(lead + 2) + piece, kinds: [...new Array(lead + 2).fill("ident"), ...kinds] });
      at += take;
      first = false;
    }
  }
  return out;
}

/* ---------------- wall ---------------- */
let wall = null;
let rows = [];
let desk = null;
let leaving = false;
const editor = { mode: "NORMAL", row: null, col: 0, shown: false, changes: 0 };
const caret = { r: -1, c: -1, on: false, block: true, blinkFrom: 0 };
const flux = new Map();
const fades = new Map();
const pointer = { x: -1, y: -1, at: -Infinity, inside: false };
let lastVisitorAt = -Infinity;
let lastScrollAt = -Infinity;

function layout() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = wallCanvas.clientWidth;
  const H = wallCanvas.clientHeight;
  for (const cv of [wallCanvas, tileCanvas]) {
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const cols = Math.floor(W / CELL_W);
  const nrows = Math.floor(H / CELL_H);
  const margin = W <= 380 ? 16 : W <= 800 ? 20 : W <= 1100 ? 36 : 64;
  const inner = Math.min(W - 2 * margin, 1312, Math.round(VIEW.cols * CELL_W));
  const span = [Math.ceil((W - inner) / 2 / CELL_W), Math.floor((W + inner) / 2 / CELL_W)];
  brandLink.style.left = `${cellX(span[0] + 5)}px`;
  switchNav.style.right = `${Math.round(W - cellX(span[1] - 5))}px`;
  const enterCells = Math.round(enterLink.getBoundingClientRect().width / CELL_W);
  enterLink.style.left = `${(span[1] - 5 - enterCells) * CELL_W}px`;
  enterLink.style.top = `${(nrows - 3) * CELL_H}px`;
  const themeCells = Math.round(themeKey.getBoundingClientRect().width / CELL_W);
  const groupStart = span[1] - 5 - enterCells - 2 - themeCells;
  themeKey.style.left = `${Math.round(groupStart * CELL_W)}px`;
  themeKey.style.top = `${(nrows - 3) * CELL_H}px`;
  noteLine.style.left = `${cellX(span[0] + 5)}px`;
  noteLine.style.top = `${(nrows - 3) * CELL_H}px`;
  noteLine.style.visibility = span[0] + 5 + noteLine.textContent.length + 2 > groupStart ? "hidden" : "";
  /* keyboard sits between the code band and the footer */
  const kbH = clamp(Math.round(H * 0.24), 120, 196);
  const kbTop = (nrows - 4) * CELL_H - kbH;
  const fits = W > 560 && H > 560;
  const bottom = fits ? Math.floor(kbTop / CELL_H) - 4 : nrows - 7;
  const top = Math.round(nrows * VIEW.top);
  const band = [top, Math.max(top + 8, bottom)];
  const size = cols * nrows;
  const prevStart = wall?.pane?.start ?? 0;
  wall = {
    ctx: wallCanvas.getContext("2d"),
    W,
    H,
    cols,
    rows: nrows,
    span,
    band,
    fade: Array.from({ length: nrows }, (_, r) => smooth(clamp(Math.min(r - band[0] + 1, band[1] - r + 1) / VIEW.ramp, 0, 1))),
    revealed: Infinity,
    chars: new Array(size).fill(" "),
    alphas: new Float32Array(size),
    tints: new Array(size).fill(look.ink),
    dirty: new Set(),
    pane: null,
    kb: fits ? { left: cellX(span[0]), width: cellX(span[1]) - cellX(span[0]), top: kbTop, height: kbH } : null,
  };
  rows = wrapRows(logicalRows(), span[1] - 1 - span[0] - GUTTER);
  const start = prevStart;
  wall.pane = { c0: span[0], codeC0: span[0] + GUTTER, codeC1: span[1] - 1, sep: -1, start, scroll: spring(start, 0.32, 1) };
  if (!desk) desk = createDesk({ idle: 3000, withMouse: false, sideLabels: true });
  if (wall.kb) desk.place(wall.kb);
  placeGlass();
  editor.row = null;
  renderPane();
  placeStatus();
  paintAll();
  homeCursor();
}

const rowOf = (r) => rows[(((wall.pane.start + r) % rows.length) + rows.length) % rows.length];
const paneRight = () => (wall.pane.sep >= 0 ? wall.pane.sep : wall.pane.c0 + (wall.span[1] - wall.span[0]));
function screenRow(row) {
  if (!row) return -1;
  const i = rows.indexOf(row);
  if (i < 0) return -1;
  const r = (((i - wall.pane.start) % rows.length) + rows.length) % rows.length;
  return r < wall.rows ? r : -1;
}
function setCell(r, c, ch, alpha, tint) {
  if (r < 0 || r >= wall.rows || c < 0 || c >= wall.cols) return;
  const i = r * wall.cols + c;
  wall.chars[i] = ch;
  wall.alphas[i] = alpha;
  wall.tints[i] = tint;
  flux.delete(i);
  fades.delete(i);
  wall.dirty.add(r);
}
function restyleRows() {
  for (const row of rows) if (row.ghost) row.tint = look.note;
}

function renderPane(from = 0) {
  const p = wall.pane;
  const right = paneRight();
  for (let r = Math.max(0, from); r < wall.rows; r++) {
    for (let c = p.c0; c <= right; c++) setCell(r, c, " ", 0, look.ink);
    if (r > wall.revealed) continue;
    const row = rowOf(r);
    const label = row.num === null ? "" : String(row.num).padStart(GUTTER - 1, " ");
    [...label].forEach((ch, k) => ch !== " " && setCell(r, p.c0 + k, ch, 0.26, look.tints.text));
    const limit = (p.sep >= 0 ? p.sep : p.codeC1) - p.codeC0;
    for (let k = 0; k < row.text.length && k < limit; k++) {
      const ch = row.text[k];
      if (ch !== " ") setCell(r, p.codeC0 + k, ch, row.alpha ?? KIND_ALPHA[row.kinds[k]] ?? 0.31, row.tint ?? look.tints[row.kinds[k]] ?? look.ink);
    }
    if (p.sep >= 0) setCell(r, p.sep, "│", 0.16, look.tints.text);
  }
  updateStatus();
}

/* ---------------- painting ---------------- */
let hole = null; // (x, y) -> 0..1 occlusion from the eye / face
const fadeColor = (f, now) => {
  const t = clamp((now - f.at) / f.ms, 0, 1);
  const a = f.from.split(",").map(Number);
  const b = f.to.split(",").map(Number);
  return a.map((v, n) => Math.round(v + (b[n] - v) * t)).join(",");
};

function paintRow(r, now) {
  const { ctx, cols, W } = wall;
  ctx.fillStyle = look.bg;
  // snap the clear to whole device pixels: at fractional DPRs a fill of exactly CELL_H leaves a 1px antialiased sliver of whatever was drawn there
  const dpr = ctx.getTransform().a || 1;
  const top = Math.floor(r * CELL_H * dpr) / dpr;
  ctx.fillRect(0, top, W, Math.ceil((r + 1) * CELL_H * dpr) / dpr - top);
  const fade = wall.fade[r];
  if (fade <= 0) return;
  ctx.font = `${FONT_PX}px "Plex Mono", ui-monospace, monospace`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const y = r * CELL_H;
  const showCaret = caret.on && caret.r === r && (now - caret.blinkFrom < 500 || Math.floor((now - caret.blinkFrom) / 530) % 2 === 0);
  for (let c = 0; c < cols; c++) {
    const i = r * cols + c;
    let ch = wall.chars[i];
    let alpha = wall.alphas[i];
    let tint = wall.tints[i];
    const fx = flux.get(i);
    if (fx) {
      ch = fx.show;
      alpha = fx.alpha;
      tint = fx.tint;
    }
    const fd = fades.get(i);
    if (fd) {
      tint = fadeColor(fd, now);
      if (now - fd.at >= fd.ms) fades.delete(i);
    }
    const isCaret = showCaret && caret.c === c;
    if (isCaret && caret.block) {
      ctx.fillStyle = `rgba(${look.glow},${(0.95 * fade).toFixed(3)})`;
      ctx.fillRect(cellX(c), y, cellX(c + 1) - cellX(c), CELL_H);
      if (ch !== " ") {
        ctx.fillStyle = look.bg;
        ctx.fillText(ch, cellX(c), y + GLYPH_Y);
      }
      continue;
    }
    if (ch !== " " && alpha > 0.004) {
      const x = cellX(c) + CELL_W / 2;
      if (hole && hole(x, y + CELL_H / 2) > 0.5) continue;
      ctx.fillStyle = `rgba(${tint},${(alpha * fade).toFixed(3)})`;
      ctx.fillText(ch, cellX(c), y + GLYPH_Y);
    }
    if (isCaret) {
      ctx.fillStyle = `rgba(${look.glow},${(0.95 * fade).toFixed(3)})`;
      ctx.fillRect(cellX(c), y, 2, CELL_H);
    }
  }
}
function paintAll() {
  for (let r = 0; r < wall.rows; r++) wall.dirty.add(r);
}
function flushPaint(now) {
  if (fades.size) for (const i of fades.keys()) wall.dirty.add(Math.floor(i / wall.cols));
  if (caret.on) wall.dirty.add(caret.r);
  for (const r of wall.dirty) paintRow(r, now);
  wall.dirty.clear();
}

/* scrambles a cell through random glyphs before it lands on `ch` */
function morph(i, ch, alpha, ticks, tint = look.ink) {
  flux.set(i, { ticks, delay: 0, ch, alpha, tint, show: pickGlyph() });
  wall.dirty.add(Math.floor(i / wall.cols));
}
setInterval(() => {
  if (!wall) return;
  for (const [i, f] of flux) {
    f.ticks--;
    f.show = pickGlyph();
    f.alpha = Math.random() < 0.24 ? 0.95 : 0.45 + Math.random() * 0.3;
    if (f.ticks <= 0) {
      flux.delete(i);
      wall.chars[i] = f.ch;
      wall.alphas[i] = f.ch === " " ? 0 : f.alpha;
    }
    wall.dirty.add(Math.floor(i / wall.cols));
  }
}, 50);
function glowCell(i, to, ms = 520) {
  fades.set(i, { from: look.glow, to, at: performance.now(), ms });
}

/* ---------------- status / cmdline ---------------- */
function placeStatus() {
  const p = wall.pane;
  const c0 = wall.span[0];
  const c1 = p.sep >= 0 ? p.sep : wall.span[1];
  const on = wall.revealed === Infinity && !leaving;
  [[statusLine, 1], [cmdLine, 2]].forEach(([node, k]) => {
    Object.assign(node.style, { left: `${cellX(c0)}px`, top: `${(wall.band[1] + k) * CELL_H}px`, width: `${cellX(c1) - cellX(c0)}px` });
    node.classList.toggle("is-on", on);
  });
  const t = term;
  const inner = Boolean(t?.nvim) && p.sep >= 0;
  [[paneStatus, 1], [paneCmd, 2]].forEach(([node, k]) => {
    if (inner) Object.assign(node.style, { left: `${cellX(p.sep + 1)}px`, top: `${(wall.band[1] + k) * CELL_H}px`, width: `${cellX(wall.span[1] + 1) - cellX(p.sep + 1)}px` });
    node.classList.toggle("is-on", inner && !leaving);
  });
  updateStatus();
}
function fitPath(path, room) {
  if (path.length <= room) return path;
  const parts = path.split("/");
  for (let k = 1; k < parts.length - 1 && parts.join("/").length > room; k++) parts[k] = parts[k][0];
  return parts.join("/");
}
function updateStatus() {
  if (!wall) return;
  let row = editor.shown ? editor.row : null;
  const col = row ? editor.col : 0;
  for (let r = wall.band[0]; r <= wall.band[1] && !row; r++) {
    const c = rowOf(r);
    if (c.num !== null) row = c;
  }
  if (!row || row.num === null) return;
  const f = row.file;
  const at = row.num - f.firstLine + 1;
  const share = at <= 1 ? "Top" : at >= f.count ? "Bot" : `${Math.floor((at / f.count) * 100)}%`;
  const place = `${row.num}:${col + 1}   ${share}`;
  const room = Math.floor(statusLine.clientWidth / CELL_W) - editor.mode.length - place.length - 6;
  statusLine.querySelector(".path").textContent = fitPath(`~/Projects/${f.repo}/${f.path}`, room);
  statusLine.querySelector(".pos").textContent = place;
}
function setMode(mode) {
  editor.mode = mode;
  statusLine.querySelector(".mode").textContent = mode;
  statusLine.classList.toggle("is-insert", mode === "INSERT");
  caret.block = mode !== "INSERT";
}
function cmdSay(text, line = cmdLine) {
  line.querySelector(".cmd").textContent = text;
  line.classList.remove("is-typing");
}
const cmdKeys = (text) => (cmdLine.querySelector(".showcmd").textContent = text);

/* ---------------- cursor & typing ---------------- */
function placeCaret(r, c, on = true) {
  if (caret.on && caret.r >= 0) wall.dirty.add(caret.r);
  Object.assign(caret, { r, c, on, blinkFrom: performance.now() });
  if (r >= 0) wall.dirty.add(r);
}
function showCursor() {
  const r = screenRow(editor.row);
  const c = wall.pane.codeC0 + editor.col;
  const ok = r >= wall.band[0] && r <= wall.band[1] && !leaving && !boot.active && !picker.open;
  if (ok) placeCaret(r, c, true);
  else placeCaret(caret.r, caret.c, false);
  editor.shown = ok;
  updateStatus();
  return ok;
}
function hideCursor() {
  editor.shown = false;
  placeCaret(caret.r, caret.c, false);
}
const indentOf = (row) => row.text.length - row.text.trimStart().length;
function homeCursor() {
  for (let r = wall.band[0] + 1; r <= wall.band[1]; r++) {
    const row = rowOf(r);
    if (row.num === null) continue;
    editor.row = row;
    editor.col = indentOf(row);
    break;
  }
  showCursor();
}

const press = (ch) => desk?.pressChar(ch);
const pressKey = (code) => desk?.press(code);
function keyDelay(ch, pace = 1) {
  let ms = between(38, 105);
  if (ch === " ") ms += between(10, 110);
  else if (!/[a-z0-9]/i.test(ch)) ms += between(20, 140);
  if (Math.random() < 0.04) ms += between(220, 560);
  return reduced.matches ? 0 : ms * pace * TEMPO;
}
function typoFor(ch) {
  if (NEAR[ch]) return NEAR[ch];
  const lower = ch.toLowerCase();
  for (const row of KEY_ROWS) {
    const k = row.indexOf(lower);
    if (k < 0) continue;
    const n = row[k + (Math.random() < 0.5 ? -1 : 1)] || row[k - 1];
    return ch === lower ? n : n.toUpperCase();
  }
  return null;
}

/* types chars into the wall at (r, c); `alive` aborts; typos make the ghost miss a key and fix it */
async function typeInto(r, c, chars, { alpha = 0.92, tints = null, alive, pace = 1, typos = 1, glow = true } = {}) {
  if (!boot.active && chars.length > 3) watchRow(r, c);
  for (let n = 0; n < chars.length; n++) {
    const ch = chars[n];
    const tint = tints?.[n] || look.ink;
    const miss = typos > 0 && ch !== " " && Math.random() < 0.035 * typos ? typoFor(ch) : null;
    if (miss) {
      await sleep(keyDelay(miss, pace));
      if (!alive()) return false;
      press(miss);
      setCell(r, c + n, miss, alpha, tint);
      if (glow) glowCell(r * wall.cols + c + n, tint);
      placeCaret(r, c + n + 1);
      await sleep(between(160, 320) * pace);
      if (!alive()) return false;
      pressKey("Backspace");
      setCell(r, c + n, " ", 0, tint);
      placeCaret(r, c + n);
      await sleep(between(90, 180) * pace);
    }
    await sleep(keyDelay(ch, pace));
    if (!alive()) return false;
    press(ch);
    setCell(r, c + n, ch, alpha, tint);
    if (glow && ch !== " ") glowCell(r * wall.cols + c + n, tint);
    placeCaret(r, c + n + 1);
    eyeFocus(cellX(c + n + 1), r * CELL_H + CELL_H / 2);
  }
  return true;
}
async function blinkAt(r, c, times, alive) {
  for (let k = 0; k < times; k++) {
    placeCaret(r, c, true);
    await sleep(beat(380));
    if (!alive()) return false;
    placeCaret(r, c, false);
    await sleep(beat(260));
    if (!alive()) return false;
  }
  placeCaret(r, c, true);
  return true;
}
async function cmdType(command, alive, { line = cmdLine, pace = 1 } = {}) {
  const node = line.querySelector(".cmd");
  node.textContent = "";
  line.classList.add("is-typing");
  for (let n = 0; n < command.length; n++) {
    await sleep(keyDelay(command[n], pace));
    if (!alive()) {
      node.textContent = "";
      line.classList.remove("is-typing");
      return false;
    }
    press(command[n]);
    node.textContent = command.slice(0, n + 1);
    const box = node.getBoundingClientRect();
    eyeFocus(box.right + 4, box.top + CELL_H / 2);
  }
  await sleep(beat(180, 340));
  if (!alive()) return false;
  pressKey("Enter");
  line.classList.remove("is-typing");
  return true;
}
async function normalKeys(keys, alive) {
  for (let n = 0; n < keys.length; n++) {
    await sleep(keyDelay(keys[n], 1.3));
    if (!alive()) {
      cmdKeys("");
      return false;
    }
    press(keys[n]);
    cmdKeys(n < keys.length - 1 ? keys.slice(0, n + 1) : "");
  }
  return true;
}

/* ---------------- boot ---------------- */
const boot = { active: false, token: 0 };
async function bootView() {
  const token = ++boot.token;
  const alive = () => token === boot.token && !leaving;
  if (reduced.matches) return finishBoot();
  boot.active = true;
  wall.revealed = -1;
  renderPane();
  placeStatus();
  const r = wall.band[0];
  const c = wall.pane.c0 + 1;
  setCell(r, c, "~", 0.5, look.ink);
  setCell(r, c + 2, "›", 0.9, look.glow);
  const col = c + 4;
  const ok = (await blinkAt(r, col, BOOT.blinks, alive)) && (await typeInto(r, col, [...BOOT.command], { alpha: 0.92, alive, typos: 0 })) && (await blinkAt(r, col + BOOT.command.length, 1, alive));
  if (!ok || !alive()) return;
  placeCaret(r, col, false);
  pressKey("Enter");
  await sleep(220);
  const [top, bottom] = wall.band;
  for (let k = top; k <= bottom; k++) {
    if (!alive()) return;
    wall.revealed = k;
    renderPane();
    await sleep(BOOT.reveal / (bottom - top + 1));
  }
  if (alive()) finishBoot();
}
function finishBoot() {
  boot.token++;
  boot.active = false;
  wall.revealed = Infinity;
  renderPane();
  placeStatus();
  homeCursor();
  scheduleCycle(between(...CYCLE.first));
}

/* ---------------- the ghost ---------------- */
const director = { token: 0, timer: 0 };
const ghost = { token: 0, act: false, themeShown: false, splits: 0 };
let message = null;
let term = null;
let face = null;

function splice(index, remove, insert = []) {
  rows.splice(index, remove, ...insert);
  for (const f of files) f.count = rows.filter((row) => row.file === f && row.num !== null).length;
}
function renumber(file) {
  let n = file.firstLine;
  for (const row of rows) if (row.file === file && row.num !== null) row.num = n++;
}
function wrapWords(text, room) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && (line + " " + word).length > room) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}
function calm() {
  const now = performance.now();
  return wall && !leaving && !document.hidden && !picker.open && now - lastScrollAt > 1500 && now - lastVisitorAt > 4000;
}
function scheduleCycle(delay) {
  clearTimeout(director.timer);
  director.timer = setTimeout(runCycle, delay);
}
function abortGhost() {
  ghost.token++;
  director.token++;
  ghost.act = false;
  if (message && !message.done) {
    for (const row of message.rows) {
      const i = rows.indexOf(row);
      if (i >= 0) splice(i, 1);
    }
    message = null;
  }
  if (term) closeSplit(true);
  endFace();
  cmdKeys("");
  cmdSay("");
  setMode("NORMAL");
  renderPane();
  showCursor();
}
async function runCycle() {
  director.timer = 0;
  if (leaving) return;
  if (!calm() || ghost.act || face) return scheduleCycle(2000);
  const token = ++director.token;
  const alive = () => token === director.token && !leaving;
  const ok = (await workAct(alive)) && (await sayAct(alive)) && (await faceAct(alive));
  if (alive()) scheduleCycle(ok ? between(...CYCLE.pause) : CYCLE.retry);
}
function tidy(token) {
  if (token !== ghost.token) return;
  ghost.act = false;
  cmdKeys("");
  if (editor.mode !== "NORMAL") setMode("NORMAL");
  showCursor();
}
async function workAct(alive) {
  const token = ghost.token;
  await ghostUndo(token);
  if (alive() && token === ghost.token) {
    if (!ghost.themeShown) {
      ghost.themeShown = true;
      await ghostColors(token);
    } else await ghostTerminal(token);
  }
  tidy(token);
  return alive();
}
async function sayAct(alive) {
  const token = ghost.token;
  await ghostComment(MESSAGES[0].join(" "), token);
  tidy(token);
  return alive() && Boolean(message?.done);
}
async function faceAct(alive) {
  await sleep(beat(1000));
  const token = ghost.token;
  if (!alive()) return false;
  await ghostUndo(token);
  tidy(token);
  if (tile && !tile.leaving) {
    closeTile(performance.now());
    for (let k = 0; k < 30 && tile; k++) await sleep(100);
  }
  if (!alive()) return false;
  const at = planFace();
  if (!at || !alive()) return false;
  const run = ghost.token;
  ghost.act = true;
  const typed = await cmdType(":!./face --track", () => run === ghost.token && alive());
  ghost.act = false;
  if (!typed) return false;
  startFace(at);
  const t0 = performance.now();
  while (face && alive() && performance.now() - t0 < 30000) await sleep(100);
  if (!alive()) return false;
  cmdSay("");
  const next = ghost.token;
  await ghostComment(MESSAGES[1].join(" "), next);
  tidy(next);
  return alive() && Boolean(message?.done);
}

async function ghostColors(token) {
  const alive = () => token === ghost.token;
  ghost.act = true;
  const name = look.theme.name;
  if (!(await cmdType(`:colorscheme ${name}`, alive))) return;
  const p = wall.pane;
  for (let r = wall.band[0]; r <= wall.band[1]; r++) {
    for (let c = p.c0; c <= paneRight(); c++) {
      const i = r * wall.cols + c;
      if (wall.chars[i] !== " ") fades.set(i, { from: look.ink, to: wall.tints[i], at: performance.now(), ms: 900 });
    }
    await sleep(16);
    if (!alive()) return;
  }
  await sleep(beat(700));
}

async function ghostComment(text, token) {
  const alive = () => token === ghost.token && !leaving;
  if (!wall || term) return false;
  const p = wall.pane;
  const [top, bottom] = wall.band;
  const width = p.codeC1 - p.codeC0 - 1;
  const inside = (r) => r >= top + 3 && r <= bottom - 4;
  const option = (at) => {
    if (!inside(at)) return null;
    const row = rowOf(at);
    if (row.num === null || row.cont) return null;
    const next = rowOf(at + 1);
    if (next.cont) return null;
    const follows = next.file === row.file && next.num !== null && next.text.trim() !== "";
    const lead = follows && !row.text.trim() ? indentOf(next) : indentOf(row);
    const marker = COMMENT[row.file.lang] || "//";
    const room = Math.min(width - lead - marker.length - 1, 46);
    const parts = wrapWords(text, room);
    if (room < 16 || !inside(at + parts.length)) return null;
    return { row, at, lead, parts, blank: !row.text.trim() };
  };
  const cursor = editor.shown ? screenRow(editor.row) : -1;
  const from = inside(cursor) ? cursor : Math.floor((top + bottom) / 2);
  let target = null;
  let fallback = null;
  for (let d = 0; d <= bottom - top && !target; d++) {
    for (const at of d ? [from + d, from - d] : [from]) {
      const found = option(at);
      if (!found) continue;
      fallback ||= found;
      if (found.blank) {
        target = found;
        break;
      }
    }
  }
  target ||= fallback;
  if (!target) return false;
  const { row, lead, parts } = target;
  const marker = COMMENT[row.file.lang] || "//";
  ghost.act = true;
  if (!editor.shown || editor.row !== row) {
    if (!(await normalKeys(`${row.num}G`, alive))) return true;
    editor.row = row;
    editor.col = indentOf(row);
    showCursor();
    await sleep(beat(350, 550));
    if (!alive()) return true;
  }
  if (!(await normalKeys("o", alive))) return true;
  setMode("INSERT");
  message = { rows: [], done: false, at: performance.now(), change: 0 };
  let anchor = row;
  for (let k = 0; k < parts.length; k++) {
    if (k) pressKey("Enter");
    const leader = k ? `${marker} ` : "";
    const draft = { text: " ".repeat(lead) + leader, num: 0, file: row.file, ghost: true, alpha: MSG_ALPHA, tint: look.note, kinds: [] };
    splice(rows.indexOf(anchor) + 1, 0, [draft]);
    renumber(row.file);
    const r = screenRow(draft);
    renderPane(r - 1);
    message.rows.push(draft);
    editor.row = draft;
    editor.col = draft.text.length;
    showCursor();
    await sleep(k ? beat(120, 260) : beat(300, 480));
    if (!alive()) return true;
    const body = [...`${k ? "" : `${marker} `}${parts[k]}`];
    if (!(await typeInto(r, p.codeC0 + draft.text.length, body, { alpha: MSG_ALPHA, alive, pace: 1.05, typos: 0.6, tints: body.map(() => look.note) }))) return true;
    draft.text += body.join("");
    anchor = draft;
  }
  await sleep(beat(320, 520));
  if (!alive()) return true;
  pressKey("Escape");
  setMode("NORMAL");
  editor.row = anchor;
  editor.col = anchor.text.length - 1;
  showCursor();
  editor.changes++;
  Object.assign(message, { done: true, at: performance.now(), change: editor.changes });
  return true;
}

async function ghostUndo(token) {
  const alive = () => token === ghost.token && !leaving;
  const job = message;
  if (!job?.done || !wall) return true;
  const first = rows.indexOf(job.rows[0]);
  if (first < 0) {
    message = null;
    return true;
  }
  const count = job.rows.length;
  const r = screenRow(job.rows[0]);
  if (r < wall.band[0] || r + count - 1 > wall.band[1]) {
    splice(first, count);
    renumber(job.rows[0].file);
    renderPane();
    message = null;
    return true;
  }
  const age = (performance.now() - job.at) / 1000;
  const secs = Math.max(1, Math.round(age));
  const when = age < 100 ? `${secs} ${secs === 1 ? "second" : "seconds"} ago` : new Date(Date.now() - age * 1000).toTimeString().slice(0, 8);
  ghost.act = true;
  if (!(await normalKeys("u", alive))) return true;
  hideCursor();
  for (let k = 0; k < count; k++) for (let c = wall.pane.c0; c <= wall.pane.codeC1; c++) {
    const i = (r + k) * wall.cols + c;
    if (wall.chars[i] !== " ") morph(i, " ", 0, ri(4, 12));
  }
  await sleep(beat(720));
  if (!alive()) return true;
  splice(first, count);
  renumber(job.rows[0].file);
  renderPane(r - 1);
  message = null;
  cmdSay(`${count === 1 ? "1 line less" : `${count} fewer lines`}; before #${job.change}  ${when}`);
  const near = rows[first - 1] || rows[first];
  editor.row = near?.cont ? rows[first - 2] : near;
  editor.col = indentOf(editor.row);
  showCursor();
  await sleep(beat(350, 550));
  return true;
}

/* :vsplit → fish → nvim another file → cut a block → type it back → :q */
function drawFish(t, history, at) {
  let r = t.r0;
  for (const [where, cmd] of history) {
    writeText(r, t.c0 + 2, `${where} › `, 0.5);
    writeText(r, t.c0 + 2 + where.length + 3, cmd, 0.85);
    r++;
  }
  writeText(r, t.c0 + 2, `${at} `, 0.5);
  setCell(r, t.c0 + 2 + at.length + 1, "›", 0.9, look.glow);
  return [r, t.c0 + 2 + at.length + 3];
}
function writeText(r, c, text, alpha, tint = look.ink, max = Infinity) {
  [...text].slice(0, max).forEach((ch, k) => ch !== " " && setCell(r, c + k, ch, alpha, tint));
}
function clearTerm(t) {
  for (let r = t.r0; r < t.r0 + t.H; r++) for (let c = t.c0 + 1; c <= wall.span[1]; c++) setCell(r, c, " ", 0, look.ink);
}
function nvimDraw(t, v) {
  clearTerm(t);
  const lineW = wall.span[1] - (t.c0 + 7);
  for (let k = 0; k < t.H - 1; k++) {
    const r = t.r0 + k;
    const li = v.top + k;
    const line = v.lines[li];
    if (!line) {
      setCell(r, t.c0 + 2, "~", 0.3, look.ink);
      continue;
    }
    writeText(r, t.c0 + 2, String(v.first + li).padStart(4), 0.26, look.tints.text);
    [...line.text].slice(0, lineW).forEach((ch, n) => ch !== " " && setCell(r, t.c0 + 7 + n, ch, KIND_ALPHA[line.kinds[n]] ?? 0.4, look.tints[line.kinds[n]] ?? look.ink));
  }
  nvimStatus(t, v);
}
function nvimStatus(t, v) {
  paneStatus.querySelector(".mode").textContent = v.mode;
  paneStatus.classList.toggle("is-insert", v.mode === "INSERT");
  paneStatus.querySelector(".path").textContent = v.path;
  paneStatus.querySelector(".pos").textContent = `${v.lang}  ${v.first + v.cur}:${v.col + 1}`;
  paneCmd.querySelector(".cmd").textContent = v.cmd;
}
function nvimCursor(t, v, block = true) {
  caret.block = block;
  placeCaret(t.r0 + v.cur - v.top, t.c0 + 7 + v.col, true);
}
function closeSplit(silent = false) {
  if (!term) return;
  term = null;
  wall.pane.sep = -1;
  paneCmd.querySelector(".cmd").textContent = "";
  placeStatus();
  renderPane();
  if (!silent) showCursor();
}
async function ghostTerminal(token) {
  const alive = () => token === ghost.token && !leaving;
  const p = wall.pane;
  const width = wall.span[1] - p.c0;
  if (width < 80) return false;
  const others = files.filter((f) => f !== editor.row?.file);
  const file = others[ghost.splits++ % others.length];
  ghost.act = true;
  if (!(await cmdType(":vsplit | terminal", alive))) return true;
  const sep = p.c0 + Math.floor(width * 0.5);
  term = { c0: sep, r0: wall.band[0] + 1, H: wall.band[1] - wall.band[0], file, nvim: false };
  p.sep = sep;
  renderPane();
  clearTerm(term);
  placeStatus();
  hideCursor();
  cmdSay("");
  await sleep(beat(300));
  if (!alive()) return true;
  const dir = `~/P/${file.repo}`;
  const history = [];
  const commands = [["~", `cd ~/Projects/${file.repo}`], [dir, `nvim ${file.path}`]];
  for (const [at, cmd] of commands) {
    const [r, c] = drawFish(term, history, at);
    caret.block = false;
    if (!(await blinkAt(r, c, 1, alive))) return true;
    if (!(await typeInto(r, c, [...cmd].slice(0, wall.span[1] - c), { alpha: 0.92, alive, pace: 0.65, typos: 0.3 }))) return true;
    await sleep(beat(160, 320));
    if (!alive()) return true;
    pressKey("Enter");
    history.push([at, cmd]);
    await sleep(beat(260, 480));
    if (!alive()) return true;
  }
  const lines = file.lines.map((text) => ({ text, kinds: tokenize(text, file.lang) }));
  const v = { lines, top: 0, cur: 0, col: 0, mode: "NORMAL", cmd: "", first: file.firstLine, path: file.path, lang: file.lang };
  const ind = (li) => (v.lines[li]?.text.length ?? 0) - (v.lines[li]?.text.trimStart().length ?? 0);
  v.col = ind(0);
  term.nvim = true;
  placeStatus();
  nvimDraw(term, v);
  nvimCursor(term, v);
  await sleep(beat(450, 650));
  if (!alive()) return true;
  const want = ri(2, 3);
  const starts = [];
  const lineW = wall.span[1] - (term.c0 + 7);
  for (let s = 3; s + want < Math.min(v.lines.length, term.H - 3) && s <= 14; s++) {
    const block = v.lines.slice(s, s + want);
    if (!block[0].text.trim() || block.some((l) => l.text.length >= lineW - 2)) continue;
    if (block.filter((l) => l.text.trim()).length >= 2) starts.push(s);
  }
  if (starts.length) {
    const start = starts[Math.floor(Math.random() * starts.length)];
    for (let k = 0; k < start; k++) {
      press("j");
      v.cur++;
      v.col = ind(v.cur);
      nvimStatus(term, v);
      nvimCursor(term, v);
      await sleep(beat(90, 170));
      if (!alive()) return true;
    }
    await sleep(beat(300, 520));
    for (const ch of `d${want - 1}j`) {
      press(ch);
      cmdKeys(ch);
      await sleep(beat(120, 200));
      if (!alive()) return true;
    }
    cmdKeys("");
    for (let k = 0; k < want; k++) for (let c = term.c0 + 7; c <= wall.span[1]; c++) {
      const i = (term.r0 + start + k) * wall.cols + c;
      if (wall.chars[i] !== " ") morph(i, " ", 0, ri(3, 9));
    }
    await sleep(beat(520));
    if (!alive()) return true;
    const cut = v.lines.splice(start, want);
    v.cmd = `${want} fewer lines`;
    v.col = ind(start);
    nvimDraw(term, v);
    nvimCursor(term, v);
    await sleep(beat(600, 900));
    if (!alive()) return true;
    press("O");
    v.lines.splice(start, 0, { text: "", kinds: [] });
    v.mode = "INSERT";
    v.cmd = "-- INSERT --";
    nvimDraw(term, v);
    for (let k = 0; k < want; k++) {
      const line = cut[k];
      const lead = line.text.length - line.text.trimStart().length;
      v.cur = start + k;
      v.col = lead;
      v.lines[v.cur] = { text: " ".repeat(lead), kinds: new Array(lead).fill("ident") };
      nvimStatus(term, v);
      nvimCursor(term, v, false);
      await sleep(beat(140, 320));
      if (!alive()) return true;
      const body = [...line.text.slice(lead)];
      const tints = line.kinds.slice(lead).map((kind) => look.tints[kind] || look.ink);
      if (!(await typeInto(term.r0 + v.cur, term.c0 + 7 + lead, body, { alpha: 0.86, alive, pace: 0.7, typos: 0.5, tints }))) return true;
      v.lines[v.cur] = line;
      v.col = line.text.length;
      if (k < want - 1) {
        pressKey("Enter");
        v.lines.splice(v.cur + 1, 0, { text: "", kinds: [] });
        nvimDraw(term, v);
        await sleep(beat(120, 260));
        if (!alive()) return true;
      }
    }
    await sleep(beat(300, 500));
    pressKey("Escape");
    v.mode = "NORMAL";
    v.cmd = "";
    nvimDraw(term, v);
    nvimCursor(term, v);
    await sleep(beat(700, 1000));
    if (!alive()) return true;
  }
  term.nvim = false;
  placeStatus();
  if (!(await cmdType(":q", alive, { pace: 1.4 }))) return true;
  closeSplit();
  cmdSay("");
  return true;
}

/* ---------------- ./face --track ---------------- */
/* rows the ghost is working in: message lines, the split terminal, the caret while it types */
function ghostRows() {
  const set = new Set();
  for (const row of message?.rows || []) {
    const r = screenRow(row);
    if (r >= 0) set.add(r);
  }
  if (term) for (let r = term.r0 - 1; r <= term.r0 + term.H; r++) set.add(r);
  if (ghost.act && caret.on) set.add(caret.r);
  return set;
}
/* …plus the cursor and anything already on screen */
function busyRows() {
  const set = ghostRows();
  if (editor.shown) set.add(screenRow(editor.row));
  if (caret.on) set.add(caret.r);
  if (tile) for (let r = tile.row; r < tile.row + tile.rows; r++) set.add(r);
  if (face) for (let r = face.at.row; r < face.at.row + face.at.rows; r++) set.add(r);
  return set;
}
const rowsTouch = (row, count, set, pad) => [...set].some((r) => r >= row - pad && r < row + count + pad);
function lineEnd(r) {
  const p = wall.pane;
  let end = 0;
  for (let c = p.codeC0; c <= Math.min(p.codeC1, p.sep >= 0 ? p.sep - 1 : p.codeC1); c++) if (wall.chars[r * wall.cols + c] !== " ") end = c;
  return end;
}

/* a block over the code, centred on a busy line, clear of the ghost's rows and away from the pointer */
function planFace() {
  const [top, bottom] = wall.band;
  const cols = Math.min(46, Math.floor((wall.span[1] - wall.span[0]) * 0.45));
  const busy = busyRows();
  const minCol = wall.span[0] + 2;
  const maxCol = (term ? term.c0 - 2 : wall.span[1]) - cols - 2;
  if (maxCol < minCol) return null;
  for (let rows = clamp(Math.floor((bottom - top) * 0.6), 9, 19); rows >= 9; rows -= 2) {
    let best = null;
    for (let attempt = 0; attempt < 240; attempt++) {
      const col = ri(minCol, maxCol);
      const row = ri(top + 1, Math.max(top + 1, bottom - rows));
      const seed = row + Math.floor(rows / 2);
      let filled = 0;
      for (let c = col; c < col + cols; c++) if (wall.chars[seed * wall.cols + c] !== " ") filled++;
      if (filled < cols * 0.5) continue;
      if (wall.fade[seed] < 0.8 || wall.fade[row] < 0.5 || wall.fade[row + rows - 1] < 0.5) continue;
      if (rowsTouch(row, rows, busy, 1)) continue;
      const x = cellX(col);
      const w = cellX(col + cols) - x;
      const y = row * CELL_H;
      const h = rows * CELL_H;
      const distance = pointer.x < 0 ? Infinity : Math.hypot(x + w / 2 - pointer.x, y + h / 2 - pointer.y);
      const at = { col, row, cols, rows, x, y, w, h, seed, distance };
      if (distance > 220) return at;
      if (!best || distance > best.distance) best = at;
    }
    if (best) return best;
  }
  return null;
}
function startFace(at) {
  const text = files.map((f) => f.lines.join(" ")).join(" ");
  face = { at, start: performance.now(), grow: spring(0, 0.6, 1), phase: "seed", until: 0, eye: createEye({ text, open: false }), blobs: [spring(0, 0.25, 1), spring(0, 0.25, 1)] };
  const dpr = Math.min(devicePixelRatio || 1, 2);
  machine.width = Math.round(at.w * dpr);
  machine.height = Math.round(at.h * dpr);
  Object.assign(machine.style, { display: "block", left: `${at.x}px`, top: `${at.y}px`, width: `${at.w}px`, height: `${at.h}px` });
  machine.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  const seed = at.seed ?? at.row + Math.floor(at.rows / 2);
  for (let c = at.col; c < at.col + at.cols; c++) {
    const i = seed * wall.cols + c;
    if (wall.chars[i] !== " ") morph(i, wall.chars[i], wall.alphas[i], ri(2, 6), wall.tints[i]);
  }
}
function faceRadii() {
  const g = clamp(face.grow.value, 0, 1);
  return [(face.at.w / 2) * g ** 0.45, (face.at.h / 2) * g ** 1.6];
}
function faceHole(x, y) {
  if (!face || face.grow.value < 0.002) return 0;
  const [rx, ry] = faceRadii();
  const cx = face.at.x + face.at.w / 2;
  const cy = face.at.y + face.at.h / 2;
  const d = Math.hypot((x - cx) / Math.max(rx, 1e-3), (y - cy) / Math.max(ry, 1e-3));
  return clamp((1.05 - d) / 0.25, 0, 1);
}
function stepFace(now, dt) {
  if (!face) return;
  if (face.phase === "seed" && now - face.start >= FACE.seed) {
    face.phase = "grow";
    face.grow.target = 1;
    face.eye.setOpen(true);
  }
  const settled = advance(face.grow, dt);
  if (face.phase === "grow" && (settled || face.grow.value > 0.985)) {
    face.phase = "hold";
    face.until = now + FACE.hold;
  } else if (face.phase === "hold" && now >= face.until) {
    face.phase = "shrink";
    face.grow.target = 0;
    face.grow.response = 0.36;
    face.eye.setOpen(false);
  } else if (face.phase === "shrink" && face.grow.value < 0.01) {
    endFace();
    return;
  }
  const { at } = face;
  for (let r = at.row - 1; r <= at.row + at.rows; r++) wall.dirty.add(r);
  const g = machine.getContext("2d");
  g.clearRect(0, 0, at.w, at.h);
  if (face.grow.value <= 0.002) return;
  const box = { cx: at.x + at.w / 2, cy: at.y + at.h / 2, w: at.w * 0.8, h: at.h * 0.62 };
  const aim = pointer.x >= 0 && now - pointer.at < 2500 ? [pointer.x, pointer.y] : null;
  face.eye.step(box, now, dt, aim, false);
  g.save();
  g.translate(-at.x, -at.y);
  face.eye.draw(g, box, now, { ink: look.ink });
  /* tracker overlays: two blobs that hunt the pupil, with scores */
  const pp = face.eye.pupil(box);
  g.font = `8px "Plex Mono", ui-monospace, monospace`;
  g.lineWidth = 0.75;
  [[-1, 0.33], [1, 0.64]].forEach(([side, base], k) => {
    const b = face.blobs[k];
    b.target = side * box.w * 0.18 + Math.sin(now / (700 + k * 260)) * 6;
    advance(b, dt);
    const bx = pp.x + b.value - 24;
    const by = pp.y - box.h * 0.42 - 6 + k * 4;
    const alpha = clamp(face.grow.value * 1.4 - 0.4, 0, 1);
    g.strokeStyle = `rgba(${look.ink},${(0.7 * alpha).toFixed(3)})`;
    g.strokeRect(Math.round(bx) + 0.5, Math.round(by) + 0.5, 48, 30);
    g.fillStyle = `rgba(${look.ink},${(0.85 * alpha).toFixed(3)})`;
    g.fillText(`['blob${k}:u'] ${(base + Math.sin(now / 400 + k) * 0.01).toFixed(7)}`, Math.round(bx), Math.round(by - 4));
  });
  face.eye.drawTrack(g, box, now, { ink: look.ink, accent: look.glow }, { label: false, targets: aim ? [{ x: aim[0], y: aim[1] }] : [] });
  g.restore();
  /* the edge of the block is soft */
  const [rx, ry] = faceRadii();
  const stretch = Math.max(ry, 1e-3) / Math.max(rx, 1e-3);
  g.save();
  g.globalCompositeOperation = "destination-in";
  g.translate(at.w / 2, at.h / 2);
  g.scale(1, stretch);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, 1e-3));
  grad.addColorStop(0, "#000");
  grad.addColorStop(0.68, "#000");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(-2 * at.w, (-2 * at.h) / stretch - 4, 4 * at.w, (4 * at.h) / stretch + 8);
  g.restore();
  if (face.phase !== "hold" && !reduced.matches) {
    for (let r = at.row; r < at.row + at.rows; r++) for (let c = at.col; c < at.col + at.cols; c++) {
      const m = faceHole(cellX(c) + CELL_W / 2, r * CELL_H + CELL_H / 2);
      const i = r * wall.cols + c;
      if (m > 0.2 && m < 0.7 && Math.random() < 0.06 && wall.chars[i] !== " " && !flux.has(i)) morph(i, wall.chars[i], wall.alphas[i], ri(1, 3), wall.tints[i]);
    }
  }
}
function endFace() {
  if (!face) return;
  const { at } = face;
  face = null;
  machine.style.display = "none";
  for (let r = at.row - 1; r <= at.row + at.rows; r++) wall.dirty.add(r);
}

/* ---------------- the watching eye (tile) ---------------- */
let tile = null;
let focusAt = { x: 0, y: 0, at: -Infinity };
const eyeFocus = (x, y) => (focusAt = { x, y, at: performance.now() });

let eyeRestUntil = 0;

/* the eye sits in the open space right of the code — never on the lines being edited, never on a split */
function chooseTile(near = null) {
  const n = TILE.rows;
  const half = Math.floor(n / 2);
  const h = n * CELL_H;
  const [top, bottom] = wall.band;
  const reach = Math.min(320, Math.max(wall.W, wall.H) * 0.3);
  const busy = busyRows();
  const working = ghostRows();
  const least = Math.round(wall.span[0] + (wall.span[1] - wall.span[0]) * 0.55);
  const options = [];
  /* leave room under the eye for its 4-line pupil readout, so it never reaches the status line */
  for (let line = top + half + 1; line <= bottom - half - 4; line++) {
    if (wall.fade[line] < 0.8 || wall.fade[line - half] < 0.5 || wall.fade[line + half] < 0.5) continue;
    let end = 0;
    for (let r = line - half; r <= line + half; r++) end = Math.max(end, lineEnd(r));
    let col = Math.max(end + 1, least);
    if (term) col = Math.min(col, term.c0 - TILE.cols - 2);
    col = clamp(col, wall.span[0] + 2, Math.max(wall.span[0] + 2, wall.span[1] - TILE.cols));
    const x = cellX(col);
    const w = cellX(col + TILE.cols) - x;
    const y = (line + 0.5) * CELL_H - h / 2;
    if (rowsTouch(line - half, n, working, 1) && !(term && x + w <= cellX(term.c0) - 4)) continue;
    if (col < end && rowsTouch(line - half, n, busy, 1)) continue;
    const score = near ? -Math.abs(y + h / 2 - near[1]) : pointer.x < 0 ? Math.random() * 1000 : Math.hypot(x + w / 2 - pointer.x, y + h / 2 - pointer.y);
    options.push({ col, line, row: line - half, rows: n, x, y, w, h, score });
  }
  if (!options.length) return null;
  const far = near ? [] : options.filter((o) => o.score > reach);
  const best = Math.max(...options.map((o) => o.score));
  const pool = far.length ? far : options.filter((o) => o.score >= best - (near ? CELL_H : 0));
  return pool[Math.floor(Math.random() * pool.length)];
}
function centeredTile() {
  const col = Math.max(0, Math.floor((wall.cols - TILE.cols) / 2));
  const half = Math.floor(TILE.rows / 2);
  const line = clamp(Math.floor(wall.rows / 2), half + 1, Math.max(half + 1, wall.rows - half - 2));
  const x = cellX(col);
  const h = TILE.rows * CELL_H;
  return { col, line, row: line - half, rows: TILE.rows, x, y: (line + 0.5) * CELL_H - h / 2, w: cellX(col + TILE.cols) - x, h };
}
function canOpen(now) {
  return Boolean(wall) && !tile && !face && !leaving && !boot.active && !picker.open && now > eyeRestUntil && now - lastScrollAt > 1200;
}
function seedLine(r, c0, c1) {
  for (let c = c0; c < c1; c++) {
    const i = r * wall.cols + c;
    if (wall.chars[i] !== " ") morph(i, wall.chars[i], wall.alphas[i], ri(2, 6), wall.tints[i]);
  }
}
function openTile(at, now = performance.now()) {
  if (!at) return false;
  const text = files.map((f) => f.lines.join(" ")).join(" ");
  tile = { ...at, cx: at.x + at.w / 2, cy: (at.line + 0.5) * CELL_H, eye: createEye({ text }), state: "seed", start: now, closeAt: Infinity, zoom: null, leaving: false, frost: null };
  if (reduced.matches) {
    tile.state = "open";
    tile.eye.setOpen(true);
    tile.closeAt = now + between(4200, 6200);
  } else seedLine(at.line, at.col, at.col + TILE.cols);
  return true;
}
/* the ghost glances at what it types */
function watchRow(r, c) {
  const now = performance.now();
  if (!canOpen(now) || document.hidden) return;
  openTile(chooseTile([cellX(c), (r + 0.5) * CELL_H]), now);
}
function closeTile(now) {
  if (!tile || tile.leaving || tile.state === "closing") return;
  if (tile.state === "seed") {
    tile = null;
    eyeRestUntil = now + between(2000, 3500);
    paintAll();
    return;
  }
  tile.state = "closing";
  tile.eye.setOpen(false);
}
const tileBox = () => ({ cx: tile.cx, cy: tile.cy, w: tile.w, h: tile.h });
function lidPath(box, open) {
  const a = box.w * 0.47;
  const path = new Path2D();
  for (let k = 0; k <= 48; k++) {
    const u = k / 24 - 1;
    const y = box.cy - box.h * 0.47 * open * (1 - u * u) ** 0.8;
    if (k) path.lineTo(box.cx + u * a, y);
    else path.moveTo(box.cx + u * a, y);
  }
  for (let k = 48; k >= 0; k--) {
    const u = k / 24 - 1;
    path.lineTo(box.cx + u * a, box.cy + box.h * 0.37 * open * (1 - u * u) ** 1.15);
  }
  path.closePath();
  return path;
}
/* blurred, tinted copy of the code under the eye, refreshed a few times a second */
function frost(now) {
  const f = tile.frost || (tile.frost = { canvas: document.createElement("canvas"), at: -Infinity, pad: 5 });
  if (now - f.at > 250) {
    const dpr = wallCanvas.width / wall.W;
    const { pad } = f;
    const x = Math.round(tile.cx - tile.w / 2);
    const y = Math.round(tile.cy - tile.h / 2);
    f.canvas.width = Math.round((tile.w + 2 * pad) * dpr);
    f.canvas.height = Math.round((tile.h + 2 * pad) * dpr);
    const fg = f.canvas.getContext("2d");
    fg.filter = `blur(${(1.6 * dpr).toFixed(2)}px)`;
    fg.drawImage(wallCanvas, Math.round((x - pad) * dpr), Math.round((y - pad) * dpr), f.canvas.width, f.canvas.height, 0, 0, f.canvas.width, f.canvas.height);
    fg.filter = "none";
    fg.fillStyle = look.bg;
    fg.globalAlpha = 0.85;
    fg.fillRect(0, 0, f.canvas.width, f.canvas.height);
    Object.assign(f, { at: now, x, y });
  }
  return f;
}
function stepTile(now) {
  const t = tile;
  if (t.state === "seed" && now - t.start >= FACE.seed) {
    t.state = "opening";
    t.eye.setOpen(true);
  } else if (t.state === "opening" && t.eye.openNow > 0.97) {
    t.state = "open";
    t.closeAt = t.leaving ? Infinity : now + between(4200, 6200);
  } else if (t.state === "open" && !t.leaving) {
    const idle = pointer.x < 0 || now - pointer.at > 2800;
    const reading = ghostRows().size > 0 || now - focusAt.at < 1600;
    if (!reading && now - lastVisitorAt > 3000 && (idle || now >= t.closeAt)) closeTile(now);
  } else if (t.state === "closing" && t.eye.state === "closed") {
    tile = null;
    eyeRestUntil = now + between(2000, 3500);
    seedLine(t.line, t.col, t.col + TILE.cols);
    paintAll();
  }
}

/* ---------------- frame ---------------- */
let last = 0;
let dive = null;
function frame(now) {
  requestAnimationFrame(frame);
  if (!wall || document.hidden) {
    last = 0;
    return;
  }
  const dt = last ? clamp((now - last) / 1000, 0, 0.1) : 1 / 60;
  last = now;
  /* scrolling */
  const p = wall.pane;
  if (!advance(p.scroll, dt) || Math.round(p.scroll.value) !== p.start) {
    const next = ((Math.round(p.scroll.value) % rows.length) + rows.length) % rows.length;
    if (next !== p.start) {
      p.start = next;
      renderPane();
      showCursor();
    }
  }
  hole = face ? faceHole : null;
  if (face) stepFace(now, dt);
  const g = tileCanvas.getContext("2d");
  g.clearRect(0, 0, wall.W, wall.H);
  if (tile) stepTile(now);
  if (tile && tile.state !== "seed") {
    const box = tileBox();
    const focused = now - focusAt.at < 1400;
    const aim = focused ? [focusAt.x, focusAt.y] : pointer.x >= 0 && now - pointer.at < 2500 ? [pointer.x, pointer.y] : null;
    tile.eye.step(box, now, dt, aim, focused);
    const open = tile.eye.openNow;
    g.save();
    if (tile.zoom) {
      g.translate(tile.zoom.origin[0], tile.zoom.origin[1]);
      g.scale(tile.zoom.scale, tile.zoom.scale);
      g.translate(-tile.zoom.origin[0], -tile.zoom.origin[1]);
      // the eye (frost + glyphs) fades out as it zooms, leaving only the hole and its streaks
      if (dive) g.globalAlpha = clamp(1 - (tile.zoom.scale - 1.2) / 2.5, 0, 1);
    }
    if (open > 0.01) {
      const f = frost(now);
      g.save();
      g.clip(lidPath(box, Math.min(1, open * 1.04)));
      g.drawImage(f.canvas, f.x - f.pad, f.y - f.pad, tile.w + 2 * f.pad, tile.h + 2 * f.pad);
      g.restore();
    }
    tile.eye.draw(g, box, now, { ink: look.ink });
    if (!tile.zoom) tile.eye.drawTrack(g, box, now, { ink: look.ink, accent: look.glow }, { targets: aim ? [{ x: aim[0], y: aim[1] }] : [], W: wall.W, H: wall.H });
    g.restore();
  }
  if (wall.kb && desk && !leaving) desk.draw(g, now, dt, { ink: look.ink, accent: look.glow }, wall.W, wall.H);
  if (glass) glass.classList.toggle("is-on", Boolean(wall.kb && desk && !leaving && desk.visible > 0.05));
  flushPaint(now);
  if (dive) drawDive(g, now);
}

/* ---------------- leaving: the eye swallows the page ---------------- */
function startDive(origin, rp) {
  const far = Math.hypot(wall.W, wall.H);
  const parts = [];
  const count = wall.W < 700 ? DIVE.phone : DIVE.count;
  for (let k = 0; k < count; k++) parts.push({ r: rp + 4 + Math.random() ** 2.2 * far, a: Math.random() * Math.PI * 2, s: 0.55 + Math.random() * 0.9, w: (0.12 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1) });
  dive = { start: performance.now(), origin, rp, far, parts, last: 0 };
}
function diveRadius(t, d) {
  const side = Math.min(wall.W, wall.H);
  const open = d.rp + (0.3 * side - d.rp) * (1 - (1 - clamp(t / 0.3, 0, 1)) ** 3);
  return open + 0.08 * side * smooth((t - 0.3) / 0.5) + d.far * smooth((t - 0.8) / 0.2) ** 2;
}
function drawDive(g, now) {
  const d = dive;
  const t = (now - d.start) / DIVE.ms;
  const glide = smooth(t / 0.45);
  const cx = d.origin[0] + (wall.W / 2 - d.origin[0]) * glide;
  const cy = d.origin[1] + (wall.H / 2 - d.origin[1]) * glide;
  if (t >= 1) {
    g.fillStyle = "#000";
    g.fillRect(0, 0, wall.W, wall.H);
    return;
  }
  const dt = d.last ? Math.min(0.05, (now - d.last) / 1000) : 1 / 60;
  d.last = now;
  const R = diveRadius(t, d);
  const pull = 1 + 2.5 * t + 14 * smooth((t - 0.78) / 0.22);
  const fade = smooth(t / 0.22);
  const paths = Array.from({ length: DIVE.buckets }, () => new Path2D());
  for (const q of d.parts) {
    if (q.r <= R + 0.5) {
      q.r = R + 8 + Math.random() ** 2.2 * d.far;
      q.a = Math.random() * Math.PI * 2;
      continue;
    }
    const v = (70 + 14000 / (Math.max(4, q.r - R) + 40)) * q.s * pull;
    q.r -= v * dt;
    q.a += q.w * dt * (1 + (2 * R) / Math.max(q.r, 1));
    if (q.r <= R + 0.5) continue;
    const tail = Math.min(q.r - R + 60, v * 0.05 + 2);
    const glow = Math.exp(-(q.r - R) / (0.3 * R + 70));
    const k = Math.min(DIVE.buckets - 1, Math.floor((0.1 + 0.9 * glow) * DIVE.buckets));
    const ca = Math.cos(q.a);
    const sa = Math.sin(q.a);
    paths[k].moveTo(cx + ca * (q.r + tail), cy + sa * (q.r + tail));
    paths[k].lineTo(cx + ca * q.r, cy + sa * q.r);
  }
  g.save();
  g.fillStyle = `rgba(0,0,0,${(0.6 * fade).toFixed(3)})`;
  g.fillRect(0, 0, wall.W, wall.H);
  const halo = g.createRadialGradient(cx, cy, R, cx, cy, R * 1.6 + 40);
  halo.addColorStop(0, `rgba(${look.ink},${(0.16 * fade).toFixed(3)})`);
  halo.addColorStop(1, `rgba(${look.ink},0)`);
  g.fillStyle = halo;
  g.fillRect(0, 0, wall.W, wall.H);
  g.lineCap = "round";
  g.lineWidth = 1;
  for (let k = 0; k < DIVE.buckets; k++) {
    g.strokeStyle = `rgba(${look.ink},${(fade * (0.18 + (0.82 * (k + 1)) / DIVE.buckets)).toFixed(3)})`;
    g.stroke(paths[k]);
  }
  for (const [w, a] of [[14, 0.05], [6, 0.12], [2.2, 0.45], [1, 0.95]]) {
    g.lineWidth = w;
    g.strokeStyle = `rgba(${look.ink},${(a * fade).toFixed(3)})`;
    g.beginPath();
    g.arc(cx, cy, R + w * 0.3, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#000";
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

async function leave(href) {
  if (leaving) return;
  leaving = true;
  if (reduced.matches || !wall) {
    location.href = href;
    return;
  }
  clearTimeout(director.timer);
  abortGhost();
  hideCursor();
  cmdSay("");
  picker.close(true);
  document.documentElement.classList.add("is-leaving");
  placeStatus();
  if (!tile) openTile(chooseTile([wall.W / 2, wall.H / 2]) || centeredTile());
  tile.leaving = true;
  if (tile.state !== "open") tile.state = "opening";
  tile.eye.setOpen(true);
  for (let k = 0; k < 50 && tile.eye.openNow < 0.98; k++) await sleep(40);
  const reach = Math.hypot(wall.W, wall.H);
  for (let r = 0; r < wall.rows; r++) for (let c = 0; c < wall.cols; c++) {
    const i = r * wall.cols + c;
    if (wall.chars[i] === " ") continue;
    const d = Math.hypot(cellX(c) - tile.cx, r * CELL_H - tile.cy) / reach;
    // scramble at the cell's current brightness so the code visibly dissolves outward from the eye
    morph(i, " ", wall.alphas[i], 2 + Math.round(d * 20) + ri(0, 3));
  }
  await sleep(700);
  const box = tileBox();
  const pp = tile.eye.pupil(box);
  const start = performance.now();
  tile.zoom = { origin: [pp.x, pp.y], scale: 1 };
  startDive([pp.x, pp.y], pp.rp);
  const ease = (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2);
  await new Promise((resolve) => {
    const grow = (now) => {
      tile.zoom.scale = 64 ** ease(clamp((now - start) / 900, 0, 1));
      if (now - start < DIVE.ms) requestAnimationFrame(grow);
      else resolve();
    };
    requestAnimationFrame(grow);
  });
  location.href = href;
}

/* ---------------- input ---------------- */
const picker = createPicker({
  apply: (name, keep) => {
    useTheme(name);
    if (keep) rememberTheme(name);
  },
  current: () => key(look.theme.name),
  onClose: (chosen) => {
    if (chosen) cmdSay(`:colorscheme ${chosen}`);
    showCursor();
  },
  place: (w, h) => {
    const box = themeKey.getBoundingClientRect();
    return { x: clamp(box.right - w, 8, innerWidth - w - 8), y: clamp((wall.band[1] - 2) * CELL_H - h, 8, innerHeight - h - 8) };
  },
});
themeKey.addEventListener("click", (e) => {
  e.preventDefault();
  hideCursor();
  picker.toggle();
});
enterLink.addEventListener("click", (e) => {
  e.preventDefault();
  leave(enterLink.getAttribute("href"));
});
addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || picker.open) return;
  if (!e.repeat) desk?.press(e.code === "Space" ? "Space" : e.code, e.shiftKey);
  if (e.key === "Enter") {
    e.preventDefault();
    leave(enterLink.getAttribute("href"));
    return;
  }
  if (e.key === ":" || e.key.length === 1 || e.key === "Escape") {
    lastVisitorAt = performance.now();
    if (ghost.act) {
      abortGhost();
      scheduleCycle(CYCLE.restart);
    }
  }
});
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || !wall) return;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.at = performance.now();
  desk?.pointerMove(e.clientX, e.clientY);
  if (tile) tile.lastAt = pointer.at;
  clearTimeout(pointer.dwell);
  if (canOpen(pointer.at)) pointer.dwell = setTimeout(() => canOpen(performance.now()) && openTile(chooseTile()), TILE.dwell);
}, { passive: true });
addEventListener("pointerdown", (e) => desk?.click(e.button), { passive: true });
document.documentElement.addEventListener("pointerleave", () => (pointer.at = -Infinity));
wallCanvas.addEventListener("wheel", (e) => {
  if (!wall || leaving) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? CELL_H * 3 : 1;
  wall.pane.scroll.target += (e.deltaY * unit) / CELL_H / 2;
  lastScrollAt = performance.now();
  if (ghost.act) {
    abortGhost();
    scheduleCycle(CYCLE.restart);
  }
}, { passive: false });
let drag = null;
wallCanvas.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse") return;
  drag = { y: e.clientY, from: wall.pane.scroll.target };
});
addEventListener("pointermove", (e) => {
  if (!drag) return;
  wall.pane.scroll.target = drag.from - (e.clientY - drag.y) / CELL_H;
  lastScrollAt = performance.now();
});
addEventListener("pointerup", () => (drag = null));
let resizeTimer = 0;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (leaving) return;
    abortGhost();
    layout();
    scheduleCycle(CYCLE.restart);
  }, 150);
});
addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});

/* a11y: list the files shown on the wall */
const list = document.createElement("ul");
for (const f of files) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = f.url;
  a.textContent = `${f.repo}/${f.path}`;
  li.append(a);
  list.append(li);
}
$(".sources").replaceChildren(list);
$(".brand-text").textContent = SITE.brand;
noteLine.textContent = INTRO.note;

/* ---------------- boot ---------------- */
useTheme(savedTheme());
await document.fonts.ready.catch(() => {});
layout();
requestAnimationFrame(frame);
bootView();
