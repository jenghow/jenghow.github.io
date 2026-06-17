// ─── Planet Guardian ──────────────────────────────────────────────────────
'use strict';

// ── Renderer / Camera ──────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(1.5, 10.5, 7.0);
camera.lookAt(0, 0.5, 0);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ── Helpers ────────────────────────────────────────────────────────────────
const rng = {
  float: (a = 0, b = 1) => a + Math.random() * (b - a),
  int:   (a, b) => Math.floor(rng.float(a, b + 1)),
  pick:  arr => arr[Math.floor(Math.random() * arr.length)],
};

function hash(n) { const x = Math.sin(n) * 43758.5453123; return x - Math.floor(x); }
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x-ix, fy = y-iy, fz = z-iz;
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy), uz = fz*fz*(3-2*fz);
  const v = (a,b,c) => hash(a + b*57 + c*113);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(THREE.MathUtils.lerp(v(ix,iy,iz),v(ix+1,iy,iz),ux), THREE.MathUtils.lerp(v(ix,iy+1,iz),v(ix+1,iy+1,iz),ux), uy),
    THREE.MathUtils.lerp(THREE.MathUtils.lerp(v(ix,iy,iz+1),v(ix+1,iy,iz+1),ux), THREE.MathUtils.lerp(v(ix,iy+1,iz+1),v(ix+1,iy+1,iz+1),ux), uy), uz);
}

// ── Colors ─────────────────────────────────────────────────────────────────
const C = {
  grassLow: 0x7caa4a, grassHigh: 0x5a8c32, sand: 0xe8c97a,
  rock: 0x9e8a6a, water: 0x4a90c8, treeTrunk: 0x7a4e2a,
  treeLeaf: 0x3a7a2a, stone: 0xaa9988, cape: 0xc03030,
  sword: 0xd4c060, shield: 0x7b8c3a, skin: 0xf0c888,
  hair: 0x6a3a1a, armor: 0x9a8a60,
};

// ── Lighting / Sky ─────────────────────────────────────────────────────────
const SKY = {
  morning: { sky: 0xffd090, ambient: 0.6, sun: 0xffcc88, si: 1.0,  fog: 0xffe0b0, fd: 0.012 },
  noon:    { sky: 0x87ceeb, ambient: 0.9, sun: 0xffffff, si: 1.5,  fog: 0xaaddff, fd: 0.008 },
  evening: { sky: 0xff7040, ambient: 0.4, sun: 0xff9050, si: 0.8,  fog: 0xff9060, fd: 0.015 },
  night:   { sky: 0x0a0a25, ambient: 0.15,sun: 0x4466aa, si: 0.3,  fog: 0x050515, fd: 0.018 },
};
const WEATHER = {
  clear:   { pc: null,       fb: 0     },
  rainy:   { pc: 0x88aabb,   fb: 0.012 },
  snowing: { pc: 0xffffff,   fb: 0.005 },
};

let currentTOD = 'morning', currentWeather = 'clear';

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(8, 14, 6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 0.5; sunLight.shadow.camera.far = 80;
sunLight.shadow.camera.left = -12; sunLight.shadow.camera.right = 12;
sunLight.shadow.camera.top  = 12;  sunLight.shadow.camera.bottom = -12;
scene.add(sunLight);
scene.fog = new THREE.FogExp2(0xffd090, 0.012);

function applySky() {
  const s = SKY[currentTOD], w = WEATHER[currentWeather];
  scene.background = new THREE.Color(s.sky);
  ambientLight.intensity = s.ambient;
  sunLight.color.set(s.sun); sunLight.intensity = s.si;
  scene.fog.color.set(s.fog); scene.fog.density = s.fd + w.fb;
}
applySky();

// ── Weather particles (in scene, not on planet) ────────────────────────────
let weatherParticles = null;
function buildWeatherParticles() {
  if (weatherParticles) { scene.remove(weatherParticles); weatherParticles = null; }
  const w = WEATHER[currentWeather];
  if (!w.pc) return;
  const count = 600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]=rng.float(-10,10); pos[i*3+1]=rng.float(-10,10); pos[i*3+2]=rng.float(-10,10);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  weatherParticles = new THREE.Points(geo, new THREE.PointsMaterial({
    color: w.pc, size: currentWeather==='rainy'?0.04:0.09, transparent:true, opacity:0.75
  }));
  scene.add(weatherParticles);
}
buildWeatherParticles();

function updateWeatherParticles(dt) {
  if (!weatherParticles) return;
  const pos = weatherParticles.geometry.attributes.position.array;
  const speed = currentWeather==='rainy'?5:1.2;
  for (let i = 0; i < pos.length; i+=3) {
    pos[i+1] -= speed*dt;
    if (pos[i+1] < -10) pos[i+1] = 10;
  }
  weatherParticles.geometry.attributes.position.needsUpdate = true;
}

