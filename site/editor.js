/* editor: wheel + terminal + bar + watch, and the views they show */
import { reduced, narrow, sleep, key, fmt, make, palettes, savedTheme, rememberTheme, applyVars, swatchesOf, gh } from "../shared/common.js";
import { createWheel } from "./wheel.js";
import { createTerminal } from "./terminal.js";
import { createBar } from "./bar.js";
import { createWatch } from "./watch.js";
import { createBlueprint } from "./blueprint.js";
import { createPicker } from "../shared/picker.js";

const $ = (s) => document.querySelector(s);
const editor = $(".editor");
const wheelHost = $(".wheel");
const buffer = $(".buffer");
const winbar = $(".winbar");
const tabline = $(".tabline");
const tabFile = $(".tab-file");
const tabToggle = $(".tab-toggle");
const barHost = $(".bar");
const cmdNode = $(".bar .cmd");
const WORM_KEY = "nc.worm";
const C = GITHUB.contributions;
$(".brand-text").textContent = SITE.brand;
$(".bar-title").textContent = SITE.name.toUpperCase().replace(/\s+/g, "-");

/* ---------------- theme ---------------- */
let currentTheme = savedTheme();
let watch = null;
let wheel = null;
let hero = null;
function applyTheme(name, remember = false) {
  const theme = palettes.get(key(name));
  if (!theme) return false;
  applyVars(theme);
  currentTheme = key(name);
  hero?.recolor?.();
  watch?.recolor();
  wheel?.recolor();
  bar?.recolor();
  if (remember) rememberTheme(currentTheme);
  return true;
}

/* ---------------- data ---------------- */
let profile = null;
const fallback = GITHUB.fallback;
const extras = new Map();
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => null)]);
const repoOf = (p) => p.github.replace(/\/$/, "").split("/").pop();
const shotsOf = (p) =>
  (SHOTS[p.id] || []).map((file, k) => ({ file: `../${file}`, name: file.split("/").pop(), alt: `${p.name} screenshot ${k + 1}` }));

