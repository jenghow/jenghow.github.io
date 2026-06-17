import * as THREE from 'three';
import { SimplexNoise } from './simplex.js';
import { createScene, updateCamera, updateEnvironment } from './scene.js';
import { Track } from './track.js';
import { Train } from './train.js';
import { ChunkManager } from './chunk-manager.js';
import { WATER_LEVEL } from './terrain.js';
import { MidiPlayer } from './midi-player.js';

const CYCLE_SEC = 40;
const WEATHER_SEC = 35;
const CROSSFADE_SEC = 5;
const WEATHER_TOTAL = WEATHER_SEC + CROSSFADE_SEC;

function showError(e) {
  const el = document.getElementById('error');
  if (el) { el.style.display = 'flex'; el.textContent = e.stack || e.message || String(e); }
  console.error(e);
}

window.addEventListener('error', (e) => showError(e.error || e));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

function createRain() {
  const N = 4000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i*3] = (Math.random() - 0.5) * 400;
    pos[i*3+1] = Math.random() * 120;
    pos[i*3+2] = (Math.random() - 0.5) * 400;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x7799bb, size: 0.6, transparent: true, opacity: 0.55,
    sizeAttenuation: true, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  mesh.renderOrder = 2;
  const vel = new Float32Array(N);
  for (let i = 0; i < N; i++) vel[i] = 18 + Math.random() * 14;
  return { mesh, pos: geo.attributes.position.array, vel, N };
}

function createSnow() {
  const N = 2500;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i*3] = (Math.random() - 0.5) * 400;
    pos[i*3+1] = Math.random() * 100;
    pos[i*3+2] = (Math.random() - 0.5) * 400;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.9, transparent: true, opacity: 0.8,
    sizeAttenuation: true, depthWrite: false,
  });
  const mesh = new THREE.Points(geo, mat);
  mesh.renderOrder = 2;
  const vel = new Float32Array(N);
  for (let i = 0; i < N; i++) vel[i] = 1.5 + Math.random() * 3.5;
  return { mesh, pos: geo.attributes.position.array, vel, N };
}

function tickParticles(p, dt, trainPos) {
  const pos = p.pos;
  for (let i = 0; i < p.N; i++) {
    pos[i*3+1] -= p.vel[i] * dt;
    if (pos[i*3+1] < -5) {
      pos[i*3]   = trainPos.x + (Math.random() - 0.5) * 350;
      pos[i*3+1] = trainPos.y + 30 + Math.random() * 80;
      pos[i*3+2] = trainPos.z + (Math.random() - 0.5) * 350;
    }
  }
  p.mesh.geometry.attributes.position.needsUpdate = true;
  p.mesh.position.copy(trainPos);
  p.mesh.position.y = 0;
}

function init() {
  const container = document.body;
  const { scene, camera, renderer, sun, ambient, hemi } = createScene(container);

  const noise = new SimplexNoise(42);
  const track = new Track(scene);
  const train = new Train(track);
  scene.add(train.group);

  const waterGeo = new THREE.PlaneGeometry(2000, 2000);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2a7f9f, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    roughness: 0.2, metalness: 0.1, flatShading: true
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.renderOrder = 1;
  scene.add(water);

  const chunkManager = new ChunkManager(scene, noise, track);

  chunkManager.update(train.getPosition());

  const rain = createRain();
  scene.add(rain.mesh);
  rain.mesh.visible = false;

  const snow = createSnow();
  scene.add(snow.mesh);
  snow.mesh.visible = false;

  const loading = document.getElementById('loading');
  if (loading) loading.remove();

  // MIDI player
  const midi = new MidiPlayer();
  const btnPlay = document.getElementById('btn-play');
  const btnLoop = document.getElementById('btn-loop');
  let midiLoaded = false;

  midi.load('SignOfTheTime.mid').then(() => {
    midiLoaded = true;
    btnPlay.textContent = '\u25B6 Play';
  }).catch((e) => { console.error('MIDI load failed:', e); btnPlay.textContent = 'Err'; });

  btnPlay.addEventListener('click', () => {
    if (!midiLoaded) return;
    if (midi.playing) { midi.pause(); btnPlay.textContent = '\u25B6 Play'; }
    else { midi.play(); btnPlay.textContent = '\u23F8 Pause'; }
  });

  btnLoop.addEventListener('click', () => {
    const on = midi.toggleLoop();
    btnLoop.classList.toggle('active', on);
  });

  midi.onPlayChange = (on) => {
    btnPlay.textContent = on ? '\u23F8 Pause' : '\u25B6 Play';
  };

  let lastTime = 0;
  let elapsed = 0;

  function loop(time) {
    requestAnimationFrame(loop);
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0.016;
    lastTime = time;
    elapsed += dt;

    // Auto speed: sinusoidal 3-8 m/s (~11-29 km/h)
    train.speed = 5.5 + 2.5 * Math.sin(elapsed * 0.22);

    // Day/night cycle (40s period)
    const dayNorm = ((elapsed % CYCLE_SEC) / CYCLE_SEC) * Math.PI * 2;
    const dayAmount = (Math.sin(dayNorm) + 1) / 2;

    // Weather: 4 states × (35s stable + 5s crossfade) = 160s full cycle
    const wt = elapsed % (WEATHER_TOTAL * 4);
    const seg = Math.floor(wt / WEATHER_TOTAL);
    const segT = wt % WEATHER_TOTAL;
    const wA = seg % 4;
    let wB, blend;
    if (segT < WEATHER_SEC) {
      wB = wA;
      blend = 0;
    } else {
      wB = (seg + 1) % 4;
      blend = (segT - WEATHER_SEC) / CROSSFADE_SEC;
    }

    updateEnvironment(scene, sun, ambient, hemi, dayAmount, wA, wB, blend);

    // Headlight on at night, foggy, or snowy
    const headlightOn = dayAmount < 0.3 || wA === 2 || wA === 3 || wB === 2 || wB === 3;
    train.setHeadlight(headlightOn);

    // Rain/snow visibility (during stable phase or fading in/out)
    const isRain = (wA === 1 && (segT < WEATHER_SEC || blend < 0.5)) ||
                   (wB === 1 && blend >= 0.5);
    const isSnow = (wA === 3 && (segT < WEATHER_SEC || blend < 0.5)) ||
                   (wB === 3 && blend >= 0.5);

    const trainPos = train.getPosition();
    rain.mesh.visible = isRain;
    snow.mesh.visible = isSnow;

    if (isRain) tickParticles(rain, dt, trainPos);
    if (isSnow) tickParticles(snow, dt, trainPos);

    train.update(dt);
    chunkManager.update(trainPos);

    const fwd = train.getForward();
    updateCamera(camera, sun, trainPos, fwd);

    renderer.render(scene, camera);
  }

  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { try { init(); } catch (e) { showError(e); } });
} else {
  try { init(); } catch (e) { showError(e); }
}