// ── Planet ─────────────────────────────────────────────────────────────────
const PLANET_R = 3.2;
// planetGroup holds the sphere + trees + stones.
// We rotate this group to simulate the player walking.
const planetGroup = new THREE.Group();
scene.add(planetGroup);

const baseGeo = new THREE.SphereGeometry(PLANET_R, 64, 64);
const baseVerts = baseGeo.attributes.position;
for (let i = 0; i < baseVerts.count; i++) {
  const v = new THREE.Vector3().fromBufferAttribute(baseVerts, i);
  const n = v.clone().normalize();
  const elev = noise3(n.x*2,n.y*2,n.z*2)*0.35 + noise3(n.x*5,n.y*5,n.z*5)*0.12;
  v.addScaledVector(n, elev);
  baseVerts.setXYZ(i, v.x, v.y, v.z);
}
baseGeo.computeVertexNormals();

const vColors = new Float32Array(baseVerts.count * 3);
for (let i = 0; i < baseVerts.count; i++) {
  const v = new THREE.Vector3().fromBufferAttribute(baseVerts, i);
  const elev = v.length() - PLANET_R;
  let col;
  if (elev < -0.05)     col = new THREE.Color(C.water);
  else if (elev < 0.05) col = new THREE.Color(C.sand);
  else if (elev < 0.20) col = new THREE.Color(C.grassLow);
  else if (elev < 0.32) col = new THREE.Color(C.grassHigh);
  else                   col = new THREE.Color(C.rock);
  vColors[i*3]=col.r; vColors[i*3+1]=col.g; vColors[i*3+2]=col.b;
}
baseGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
const planetMesh = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
planetMesh.castShadow = true; planetMesh.receiveShadow = true;
planetGroup.add(planetMesh);

// ── Surface helpers ────────────────────────────────────────────────────────
// Mirror the exact noise formula used to deform the mesh vertices.
function surfaceElevation(nx, ny, nz) {
  return noise3(nx*2, ny*2, nz*2)*0.35 + noise3(nx*5, ny*5, nz*5)*0.12;
}

// Returns the true deformed surface radius at a unit-direction vector (nx,ny,nz).
function surfaceR(nx, ny, nz) {
  return PLANET_R + surfaceElevation(nx, ny, nz);
}

// Returns a 3-D point on the ACTUAL deformed surface in planet-local space,
// plus an optional stand-off distance (extra) above the terrain.
function localSurfacePos(theta, phi, extra = 0) {
  const nx = Math.sin(phi)*Math.cos(theta);
  const ny = Math.cos(phi);
  const nz = Math.sin(phi)*Math.sin(theta);
  const r  = surfaceR(nx, ny, nz) + extra;
  return new THREE.Vector3(nx*r, ny*r, nz*r);
}

// Place obj on the deformed planet surface, oriented outward.
function placeOnPlanet(obj, theta, phi, extra = 0.02) {
  const pos = localSurfacePos(theta, phi, extra);
  obj.position.copy(pos);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), pos.clone().normalize());
}

// ── Trees & Stones (children of planetGroup – rotate with planet) ──────────
function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.05,0.28,6),
    new THREE.MeshLambertMaterial({color:C.treeTrunk}));
  trunk.position.y = 0.14; g.add(trunk);
  for (let l=0;l<3;l++) {
    const layer = new THREE.Mesh(new THREE.ConeGeometry(0.22-l*0.05,0.2,7),
      new THREE.MeshLambertMaterial({color:l===0?C.treeLeaf:(l===1?0x4a9a3a:0x5aaa4a)}));
    layer.position.y = 0.26+l*0.15; g.add(layer);
  }
  return g;
}
function makeStone() {
  const g = new THREE.Group();
  const r = rng.float(0.07, 0.14);
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0),
    new THREE.MeshLambertMaterial({color:C.stone}));
  mesh.position.y = r * 0.6; // sit base on surface
  mesh.rotation.y = rng.float(0, Math.PI*2); g.add(mesh);
  return g;
}

for (let i=0; i<40; i++) {
  const theta=rng.float(0,Math.PI*2), phi=rng.float(0.3,Math.PI-0.3);
  if (localSurfacePos(theta,phi).length()-PLANET_R < 0.04) continue;
  const t=makeTree(); placeOnPlanet(t,theta,phi,0); planetGroup.add(t);
}
for (let i=0; i<25; i++) {
  const theta=rng.float(0,Math.PI*2), phi=rng.float(0.2,Math.PI-0.2);
  const s=makeStone(); placeOnPlanet(s,theta,phi,0); planetGroup.add(s);
}

