/* :colorscheme picker — a bordered list with live preview. Enter keeps, Esc restores. */
import { palettes, swatchesOf, key, make } from "./common.js";

const ROWS = 8;

export function createPicker({ apply, current, onClose, place }) {
  const box = make("div", "picker");
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "colorscheme");
  const title = make("span", "picker-title", "colorscheme");
  const field = make("label", "picker-input", ":");
  const input = make("input");
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "filter colorschemes");
  field.append(input);
  const list = make("ol", "picker-list");
  const count = make("span", "picker-count");
  box.append(title, field, list, count);
  document.body.append(box);

  const names = [...palettes.keys()];
  let items = names;
  let at = 0;
  let before = null;
  let open = false;

  function render(preview = true) {
    const q = key(input.value);
    items = names.filter((n) => n.includes(q));
    at = Math.max(0, Math.min(at, items.length - 1));
    const top = Math.max(0, Math.min(at - 3, items.length - ROWS));
    list.replaceChildren(
      ...items.slice(top, top + ROWS).map((name, k) => {
        const theme = palettes.get(name);
        const li = make("li");
        li.dataset.name = name;
        if (top + k === at) li.className = "is-on";
        const sw = make("span", "sw");
        sw.append(...swatchesOf(theme).map((c) => Object.assign(make("i"), { style: `background:${c}` })));
        li.append(make("span", "nm", name), sw);
        if (theme.light) li.append(make("span", "lt", "light"));
        return li;
      }),
    );
    count.textContent = `${items.length ? at + 1 : 0}/${items.length}`;
    if (preview && items[at]) apply(items[at], false);
  }

  function show() {
    if (open) return;
    open = true;
    before = current();
    input.value = "";
    at = Math.max(0, names.indexOf(before));
    box.hidden = false;
    render(false);
    const w = 300;
    const h = box.offsetHeight;
    const p = place?.(w, h) || { x: innerWidth / 2 - w / 2, y: innerHeight / 2 - h / 2 };
    Object.assign(box.style, { left: `${Math.round(p.x)}px`, top: `${Math.round(p.y)}px`, width: `${w}px` });
    input.focus({ preventScroll: true });
  }

  function close(keep) {
    if (!open) return;
    open = false;
    const chosen = keep ? items[at] : null;
    apply(chosen || before, Boolean(chosen));
    box.hidden = true;
    input.blur();
    onClose?.(chosen || null);
  }

  input.addEventListener("input", () => {
    at = 0;
    render();
  });
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n") || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      at = (at + 1) % Math.max(1, items.length);
      render();
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p") || (e.key === "Tab" && e.shiftKey)) {
      e.preventDefault();
      at = (at - 1 + items.length) % Math.max(1, items.length);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    }
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    e.preventDefault();
    at = items.indexOf(li.dataset.name);
    render();
    close(true);
  });
  input.addEventListener("blur", () => setTimeout(() => open && document.activeElement !== input && close(false), 120));

  return { show, close, toggle: () => (open ? close(true) : show()), get open() {
    return open;
  } };
}
