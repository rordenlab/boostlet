# Boostlet: developer notes

Bookmarklet runtime: `window.Boostlet` gives examples one API over several web viewers.

## Map

- `src/index.js`: entry; sets `window.Boostlet`.
- `src/boostlet.js`: public API; delegates to `this.framework`.
- `src/framework.js`: adapter base class (`get_image`, `set_image`, `set_mask`, `select_box`, `convert_to_png`).
- `src/util.js`: framework detection (`window.nv`/`window.niivue` → `<niivue-viewer>.nv` / `<niivue-scene>.scene.getNiivue(0)` → window scan for NiiVue → cornerstone → `window.r` XTK → OpenSeadragon → `papayaContainers` → canvas fallback), filter, PNG, grayscale/RGBA, hint.
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
- Examples load production dist from boostlet.org. NiiVue test pages run them through `tests/niivue/js/local_example.js`: it waits for `window.nv` to hold a volume, then runs `examples/<name>.js` with every `https://boostlet.org/` URL rewritten to the local server (dist and helper examples such as `brainchop_runner.js`; so build first). OpenSeaDragon/Papaya/XTK pages still load production.
- 0.6 NiiVue ground truths were made in CI and don't reproduce byte-exactly on macOS; with the local build they pass the runner's 5% pixelmatch rule (0.05–3.2%). 1.0 pages match exactly.

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
- Tested: 1.0.0-rc.118 via `tests/niivue/v1.html?example=<name>&bounds=x0,y0,x1,y1`: runs the real `examples/<name>.js` (default sobel) via `local_example.js`; `?data=<url>` picks the volume (default `data/avf.nii.gz`); sets `TESTCOMPLETED` after a fixed 5 s (the runner then waits 30 s more). Config types `sobel_v1`, `sobel_v1_bounds`, `pixelexplorer_v1`, `roistats_v1`.
- `on_location(cb)`: 1.0 `addEventListener('locationChange', e => cb(e.detail))`; 0.6 chains `onLocationChange`; then `createOnLocationChange()` fires once. `slice_type()` exposed on Boostlet.
- Examples ported to both versions: PixelExplorer, roiStats (`on_location`, `slice_type`; PixelExplorer also `cal_min ?? calMin`), numpyBoostlet (`Boostlet.refresh_volume()` sets `isDirty`), meshAR (`positions ?? pts`, `indices ?? tris`, `color` 0–1), fibersAR (`trx.offsets/vertices ?? offsetPt0/pts`).
- sync (both versions): reads via `Boostlet.framework.crosshair_pos()` / `Boostlet.slice_type()` / `cal_min ?? calMin`; 1.0 writes via `nv.crosshairPos =`, `nv.sliceType =`, `nv.setVolume(0, {colormap, calMin, calMax})`; uploads use NiiVue's own NIfTI (`saveVolume` / 0.6 `saveImage`, `filename: ''`). Change detection is still per-frame `requestAnimationFrame` polling (one path for both versions; paused in background tabs). Detection poll gives up after ~30 s.
- brainchop (both versions): `brainchop_runner.js` uses `@brainchop/mindgrab` from jsdelivr (`segment`, `worker: false` since a CDN module worker can't start in a host page). Prompts for a label model (mindmap default). 1.0: `addColormap` + `addVolume({url: File})`; 0.6: `NVImage.new` (via `volumes[0].constructor`) + `setColormapLabel` + `addVolume`, tolerating a throwing host `onImageLoaded`. ~2.5 s on WebGPU.
- Testing sync without the live services: stub `window.Pusher` with a BroadcastChannel relay (JSON-serialize payloads), block `workers.dev`/dropbox, open two pages, `bringToFront()` before changing each (rAF).
- trako (both versions): decoded TKO line segments are joined into streamlines and written as an in-memory MRtrix `.tck` (`fibersToTck`), loaded via 1.0 `addMesh({url: File})` / 0.6 `loadFromArrayBuffer`. A leading NaN triplet works around a NiiVue TCK reader bug (0.6 and 1.0rc drop the first streamline; see niivue-parity.md).
- imageCaptioning: HF router `v1/chat/completions` with `google/gemma-4-31B-it` (BLIP has no inference provider); image is a PNG data URL of the view: canvas RGBA via `get_image(true)`, except NiiVue `get_image()` grayscale (raw-voxel contract). Token prompted at run time. Request/PNG verified with a stubbed endpoint on 0.6 and 1.0 (PNG = view exactly); never run against the live API (needs a token).
- Every example supports NiiVue 0.6 and 1.0. Examples load boostlet.org's dist, so the 1.0 paths are live only after this branch is deployed. Per-API mapping: `/Users/chris/dcm/niivue-parity.md`.
- Trap: in-place `vol.img` edits + `updateGLVolume()` silently do nothing on 1.0 (textures cached by buffer identity); set `vol.isDirty = true` or call `updateVolumeData(i)`.

## Next steps

Medium pass (sync, brainchop) committed ba9f65c. Final pass (trako, imageCaptioning) done 2026-11-08 incl. audit 4–5 fixes, committed.

Later:
- NiiVue core (niivue-parity.md R1/R2): `canvas.niivue`, RAS voxel helpers. Then detect via `canvas.niivue` and drop `volume_data()`.
- NiiVue TCK reader fix: niivue/mono#623 (open). Keep trako's leading-NaN workaround while 0.6 is supported (0.6's reader won't be fixed); it is harmless on the fixed 1.0 reader. PR CI: the Playwright jobs fail on GitHub's ubuntu26.04 runner image (`chromium-headless-shell` unsupported), repo-wide, unrelated to the change; Lint/Typecheck/Test passed.
- Audit open items below.

## Audit notes

2026-11-08 audit (details: `audit_response.md`):
- Fixed: 1.0 bounded-view round trip; leaked HF token removed from `examples/imageCaptioning.js` (still in history from `3f50bf3` → owner must revoke); dead Segment Anything example (backend 404) removed; small dead-code cleanups.
- Open, needs maintainer decision: `get_image(true)` means raw voxels on NiiVue but canvas RGBA elsewhere (imageCaptioning works around it); NiiVue `set_mask` throws since `63b4da3` (fix vs delete mask/box/BoxCraft path); unify adapters on CanvasFallback; `Util.filter` OOB reads (benchmark first); package.json dep hygiene; stale `server/package.json`, `tests/dev.html`.
- Never commit API tokens in examples; ask at run time (don't store: bookmarklet storage belongs to the host page).
- Security pass fixed client side (sync URL and protocol checks, OAuth popup check, numpy remote-run, boostlet URL allowlist, `global` hack, `hint` textContent). Open: server `/scene` validation and limits, Pusher auth channel/user_id, infrastructure on a contributor's accounts, Dropbox privacy. Treat sync scene JSON and peer messages as untrusted.
- 2026-11-08 audit 2: external review of easy fixes had no actionable findings
- 2026-11-08 audit 2 agents: fixed numpy `refreshVolume` scope (Undo threw), NiiVue test pages now test the local build (were testing production, which lacks `on_location`), multiplanar uses the clicked tile (`loc.axCorSag`), slab code trimmed, meshAR colour in 0–1, fibersAR no longer copies `trx.vertices`. Not done (YAGNI): `on_location` unsubscribe; detection only checks the first default-named web component; numpy bench timings don't await 1.0's async `updateGLVolume`.
- 2026-11-08 audit 4: external review found HF BLIP undeployed and Cornerstone raw-pixel regression in imageCaptioning: fixed (chat-completions vision model; canvas RGBA except NiiVue). Agents: trako `fibersToTck` writes a preallocated Float32Array (~3.5× faster, byte-identical), drop handler takes one file, awaits the load and reports errors; docs fixed (workaround stays for 0.6, deployment caveat).
- 2026-11-08 audit 5: external review found no new issues; final pass committed.