// ── Player (lives in scene, NOT inside planetGroup) ────────────────────────
// The player stays fixed at world-space top of the planet.
// We move the planet under the player instead.
const playerGroup = new THREE.Group();
scene.add(playerGroup);   // <-- scene, not planetGroup

function buildPlayer() {
  const g = new THREE.Group();
  const mesh = (geo, color) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({color}));
    m.castShadow=true; m.receiveShadow=true; return m;
  };

  // torso (index 0)
  const torso = mesh(new THREE.BoxGeometry(0.18,0.22,0.12), C.armor);
  torso.position.set(0, 0.30, 0); g.add(torso);

  // head (index 1)
  const head = mesh(new THREE.BoxGeometry(0.14,0.14,0.14), C.skin);
  head.position.set(0, 0.49, 0); g.add(head);

  // hair (index 2)
  const hair = mesh(new THREE.BoxGeometry(0.15,0.06,0.15), C.hair);
  hair.position.set(0, 0.545, 0); g.add(hair);

  // cape (index 3)
  const cape = mesh(new THREE.BoxGeometry(0.18,0.28,0.03), C.cape);
  cape.position.set(0, 0.26, -0.075); g.add(cape);

  // leg L (index 4)
  const legL = mesh(new THREE.BoxGeometry(0.075,0.18,0.09), 0x5a4030);
  legL.position.set(-0.052, 0.10, 0); g.add(legL);

  // leg R (index 5)
  const legR = mesh(new THREE.BoxGeometry(0.075,0.18,0.09), 0x5a4030);
  legR.position.set(0.052, 0.10, 0); g.add(legR);

  // arm L + shield as child (index 6)
  const armL = new THREE.Group();
  armL.position.set(-0.135, 0.28, 0);
  const armLMesh = mesh(new THREE.BoxGeometry(0.07,0.16,0.08), C.armor);
  armL.add(armLMesh);
  const shieldMesh = mesh(new THREE.BoxGeometry(0.12,0.16,0.04), C.shield);
  shieldMesh.position.set(-0.075, 0.02, 0.04);  // relative to armL pivot
  armL.add(shieldMesh);
  g.add(armL);  // index 6

  // arm R + sword as children (index 7)
  // Pivot is at the shoulder; sword pieces are relative to that pivot.
  const armR = new THREE.Group();
  armR.position.set(0.135, 0.28, 0);
  const armRMesh = mesh(new THREE.BoxGeometry(0.07,0.16,0.08), C.armor);
  armR.add(armRMesh);
  // sword handle – relative to arm pivot
  const swordHandle = mesh(new THREE.BoxGeometry(0.03,0.1,0.03), C.treeTrunk);
  swordHandle.position.set(0.075, 0.0, 0.04);
  armR.add(swordHandle);
  // sword guard
  const swordGuard = mesh(new THREE.BoxGeometry(0.09,0.025,0.025), C.sword);
  swordGuard.position.set(0.075, 0.065, 0.04);
  armR.add(swordGuard);
  // sword blade
  const swordBlade = mesh(new THREE.BoxGeometry(0.025,0.2,0.02), C.sword);
  swordBlade.position.set(0.075, 0.16, 0.04);
  armR.add(swordBlade);
  g.add(armR);  // index 7

  return g;
}

const playerMesh = buildPlayer();
playerGroup.add(playerMesh);

// The player stands at the world-space "top" of the planet.
// Its height must track the actual deformed terrain under it each frame,
// which is determined by the planet-local direction that currently points up.
// We recompute this every frame in update().
let PLAYER_SURFACE_Y = PLANET_R;
playerGroup.position.set(0, PLAYER_SURFACE_Y, 0);

// ── Planet rotation state ──────────────────────────────────────────────────
// We track rotation as a quaternion so axes compose correctly.
// WASD tilts the planet: W tilts back (planet rotates so +Z face comes up),
// S tilts forward, A rotates right, D rotates left.
const MOVE_SPEED = 0.018; // radians per frame at 60 fps equivalent

// ── Monster container (also in scene, not planetGroup) ─────────────────────
// Each monster has a (theta, phi) coordinate in the planet's LOCAL frame.
// To find its world position we transform through planetGroup's rotation.
const monsterContainer = new THREE.Group();
scene.add(monsterContainer);

const MONSTER_TYPES = [
  { name:'Goblin',   color:0x50cc50, scale:0.70, speed:0.004, damage:8  },
  { name:'Ogre',     color:0x886644, scale:1.30, speed:0.002, damage:18 },
  { name:'Wraith',   color:0x8888ff, scale:0.90, speed:0.005, damage:12 },
  { name:'Slime',    color:0xaadd44, scale:0.65, speed:0.003, damage:6  },
  { name:'Skeleton', color:0xeeeecc, scale:0.85, speed:0.003, damage:10 },
];

