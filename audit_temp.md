# Audit

No new actionable findings in the reviewed commit. The previous bounded-view round-trip finding is resolved.

## Scope

- Clean working tree: reviewed `3d2a85b63f46d64fa462cc823ad9e2b69b0e8cf9` against its parent.
- Read `audit_response.md`; checked the capture/setter correction, canvas fallback and PNG changes, token removal, deleted example references, documentation, test configuration, and distribution artifacts.
- Older API inconsistencies and defects documented in the response were not reclassified as new findings. No implementation changes made.

## Checks performed

- Headless system Chrome, local distribution, pinned NiiVue 1.0.0-rc.118: full-view and bounded-view Sobel screenshots matched committed ground truths with zero differing pixels.
- Pixel round trips passed for bounds `[0,0,1,1]`, `[0.5,0.5,1,1]`, `[0,0,0.5,1]`, and `[-0.25,0,0.5,1]`. Verified capture size/placement, pixel values, opacity, and click restoration. Waited for NiiVue's resize after restoring its canvas before recapturing.
- Canvas fallback returned the expected grayscale and RGBA data; PNG encoding/decoding preserved RGBA pixels.
- All ten embedded source-map source files matched current repository source.
- Traced PNG callers and searched source/examples/test references to the deleted Segment Anything example.
- `git diff HEAD^ HEAD --check` reported only four trailing-whitespace lines in generated bundle comments.

## Verification gaps

- Full screenshot suite, WebGPU, external captioning API, and exhaustive orientation/datatype coverage were not run. Focused browser checks used Puppeteer's ES-module entry point.
- No before/after PNG-copy benchmark was run; no performance claim is made.
- Removal of the hardcoded credential is confirmed; revocation of the historical credential remains unverified, as already documented in `audit_response.md`.
