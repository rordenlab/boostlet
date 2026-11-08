// Runs examples/<name>.js against the LOCAL build (its boostlet.org URL is rewritten to
// /dist/boostlet.min.js), so test pages exercise this checkout rather than production.
// Use <script src="js/local_example.js" data-example="sobel"></script>, or call loadLocalExample(name).
// Waits for window.nv to hold a volume so the example never runs on a loading screen.
async function loadLocalExample(name) {
  while (!window.nv?.volumes?.length) await new Promise(r => setTimeout(r, 100))
  const source = await fetch(`/examples/${name}.js`).then(r => r.text())
  const script = document.createElement('script')
  script.src = URL.createObjectURL(new Blob([source.replaceAll('https://boostlet.org/dist/boostlet.min.js', '/dist/boostlet.min.js')]))
  document.head.appendChild(script)
}
if (document.currentScript?.dataset.example) loadLocalExample(document.currentScript.dataset.example)