function buildMonsterMesh(type) {
  const g = new THREE.Group();
  const col = type.color;
  const add = (geo, c, px,py,pz) => {
    const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c}));
    m.position.set(px,py,pz); m.castShadow=true; g.add(m); return m;
  };
  add(new THREE.BoxGeometry(0.18,0.20,0.12), col,            0, 0.22,0);
  add(new THREE.BoxGeometry(0.16,0.15,0.14), col,            0, 0.40,0);
  for (const s of [-1,1]) {
    const eye=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,0.02),
      new THREE.MeshLambertMaterial({color:0xff2222}));
    eye.position.set(s*0.04,0.42,0.07); g.add(eye);
  }
  for (const s of [-1,1]) add(new THREE.BoxGeometry(0.07,0.15,0.08),
    new THREE.Color(col).multiplyScalar(0.7).getHex(), s*0.055,0.075,0);
  for (const s of [-1,1]) add(new THREE.BoxGeometry(0.065,0.14,0.07), col, s*0.135,0.22,0);

  // HP bar bg
  const hpBg=new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.04),
    new THREE.MeshBasicMaterial({color:0x550000,depthTest:false}));
  hpBg.position.set(0,0.65,0); g.add(hpBg);
  const hpFg=new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.04),
    new THREE.MeshBasicMaterial({color:0x00cc00,depthTest:false}));
  hpFg.position.set(0,0.655,0.001); g.add(hpFg);

  g.scale.setScalar(type.scale);
  return { mesh:g, hpFg };
}

const monsters = [];
let MAX_MONSTERS = 8;
let spawnTimer = 0;
const SPAWN_INTERVAL = 5.5;

function spawnMonster() {
  if (monsters.length >= MAX_MONSTERS) return;
  const type = rng.pick(MONSTER_TYPES);
  // Spawn away from the player's fixed position (top of planet, phi≈0 in planet local space)
  // Player is always at phi=0 in planet-local coords (top of sphere after rotation applied)
  const theta = rng.float(0, Math.PI*2);
  const phi   = rng.float(0.6, Math.PI-0.3);   // guaranteed away from top
  const built = buildMonsterMesh(type);
  const wrapper = new THREE.Group();
  wrapper.add(built.mesh);
  monsterContainer.add(wrapper);
  monsters.push({ theta, phi, type, hp:5, mesh:wrapper, innerMesh:built.mesh,
    hpFg:built.hpFg, attackCooldown:0, walkAnim:0, dead:false, hitFlash:0 });
  updateMonsterWorldPos(monsters[monsters.length-1]);
}

// Convert planet-local (theta,phi) → world position via planetGroup rotation,
// using the actual deformed terrain height.
function localToWorld(theta, phi, extra=0) {
  const local = localSurfacePos(theta, phi, extra);
  return local.clone().applyQuaternion(planetGroup.quaternion);
}

function updateMonsterWorldPos(m) {
  // extra=0: monster feet (y=0 in local mesh) land exactly on deformed surface
  const wpos = localToWorld(m.theta, m.phi, 0);
  m.mesh.position.copy(wpos);
  const up = wpos.clone().normalize();
  m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
}

for (let i=0;i<4;i++) spawnMonster();

// ── Health packs ───────────────────────────────────────────────────────────
const healthPacks = [];
const healthPackContainer = new THREE.Group();
scene.add(healthPackContainer);
let healthPackTimer = 0;
const HEALTH_PACK_INTERVAL = 18; // seconds between spawns
const MAX_HEALTH_PACKS = 3;
const HEALTH_PACK_PICKUP_RANGE = PLANET_R * 0.35;
const HEALTH_PACK_HEAL = 10;

function makeHealthPackMesh() {
  const g = new THREE.Group();
  // Red cross box base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.08, 0.18),
    new THREE.MeshLambertMaterial({ color: 0xdd2222 })
  );
  g.add(base);
  // White cross — horizontal bar
  const barH = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.10, 0.05),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  barH.position.y = 0.005;
  g.add(barH);
  // White cross — vertical bar
  const barV = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.10, 0.16),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  barV.position.y = 0.005;
  g.add(barV);
  // Subtle glow ring underneath
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12),
    new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.5 })
  );
  ring.position.y = -0.05;
  g.add(ring);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function spawnHealthPack() {
  if (healthPacks.length >= MAX_HEALTH_PACKS) return;
  const theta = rng.float(0, Math.PI * 2);
  const phi   = rng.float(0.25, Math.PI - 0.25);
  const mesh  = makeHealthPackMesh();
  const wrapper = new THREE.Group();
  wrapper.add(mesh);
  healthPackContainer.add(wrapper);
  const hp = { theta, phi, mesh: wrapper, innerMesh: mesh, bob: rng.float(0, Math.PI * 2) };
  healthPacks.push(hp);
  updateHealthPackWorldPos(hp);
}

