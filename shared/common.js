/* shared helpers for the intro and the editor. Globals PALETTES / SITE / … come from the classic scripts. */
export const reduced = matchMedia("(prefers-reduced-motion: reduce)");
export const narrow = matchMedia("(max-width: 700px)");
export const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
export const prefersStill = () => reduced.matches;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const between = (a, b) => a + Math.random() * (b - a);
export const smooth = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
export const key = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
export const fmt = (value) => Math.round(value || 0).toLocaleString("en-US").replace(/,/g, "'");
export const TAU = Math.PI * 2;
export const EM_TOP = 1025 / 1300;

export function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* critically damped spring, integrated in small steps */
export function spring(value, response = 0.35, damping = 1) {
  return { value, target: value, velocity: 0, response, damping };
}
export function advance(s, dt) {
  if (reduced.matches) {
    s.value = s.target;
    s.velocity = 0;
    return true;
  }
  const k = ((2 * Math.PI) / s.response) ** 2;
  const c = (4 * Math.PI * s.damping) / s.response;
  let left = Math.min(Math.max(dt, 0), 0.1);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 240);
    s.velocity += (-k * (s.value - s.target) - c * s.velocity) * h;
    s.value += s.velocity * h;
    left -= h;
  }
  if (Math.abs(s.value - s.target) < 0.002 && Math.abs(s.velocity) < 0.02) {
    s.value = s.target;
    s.velocity = 0;
    return true;
  }
  return false;
}

const probe = document.createElement("canvas").getContext("2d");
export function rgbOf(value, fallback = "#d8d4b4") {
  probe.fillStyle = fallback;
  probe.fillStyle = value || fallback;
  const color = probe.fillStyle;
  if (color.startsWith("#")) return [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16)).join(",");
  return (color.match(/\d+/g) || [216, 212, 180]).slice(0, 3).join(",");
}
export const cssVar = (name, el = document.body) => getComputedStyle(el).getPropertyValue(name).trim();

/* ---------------- colorschemes ---------------- */
export const DEFAULT_THEME = "blackmoney";
export const THEME_KEY = "nc.scheme";
export const palettes = new Map(PALETTES.map((p) => [key(p.name), p]));
const hex = (v) => [1, 3, 5].map((k) => parseInt(v.slice(k, k + 2), 16));
export const mix = (a, b, t) => `#${hex(a).map((v, n) => Math.round(v * (1 - t) + hex(b)[n] * t).toString(16).padStart(2, "0")).join("")}`;
const lum = (v) => {
  const [r, g, b] = hex(v).map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const sat = (v) => {
  const [r, g, b] = hex(v);
  return Math.max(r, g, b) - Math.min(r, g, b);
};

export function savedTheme() {
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s && palettes.has(s)) return s;
  } catch {}
  return DEFAULT_THEME;
}
export function rememberTheme(name) {
  try {
    localStorage.setItem(THEME_KEY, key(name));
  } catch {}
}

/* the editor's token mapping: bg / ink / dim / accent / line / syntax kinds / chrome / link */
export function themeVars(theme) {
  const fg = theme.fg || theme.kinds.text;
  const vars = {
    "--bg": theme.bg,
    "--ink": fg,
    "--dim": theme.kinds.comment || mix(fg, theme.bg, 0.55),
    "--accent": theme.accent,
    "--line": theme.cursorline || mix(fg, theme.bg, 0.9),
    "--kw": theme.kinds.keyword,
    "--str": theme.kinds.string,
    "--fn": theme.kinds.function,
    "--ty": theme.kinds.type,
    "--num": theme.kinds.number,
    "--chrome": mix(fg, theme.bg, 0.3),
    "--color1": theme.color1,
  };
  const links = [3, 4, 5, 8].map((n) => theme.ansi?.[n]).filter((v) => v && contrast(v, theme.bg) >= 3 && v.toLowerCase() !== fg.toLowerCase());
  vars["--link"] = links.sort((a, b) => sat(b) - sat(a))[0] || fg;
  return vars;
}

export function applyVars(theme, extra = {}) {
  const vars = { ...themeVars(theme), ...extra };
  for (const [n, v] of Object.entries(vars)) if (v) document.body.style.setProperty(n, v);
  document.documentElement.style.colorScheme = theme.light ? "light" : "dark";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme.bg;
}

export const swatchesOf = (theme) => [theme.bg, theme.accent, theme.kinds.string, theme.kinds.number, theme.kinds.function, theme.kinds.keyword, theme.kinds.type, theme.fg];

/* ---------------- GitHub (public API, cached per session) ---------------- */
const API = "https://api.github.com";
async function cached(name, fn, ttl = 30 * 60e3) {
  try {
    const hit = JSON.parse(sessionStorage.getItem(name) || "null");
    if (hit && Date.now() - hit.t < ttl) return hit.v;
  } catch {}
  const v = await fn();
  if (v != null) {
    try {
      sessionStorage.setItem(name, JSON.stringify({ t: Date.now(), v }));
    } catch {}
  }
  return v;
}
const getJSON = async (url) => {
  const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
};

export const gh = {
  profile: () =>
    cached("nc.gh.profile", async () => {
      try {
        const [u, repos] = await Promise.all([getJSON(`${API}/users/${GITHUB.user}`), getJSON(`${API}/users/${GITHUB.user}/repos?per_page=100&type=owner`)]);
        const byName = {};
        let stars = 0;
        let forks = 0;
        for (const r of repos) {
          stars += r.stargazers_count;
          forks += r.forks_count;
          byName[r.name.toLowerCase()] = { stars: r.stargazers_count, forks: r.forks_count, watchers: r.subscribers_count ?? r.watchers_count, language: r.language, created: r.created_at.slice(0, 10), pushed: r.pushed_at.slice(0, 10), branch: r.default_branch, license: r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null };
        }
        return { followers: u.followers, repos: u.public_repos, stars, forks, byName };
      } catch {
        return null;
      }
    }),
  extra: (repo) =>
    cached(`nc.gh.x.${repo.toLowerCase()}`, async () => {
      try {
        const [c, t] = await Promise.all([fetch(`${API}/repos/${GITHUB.user}/${repo}/commits?per_page=1`), getJSON(`${API}/repos/${GITHUB.user}/${repo}/git/trees/HEAD?recursive=1`).catch(() => null)]);
        let commits = null;
        const link = c.headers.get("link");
        const m = link && link.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (m) commits = Number(m[1]);
        else if (c.ok) commits = (await c.json()).length;
        const files = t?.tree ? t.tree.filter((n) => n.type === "blob").length : null;
        return { commits, files };
      } catch {
        return null;
      }
    }),
};

export const BRAND_PATHS = ["M0 80V0h14l26 46V0h14v80H40L14 34v46z", "M62 0h26v14H74v19h14v47H62V66h12V47H62z"];
export const BRAND_BOX = [88, 80];
export const brandSvg = () => `<svg viewBox="0 0 88 80" aria-hidden="true">${BRAND_PATHS.map((d) => `<path d="${d}"/>`).join("")}</svg>`;
