# Boostlet: developer notes

Bookmarklet runtime: `window.Boostlet` gives examples one API over several web viewers.

## Map

- `src/index.js`: entry; sets `window.Boostlet`.
- `src/boostlet.js`: public API; delegates to `this.framework`.
- `src/framework.js`: adapter base class (`get_image`, `set_image`, `set_mask`, `select_box`, `convert_to_png`).
- `src/util.js`: framework detection (`window.nv`/`window.niivue` → window scan for NiiVue → cornerstone → `window.r` XTK → OpenSeadragon → `papayaContainers` → canvas fallback), filter, PNG, grayscale/RGBA, hint.
- `src/frameworks/niivue.js`: NiiVue 0.6 + 1.0 adapter; `volume_data()` RAS voxel reader.
- `src/frameworks/cornerstone2d.js`, `openseadragon.js`: native adapters.
- `src/frameworks/papaya.js`, `xtk.js`: thin wrappers over `canvasFallback.js` (largest `<canvas>`, 2D).
- `examples/*.js`: boostlets. Header loads `https://boostlet.org/dist/boostlet.min.js`, sets `CATEGORY`, defines `run()`. Listed in `index.html` (`examples` array), fetched from GitHub `main`.
- `examples/EXAMPLES.txt`: real-world test URLs.
- `index.html`, `CNAME`: boostlet.org site (GitHub Pages serves this repo).
- `dist/`: build output. `boostlet.min.js(.map)`, `boxcraft.min.js` tracked.
- `submodule/BoxCraft`: ROI widgets, built into `dist/boxcraft.min.js`.
- `tests/<framework>/*.html`: screenshot test pages. `tests/dev.html` (src), `tests/dist.html` (build): console prototyping.
- `tests/scripts/`: puppeteer runner; `config.json` maps framework/type → URL; `images/GroundTruth_*.png`.
- `tests/validation/`: nibabel check for roiStats numbers.
- `server/server.js`: Cloudflare worker for sync (Pusher auth, room-code KV). `server/package.json` is a stale Express manifest.

## Build / test

- Build: `npx parcel build --no-cache`. `npm run build` also inits the submodule and builds BoxCraft.
- Dev server: `npm run dev` (live-server :5501). Test pages use `http://127.0.0.1:5501/...`.
- `npm test`: puppeteer 21 fails under Node 26 (yargs ESM error), and puppeteer's Chrome download postinstall is blocked by npm allow-scripts. Workaround: puppeteer-core + system Chrome (`executablePath`).
- Runner waits for `window.TESTCOMPLETED === true`, sleeps 30 s, screenshots to `tests/scripts/images/Test_<date>_<Framework>_<type>.png` (gitignored), pixelmatches against ground truth.
- Examples and most test pages load production dist from boostlet.org, so they test production, not your build. `tests/niivue/sobel_v1.html` loads local `/dist`.

## Conventions

- `dist/` is gitignored; commit builds with `git add -f dist/boostlet.min.js dist/boostlet.min.js.map`.
- New test page: set `window.TESTCOMPLETED = true` when done; add URL to `tests/scripts/config.json`; ground truth `tests/scripts/images/GroundTruth_<Framework>_<type>.png` (Framework as in config: `Niivue`, `OpenSeaDragon`, `Papaya`, `Xtk`).
- New example: add to `index.html` `examples` array.

## NiiVue 0.6 vs 1.0

- Detection: `this.v1 = typeof instance.getCanvasImage === 'function'`.
- 1.0 pages are usually ES modules; no `window.nv`. Use `Boostlet.init('niivue', nv)` or set `window.nv`.
- Accessors: `slice_type()` = `sliceType` (1.0) / `opts.sliceType` (0.6); `crosshair_pos()` = `crosshairPos` / `scene.crosshairPos`.
- `get_image()`: 1.0 uses `getCanvasImage()` (WebGL2 and WebGPU), crosshair hidden via `crosshairWidth = 0`, top-left origin, no flip. 0.6 uses `gl.readPixels` (bottom-up, `flip_on_png`).
- `get_image(true)`, `get_subvolume(start, end)`: `volume_data()`, a port of 0.6 `NVImage.getVolumeData` (removed in 1.0). RAS voxel coords, end inclusive, clamped. Reads `dimsRAS`, `img2RASstart`, `img2RASstep`, `img` (present in both).
- 1.0 bounded views (`setBounds`): `get_image` returns only the instance's rect; it stores `this.capture = {x, y, width, height}` (from `nv.view.boundsOffsetX/Y`, top-left canvas px) and `set_image` pastes back there. Outside the rect the overlay canvas is transparent.
- Tested: 1.0.0-rc.118. `tests/niivue/sobel_v1.html` (`?bounds=x0,y0,x1,y1` calls `setBounds`); config types `sobel_v1`, `sobel_v1_bounds`.
- Not ported (use 0.6 internals): brainchop_runner, sync, PixelExplorer, roiStats, numpyBoostlet, meshAR/fibersAR, trako. Per-API mapping: `/Users/chris/dcm/niivue-parity.md`.
- Trap: in-place `vol.img` edits + `updateGLVolume()` silently do nothing on 1.0 (textures cached by buffer identity); set `vol.isDirty = true` or call `updateVolumeData(i)`.

## Next steps

From niivue-parity.md:

1. Merge this branch (core API + capture on 1.0).
2. NiiVue core: `canvas.niivue = this` (R1) and RAS voxel helpers `getVolumeData`/`setVolumeData`/`rasToIndex` (R2). Then detect via `canvas.niivue` before the window scan, and drop `volume_data()`.
3. Port PixelExplorer, roiStats (`locationChange` event, `nv.sliceType`, `nv.crosshairPos`), numpyBoostlet (dirty flag).
4. Rewrite brainchop on `@brainchop/mindgrab`: `saveVolume` → `segment` → `addVolume`.
5. Port sync to `change` events; `saveVolume` replaces the hand-written NIfTI writer.
6. meshAR/fibersAR: `positions`/`indices`/`color` (0–1). trako: `addMesh({url})`.

## Audit notes

2026-11-08 audit (details: `audit_response.md`):
- Fixed: 1.0 bounded-view round trip; leaked HF token removed from `examples/imageCaptioning.js` (still in history from `3f50bf3` → owner must revoke); dead Segment Anything example (backend 404) removed; small dead-code cleanups.
- Open, needs maintainer decision: `get_image(true)` means raw voxels on NiiVue but canvas RGBA elsewhere (breaks imageCaptioning on NiiVue); NiiVue `set_mask` throws since `63b4da3` (fix vs delete mask/box/BoxCraft path); unify adapters on CanvasFallback; `Object.prototype.global` hack; `Util.filter` OOB reads (benchmark first); package.json dep hygiene; stale `server/package.json`, `tests/dev.html`.
- Never commit API tokens in examples; ask at run time (don't store: bookmarklet storage belongs to the host page).
