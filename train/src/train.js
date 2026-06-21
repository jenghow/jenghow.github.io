import * as THREE from 'three';

export class Train {
  constructor(track) {
    this.track = track;
    this.group = new THREE.Group();
    this.wheels = [];
    this.distance = 0;
    this.speed = 0;
    this.headlight = null;
    this._windowMat = new THREE.MeshStandardMaterial({
      color: 0x4488aa, emissive: 0xffaa44, emissiveIntensity: 0,
      transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2,
    });

    this._build();
  }

  _build() {
    this._buildLocomotive();
    this._buildCoach(0xcc3333, -3.5);
    this._buildCoach(0x33aa33, -10.5);
  }

  _buildLocomotive() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a3e, roughness: 0.3, metalness: 0.7, flatShading: true });
    const gold = new THREE.MeshStandardMaterial({ color: 0xccaa00, roughness: 0.4, metalness: 0.3, flatShading: true });
    const grey = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.5, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 4.5), dark);
    body.position.y = 1.3;
    body.castShadow = true;
    g.add(body);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6), dark);
    cab.position.set(0, 2.8, -1.8);
    cab.castShadow = true;
    g.add(cab);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 1.4), grey);
    roof.position.set(0, 3.3, -1.8);
    g.add(roof);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 0.8), dark);
    nose.position.set(0, 1.8, 2.5);
    nose.castShadow = true;
    g.add(nose);

    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.6, 6), grey);
    stack.position.set(0, 2.8, 1.5);
    stack.castShadow = true;
    g.add(stack);

    const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), gold);
    light.position.set(0, 1.6, 2.9);
    g.add(light);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 4.3), gold);
    trim.position.set(0, 0.55, 0);
    g.add(trim);

    this._addWheels(g, 0.0, -1.5, 3, 0.35, 0.12);
    this._addWheels(g, 0.0, -1.5, 3, 0.35, 0.12);

    // Headlight
    this.headlight = new THREE.SpotLight(0xffeecc, 0);
    this.headlight.angle = 0.28;
    this.headlight.penumbra = 0.35;
    this.headlight.decay = 1;
    this.headlight.distance = 80;
    this.headlight.position.set(0, 1.0, 3.0);
    this.headlight.target.position.set(0, -0.2, 6);
    g.add(this.headlight);
    g.add(this.headlight.target);

    g.position.set(0, 0, 3.5);
    this.group.add(g);
  }

  _buildCoach(color, zOffset) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6, flatShading: true });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 5.0), mat);
    body.position.y = 1.1;
    body.castShadow = true;
    g.add(body);

    const winGeo = new THREE.BoxGeometry(0.04, 0.5, 0.5);
    for (const side of [-1, 1]) {
      for (const zw of [-1.5, -0.5, 0.5, 1.5]) {
        const w = new THREE.Mesh(winGeo, this._windowMat);
        w.position.set(side * 1.11, 1.35, zw);
        g.add(w);
      }
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 4.8), roofMat);
    roof.position.y = 2.0;
    g.add(roof);

    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.10, 7);

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 2; i++) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        const zPos = -1.2 + i * 2.4;
        w.position.set(side * 1.25, 0.14, zPos);
        w.rotation.z = Math.PI / 2;
        w.castShadow = true;
        g.add(w);
        this.wheels.push(w);
      }
    }

    g.position.set(0, 0, zOffset);
    this.group.add(g);
  }

  _addWheels(group, yPos, zStart, count, radius, width) {
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, flatShading: true });
    const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, 8);

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < count; i++) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        const zPos = zStart + i * 1.5;
        w.position.set(side * 1.25, yPos + 0.2, zPos);
        w.rotation.z = Math.PI / 2;
        w.castShadow = true;
        group.add(w);
        this.wheels.push(w);
      }
    }
  }

  setHeadlight(on) {
    if (this.headlight) {
      this.headlight.intensity = on ? 2.5 : 0;
    }
  }

  setWindowLights(on) {
    this._windowMat.emissiveIntensity = on ? 0.9 : 0;
  }

  update(dt) {
    this.distance += this.speed * dt;

    const pt = this.track.getPointAtDistance(this.distance);
    const tangent = this.track.getTangentAtDistance(this.distance);

    this.group.position.copy(pt);

    const flatTan = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
    const yaw = Math.atan2(flatTan.x, flatTan.z);
    const pitch = Math.atan2(tangent.y, Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z));
    this.group.rotation.set(0, yaw, 0);
    this.group.rotateX(-pitch);

    const wheelSpeed = this.speed * 4.5;
    for (const w of this.wheels) {
      w.rotation.x += wheelSpeed * dt;
    }
  }

  getPosition() {
    return this.group.position;
  }

  getForward() {
    const t = this.track.getTangentAtDistance(this.distance);
    return new THREE.Vector3(t.x, 0, t.z).normalize();
  }
}