function updateHealthPackWorldPos(hp) {
  const wpos = localToWorld(hp.theta, hp.phi, 0.12);
  hp.mesh.position.copy(wpos);
  const up = wpos.clone().normalize();
  hp.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
}

// Spawn a couple at start
for (let i = 0; i < 2; i++) spawnHealthPack();

// ── Input ──────────────────────────────────────────────────────────────────
const keys = {};
// Analog joystick state — updated by the on-screen joystick, read in update()
const joystick = { nx: 0, ny: 0 };
window.addEventListener('keydown', e => {
  keys[e.code]=true;
  if (e.code==='KeyP') togglePause();
  if (e.code==='Space' && !paused && !player.dead) doAttack();
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code]=false; });

let paused=false;
function togglePause() {
  paused=!paused;
  document.getElementById('pause-overlay').classList.toggle('active',paused);
}

// Tap/click the pause overlay to resume (works on both mobile and desktop).
// Guard: only resume if actually paused — not on game-over screen.
document.getElementById('pause-overlay').addEventListener('click', () => {
  if (paused && !player.dead) togglePause();
});
document.getElementById('pause-overlay').addEventListener('touchstart', e => {
  if (paused && !player.dead) { e.preventDefault(); togglePause(); }
}, { passive: false });

// ── Player state ───────────────────────────────────────────────────────────
const player = { hp:100, kills:0, attackCooldown:0, attackAnim:0,
                  walkAnim:0, invincible:0, dead:false };

// ── UI ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('[data-tod]').forEach(btn=>btn.addEventListener('click',()=>{
  currentTOD=btn.dataset.tod;
  document.querySelectorAll('[data-tod]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); applySky();
}));
document.querySelectorAll('[data-weather]').forEach(btn=>btn.addEventListener('click',()=>{
  currentWeather=btn.dataset.weather;
  document.querySelectorAll('[data-weather]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); applySky(); buildWeatherParticles();
}));

// Monster count slider
document.getElementById('monster-slider').addEventListener('input', function() {
  MAX_MONSTERS = parseInt(this.value);
  document.getElementById('monster-count-val').textContent = MAX_MONSTERS;
  // Cull excess monsters immediately if slider was lowered
  while (monsters.length > MAX_MONSTERS) {
    const m = monsters.pop();
    m.dead = true;
    monsterContainer.remove(m.mesh);
  }
});

const hitFlashEl = document.getElementById('hitflash');
function triggerHitFlash() {
  hitFlashEl.style.opacity='1';
  setTimeout(()=>{ hitFlashEl.style.opacity='0'; },160);
}

// ── Attack ─────────────────────────────────────────────────────────────────
// In the new scheme the player is always at world (0, PLANET_R, 0).
// A monster is "near" if its world position is close to the player.
const ATTACK_RANGE_WORLD = PLANET_R * 0.55; // halved from 1.1

function doAttack() {
  if (player.attackCooldown>0) return;
  player.attackCooldown=0.5; player.attackAnim=0.4;
  const playerPos = new THREE.Vector3(0, PLAYER_SURFACE_Y, 0);
  for (const m of monsters) {
    if (m.dead) continue;
    if (m.mesh.position.distanceTo(playerPos) < ATTACK_RANGE_WORLD) {
      m.hp--; m.hitFlash=0.25;
      updateMonsterHPBar(m);
      if (m.hp<=0) killMonster(m);
    }
  }
}

function updateMonsterHPBar(m) {
  const ratio=Math.max(0,m.hp/5);
  m.hpFg.scale.x=ratio; m.hpFg.position.x=(ratio-1)*0.14;
  m.hpFg.material.color.set(ratio>0.5?0x00cc00:ratio>0.25?0xffaa00:0xff2222);
}

function killMonster(m) {
  m.dead=true; monsterContainer.remove(m.mesh);
  player.kills++; document.getElementById('kill-count').textContent=player.kills;
}

// ── Main loop ──────────────────────────────────────────────────────────────
let lastTime=0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min((now-lastTime)/1000,0.05); lastTime=now;
  if (paused||player.dead) { renderer.render(scene,camera); return; }
  update(dt);
  renderer.render(scene,camera);
}

