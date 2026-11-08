script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

CATEGORY = "Visualization";

function run() {
  
  // detect visualization framework
  Boostlet.init();

  if (Boostlet.framework.name != 'niivue') {
    alert('Only niivue is supported right now :(');
    return;
  }

  Boostlet.load_script("https://aframe.io/releases/1.3.0/aframe.min.js", function() {

    Boostlet.load_script("https://raw.githack.com/AR-js-org/AR.js/dev/aframe/build/aframe-ar.js", function() {

      const scene = document.createElement('a-scene');
      scene.setAttribute('embedded', '');
      scene.setAttribute('arjs', '');
      scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;');


      // 2. Create a marker
      const marker = document.createElement('a-marker');
      marker.setAttribute('preset', 'hiro');
      scene.appendChild(marker);

      // 3. Create an entity to hold the mesh
      const entity = document.createElement('a-entity');
      entity.setAttribute('position', '0 0 0');
      entity.setAttribute('rotation', '0 0 0');
      marker.appendChild(entity);

      // 4. Create the camera
      const camera = document.createElement('a-entity');
      camera.setAttribute('camera', '');
      scene.appendChild(camera);


      scene.style.zIndex = 31337;

      document.body.appendChild(scene);
      

      setTimeout(() => {

        const meshObj = Boostlet.framework.instance.meshes[0];
        // NiiVue 1.0 names (positions, indices, color 0-1) ?? 0.6 names (pts, tris, rgba255)
        const verts = meshObj.positions ?? meshObj.pts;
        const tris = meshObj.indices ?? meshObj.tris;

        if (tris && tris.length > 0) {
          const indices = new Uint32Array(tris);

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          geometry.computeVertexNormals();

          // 0-1 RGBA: 0.6 rgba255 scaled, else 1.0 color, else minty default
          const rgba = meshObj.rgba255 ? Array.from(meshObj.rgba255, c => c / 255) : meshObj.color ?? [0, 0.8, 0.53, 1];
          const color = new THREE.Color(rgba[0], rgba[1], rgba[2]);

          const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide,
            color: color,
            opacity: rgba[3],
            transparent: rgba[3] < 1
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(0.1, 0.1, 0.1);
          entity.setObject3D('mesh', mesh);

        } else {
          console.warn('Neither offsetPt0 nor tris were available. Nothing to render.');
        }

        currentScale = 0.1;
        window.addEventListener('keydown', (e) => {
          if (e.key === '+' || e.key === '=') {
            currentScale *= 1.1;
          } else if (e.key === '-') {
            currentScale /= 1.1;
          } else {
            return; // ignore other keys
          }

          const obj = entity.getObject3D('mesh');
          if (obj) {
            obj.scale.set(currentScale, currentScale, currentScale);
          }
        });

        window.__POWERBOOSTTIMER__ = setInterval(function() {

          var vid = document.getElementById('arjs-video');
          if (vid) {
            if (vid.style.zIndex == -2) {
              console.log('Raise the vid!');
              vid.style.zIndex = 1337;
              clearInterval(window.__POWERBOOSTTIMER__);
            } else {
              console.log('still waiting... no zStyle');
            }
          } else {
            console.log('still waiting... no vid');
          }

        }, 1000);


      }, 100);




    });

  });

};
