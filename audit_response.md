# Audit response

Branch `niivue-1.0`. Covers the external review (`audit_temp.md`, now deleted) and the internal audit agents. The security/bug agent was still running when this was written; its findings will be appended under "Security pass".

## External review

**P2: NiiVue 1.0 bounded views break `get_image` → `set_image`. Fixed.**
- `get_image()` (v1) records `this.capture = {x, y, width, height}`. The offsets come from `nv.view.boundsOffsetX/Y`, the same values `getCanvasImage` crops with (top-left canvas pixels).
- `set_image` builds the ImageData at the captured size and pastes it at the captured offset. The 0.6 path is unchanged.
- The cropped capture is intentional: it is what this instance draws. Outside the rect, the temporary overlay canvas is transparent; clicking restores NiiVue as before.
- Regression check: `tests/niivue/sobel_v1.html?bounds=x0,y0,x1,y1` calls `setBounds`. It is a new config entry, `sobel_v1_bounds` (`0.5,0.5,1,1`), with ground truth `GroundTruth_Niivue_sobel_v1_bounds.png`.
- Verified in Chrome with bounds `[0,0,0.5,1]`, `[0.5,0.5,1,1]` and `[0,0,1,1]`: the pasted pixels match the capture exactly (0 mismatches), and the rects are 400×1200@(0,0), 400×600@(400,0) and 800×1200@(0,0). 0.6/1.0 slice and subvolume checksums are unchanged.

The review's verification gaps still stand: no WebGPU run, no orientation/datatype matrix, and `npm test` still fails under Node 26.

## Fixed during this audit

| Item | Change |
|---|---|
| **Leaked Hugging Face token** (`examples/imageCaptioning.js`, committed in `3f50bf3`) | Removed; the token is now asked for with `prompt()` at run time and never stored (a bookmarklet's localStorage belongs to the host page). **The token is still in public git history: the owner must revoke it on huggingface.co.** |
| Dead Segment Anything example | `examples/segmentanything.js` was deleted in `815505f` (inside an unrelated sync commit), and its backend (`model-zoo.metademolab.com/.../segment_everything_box_model`) now returns 404. Removed the dead `index.html` button and array entry, the two test pages, the two ground truths and the config entries. Restore from history if a new SAM backend appears. |
| `niivue.js` unused `onMouseDown`/`x1..y2` fields | Deleted. |
| Unused `Util` imports in `cornerstone2d.js`, `xtk.js`, `papaya.js` | Deleted. |
| `Util.load_script` `eval(script)` | Deleted: `eval` on a DOM element is a no-op. |
| `Util.convert_to_png` element-by-element copy | `imgdata.data.set(...)`, same clamping. |
| `canvasFallback.get_image` computed grayscale even when RGBA was requested | Now computes only the format asked for. |

## For discussion (not changed)

These are API or deletion decisions for the maintainers:

1. **The meaning of `get_image(true)` differs per framework.**
   - NiiVue: raw slice voxels whenever the argument is *defined*, even `false` (set in `63b4da3`, "real pixel access").
   - Cornerstone and canvas fallback: canvas RGBA.
   - Consequence: `examples/imageCaptioning.js` sends voxels with slice dimensions to `convert_to_png` on NiiVue, which produces a garbage PNG.
   - Proposal: `get_image(true)` = canvas RGBA everywhere, with NiiVue raw slices via `get_subvolume`. Needs a maintainer decision because `63b4da3` chose the current meaning.
2. **NiiVue `set_mask` throws on 0.6 and 1.0 (since `63b4da3`).** It builds ImageData from raw voxels of length w·h. Its only caller was the removed Segment Anything example. Options:
   - A: delete the mask/box path (`set_mask`, `harden_mask`, `select_box`, `select_seed`, BoxCraft submodule, `operatingSystem.js`; about 250 lines). Third-party bookmarklets using them would break.
   - B: fix it once item 1 is decided.
   - Also, Cornerstone `select_box` is broken either way: BoxCraft is never loaded on that path.
3. **Unify the adapters.** Make CanvasFallback the base class, so a framework supplies only `get_canvas()`/`get_rgba()`. This deletes `framework.js`, `xtk.js`, `papaya.js` and NiiVue's duplicated `set_image`/`set_mask`. Separately, flip 0.6 readback once in `get_image` and drop `flip_on_png`. Medium risk, covered by the sobel/plotly screenshots. Better as its own PR, after item 1.
4. **The `Object.prototype.global` hack in `Util.load_script`.** It adds a getter to every object, and its setter reassigns `globalThis`. `window.global ??= window` resolves free `global` the same way. Not changed because the OpenNeuro case it was written for needs re-testing.
5. **`Util.filter`.** It copies a buffer it then fully overwrites, and its top and bottom rows read out of bounds (NaN → 0). Fix by looping over interior rows only. Not changed: this is a hot loop and needs a before/after benchmark.
6. **Hygiene.**
   - `package.json`: test tools (puppeteer, pixelmatch, pngjs, signale, cloudinary, live-server, @actions/core) belong in devDependencies, and chalk, cross-env and process are unused.
   - `server/package.json` is a stale Express manifest for what is now a Cloudflare worker.
   - `tests/dev.html` mocks `window.nv = {}`, which detection now rejects.
   - The 9 MB `opencv.js` loads on every NiiVue test page.
   - Left for a separate hygiene PR to keep the NiiVue PR reviewable.

## Security pass

Pending: the security/bug agent had not reported when this was written.

## Verification

- Rebuilt `dist/boostlet.min.js`. Headless Chrome (system Chrome via puppeteer-core): 0.6 vs 1.0 slices and subvolumes are bit-identical, crosshair hiding holds, click-restore works, and the bounded round trips above pass.
- The canvas-fallback change is covered by the papaya/xtk/osd sobel pages. Those load production dist from boostlet.org, so they don't exercise this branch until it is deployed.
