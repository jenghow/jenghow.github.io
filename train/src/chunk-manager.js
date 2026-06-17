import { TerrainChunk, CHUNK_SIZE } from './terrain.js';
import { ChunkDecorations, Clouds } from './decorations.js';

const VIEW_RADIUS = 3;
const LOAD_AHEAD = 4;

export class ChunkManager {
  constructor(scene, noise, track) {
    this.scene = scene;
    this.noise = noise;
    this.track = track;

    this.chunks = new Map();
    this.decorations = new Map();

    this.clouds = new Clouds(scene);

    this.lastCx = null;
    this.lastCz = null;
  }

  setSnow(amount) {
    for (const chunk of this.chunks.values()) chunk.setSnow(amount);
  }

  update(trainPos) {
    const cx = Math.floor(trainPos.x / CHUNK_SIZE);
    const cz = Math.floor(trainPos.z / CHUNK_SIZE);

    if (cx === this.lastCx && cz === this.lastCz) {
      this.clouds.update(trainPos);
      return;
    }

    this.lastCx = cx;
    this.lastCz = cz;

    const needed = new Set();
    for (let dx = -VIEW_RADIUS; dx <= LOAD_AHEAD; dx++) {
      for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
        needed.add(`${cx + dx},${cz + dz}`);
      }
    }

    // Add new
    for (const key of needed) {
      if (!this.chunks.has(key)) {
        const [x, z] = key.split(',').map(Number);
        const chunk = new TerrainChunk(x, z, this.noise, this.track);
        this.scene.add(chunk.mesh);
        if (chunk.bridgeGroup) this.scene.add(chunk.bridgeGroup);
        this.chunks.set(key, chunk);

        const dec = new ChunkDecorations(x, z, this.noise, this.track, this.scene);
        this.scene.add(dec.group);
        this.decorations.set(key, dec);
      }
    }

    // Remove old
    for (const [key, chunk] of this.chunks) {
      if (!needed.has(key)) {
        chunk.dispose(this.scene);
        this.chunks.delete(key);

        const dec = this.decorations.get(key);
        if (dec) {
          dec.dispose(this.scene);
          this.decorations.delete(key);
        }
      }
    }

    this.clouds.update(trainPos);
  }

  dispose() {
    for (const chunk of this.chunks.values()) chunk.dispose(this.scene);
    this.chunks.clear();
    for (const dec of this.decorations.values()) dec.dispose(this.scene);
    this.decorations.clear();
  }
}
