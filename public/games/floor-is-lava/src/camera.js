// Third-person orbit camera with smoothing, collision pull-in and shake.
import * as THREE from 'three';

export class CameraRig {
  constructor(physics) {
    this.physics = physics;
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
    this.yaw = 0; this.pitch = 0.42; this.dist = 9.5; this.curDist = 9.5;
    this.target = new THREE.Vector3(); this.pos = new THREE.Vector3();
    this.shake = 0; this.shakeEnabled = true;
    this._d = new THREE.Vector3();
  }
  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
  rotate(dx, dy) {
    this.yaw -= dx * 0.0055;
    this.pitch = Math.min(1.25, Math.max(0.05, this.pitch + dy * 0.004));
  }
  zoom(delta) { this.dist = Math.min(15, Math.max(5, this.dist + delta * 0.006)); }
  addShake(a) { if (this.shakeEnabled) this.shake = Math.min(1.2, Math.max(this.shake, a)); }
  snap(p) {
    this.yaw = 0; this.pitch = 0.42; this.curDist = this.dist;
    this.target.set(p.x, p.y + 1.5, p.z);
    this.place(1, true);
  }
  place(dt, instant = false) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this._d.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    // collision: pull the camera in when furniture is between it and the player
    const hit = this.physics.raycast(this.target.x, this.target.y, this.target.z, this._d.x, this._d.y, this._d.z, this.dist + 0.5);
    const want = Math.max(2.2, Math.min(this.dist, hit - 0.5));
    this.curDist += (want - this.curDist) * (instant ? 1 : 1 - Math.exp(-dt * (want < this.curDist ? 18 : 4)));
    const desired = this._d.multiplyScalar(this.curDist).add(this.target);
    if (instant) this.pos.copy(desired); else this.pos.lerp(desired, 1 - Math.exp(-dt * 14));
    this.camera.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.7;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.7;
      this.shake *= Math.exp(-dt * 3.2);
    }
    this.camera.lookAt(this.target);
  }
  update(dt, p) {
    const tx = p.x, ty = p.y + 1.5, tz = p.z;
    const k = 1 - Math.exp(-dt * 10);
    this.target.x += (tx - this.target.x) * k; this.target.y += (ty - this.target.y) * (1 - Math.exp(-dt * 6)); this.target.z += (tz - this.target.z) * k;
    this.place(dt);
  }
}