function update(dt) {
  updateWeatherParticles(dt);

  // ── Update player height to match terrain under feet ────────────────────
  // The planet-local direction currently pointing world-up is the inverse
  // of planetGroup's rotation applied to (0,1,0).
  const invQ = planetGroup.quaternion.clone().invert();
  const localUp = new THREE.Vector3(0,1,0).applyQuaternion(invQ).normalize();
  PLAYER_SURFACE_Y = surfaceR(localUp.x, localUp.y, localUp.z);
  playerGroup.position.y = PLAYER_SURFACE_Y;

  // ── Rotate planet ────────────────────────────────────────────────────────
  // Combine keyboard (digital) and joystick (analog) into one input vector.
  // Keyboard gives a unit vector on each axis; joystick gives -1..1 floats.
  let inputX = joystick.nx; // +X = right (KeyD), -X = left (KeyA)
  let inputY = joystick.ny; // +Y = backward (KeyS), -Y = forward (KeyW)

  if (keys['KeyA']) inputX = Math.min(inputX - 1, -1);
  if (keys['KeyD']) inputX = Math.max(inputX + 1,  1);
  if (keys['KeyW']) inputY = Math.min(inputY - 1, -1);
  if (keys['KeyS']) inputY = Math.max(inputY + 1,  1);

  // Clamp to unit circle so diagonals aren't faster
  const inputLen = Math.sqrt(inputX*inputX + inputY*inputY);
  const moving = inputLen > 0.01;

  let facingAngle = playerMesh.rotation.y;

  if (moving) {
    const norm = Math.min(inputLen, 1);
    const nx = inputX / inputLen;
    const ny = inputY / inputLen;

    // Invert the tilt axis so the planet rolls away from the input direction
    const axis = new THREE.Vector3(-ny, 0, nx).normalize();
    const rotQ = new THREE.Quaternion().setFromAxisAngle(axis, MOVE_SPEED * norm);
    planetGroup.quaternion.multiplyQuaternions(rotQ, planetGroup.quaternion);

    // Face the direction the joystick points in screen space.
    // camAzimuth = horizontal angle of camera from +Z axis.
    // Adding PI flips "stick up = toward camera" to "stick up = away from camera".
    const camAzimuth = Math.atan2(camera.position.x, camera.position.z);
    facingAngle = Math.atan2(-inputX, -inputY) + Math.PI + camAzimuth;
    playerMesh.rotation.y = facingAngle;
    player.walkAnim += dt * 8 * norm;
  }

  // ── Walk animation ───────────────────────────────────────────────────────
  const wave = Math.sin(player.walkAnim);
  const ch = playerMesh.children;
  // indices: 0=torso,1=head,2=hair,3=cape,4=legL,5=legR,6=armL,7=armR,...
  if (ch.length>7) {
    ch[4].rotation.x = moving ? wave*0.5 : 0;
    ch[5].rotation.x = moving ? -wave*0.5 : 0;
    ch[6].rotation.x = moving ? -wave*0.4 : 0;
    ch[7].rotation.x = moving ? wave*0.4 : 0;
  }
  // Attack swing on sword arm
  if (player.attackAnim>0) {
    player.attackAnim -= dt*3;
    if (ch.length>7) ch[7].rotation.x = -Math.sin(player.attackAnim*Math.PI)*1.5;
  }
  if (player.attackCooldown>0) player.attackCooldown -= dt;
  if (player.invincible>0)     player.invincible -= dt;

  // ── Monster AI ───────────────────────────────────────────────────────────
  const playerWorldPos = new THREE.Vector3(0, PLAYER_SURFACE_Y, 0);

  for (const m of monsters) {
    if (m.dead) continue;

    // World distance to player
    const dist = m.mesh.position.distanceTo(playerWorldPos);
    const CHASE = PLANET_R * 1.8;   // world-space chase radius
    const MELEE = PLANET_R * 0.22;  // world-space melee radius

    if (dist < CHASE) {
      if (dist > MELEE) {
        // Move monster's sphere coords toward the player's sphere coords.
        // Player is always at the "top" of the planet in its local frame.
        // invQ is already computed above for player height.
        const localPlayerPos = new THREE.Vector3(0, 1, 0).applyQuaternion(invQ);
        const pPhi   = Math.acos(THREE.MathUtils.clamp(localPlayerPos.y, -1, 1));
        const pTheta = Math.atan2(localPlayerPos.z, localPlayerPos.x);

        const dTheta = pTheta - m.theta;
        const dPhi   = pPhi   - m.phi;
        const angDist = Math.sqrt(dTheta*dTheta + dPhi*dPhi);
        if (angDist > 0.001) {
          m.theta += (dTheta/angDist)*m.type.speed;
          m.phi   += (dPhi  /angDist)*m.type.speed;
        }
        m.phi = THREE.MathUtils.clamp(m.phi, 0.05, Math.PI-0.05);
        m.walkAnim += dt*6;
      } else {
        // Melee attack player — blocked if hero is mid-attack swing
        m.attackCooldown -= dt;
        if (m.attackCooldown<=0 && player.invincible<=0) {
          if (player.attackAnim > 0) {
            // Hero's attack negates this hit — push monster cooldown back
            m.attackCooldown = 1.0;
          } else {
            m.attackCooldown = 1.5;
            player.hp -= m.type.damage;
            player.invincible = 0.8;
            triggerHitFlash();
            document.getElementById('hp-val').textContent = Math.max(0, player.hp);
            if (player.hp<=0) { player.dead=true; showGameOver(); }
          }
        }
      }
    }

    // Limb animation
    const mc = m.innerMesh.children;
    const mw = Math.sin(m.walkAnim);
    if (mc.length>5) {
      mc[3].rotation.x = mw*0.45;
      if(mc[4]) mc[4].rotation.x = -mw*0.45;
      if(mc[5]) mc[5].rotation.x = -mw*0.35;
      if(mc[6]) mc[6].rotation.x =  mw*0.35;
    }

    // Hit flash
    if (m.hitFlash>0) {
      m.hitFlash-=dt;
      m.innerMesh.traverse(c=>{
        if(c.isMesh&&c.material&&c.material.color)
          c.material.color.lerp(new THREE.Color(0xff4444),0.5);
      });
    }

    // HP bars always face camera
    m.hpFg.parent.lookAt(camera.position);

    // Update world position from local sphere coords
    updateMonsterWorldPos(m);

    // Face toward player in world space (rotate innerMesh)
    const toPlayer = playerWorldPos.clone().sub(m.mesh.position).normalize();
    const mUp = m.mesh.position.clone().normalize();
    const mRight = new THREE.Vector3().crossVectors(mUp, toPlayer).normalize();
    const mFwd = new THREE.Vector3().crossVectors(mRight, mUp).normalize();
    if (mFwd.lengthSq()>0.001) {
      const lookQ = new THREE.Quaternion();
      const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(), mFwd, mUp);
      lookQ.setFromRotationMatrix(lookMat);
      m.innerMesh.quaternion.copy(lookQ);
    }
  }

  // Spawn
  spawnTimer+=dt;
  if (spawnTimer>=SPAWN_INTERVAL) { spawnTimer=0; spawnMonster(); }

  // ── Health pack update ─────────────────────────────────────────────────
  healthPackTimer += dt;
  if (healthPackTimer >= HEALTH_PACK_INTERVAL) { healthPackTimer = 0; spawnHealthPack(); }

  const playerPos2 = new THREE.Vector3(0, PLAYER_SURFACE_Y, 0);
  for (let i = healthPacks.length - 1; i >= 0; i--) {
    const hp = healthPacks[i];
    // Bob up and down
    hp.bob += dt * 2.5;
    updateHealthPackWorldPos(hp);
    // Small extra bob offset in world-up direction
    const up = hp.mesh.position.clone().normalize();
    hp.mesh.position.addScaledVector(up, Math.sin(hp.bob) * 0.04);
    // Spin slowly
    hp.innerMesh.rotation.y += dt * 1.2;

    // Pickup check
    if (hp.mesh.position.distanceTo(playerPos2) < HEALTH_PACK_PICKUP_RANGE) {
      // Heal player, cap at 100
      player.hp = Math.min(100, player.hp + HEALTH_PACK_HEAL);
      document.getElementById('hp-val').textContent = player.hp;
      healthPackContainer.remove(hp.mesh);
      healthPacks.splice(i, 1);
    }
  }

  // Remove dead monsters
  for (let i=monsters.length-1;i>=0;i--) {
    if (monsters[i].dead) monsters.splice(i,1);
  }
}

