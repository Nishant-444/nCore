# NCore

Nishant Sharma's portfolio: a wall of code with a ghost at the keyboard (`/`), and an editor you can
browse (`/site/`). Static HTML, CSS and ES modules. There is no build step and nothing to install.

```
index.html, intro.css, intro.js   the intro: code wall, nvim ghost, :vsplit, ./face --track, the eye, the dive
site/                              the editor
  editor.js                          views, :commands, keys, boot
  wheel.js                           project wheel + contribution-ink ring
  terminal.js                        typed shell blocks, shots viewer, renderMonth() calendar
  blueprint.js                       about plate: NS ridgelines + a tree grown from 1 point per contribution
  watch.js                           the eye, the desk, the worm (and the ghost that repairs what it eats)
  bar.js                             status bar + 56-day contribution sparkline
shared/                            colorschemes, springs, GitHub client, desk (keyboard + hands), eye, picker
data.js                            ALL content: projects, experience, links, toolkit, certs, intro code + messages
days.js                            daily contribution snapshot + language counts
palettes.js                        28 colorschemes
assets/                            fonts (IBM Plex Mono, OFL) and project screenshots
```

## Edit content
- Projects, experience, links, toolkit and so on live in `data.js`. Add a project to `PROJECTS` and its
  screenshots to `SHOTS`; the wheel, views and bar pick them up automatically.
- The intro's code comes from `INTRO_FILES`, and the two lines the ghost types come from `INTRO.messages`.
- Stars, forks, watchers, commits and files are fetched live from the public GitHub API, with the
  numbers in `GITHUB.fallback` used when the API is unavailable.
- Contributions are a snapshot. To refresh `days.js`, re-scrape
  `https://github.com/users/Nishant-444/contributions` (each cell carries `data-date`, and its tooltip
  holds the count) and update `GITHUB.contributions` in `data.js`.

## Run locally
```
python -m http.server 5173
```
then open http://127.0.0.1:5173

## Deploy
Any static host. On Vercel, import the folder with framework preset "Other" and no build command.

## Keys
Intro: `↩` enters, `:theme` picks a colorscheme, and scrolling moves through the code.
Editor: `↑↓`/`j k` move through projects, `←→` flip screenshots, `↩` focuses the buffer, and `:` opens commands
(`:e weave`, `:colo saga`, `:theme`, `:resume`, `:mail`, `:worm`, `:q` back to the intro).
The den above the sparkline wakes the worm.

## Credits
Colorschemes are palettes from open-source Omarchy themes (MIT).
