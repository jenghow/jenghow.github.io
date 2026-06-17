import * as THREE from 'three';
import { getTerrainHeight, CHUNK_SIZE, CARVE_RADIUS, AMPLITUDE, WATER_LEVEL } from './terrain.js';

const CLEARANCE = 4.5;
const TREE_COUNT = 40;
const ROCK_COUNT = 20;

const crownGeo = new THREE.ConeGeometry(0.8, 1.8, 6);
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 0.8, 5);
const rockGeos = [
  new THREE.DodecahedronGeometry(0.3, 0),
  new THREE.DodecahedronGeometry(0.45, 0),
  new THREE.DodecahedronGeometry(0.65, 0),
  new THREE.DodecahedronGeometry(0.85, 0),
];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

export class ChunkDecorations {
  constructor(cx, cz, noise, track, scene) {
    this.group = new THREE.Group();
    this._generate(cx, cz, noise, track, scene);
  }

  _generate(cx, cz, noise, track, scene) {
    const rand = seededRandom(cx * 7919 + cz * 6271 + 12345);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d6b2a, roughness: 0.8, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.9, flatShading: true });
    const rockColor = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.8, flatShading: true });

    const treePositions = [];
    const rockPositions = [];

    // Collect tree positions
    for (let i = 0; i < TREE_COUNT; i++) {
      const tryPos = () => {
        for (let attempt = 0; attempt < 20; attempt++) {
          const x = baseX + rand() * CHUNK_SIZE;
          const z = baseZ + rand() * CHUNK_SIZE;

          const nearest = track.getNearestTrackPoint(x, z, CLEARANCE);
          if (nearest) {
            const dx = nearest.x - x;
            const dz = nearest.z - z;
            if (dx * dx + dz * dz < CLEARANCE * CLEARANCE) continue;
          }

          const h = getTerrainHeight(x, z, noise, track);
          if (h < WATER_LEVEL + 0.5 || h > AMPLITUDE * 0.7) continue;

          return { x, z, h };
        }
        return null;
      };

      const pos = tryPos();
      if (pos) {
        const scale = 0.6 + rand() * 0.9;
        treePositions.push({ x: pos.x, z: pos.z, y: pos.h, scale });
      }
    }

    // Collect rock positions
    for (let i = 0; i < ROCK_COUNT; i++) {
      const tryPos = () => {
        for (let attempt = 0; attempt < 15; attempt++) {
          const x = baseX + rand() * CHUNK_SIZE;
          const z = baseZ + rand() * CHUNK_SIZE;

          const nearest = track.getNearestTrackPoint(x, z, CLEARANCE);
          if (nearest) {
            const dx = nearest.x - x;
            const dz = nearest.z - z;
            if (dx * dx + dz * dz < CLEARANCE * CLEARANCE) continue;
          }

          const h = getTerrainHeight(x, z, noise, track);
          if (h < WATER_LEVEL + 0.3) continue;

          return { x, z, h };
        }
        return null;
      };

      const pos = tryPos();
      if (pos) {
        rockPositions.push({ x: pos.x, z: pos.z, y: pos.h, sizeIdx: Math.floor(rand() * rockGeos.length) });
      }
    }

    // Build tree instanced meshes
    if (treePositions.length > 0) {
      const crownMesh = new THREE.InstancedMesh(crownGeo, treeMat, treePositions.length);
      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
      const dummy = new THREE.Object3D();

      treePositions.forEach((t, i) => {
        const s = t.scale;
        const trunkH = 0.8 * s;
        const crownH = 1.8 * s;

        // Crown
        dummy.position.set(t.x, t.y + trunkH + crownH * 0.5, t.z);
        dummy.scale.set(s, s, s);
        dummy.rotation.y = rand() * Math.PI * 2;
        dummy.updateMatrix();
        crownMesh.setMatrixAt(i, dummy.matrix);

        // Trunk
        dummy.position.set(t.x, t.y + trunkH * 0.5, t.z);
        dummy.scale.set(s, s, s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);
      });

      crownMesh.instanceMatrix.needsUpdate = true;
      crownMesh.castShadow = true;
      trunkMesh.instanceMatrix.needsUpdate = true;
      trunkMesh.castShadow = true;
      this.group.add(crownMesh);
      this.group.add(trunkMesh);
    }

    // Build rock instanced meshes per size group
    if (rockPositions.length > 0) {
      const bySize = {};
      for (let i = 0; i < rockGeos.length; i++) bySize[i] = [];

      rockPositions.forEach((r, i) => {
        bySize[r.sizeIdx].push(i);
      });

      const dummy = new THREE.Object3D();
      for (let si = 0; si < rockGeos.length; si++) {
        const indices = bySize[si];
        if (indices.length === 0) continue;

        const mesh = new THREE.InstancedMesh(rockGeos[si], rockColor, indices.length);
        for (let j = 0; j < indices.length; j++) {
          const r = rockPositions[indices[j]];
          const baseScale = 0.6 + rand() * 0.7;
          dummy.position.set(r.x, r.y + baseScale * 0.2, r.z);
          dummy.rotation.set(rand() * 6, rand() * 6, rand() * 6);
          dummy.scale.set(baseScale, baseScale * (0.5 + rand() * 0.5), baseScale);
          dummy.updateMatrix();
          mesh.setMatrixAt(j, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        this.group.add(mesh);
      }
    }
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((c) => {
      if (c.isMesh) {
        c.geometry.dispose();
        c.material.dispose();
      }
    });
  }
}

export class Clouds {
  constructor(scene) {
    this.group = new THREE.Group();

    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0.4, flatShading: true
    });
    const geo = new THREE.SphereGeometry(1, 6, 5);

    for (let i = 0; i < 25; i++) {
      const c = new THREE.Group();
      const count = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < count; j++) {
        const s = new THREE.Mesh(geo, cloudMat);
        const r = 2 + Math.random() * 4;
        const angle = (j / count) * Math.PI * 2 + Math.random() * 0.5;
        s.position.set(Math.cos(angle) * r, Math.random() * 1.5, Math.sin(angle) * r);
        s.scale.set(1 + Math.random(), 0.4 + Math.random() * 0.3, 1 + Math.random());
        c.add(s);
      }
      c.position.set(
        (Math.random() - 0.5) * 800,
        25 + Math.random() * 15,
        (Math.random() - 0.5) * 800
      );
      c.userData = { vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2 };
      this.group.add(c);
    }

    scene.add(this.group);
  }

  update(trainPos) {
    this.group.children.forEach((c) => {
      c.position.x += c.userData.vx * 0.005;
      c.position.z += c.userData.vz * 0.005;

      const dx = c.position.x - trainPos.x;
      const dz = c.position.z - trainPos.z;
      if (dx * dx + dz * dz > 40000) {
        c.position.x = trainPos.x + (Math.random() - 0.5) * 600;
        c.position.z = trainPos.z + (Math.random() - 0.5) * 600;
      }
    });
  }
}
