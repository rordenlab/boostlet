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
4. ~~The `Object.prototype.global` hack~~: fixed in the security pass. Re-test OpenNeuro.
5. **`Util.filter`.** It copies a buffer it then fully overwrites, and its top and bottom rows read out of bounds (NaN → 0). Fix by looping over interior rows only. Not changed: this is a hot loop and needs a before/after benchmark.
6. **Hygiene.**
   - `package.json`: test tools (puppeteer, pixelmatch, pngjs, signale, cloudinary, live-server, @actions/core) belong in devDependencies, and chalk, cross-env and process are unused.
   - `server/package.json` is a stale Express manifest for what is now a Cloudflare worker.
   - `tests/dev.html` mocks `window.nv = {}`, which detection now rejects.
   - The 9 MB `opencv.js` loads on every NiiVue test page.
   - Left for a separate hygiene PR to keep the NiiVue PR reviewable.

## Security pass

The root cause behind several findings: `POST /scene` (`server/server.js`) stores any `sceneUrl` for any unclaimed code, and `examples/sync.js` trusts the scene JSON it points to. A code stays unclaimed if the host's Dropbox OAuth is blocked or declined, so scene contents and peer messages are attacker-controlled.

**Fixed (client side, separate commit):**

| Sev | Finding | Fix |
|---|---|---|
| P1 | `sync.js`: a scene `originUrl` of `javascript:…` was assigned to `location.href`, running script on the joiner's origin (verified in Node). An `https:` value was an open redirect. | Allow `https:` only, and confirm before navigating to the other origin. |
| P1 | Hugging Face token committed | Removed (see above); **revoke it**. The rest of the secret scan is clean: Pusher and Dropbox keys are public client keys, server secrets come from env, and the `AKIA…` hits are base64 inside minified test libraries. |
| P2 | `numpyBoostlet.js`: a peer could `numpy-edit` the editor and then `numpy-run` it, executing their code on every peer | A remote run now only shows a hint; running requires a local click. |
| P2 | `sync.js` `promptBoostlets`: one click loaded any scene-supplied script URL (only the name was shown) | Only `https://boostlet.org/examples/` URLs are offered. |
| P2 | `Util.load_script`: the `Object.prototype.global` setter reassigned `globalThis` on any `obj.global = x` in the host page, and could not be undone | Replaced with `window.global ??= window`. Still needs a re-test on OpenNeuro, the case it was written for. |
| P2 | `sync.js`: peers could make everyone load any volume URL. `isDropboxUrl` was a substring check (`https://evil/x?dropbox.com` passed) | Parsed check: `https:` and host `dl.dropboxusercontent.com` for `volume-ready`; the scene's `volumeUrl` must be `https:`. |
| P2 | `sync.js`: joining from the host panel left the first Pusher connection, its peers and its animation-frame loop running | `connectToRoom` tears the previous connection down first. |
| P3 | `sync.js`: the OAuth `message` listener accepted any window | Requires `e.source === popup` and the redirect origin. |
| P3 | `Util.hint` and `webllm.js` put remote text into `innerHTML` | `textContent`. |

**Open: server/infrastructure (not changed; needs the worker's owner to deploy):**
- `POST /scene`: no size cap or rate limit; invalid JSON returns a 500 without CORS; `sceneUrl` should be limited to `https://dl.dropboxusercontent.com/…`.
- Old token-less entries can be taken over, and 5-character codes are still accepted.
- The auth endpoint signs any channel and any caller-chosen `user_id`, and clients trust `from` in signalling payloads. Fix: restrict `channel_name` to `presence-boostlet-[a-z0-9]{5,32}`, set `user_id = socket_id`, and have the client use `metadata.user_id`.
- The auth worker (`bronsdonayden.workers.dev`) and the OAuth redirect (`bronsdonayden.github.io`) live on a contributor's accounts. Move both to an origin the project owns.
- Privacy: volumes and scenes are uploaded as public Dropbox links, and `originUrl` carries the full query string (possibly signed tokens). Warn before upload, and strip or allowlist query parameters.
- `sync.js` polls `Boostlet.init()` every 300 ms forever on non-NiiVue pages. Cap the attempts.
- The 1.0 breakage of sync, PixelExplorer and roiStats is already tracked under NiiVue porting.

No problems were found in `volume_data`, the `Boostlet.init('niivue', nv)` path, or room-code entropy (about 52 bits).

## Verification

- Rebuilt `dist/boostlet.min.js`. Headless Chrome (system Chrome via puppeteer-core): 0.6 vs 1.0 slices and subvolumes are bit-identical, crosshair hiding holds, click-restore works, and the bounded round trips above pass.
- The canvas-fallback change is covered by the papaya/xtk/osd sobel pages. Those load production dist from boostlet.org, so they don't exercise this branch until it is deployed.

## Audit 2 (easy NiiVue 1.0 fixes, before commit)

**External review (`audit_temp.md`, deleted):** no actionable findings. Its notes:
- The roiStats 49-pixel difference was within tolerance. With the loader change below, all four 1.0 pages now match exactly.
- The fixed 5 s `TESTCOMPLETED` timer is acknowledged. The runner then waits another 30 s, so a slow CDN would need more than 35 s to break it. Left as is.

**Agents. Fixed:**

| Sev | Finding | Fix |
|---|---|---|
| P0 | `numpyBoostlet.js`: making `refreshVolume` local (refactor pass) put it out of scope for the top-level `undoCode`, so Undo threw `ReferenceError` | Moved to module scope. |
| P1 | The 0.6 `pixelexplorer`/`roistats` test pages ran the examples against boostlet.org's production build, which has no `on_location`, so they would fail until deploy | New `tests/niivue/js/local_example.js`, used by every NiiVue test page: it waits for `window.nv` to hold a volume, then runs the example against local `/dist`. Waiting also removes a race where sobel ran on the loading screen. |
| P3 | Multiplanar views always sampled the axial plane | Use `loc.axCorSag` (the clicked tile) when set. |
| P3 | `fibersAR` copied `trx.vertices` | Uses it directly; 0.6 still wraps `pts`. |
| — | Refactor: duplicated slab code, dead `Math.round`/empty-data checks, `nv.volumes[0]` lookups, meshAR 0–255 round trip | Trimmed. `get_subvolume` already rounds and clamps. |

**Not changed (YAGNI or pre-existing):**
- `on_location` has no unsubscribe (examples guard re-runs with `window._XLoaded`).
- Detection checks only the first `niivue-viewer`/`niivue-scene` with the default tag names.
- `createOnLocationChange()` fires the host's own location handlers once, which is benign.
- numpy's benchmark timings don't await 1.0's async `updateGLVolume`.
- The `example` parameter in the test page can only fetch same-origin `/examples/*.js`.

**Verification:** all 9 NiiVue screenshot configs, mirroring the runner (800×1200, 30 s settle, pixelmatch threshold 0.1, 5% rule) on the local build:
- 1.0 `sobel_v1`, `sobel_v1_bounds`, `pixelexplorer_v1`, `roistats_v1`: 0 differing pixels.
- 0.6 `sobel` 3.23%, `plotly` 0.17%, `subvolume` 0.05%, `pixelexplorer` 2.45%, `roistats` 0.23%: all pass.
- At HEAD on this Mac, the 0.6 pages using the production build didn't even load their volume headlessly. Their byte-exact mismatch is environmental (the ground truths come from CI).
- Behaviour checks: on 1.0, roiStats updates on crosshair moves, the dirty-flag refresh works, and web-component detection works; on 0.6, PixelExplorer and roiStats work with the local build.
