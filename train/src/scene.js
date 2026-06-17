import * as THREE from 'three';

const SKY_COLOR = 0x7ec8e3;
const FRUSTUM_SIZE = 90;

const NIGHT_COLOR = 0x070714;

const WEATHER = [
  { sky: 0x7ec8e3, fogNear: 200, fogFar: 500, sunCol: 0xffeedd, sunInt: 1.4, ambInt: 0.4, hSky: 0x87ceeb, hGround: 0x3a7d44 },
  { sky: 0x4a5a6a, fogNear: 80,  fogFar: 280, sunCol: 0x8899aa, sunInt: 0.5, ambInt: 0.3, hSky: 0x5a6a7a, hGround: 0x3a4a3a },
  { sky: 0x8a8a8a, fogNear: 15,  fogFar: 100, sunCol: 0x999988, sunInt: 0.3, ambInt: 0.35, hSky: 0x8a8a8a, hGround: 0x6a6a6a },
  { sky: 0x9a9aaa, fogNear: 60,  fogFar: 220, sunCol: 0xccccdd, sunInt: 0.6, ambInt: 0.4, hSky: 0x9a9aaa, hGround: 0xaaaacc },
];

const _c = new THREE.Color();

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.Fog(SKY_COLOR, 200, 450);

  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.OrthographicCamera(
    -FRUSTUM_SIZE * aspect / 2,
    FRUSTUM_SIZE * aspect / 2,
    FRUSTUM_SIZE / 2,
    -FRUSTUM_SIZE / 2,
    0.1, 600
  );

  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.ACESFilmicToneMapping !== undefined) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  }
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x8899bb, 0.4);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
  sun.position.set(60, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 300;
  sun.shadow.bias = -0.001;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
  fill.position.set(-40, 60, -30);
  scene.add(fill);

  window.addEventListener('resize', () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const a = w / h;
    camera.left = -FRUSTUM_SIZE * a / 2;
    camera.right = FRUSTUM_SIZE * a / 2;
    camera.top = FRUSTUM_SIZE / 2;
    camera.bottom = -FRUSTUM_SIZE / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  return { scene, camera, renderer, sun, ambient, hemi };
}

export function updateCamera(camera, sun, trainPos, trainForward) {
  const behind = trainForward.clone().multiplyScalar(-45);
  const offset = new THREE.Vector3(-45, 55, 0).add(behind);
  const target = trainPos.clone().add(offset);
  camera.position.copy(target);
  camera.lookAt(trainPos);
  camera.updateProjectionMatrix();

  sun.position.copy(trainPos).add(new THREE.Vector3(60, 120, 40));
  sun.target.position.copy(trainPos);
  sun.target.updateMatrixWorld();
}

function lerpColor(hexA, hexB, t) {
  _c.setHex(hexA).lerp(new THREE.Color(hexB), t);
  return _c;
}

export function updateEnvironment(scene, sun, ambient, hemi, dayAmount, wA, wB, blend) {
  const w = WEATHER[wA];
  const wn = WEATHER[wB];

  const skyCol = lerpColor(w.sky, wn.sky, blend);
  const nightCol = new THREE.Color(NIGHT_COLOR);
  const finalSky = skyCol.clone().lerp(nightCol, 1 - dayAmount);

  scene.background.copy(finalSky);
  scene.fog.color.copy(finalSky);
  scene.fog.near = w.fogNear + (wn.fogNear - w.fogNear) * blend;
  scene.fog.far = w.fogFar + (wn.fogFar - w.fogFar) * blend;

  const sunCol = lerpColor(w.sunCol, wn.sunCol, blend);
  const nightSun = new THREE.Color(0x222244);
  const finalSunCol = sunCol.clone().lerp(nightSun, 1 - dayAmount * 0.8);
  sun.color.copy(finalSunCol);
  sun.intensity = (w.sunInt + (wn.sunInt - w.sunInt) * blend) * (0.08 + 0.92 * dayAmount);

  ambient.intensity = (w.ambInt + (wn.ambInt - w.ambInt) * blend) * (0.15 + 0.85 * dayAmount);

  const hSky = lerpColor(w.hSky, wn.hSky, blend);
  const hGround = lerpColor(w.hGround, wn.hGround, blend);
  const nSky = new THREE.Color(0x0a0a2a);
  const nGround = new THREE.Color(0x050515);
  hemi.color.copy(hSky.clone().lerp(nSky, 1 - dayAmount));
  hemi.groundColor.copy(hGround.clone().lerp(nGround, 1 - dayAmount));
}
