import * as THREE from 'three';

const CHUNK_SIZE = 64;
const SEGMENTS = 18;
const CARVE_RADIUS = 14;
const AMPLITUDE = 11;
const WATER_LEVEL = -4;
const HEIGHT_SCALE = 1.0;

export { CHUNK_SIZE, CARVE_RADIUS, AMPLITUDE, WATER_LEVEL, HEIGHT_SCALE };

export function getTerrainHeight(wx, wz, noise, track) {
  let h = noise.noise2D(wx * 0.018, wz * 0.018) * AMPLITUDE;
  h += noise.noise2D(wx * 0.045, wz * 0.045) * 3.5;
  h += noise.noise2D(wx * 0.09, wz * 0.09) * 1.2;

  const nearest = track.getNearestTrackPoint(wx, wz, CARVE_RADIUS);
  if (nearest) {
    const dx = nearest.x - wx;
    const dz = nearest.z - wz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < CARVE_RADIUS) {
      const t = dist / CARVE_RADIUS;
      const blend = t * t * (3 - 2 * t);
      h = h * blend + (nearest.y - 0.6) * (1 - blend);
    }
  }

  return h;
}

function createHorizontalPlane(size, segs) {
  const geo = new THREE.BufferGeometry();
  const half = size / 2;
  const step = size / segs;
  const verts = (segs + 1) * (segs + 1);
  const pos = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const idx = [];

  let n = 0;
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j <= segs; j++) {
      pos[n * 3] = -half + j * step;
      pos[n * 3 + 1] = 0;
      pos[n * 3 + 2] = -half + i * step;
      uv[n * 2] = j / segs;
      uv[n * 2 + 1] = i / segs;
      n++;
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = i * (segs + 1) + j + 1;
      const c = (i + 1) * (segs + 1) + j;
      const d = (i + 1) * (segs + 1) + j + 1;
      idx.push(a, c, b, c, d, b);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

export class TerrainChunk {
  constructor(cx, cz, noise, track) {
    this.cx = cx;
    this.cz = cz;
    this.mesh = null;
    this.bridgeGroup = null;
    this.disposed = false;

    this._generate(noise, track);
  }

  _generate(noise, track) {
    const wx = this.cx * CHUNK_SIZE;
    const wz = this.cz * CHUNK_SIZE;

    const geo = createHorizontalPlane(CHUNK_SIZE, SEGMENTS);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    let needsBridge = false;
    let bridgeY = 0;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const worldX = wx + lx + CHUNK_SIZE / 2;
      const worldZ = wz + lz + CHUNK_SIZE / 2;

      let h = getTerrainHeight(worldX, worldZ, noise, track);
      h = Math.max(h, WATER_LEVEL - 0.5);

      // Check if bridge needed near track
      if (!needsBridge) {
        const nearest = track.getNearestTrackPoint(worldX, worldZ, 3);
        if (nearest) {
          const dx = nearest.x - worldX;
          const dz = nearest.z - worldZ;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 3 && nearest.y < WATER_LEVEL) {
            needsBridge = true;
            bridgeY = WATER_LEVEL + 1.5;
          }
        }
      }

      pos.setY(i, h);

      // Vertex colors based on height
      const n = (h + AMPLITUDE) / (AMPLITUDE * 2);
      if (h < WATER_LEVEL + 0.5) {
        colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.65; colors[i * 3 + 2] = 0.4;
      } else if (h < WATER_LEVEL + 2) {
        colors[i * 3] = 0.55; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.35;
      } else if (h < 2) {
        colors[i * 3] = 0.25 + n * 0.35;
        colors[i * 3 + 1] = 0.35 + n * 0.4;
        colors[i * 3 + 2] = 0.1 + n * 0.1;
      } else {
        colors[i * 3] = 0.3 + n * 0.3;
        colors[i * 3 + 1] = 0.25 + n * 0.2;
        colors[i * 3 + 2] = 0.15 + n * 0.1;
      }
    }

    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const nonIndexed = geo.toNonIndexed();
    nonIndexed.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.0,
    });

    this.mesh = new THREE.Mesh(nonIndexed, mat);
    this.mesh.position.set(wx + CHUNK_SIZE / 2, 0, wz + CHUNK_SIZE / 2);
    this.mesh.receiveShadow = true;
    this._baseColors = new Float32Array(this.mesh.geometry.attributes.color.array);

    if (needsBridge) {
      this._buildBridge(wx + CHUNK_SIZE / 2, wz + CHUNK_SIZE / 2, track, bridgeY);
    }
  }

  _buildBridge(centerX, centerZ, track, bridgeY) {
    this.bridgeGroup = new THREE.Group();

    const deckMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7, flatShading: true });
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, flatShading: true });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 3), deckMat);
    deck.position.set(centerX, bridgeY, centerZ);
    deck.receiveShadow = true;
    deck.castShadow = true;
    this.bridgeGroup.add(deck);

    for (let dx = -3; dx <= 3; dx += 3) {
      const pier = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, bridgeY - WATER_LEVEL + 0.5, 6),
        pierMat
      );
      pier.position.set(centerX + dx, (bridgeY + WATER_LEVEL - 0.5) / 2, centerZ);
      pier.receiveShadow = true;
      this.bridgeGroup.add(pier);
    }
  }

  setSnow(amount) {
    if (!this._baseColors || !this.mesh) return;
    const colors = this.mesh.geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i++) {
      colors[i] = this._baseColors[i] + (1 - this._baseColors[i]) * amount;
    }
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  dispose(scene) {
    if (this.disposed) return;
    this.disposed = true;

    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    if (this.bridgeGroup) {
      scene.remove(this.bridgeGroup);
      this.bridgeGroup.traverse((c) => {
        if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); }
      });
      this.bridgeGroup = null;
    }
  }
}