function showGameOver() {
  const box = document.getElementById('pause-box');
  box.innerHTML = `
    <h1>💀 GAME OVER</h1>
    <p>Kills: <b>${player.kills}</b></p>
    <button id="restart-btn" style="
      margin-top:22px; padding:10px 32px; font-size:17px;
      background:#b8762a; color:#f5deb3; border:2px solid #f5deb3;
      border-radius:10px; cursor:pointer; font-family:Georgia,serif;
      letter-spacing:1px;">▶ Restart</button>`;
  document.getElementById('pause-overlay').classList.add('active');
  document.getElementById('restart-btn').addEventListener('click', restartGame);
}

function restartGame() {
  // Reset player state
  player.hp = 100;
  player.kills = 0;
  player.attackCooldown = 0;
  player.attackAnim = 0;
  player.walkAnim = 0;
  player.invincible = 0;
  player.dead = false;

  // Reset planet rotation
  planetGroup.quaternion.identity();

  // Remove all existing monsters
  for (const m of monsters) monsterContainer.remove(m.mesh);
  monsters.length = 0;
  spawnTimer = 0;

  // Remove all health packs
  for (const hp of healthPacks) healthPackContainer.remove(hp.mesh);
  healthPacks.length = 0;
  healthPackTimer = 0;

  // Spawn fresh monsters
  for (let i = 0; i < 4; i++) spawnMonster();

  // Spawn fresh health packs
  for (let i = 0; i < 2; i++) spawnHealthPack();

  // Reset UI
  document.getElementById('hp-val').textContent = 100;
  document.getElementById('kill-count').textContent = 0;
  // Keep whatever monster count the player had set — no reset needed

  // Restore pause box content for next pause
  document.getElementById('pause-box').innerHTML =
    `<h1>⏸ PAUSED</h1><p>Press <b>P</b> or tap to resume</p>`;

  // Hide overlay and resume
  document.getElementById('pause-overlay').classList.remove('active');
  paused = false;
}

