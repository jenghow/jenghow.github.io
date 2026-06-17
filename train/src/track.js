import * as THREE from 'three';

const POINT_SPACING = 25;
const INITIAL_POINTS = 50;
const EXTEND_CHUNK = 10;
const AMPLITUDE_X = 28;
const AMPLITUDE_Y = 3.5;

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.controlPoints = [];
    this.curve = null;
    this.totalLength = 0;
    this.sampleStep = 1.5;
    this.samples = [];
    this.grid = {};
    this.gridSize = 10;
    this.meshes = { rails: [], ties: null };

    this._init();
    this._buildMeshes();
  }

  _init() {
    for (let i = 0; i < INITIAL_POINTS; i++) {
      this.controlPoints.push(this._genPoint(i));
    }
    this._rebuild();
  }

  _genPoint(i) {
    const z = i * POINT_SPACING;
    const x = Math.sin(i * 0.43) * AMPLITUDE_X
           + Math.sin(i * 0.11) * 18
           + Math.cos(i * 0.07) * 10;
    const y = Math.sin(i * 0.27) * AMPLITUDE_Y
           + Math.cos(i * 0.49) * 2.5
           + 1.5;
    return new THREE.Vector3(x, y, z);
  }

  _rebuild() {
    this.curve = new THREE.CatmullRomCurve3(this.controlPoints);
    this.totalLength = this.curve.getLength();
    this._resample();
  }

  _resample() {
    this.samples = [];
    this.grid = {};
    const steps = Math.ceil(this.totalLength / this.sampleStep);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = this.curve.getPointAt(t);
      const s = { x: pt.x, y: pt.y, z: pt.z, dist: i * this.sampleStep };
      this.samples.push(s);
      const gx = Math.floor(pt.x / this.gridSize);
      const gz = Math.floor(pt.z / this.gridSize);
      const key = `${gx},${gz}`;
      if (!this.grid[key]) this.grid[key] = [];
      this.grid[key].push(s);
    }
  }

  getPointAtDistance(d) {
    const maxD = (this.controlPoints.length - 3) * POINT_SPACING;
    if (d > maxD * 0.75) this._extend();
    const t = Math.max(0, Math.min(1, d / this.totalLength));
    return this.curve.getPointAt(t);
  }

  getTangentAtDistance(d) {
    const t = Math.max(0, Math.min(1, d / this.totalLength));
    return this.curve.getTangentAt(t);
  }

  _extend() {
    const idx = this.controlPoints.length;
    for (let i = 0; i < EXTEND_CHUNK; i++) {
      this.controlPoints.push(this._genPoint(idx + i));
    }
    this._rebuild();
    this._buildMeshes();
  }

  getNearestTrackPoint(wx, wz, radius) {
    const gx = Math.floor(wx / this.gridSize);
    const gz = Math.floor(wz / this.gridSize);
    const cells = Math.ceil(radius / this.gridSize) + 1;
    let bestDistSq = radius * radius;
    let best = null;

    for (let dx = -cells; dx <= cells; dx++) {
      for (let dz = -cells; dz <= cells; dz++) {
        const key = `${gx + dx},${gz + dz}`;
        const pts = this.grid[key];
        if (!pts) continue;
        for (const p of pts) {
          const ddx = p.x - wx;
          const ddz = p.z - wz;
          const d = ddx * ddx + ddz * ddz;
          if (d < bestDistSq) {
            bestDistSq = d;
            best = p;
          }
        }
      }
    }
    return best;
  }

  _buildMeshes() {
    this._clearMeshes();

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x777788, metalness: 0.6, roughness: 0.3, flatShading: true
    });
    const railRadius = 0.07;
    const railOffset = 0.65;
    const steps = Math.max(1, Math.floor(this.totalLength / 2.5));
    const pts1 = [], pts2 = [];


    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const p1 = pt.clone().addScaledVector(right, railOffset).add(up.clone().multiplyScalar(0.15));
      const p2 = pt.clone().addScaledVector(right, -railOffset).add(up.clone().multiplyScalar(0.15));
      pts1.push(p1);
      pts2.push(p2);
    }

    for (const pts of [pts1, pts2]) {
      if (pts.length < 4) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const segs = Math.max(4, Math.floor(pts.length * 2));
      const geo = new THREE.TubeGeometry(curve, segs, railRadius, 4, false);
      const mesh = new THREE.Mesh(geo, railMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.rails.push(mesh);
    }

    // Ties (sleepers)
    const tieMat = new THREE.MeshStandardMaterial({
      color: 0x6b4c3b, roughness: 0.9, flatShading: true
    });
    const tieGeo = new THREE.BoxGeometry(2.0, 0.12, 0.28);
    const spacing = 1.2;
    const count = Math.floor(this.totalLength / spacing);
    if (count > 0) {
      const ties = new THREE.InstancedMesh(tieGeo, tieMat, count);
      ties.receiveShadow = true;
      ties.castShadow = true;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const t = (i * spacing) / this.totalLength;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t);

        const flatTan = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
        const angle = Math.atan2(flatTan.x, flatTan.z);

        dummy.position.copy(pt);
        dummy.position.y += 0.06;
        dummy.rotation.y = angle;
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        ties.setMatrixAt(i, dummy.matrix);
      }
      ties.instanceMatrix.needsUpdate = true;
      this.scene.add(ties);
      this.meshes.ties = ties;
    }
  }

  _clearMeshes() {
    for (const m of this.meshes.rails) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this.meshes.rails = [];

    if (this.meshes.ties) {
      this.scene.remove(this.meshes.ties);
      this.meshes.ties.geometry.dispose();
      this.meshes.ties.material.dispose();
      this.meshes.ties = null;
    }
  }
}