const entries = [
  { id: "about", label: "whoami", kind: "about", tile: "about" },
  ...PROJECTS.map((p) => ({ id: repoOf(p), label: repoOf(p), kind: "project", data: p, src: shotsOf(p)[0]?.file })),
  { id: "experience", label: "experience/", kind: "experience", tile: "experience" },
  { id: "open-source", label: "open-source/", kind: "oss", tile: "oss" },
  { id: "stack", label: "stack/", kind: "stack", tile: "stack" },
  { id: "themes", label: "themes/", kind: "themes", tile: "themes" },
  { id: "off-the-clock", label: "off-the-clock/", kind: "offclock", tile: "offclock" },
  { id: "links", label: "links/", kind: "links", tile: "links" },
];
const items = entries.map((entry) => ({ entry, label: entry.label, src: entry.src, tile: entry.tile, host: entry.data ? (entry.data.live || entry.data.github).replace(/^https?:\/\//, "").replace(/\/$/, "") : "" }));

/* ---------------- bar, terminal ---------------- */
const bar = createBar(barHost);
const KEYS = { wide: "↑↓ project · ←→ shot · ↩ enter · : cmd", touch: "swipe the wheel · tap to open", closed: "tap ~/Projects ↓ to browse" };
const paintKeys = () => bar.setKeys(narrow.matches ? (editor.classList.contains("is-tree-open") ? KEYS.touch : KEYS.closed) : matchMedia("(pointer: fine)").matches ? KEYS.wide : KEYS.touch);
paintKeys();
let typingBar = false;
let typingTerm = false;
const paintTyping = () => bar.setTyping(typingBar || typingTerm);

const lightbox = (() => {
  const box = make("div", "lb");
  box.hidden = true;
  const fig = make("figure");
  const img = make("img");
  const cap = make("figcaption");
  fig.append(img, cap);
  box.append(fig);
  document.body.append(box);
  const close = () => (box.hidden = true);
  box.addEventListener("click", close);
  addEventListener("keydown", (e) => !box.hidden && e.key === "Escape" && close(), true);
  return {
    open(shot) {
      img.src = shot.file;
      img.alt = shot.alt;
      cap.innerHTML = "";
      cap.append(Object.assign(make("span"), { innerHTML: `shots · <span class="lb-b">${shot.name}</span>` }), make("span", "", "esc · click closes"));
      box.hidden = false;
    },
    get open_() {
      return !box.hidden;
    },
  };
})();

const terminal = createTerminal(buffer, {
  lightbox,
  watch: () => watch,
  onTyping(on) {
    typingTerm = on;
    paintTyping();
  },
});

let typingToken = 0;
let clearTimer = 0;
let command = null;
function clearSoon(ms = 2400) {
  clearTimeout(clearTimer);
  clearTimer = setTimeout(() => command === null && !typingBar && (cmdNode.textContent = ""), ms);
}
async function typeCmd(text, pace = 11) {
  const token = ++typingToken;
  clearTimeout(clearTimer);
  typingBar = true;
  barHost.classList.add("is-typing");
  paintTyping();
  try {
    if (reduced.matches) cmdNode.textContent = text;
    else {
      cmdNode.textContent = "";
      for (let n = 1; n <= text.length; n++) {
        if (token !== typingToken) return;
        cmdNode.textContent = text.slice(0, n);
        watch?.pressChar(text[n - 1]);
        const r = cmdNode.getBoundingClientRect();
        if (r.width) watch?.focus(r.right + 4, r.top + r.height / 2);
        await sleep(pace);
      }
    }
    await sleep(160);
    if (token !== typingToken) return;
    watch?.pressKey("Enter");
  } finally {
    if (token === typingToken) {
      typingBar = false;
      barHost.classList.remove("is-typing");
      paintTyping();
      clearSoon();
    }
  }
}
function say(text) {
  typingToken++;
  typingBar = false;
  barHost.classList.remove("is-typing");
  paintTyping();
  cmdNode.textContent = text;
  clearSoon(text ? 3200 : 0);
}

/* ---------------- building blocks ---------------- */
const GAUGE = 16;
const pad = (label) => label.padEnd(9);
const num = (v) => (v === null || v === undefined ? "—".padStart(6) : fmt(v).padStart(6));
const fact = (label, value, extra = []) => ({ segments: [[pad(label), "t-key"], [num(value), "md-num"], ...extra] });
const text = (label, value, extra = []) => ({ segments: [[pad(label), "t-key"], value, ...extra] });
const dim = (s) => ({ segments: [s], className: "t-dim" });
const bullet = (s) => ({ segments: [["- ", "md-bul"], s], className: "t-bullet" });
const blank = { segments: [" "] };
const host = (url) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");
function room(used) {
  const style = getComputedStyle(buffer);
  const chars = Math.floor((buffer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 1) / 7.2) - 3;
  return Math.max(6, Math.min(GAUGE, chars - used));
}
function gauge(share, used) {
  const cells = room(used);
  const filled = share > 0 ? Math.max(1, Math.min(cells, Math.round(share * cells))) : 0;
  return [["█".repeat(filled), "t-gauge"], ["░".repeat(cells - filled), "t-gauge-off"]];
}
function starLine(stars) {
  const total = profile?.stars || fallback.stars;
  const share = total ? Math.round((stars / total) * 100) : 0;
  const note = stars === null || stars === undefined ? "" : `  ${share || (stars ? "<1" : 0)}% of all stars`;
  return fact("stars", stars, ["  ", ...gauge((share || (stars ? 0.5 : 0)) / 100, 17 + note.length), ...(note ? [[note, "t-dim"]] : [])]);
}
const calendarBlock = () => ({ cmd: `node calendar.mjs ${C.from.slice(0, 4)}`, calendar: { days: DAYS, done: `// done · ${new Set(DAYS.map((d) => d[0].slice(0, 7))).size} months · ${fmt(C.total)} contributions` } });
const sentences = (s) => s.split(/(?<=\.)\s+(?=[A-Z])/).map((x) => x.trim());

/* ---------------- views ---------------- */
function aboutSpec() {
  const links = LINKS.filter((l) => ["github", "linkedin", "x", "leetcode", "resume"].includes(l.id));
  return {
    cwd: "~",
    hero: (el) => createBlueprint(el, { points: C.total, from: C.from, owner: GITHUB.user, plate: ["opposite hitter", "jaipur, in"] }),
    blocks: [
      { cmd: "whoami", out: [{ segments: [[SITE.headline, "md-h1"]] }, ...sentences(SITE.about).map(dim)] },
      {
        cmd: `fetch ${GITHUB.user}`,
        out: [
          fact("followers", profile?.followers ?? fallback.followers),
          fact("stars", profile?.stars ?? fallback.stars, [[`  own ${fmt(profile?.stars ?? fallback.stars)} · forks ${fmt(profile?.forks ?? 0)}`, "t-dim"]]),
          fact("repos", profile?.repos ?? fallback.repos),
          fact("contribs", C.total, [[`  ${C.from} → ${C.to}`, "t-dim"]]),
          text("role", `${SITE.role} @ `, [["IterativeTech", "", "https://iterativetech.com/"]]),
          text("based", SITE.location),
          text("status", [SITE.status, "md-code"]),
        ],
      },
      { cmd: "ls links/", out: [{ segments: links.flatMap((l, k) => [...(k ? ["   "] : []), [l.label, "", l.url]]) }, { segments: [[pad("mail"), "t-key"], [SITE.email, "", `mailto:${SITE.email}`]] }] },
      calendarBlock(),
    ],
  };
}

function projectSpec(p) {
  const repo = repoOf(p);
  const r = profile?.byName[repo.toLowerCase()];
  const x = extras.get(repo);
  const out = [
    { segments: [[repo, "md-h md-h1"]] },
    dim(p.tagline),
    blank,
    starLine(r ? r.stars : null),
    fact("forks", r ? r.forks : null),
    fact("watch", r ? r.watchers : null),
    fact("commits", x?.commits ?? null),
    fact("files", x?.files ?? null),
    { segments: [[pad("lang"), "t-key"], [r?.language || p.stack[0], "md-code"], ...(r?.license ? [["  " + r.license, "t-dim"]] : [])] },
    { segments: [[pad("since"), "t-key"], r?.created || p.period, ...(r ? [["  pushed ", "t-dim"], r.pushed] : [])] },
  ];
  const shots = shotsOf(p);
  return {
    cwd: `~/P/${repo}`,
    branch: r?.branch || "main",
    shots,
    blocks: [
      { cmd: `fetch ${repo}`, out },
      { cmd: "cat NOTES.md", out: [...p.notes.map(bullet), { segments: [[pad("stack"), "t-key"], [p.stack.join(" · "), "t-dim"]], className: "t-hang" }] },
      ...(shots.length ? [{ cmd: "ls shots/", viewer: true }] : []),
      { cmd: `open ${host(p.github)}`, link: { text: host(p.github), href: p.github } },
      ...(p.live ? [{ cmd: `open ${host(p.live)}`, link: { text: host(p.live), href: p.live } }] : []),
    ],
  };
}

function experienceSpec() {
  const out = EXPERIENCE.flatMap((e, k) => [
    ...(k ? [blank] : []),
    { segments: [[e.when, "t-dim"], ["  ·  ", "t-dim"], [e.where, "t-dim"], ...(e.current ? [["  ● now", "md-h1"]] : [])] },
    { segments: [[e.role, "md-h"], ["  @ ", "t-dim"], e.url ? [e.org, "", e.url] : e.org] },
    ...e.notes.map(bullet),
    ...(e.tags.length ? [dim(e.tags.join(" · "))] : []),
  ]);
  const hl = HIGHLIGHTS.flatMap((h, k) => [...(k ? [blank] : []), { segments: [[h.title, "md-h"]] }, dim(h.text)]);
  return { cwd: "~/experience", blocks: [{ cmd: "cat experience.log", out }, { cmd: "cat highlights.txt", out: hl }] };
}

function ossSpec() {
  const o = OPEN_SOURCE;
  return {
    cwd: "~/oss/llm_engineering",
    branch: "main",
    blocks: [
      { cmd: `gh repo view ${o.repo}`, out: [{ segments: [[o.repo, "md-h md-h1"]] }, dim("LLM engineering course repo — contributions merged upstream."), blank, text("stars", [o.stars.padStart(6), "md-num"]), fact("merged", o.prs.length, [["  PRs", "t-dim"]]), text("lines", [o.lines.padStart(6), "md-num"]), text("since", o.since)] },
      { cmd: "gh pr list --author @me --state merged", out: o.prs.flatMap((pr, k) => [...(k ? [blank] : []), { segments: [[`#${pr.n}`, "md-num"], ["  merged  ", "t-dim"], [`view pull request`, "", pr.url]] }, dim(pr.text)]) },
      { cmd: `open ${host(o.url)}`, link: { text: host(o.url), href: o.url } },
    ],
  };
}

function stackSpec() {
  const total = LANGS.reduce((s, [, n]) => s + n, 0);
  const unit = (n) => ` repo${n === 1 ? "" : "s"}`;
  const used = Math.max(...LANGS.map(([name, n]) => 3 + Math.max(16, name.length) + 4 + unit(n).length));
  const lang = LANGS.map(([name, n]) => ({ segments: [{ letter: name }, " ", [name.padEnd(16), "md-code"], ...gauge(n / total, used), [String(n).padStart(4), "md-num"], [unit(n), "t-dim"]] }));
  const tools = TOOLKIT.flatMap((t) => [{ segments: [[`[${t.key}]`, "md-h1"], ["  # ", "t-dim"], [t.label, "t-dim"]] }, { segments: t.items.flatMap((i, k) => [...(k ? [["  ", ""]] : []), { letter: i }, " ", i]) }, blank]);
  const certs = CERTS.map((c) => ({ segments: [[c.when.padEnd(10), "t-key"], c.url ? [c.name, "", c.url] : c.name, [`  — ${c.by}`, "t-dim"]], className: "t-hang" }));
  return {
    cwd: "~",
    blocks: [
      { cmd: "stack --languages", out: [...lang, dim("numbers: public repos by primary language")] },
      { cmd: "stack --toolkit", out: tools.slice(0, -1) },
      { cmd: "ls certs/", out: certs },
    ],
  };
}

function themesSpec() {
  const list = [...palettes.values()];
  return {
    cwd: "~/themes",
    blocks: [
      { cmd: "fetch themes/", out: [fact("schemes", list.length), fact("dark", list.filter((t) => !t.light).length), fact("light", list.filter((t) => t.light).length), text("current", [currentTheme, "md-code"]), dim("palettes from the open-source Omarchy themes by HANCORE-linux (MIT)")] },
      {
        cmd: "git log --graph themes/",
        mount(el) {
          const arc = make("div", "arc");
          const grid = make("ul", "arc-grid");
          const cards = list.map((t) => {
            const li = make("li");
            const card = make("button", `arc-card${key(t.name) === currentTheme ? " is-on" : ""}`);
            card.type = "button";
            const shot = make("span", "arc-shot");
            shot.style.background = t.bg;
            shot.style.color = t.fg;
            const k = t.kinds;
            shot.innerHTML = [
              `<span style="color:${k.comment}">// ${t.name}</span>`,
              `<span style="color:${k.keyword}">const</span> <span style="color:${k.function}">answer</span> = <span style="color:${k.function}">cite</span>(<span style="color:${k.string}">"source"</span>);`,
              `<span style="color:${k.keyword}">if</span> (k > <span style="color:${k.number}">5</span>) <span style="color:${k.keyword}">return</span> <span style="color:${k.type}">Groq</span>;`,
              `<span style="background:${t.accent};color:${t.bg}"> NORMAL </span>`,
            ].join("\n");
            const meta = make("span", "arc-meta");
            meta.append(make("span", "arc-name", t.name), make("span", "arc-note", t.light ? "light" : "dark"));
            const sw = make("span", "arc-sw");
            sw.append(...swatchesOf(t).map((c) => Object.assign(make("i"), { style: `background:${c}` })));
            card.append(shot, meta, sw);
            card.addEventListener("click", () => {
              if (applyTheme(t.name, true)) {
                cards.forEach((c) => c.classList.toggle("is-on", c === card));
                typeCmd(`:colorscheme ${key(t.name)}`);
              }
            });
            li.append(card);
            grid.append(li);
            return card;
          });
          arc.append(grid);
          el.append(arc);
          return () => arc.remove();
        },
      },
    ],
  };
}

function offclockSpec() {
  return {
    cwd: "~/off-the-clock",
    blocks: [
      { cmd: "cat README.md", out: [dim(OFF_CLOCK.intro)] },
      ...OFF_CLOCK.groups.map((grp) => ({
        cmd: `ls ${grp.name}/`,
        out: grp.items.map(([k, v, url]) => ({ segments: [[pad(k).padEnd(12), "t-key"], v.replace(/\s*[^.]*→$/, ""), ...(url ? [" ", [(v.match(/[^.]*→$/) || ["→"])[0].trim(), "", url]] : [])], className: "t-hang" })),
      })),
    ],
  };
}

function linksSpec() {
  return {
    cwd: "~/links",
    blocks: [
      { cmd: "ls -l links/", out: LINKS.map((l) => ({ segments: [[l.label.padEnd(12), "t-key"], [l.handle, "", l.url]] })) },
      { cmd: "echo $MAIL", out: [{ segments: [[SITE.email, "", `mailto:${SITE.email}`]] }] },
      { cmd: "cat status", out: [{ segments: [["● ", "md-h1"], [SITE.status, "md-code"], ["  ·  ", "t-dim"], SITE.location] }] },
    ],
  };
}

function textOf(entry) {
  if (entry.kind === "project") return [repoOf(entry.data), entry.data.tagline, ...entry.data.notes, entry.data.stack.join(" ")].join(" ");
  if (entry.kind === "about") return `${SITE.headline} ${SITE.about}`;
  if (entry.kind === "experience") return EXPERIENCE.flatMap((e) => [e.role, e.org, ...e.notes]).join(" ");
  if (entry.kind === "oss") return OPEN_SOURCE.prs.map((p) => p.text).join(" ");
  if (entry.kind === "stack") return TOOLKIT.flatMap((t) => t.items).join(" ");
  if (entry.kind === "themes") return [...palettes.keys()].join(" ");
  if (entry.kind === "offclock") return OFF_CLOCK.intro;
  return LINKS.map((l) => `${l.label} ${l.handle}`).join(" ");
}

function barView(entry) {
  if (entry.kind === "project") {
    const r = profile?.byName[repoOf(entry.data).toLowerCase()];
    return [["STARS", r ? fmt(r.stars) : "—"], ["FORKS", r ? fmt(r.forks) : "—"], ["WATCH", r ? fmt(r.watchers) : "—"]];
  }
  if (entry.kind === "experience") return [["ROLES", "2"], ["GPA", "8.3"], ["SSB", "×2"]];
  if (entry.kind === "oss") return [["STARS", OPEN_SOURCE.stars], ["MERGED", String(OPEN_SOURCE.prs.length)], ["LINES", OPEN_SOURCE.lines]];
  if (entry.kind === "stack") return [["LANGS", String(LANGS.length)], ["SKILLS", String(TOOLKIT.reduce((n, t) => n + t.items.length, 0))], ["CERTS", String(CERTS.length)]];
  if (entry.kind === "themes") return [["SCHEMES", String(palettes.size)], ["LIGHT", String([...palettes.values()].filter((t) => t.light).length)]];
  if (entry.kind === "offclock") return [["SPORTS", "5"], ["OPENINGS", "4"], ["BOOKS", "6"]];
  if (entry.kind === "links") return [["LINKS", String(LINKS.length)], ["STATUS", "open"]];
  return [["REPOS", fmt(profile?.repos ?? fallback.repos)], ["STARS", fmt(profile?.stars ?? fallback.stars)], ["FOLLOWERS", fmt(profile?.followers ?? fallback.followers)]];
}

const WINBAR = {
  about: () => `fish — ~ · ${GITHUB.user}`,
  project: (e) => `fish — ~/Projects/${repoOf(e.data)}`,
  experience: () => "experience/ — 2 roles · 2 schools",
  oss: () => `open-source/ — ${OPEN_SOURCE.prs.length} PRs merged into ${OPEN_SOURCE.repo}`,
  stack: () => "fish — ~ · stack",
  themes: () => `themes/ — ${palettes.size} colorschemes · ↩ on a card applies it`,
  offclock: () => "off-the-clock/ — away from the keyboard",
  links: () => "links/ — elsewhere",
};
const SPECS = { about: aboutSpec, project: (e) => projectSpec(e.data), experience: experienceSpec, oss: ossSpec, stack: stackSpec, themes: themesSpec, offclock: offclockSpec, links: linksSpec };

let openEntry = null;
let openToken = 0;
async function open(entry) {
  if (entry === openEntry) return;
  const mine = ++openToken;
  openEntry = entry;
  history.replaceState(null, "", `#${entry.id}`);
  document.title = entry.kind === "about" ? `${SITE.brand} — ${SITE.name}` : `${entry.label} · ${SITE.brand}`;
  winbar.textContent = WINBAR[entry.kind](entry);
  tabFile.textContent = `/${entry.kind === "project" ? entry.id : entry.label}`;
  watch?.setText(textOf(entry));
  if (entry.kind === "project" && !extras.has(entry.id)) {
    const x = await withTimeout(gh.extra(entry.id), 1200);
    if (x) extras.set(entry.id, x);
    if (mine !== openToken) return;
  }
  terminal.destroy();
  hero = null;
  buffer.scrollTop = 0;
  buffer.dataset.kind = entry.kind;
  bar.setView(barView(entry));
  hero = terminal.show(SPECS[entry.kind](entry));
  if (entry.kind === "themes") typeCmd(":e themes/");
}

/* ---------------- drawer (narrow screens) ---------------- */
function openDrawer() {
  editor.classList.add("is-tree-open");
  tabline.setAttribute("aria-expanded", "true");
  tabToggle.textContent = "↑";
  paintKeys();
  requestAnimationFrame(() => wheel?.layout());
}
function closeDrawer() {
  editor.classList.remove("is-tree-open");
  tabline.setAttribute("aria-expanded", "false");
  tabToggle.textContent = "↓";
  paintKeys();
}
tabline.addEventListener("click", () => (editor.classList.contains("is-tree-open") ? closeDrawer() : openDrawer()));

/* ---------------- commands ---------------- */
function findEntry(name) {
  const wanted = key(name.replace(/^~\/Projects\/?/, ""));
  if (!wanted || ["about", "whoami", "home", "readmemd"].includes(wanted)) return entries[0];
  return entries.find((e) => key(e.id) === wanted || key(e.label) === wanted) || entries.find((e) => key(e.id).startsWith(wanted));
}
function goTo(entry) {
  const k = items.findIndex((i) => i.entry === entry);
  if (k < 0) return;
  wheel.select(k);
  wheel.commitNow();
  open(entry);
}
const schemes = (name) => {
  const w = key(name);
  if (!w) return [];
  if (palettes.has(w)) return [w];
  return [...palettes.keys()].filter((c) => c.startsWith(w));
};
function scheme(name) {
  const found = schemes(name);
  if (found.length === 1 && applyTheme(found[0], true)) return say(`:colorscheme ${found[0]}`);
  if (found.length > 1) return say(`E185: ${found.slice(0, 4).join(" · ")}${found.length > 4 ? " …" : ""}`);
  return say(`E185: Cannot find color scheme '${name}'`);
}
const picker = createPicker({
  apply: (name, keep) => applyTheme(name, keep),
  current: () => currentTheme,
  onClose: (chosen) => chosen && say(`:colorscheme ${chosen}`),
  place: (w, h) => {
    const r = buffer.getBoundingClientRect();
    return { x: Math.min(r.left + 40, innerWidth - w - 8), y: Math.max(8, r.top + r.height / 2 - h / 2) };
  },
});
function run(input) {
  const [name, ...rest] = input.trim().split(/\s+/);
  const arg = rest.join(" ");
  if (!name) return say("");
  if (/^q(a|all)?!?$/.test(name) || name === "wq" || name === "x") {
    location.href = "../";
    return;
  }
  if (["colorscheme", "colo", "theme"].includes(name)) {
    if (!arg) return name === "theme" ? picker.show() : say(currentTheme);
    return scheme(arg);
  }
  if (["e", "edit", "cd", "open"].includes(name)) {
    const entry = findEntry(arg);
    if (entry) {
      say("");
      return goTo(entry);
    }
    return say(`E484: Can't open file ${arg}`);
  }
  if (name === "help" || name === "h") return say(":e <name> · :theme · :colo <scheme> · :resume · :mail · :worm · :q");
  if (name === "resume" || name === "cv") {
    window.open(SITE.resume, "_blank", "noopener");
    return say(`opening ${SITE.resume.split("/").pop()}`);
  }
  if (name === "mail") return say(SITE.email);
  if (name === "worm") return den.click();
  const link = LINKS.find((l) => l.id === key(name));
  if (link && !arg) {
    window.open(link.url, "_blank", "noopener");
    return say(`opening ${host(link.url)}`);
  }
  const entry = !arg && findEntry(name);
  if (entry) {
    say("");
    return goTo(entry);
  }
  if (!arg && schemes(name).length) return scheme(name);
  return say(`E492: Not an editor command: ${input.trim()}`);
}
function startCommand() {
  typingToken++;
  clearTimeout(clearTimer);
  command = "";
  barHost.classList.add("is-typing");
  cmdNode.textContent = ":";
}
function commandKey(e) {
  e.preventDefault();
  if (e.key === "Escape") {
    command = null;
    barHost.classList.remove("is-typing");
    say("");
  } else if (e.key === "Enter") {
    const t = command;
    command = null;
    barHost.classList.remove("is-typing");
    run(t);
  } else if (e.key === "Backspace") {
    if (!command) {
      command = null;
      barHost.classList.remove("is-typing");
      return say("");
    }
    command = command.slice(0, -1);
    cmdNode.textContent = `:${command}`;
  } else if (e.key === "Tab") {
    const [n, ...r] = command.split(" ");
    const pool = r.length ? (["colo", "colorscheme", "theme"].includes(n) ? [...palettes.keys()] : entries.map((x) => x.id)) : ["edit", "colorscheme", "theme", "resume", "mail", "worm", "help", ...entries.map((x) => x.id)];
    const last = (r.length ? r.at(-1) : n).toLowerCase();
    const hit = pool.find((p) => p.toLowerCase().startsWith(last));
    if (hit) command = r.length ? [n, ...r.slice(0, -1), hit].join(" ") : hit;
    cmdNode.textContent = `:${command}`;
  } else if (e.key.length === 1) {
    command += e.key;
    cmdNode.textContent = `:${command}`;
  }
}

let booted = false;
document.addEventListener("keydown", (e) => {
  if (!e.repeat) watch?.pressKey(e.code, e.shiftKey);
  if (e.ctrlKey || e.metaKey || e.altKey || !booted || picker.open || lightbox.open_) return;
  if (command !== null) return commandKey(e);
  const target = e.target instanceof Element ? e.target : null;
  if (e.key === ":") {
    e.preventDefault();
    return startCommand();
  }
  const inBuffer = target && (target === buffer || buffer.contains(target));
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    if (inBuffer) wheel.focus();
    else buffer.focus({ preventScroll: true });
    return;
  }
  if (inBuffer) {
    const lines = { j: 13, ArrowDown: 13, k: -13, ArrowUp: -13, d: buffer.clientHeight / 2, u: -buffer.clientHeight / 2 };
    if (e.key in lines) {
      e.preventDefault();
      buffer.scrollBy({ top: lines[e.key] });
    } else if (e.key === "g") buffer.scrollTo({ top: 0 });
    else if (e.key === "G") buffer.scrollTo({ top: buffer.scrollHeight });
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      terminal.step(e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "Enter" && !target.closest("button, a") && terminal.zoom()) e.preventDefault();
    else if (e.key === "h" || e.key === "Escape") wheel.focus();
    return;
  }
  if (target?.closest("a, button:not(.wheel-item)") && e.key === "Enter") return;
  if (e.key === "j" || e.key === "ArrowDown") {
    e.preventDefault();
    wheel.step(1);
  } else if (e.key === "k" || e.key === "ArrowUp") {
    e.preventDefault();
    wheel.step(-1);
  } else if (e.key === "l" || e.key === "ArrowRight") {
    e.preventDefault();
    terminal.step(1);
  } else if (e.key === "h" || e.key === "ArrowLeft") {
    e.preventDefault();
    terminal.step(-1);
  } else if (e.key === "Enter") {
    e.preventDefault();
    wheel.commitNow();
    if (openEntry?.kind === "themes") picker.show();
    else buffer.focus({ preventScroll: true });
    closeDrawer();
  } else if (e.key === "Escape") closeDrawer();
});
addEventListener("hashchange", () => {
  const entry = entries.find((e) => e.id === decodeURIComponent(location.hash.slice(1)));
  if (entry && entry !== openEntry) goTo(entry);
});
narrow.addEventListener("change", () => {
  closeDrawer();
  paintKeys();
});
addEventListener("resize", () => {
  for (const g of buffer.querySelectorAll(".t-gauge")) void g;
});

/* tooltips */
const tip = $(".tip");
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest?.("[data-tip]");
  if (!t || e.pointerType !== "mouse") return (tip.hidden = true);
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
  const r = t.getBoundingClientRect();
  const w = tip.offsetWidth;
  tip.style.transform = `translate(${Math.round(Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)))}px, ${Math.round(r.top - tip.offsetHeight - 6 < 4 ? r.bottom + 6 : r.top - tip.offsetHeight - 6)}px)`;
});

/* worm den */
const den = $(".den");
let wormOn = false;
try {
  wormOn = localStorage.getItem(WORM_KEY) === "on";
} catch {}
const paintDen = () => {
  den.setAttribute("aria-pressed", String(wormOn));
  den.dataset.tip = wormOn ? "switch the worm off" : "wake the worm";
};
paintDen();
den.addEventListener("click", () => {
  wormOn = !wormOn;
  paintDen();
  watch?.setWorm(wormOn);
  try {
    if (wormOn) localStorage.setItem(WORM_KEY, "on");
    else localStorage.removeItem(WORM_KEY);
  } catch {}
});

/* ---------------- boot ---------------- */
applyTheme(currentTheme);
watch = createWatch({ layer: $(".overlay"), deskHost: $(".desk"), eyeHost: $(".eye-host"), buffer, onState: (s) => bar.setState(s), den, wormOn });
profile = await withTimeout(gh.profile(), 1500);
const initial = entries.find((e) => e.id.toLowerCase() === decodeURIComponent(location.hash.slice(1)).toLowerCase()) || entries[0];
await document.fonts.ready.catch(() => {});
wheel = createWheel(wheelHost, {
  items,
  days: DAYS,
  initial: Math.max(0, items.findIndex((i) => i.entry === initial)),
  onChange: (item) => (tabFile.textContent = `/${item.entry.kind === "project" ? item.entry.id : item.label}`),
  onCommit(item) {
    if (!booted) return;
    open(item.entry);
    const c = wheel.centerOf();
    if (c) watch?.focus(c.x, c.y);
  },
  onPick() {
    if (!narrow.matches) return;
    setTimeout(() => {
      wheel.commitNow();
      closeDrawer();
    }, reduced.matches ? 0 : 170);
  },
});
if (!reduced.matches) await typeCmd(":e ~/Projects", 18);
wheelHost.classList.add("is-in");
wheel.form();
booted = true;
wheel.commitNow();
if (!openEntry) open(wheel.current().item.entry);
/* live numbers may arrive late: refresh the bar when they do */
if (!profile)
  gh.profile().then((p) => {
    if (!p) return;
    profile = p;
    if (openEntry) bar.setView(barView(openEntry));
  });