requestAnimationFrame(animate);

// ── Mobile on-screen controls ──────────────────────────────────────────────
(function setupMobileControls() {
  const zone = document.getElementById('joystick-zone');
  const knob = document.getElementById('joystick-knob');
  if (!zone || !knob) return;

  const ZONE_R  = 65;   // half of zone width (130/2)
  const KNOB_R  = 26;   // half of knob width  (52/2)
  const DEAD    = 0.20; // dead-zone: fraction of ZONE_R below which no input registers
  const MAX_R   = ZONE_R - KNOB_R; // max knob travel from centre

  let activeTouchId = null;
  let zoneRect = null;

  function getZoneCenter() {
    zoneRect = zone.getBoundingClientRect();
    return { cx: zoneRect.left + ZONE_R, cy: zoneRect.top + ZONE_R };
  }

  function applyJoystick(nx, ny) {
    // Store analog values directly — the update() loop reads joystick.nx/ny
    joystick.nx = nx;
    joystick.ny = ny;
  }

  function releaseJoystick() {
    joystick.nx = 0;
    joystick.ny = 0;
    knob.style.transform = 'translate(-50%, -50%)';
    activeTouchId = null;
  }

  function handleMove(clientX, clientY) {
    const { cx, cy } = getZoneCenter();
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Clamp knob within MAX_R
    const clampedDist = Math.min(dist, MAX_R);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    // Move knob visually
    knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

    // Normalise to -1..1 and apply dead-zone
    const norm = dist / ZONE_R;
    if (norm < DEAD) {
      applyJoystick(0, 0);
    } else {
      const scale = (norm - DEAD) / (1 - DEAD); // remap so dead-zone edge = 0
      const nx = Math.cos(angle) * Math.min(scale, 1);
      const ny = Math.sin(angle) * Math.min(scale, 1);
      applyJoystick(nx, ny);
    }
  }

  // Touch events
  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if (activeTouchId !== null) return;
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    getZoneCenter();
    handleMove(t.clientX, t.clientY);
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === activeTouchId) {
        handleMove(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  zone.addEventListener('touchend',    e => { for (const t of e.changedTouches) if (t.identifier === activeTouchId) releaseJoystick(); }, { passive: false });
  zone.addEventListener('touchcancel', e => { for (const t of e.changedTouches) if (t.identifier === activeTouchId) releaseJoystick(); }, { passive: false });

  // Mouse fallback for desktop testing
  let mouseDown = false;
  zone.addEventListener('mousedown', e => { mouseDown = true; getZoneCenter(); handleMove(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => { if (mouseDown) handleMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup',   () => { if (mouseDown) { mouseDown = false; releaseJoystick(); } });

  // Attack button
  const atkBtn = document.getElementById('btn-attack');
  if (atkBtn) {
    const attack = e => { e.preventDefault(); if (!paused && !player.dead) doAttack(); };
    atkBtn.addEventListener('touchstart', attack, { passive: false });
    atkBtn.addEventListener('mousedown',  attack);
  }

  // Pause button
  const pauseBtn = document.getElementById('btn-pause-mobile');
  if (pauseBtn) {
    pauseBtn.addEventListener('touchstart', e => { e.preventDefault(); togglePause(); }, { passive: false });
    pauseBtn.addEventListener('click', togglePause);
  }

  // Release all on global cancel
  window.addEventListener('touchcancel', releaseJoystick);
})();

// ── World panel collapse ───────────────────────────────────────────────────
(function setupWorldPanel() {
  const panel  = document.getElementById('world-panel');
  const header = document.getElementById('world-panel-header');

  // Auto-collapse on touch devices
  if (window.matchMedia('(pointer: coarse)').matches) {
    panel.classList.add('collapsed');
  }

  header.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
  });
  header.addEventListener('touchstart', e => {
    e.preventDefault();
    panel.classList.toggle('collapsed');
  }, { passive: false });
})();
