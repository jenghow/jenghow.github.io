import * as THREE from 'three';

function wingGeo(mirror) {
  const s = mirror ? -1 : 1;
  const v = [
    s*0,     0.01, 0.12,
    s*0.3,   0.02, 0.08,
    s*0.6,   0.03, 0.03,
    s*0.82,  0.04, 0,
    s*0.72,  0.03, -0.16,
    s*0.4,   0.02, -0.10,
    s*0.15,  0.01, -0.05,
    s*0,     0,    -0.08,
  ];
  const idx = [0,2,1, 2,4,3, 2,5,4, 0,5,2, 5,7,6, 0,7,5];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}

const DIRS = [
  new THREE.Vector3(-0.215, 0.52, 0.826),
  new THREE.Vector3(0.826, 0.52, -0.215),
  new THREE.Vector3(-0.826, -0.52, 0.215),
  new THREE.Vector3(0.215, -0.52, -0.826),
];

export class Birds {
  constructor(scene) {
    this.scene = scene;
    this.rand = rng(Date.now());
    this.elapsed = 0;
    this.pool = [];
    this.active = [];
    this._timer = 0;

    const wingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, flatShading: true, side: THREE.DoubleSide });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.7, flatShading: true });
    const lWing = wingGeo(false);
    const rWing = wingGeo(true);
    const bodyGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.45, 5);
    bodyGeo.rotateX(Math.PI / 2);
    const headGeo = new THREE.SphereGeometry(0.05, 4, 3);
    const tailGeo = new THREE.ConeGeometry(0.06, 0.1, 4);
    tailGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();

      const leftPivot = new THREE.Object3D();
      leftPivot.position.set(0.08, 0.01, 0.02);
      const leftWing = new THREE.Mesh(lWing, wingMat);
      leftPivot.add(leftWing);
      g.add(leftPivot);

      const rightPivot = new THREE.Object3D();
      rightPivot.position.set(-0.08, 0.01, 0.02);
      const rightWing = new THREE.Mesh(rWing, wingMat);
      rightPivot.add(rightWing);
      g.add(rightPivot);

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(0, 0, -0.02);
      g.add(body);

      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 0.06, 0.16);
      g.add(head);

      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 0.02, -0.24);
      g.add(tail);

      g.visible = false;
      scene.add(g);
      this.pool.push({
        group: g, leftPivot, rightPivot,
        dir: new THREE.Vector3(),
        startPos: new THREE.Vector3(),
        speed: 0,
        totalDist: 0,
        progress: 0,
        flapFreq: 0,
        flapAmp: 0,
        flapPhase: 0,
      });
    }
  }

  _spawn(trainPos) {
    const bird = this.pool.pop();
    if (!bird) return;

    const isUp = this.rand() > 0.5;
    const dirIdx = isUp ? Math.floor(this.rand() * 2) : 2 + Math.floor(this.rand() * 2);
    const dir = DIRS[dirIdx];

    bird.dir.copy(dir);
    bird.speed = 15 + this.rand() * 10;
    bird.totalDist = 180 + this.rand() * 60;
    bird.progress = 0;
    bird.flapFreq = 8 + this.rand() * 17;
    bird.flapAmp = 0.4 + this.rand() * 0.4;
    bird.flapPhase = this.rand() * Math.PI * 2;

    bird.startPos.copy(trainPos).add(dir.clone().multiplyScalar(-bird.totalDist * 0.55));
    bird.startPos.x += (this.rand() - 0.5) * 20;
    bird.startPos.z += (this.rand() - 0.5) * 20;
    bird.startPos.y += 15 + this.rand() * 20;

    bird.group.visible = true;
    this.active.push(bird);
  }

  _despawn(bird) {
    bird.group.visible = false;
    const i = this.active.indexOf(bird);
    if (i !== -1) this.active.splice(i, 1);
    this.pool.push(bird);
  }

  update(dt, trainPos) {
    this.elapsed += dt;

    this._timer -= dt;
    if (this._timer <= 0) {
      const target = 2 + Math.floor(this.rand() * 6);
      while (this.active.length < target && this.pool.length > 0) this._spawn(trainPos);
      this._timer = 1 + this.rand() * 3;
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.progress += b.speed * dt / b.totalDist;

      const p = b.progress;
      b.group.position.copy(b.startPos).add(b.dir.clone().multiplyScalar(p * b.totalDist));
      b.group.position.y += Math.sin(p * Math.PI * 3 + b.flapPhase) * 0.7;

      const flap = b.flapAmp * Math.sin(this.elapsed * b.flapFreq + b.flapPhase);
      b.leftPivot.rotation.z = flap;
      b.rightPivot.rotation.z = -flap;

      if (p > 1.1) this._despawn(b);
    }
  }
}
