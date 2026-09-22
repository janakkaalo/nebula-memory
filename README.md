# Nebula Memory Arcade

Four ready to play memory games in a moving cosmic world. Vite + React + Three.js. Free to host on GitHub Pages.

Games:
- Nebula Flip: classic pair match, easy 12 and hard 24 cards, 3D flip
- Pulse Sequence: Simon style with 4 glowing orbs, 10 rounds, WebAudio sounds
- Cube Pairs 3D: real Three.js cubes, drag to orbit, tap to match runes
- Flash Grid Recall: memorize flash, recall tiles, 5 levels

## Run locally

```bash
cd nebula-memory
npm install
npm run dev
```

Open the localhost link. Test at 375px width for mobile.

## Build

```bash
npm run build
npm run preview
```

Output is `dist/`. Page weight excluding Three.js is about 250KB JS plus 14KB CSS. Three.js chunk is about 544KB, lazy games are 2 to 6KB each.

## Host free on GitHub Pages

Option A, this folder is a subfolder (current layout):
- Push the whole repo. The workflow at `../.github/workflows/deploy.yml` builds `nebula-memory/` and publishes `dist/`.
- In GitHub go to Settings, Pages, Source: GitHub Actions.
- Live URL is `https://USERNAME.github.io/REPO-NAME/`. Base is `./` so it works on project pages.

Option B, you want this app as repo root:
- Move contents of `nebula-memory/` to repo root.
- Change workflow `working-directory` to `./` and paths to `package-lock.json` and `dist/`.

After deploy, patch `og:image` and `og:url` in `index.html` with the live URL if you need link previews.

## Controls

- Flip and Flash: click or tap, keyboard focusable.
- Pulse: watch, then click orbs.
- Cube 3D: drag to orbit, tap a cube to flip. Restart reshuffles.
- Sound toggle in hero. Scores save in localStorage. Reset in footer.
