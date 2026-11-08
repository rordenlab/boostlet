const CATEGORY = "Visualization"

if (typeof window._PixelExplorerLoaded === 'undefined') {
window._PixelExplorerLoaded = true;

(function() {

const script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = function() {
  /// wait for nv and volumes before calling init
  // calling init too early means niivue won't be detected yet
  var poll = setInterval(function() {
    try {
      Boostlet.init();
      clearInterval(poll);
      run();
    } catch(e) {
      // framework not ready yet keep polling
    }
  }, 300);
};
document.head.appendChild(script);

const HALF = 4;

function run() {
  if (Boostlet.framework.name !== 'niivue') {
    alert('Only niivue is supported right now :(');
    return;
  }

  const nv = Boostlet.framework.instance;
  setup(nv);
}

function setup(nv) {
  // create the panel once
  plot();

  // fires on every crosshair move / slice change, and once now so the panel fills on load
  Boostlet.on_location(function(loc) {
    if (!nv.volumes.length) return;

    // get_subvolume rounds and clamps; collapse the axis perpendicular to the slice
    // (axial z, coronal y, sagittal x). In multiplanar, axCorSag is the clicked tile; else axial.
    const start = loc.vox.map(x => x - HALF), end = loc.vox.map(x => x + HALF);
    const axis = [2, 1, 0][loc.axCorSag >= 0 ? loc.axCorSag : Boostlet.slice_type()] ?? 2;
    start[axis] = end[axis] = loc.vox[axis];

    const { data, dims } = Boostlet.get_subvolume(start, end);
    const mc = document.getElementById('PixelExplorerCanvas');
    if (mc) drawMatrix(data, dims, mc);
  });
}

// render voxel values as a labeled grayscale grid
function drawMatrix(data, dims, mc) {
  const vol = Boostlet.framework.instance.volumes[0];
  const cal_min = vol.cal_min ?? vol.calMin; // 0.6 ?? 1.0
  const cal_max = vol.cal_max ?? vol.calMax;
  const range = cal_max - cal_min || 1;
  const ctx = mc.getContext('2d');

  // apply nifti slope/intercept to convert raw values to display values.
  // raw voxel values can be stored in arbitrary units (e.g. large negatives like -9000)
  // and need to be scaled to match what NiiVue actually displays: display_value = raw * slope + inter
  const slope = vol.hdr.scl_slope || 1;
  const inter = vol.hdr.scl_inter || 0;

  // getVolumeData returns dims as X Y Z and the collapsed axis has size 1
  // the first non-1 dim is cols, second is rows
  const [cols, rows] = dims.filter(d => d > 1);
  if (!cols || !rows) return;

  const cell = Math.floor(Math.min(mc.width / cols, mc.height / rows));
  if (cell < 1) return;

  const showLabels = cell >= 8;
  if (showLabels) {
    ctx.font = `${Math.max(Math.floor(cell * 0.28), 6)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  ctx.clearRect(0, 0, mc.width, mc.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const raw = data[c + (rows - 1 - r) * cols];
      const val = raw * slope + inter;
      const norm = (val - cal_min) / range;
      const g = Math.round(norm * 255);

      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(c * cell, r * cell, cell, cell);

      if (showLabels) {
        ctx.fillStyle = norm > 0.55 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
        ctx.fillText(val.toFixed(0), c * cell + cell / 2, r * cell + cell / 2);
      }
    }
  }
}

function plot() {
  // remove existing panel if re-run
  const existing = document.getElementById('PixelExplorerDiv');
  if (existing) existing.remove();

  let container = window.document.createElement('div');
  container.id = 'PixelExplorerDiv';
  container.style.cssText = 'position:fixed; top:10px; left:10px; z-index:2147483647; cursor:move; border:2px solid #fff; box-shadow:0 0 0 1px #000; border-radius:3px; overflow:hidden; line-height:0;';
  window.document.body.appendChild(container);

  const size = Math.floor(400 / (HALF * 2 + 1)) * (HALF * 2 + 1);

  const mc = document.createElement('canvas');
  mc.id = 'PixelExplorerCanvas';
  mc.width = size;
  mc.height = size;
  mc.style.cssText = `display:block; width:${size}px; height:${size}px;`;
  container.appendChild(mc);

  // drag logic
  let startX, startY, startLeft, startTop;
  container.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    startY = e.clientY;
    startLeft = container.offsetLeft;
    startTop = container.offsetTop;

    function onMove(e) {
      container.style.left = (startLeft + e.clientX - startX) + 'px';
      container.style.top  = (startTop  + e.clientY - startY) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

})();
}
