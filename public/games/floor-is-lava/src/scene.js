// Renderer, world scene, lights, and a pooled particle system.
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 600) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.base = new Float32Array(max * 3);
    this.pos.fill(-9999);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }
  emit(x, y, z, color, count = 8, speed = 4, life = 0.8, gravity = 9, up = 0.6) {
    this._c.set(color);
    for (let n = 0; n < count; n++) {
      const k = this.i; this.i = (this.i + 1) % this.max;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.pos.set([x, y, z], k * 3);
      this.vel[k * 3] = Math.cos(a) * s; this.vel[k * 3 + 1] = (Math.random() * 0.8 + up) * speed * 0.8; this.vel[k * 3 + 2] = Math.sin(a) * s;
      this.life[k] = this.maxLife[k] = life * (0.6 + Math.random() * 0.6); this.grav[k] = gravity;
      this.base.set([this._c.r, this._c.g, this._c.b], k * 3);
      this.col.set([this._c.r, this._c.g, this._c.b], k * 3);
    }
  }
  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -9999; continue; }
      this.vel[k * 3 + 1] -= this.grav[k] * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      const f = this.life[k] / this.maxLife[k]; // additive blending: dimming == fading out
      this.col[k * 3] = this.base[k * 3] * f; this.col[k * 3 + 1] = this.base[k * 3 + 1] * f; this.col[k * 3 + 2] = this.base[k * 3 + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.pos.fill(-9999); this.geo.attributes.position.needsUpdate = true; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

export class SceneManager {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.world = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xfff0dd, 0x8a3a22, 0.8);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.position.set(14, 30, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.world.add(this.hemi, this.sun, this.sun.target);
    this.fx = new Particles(this.world, 700);
    this.resize();
  }
  followSun(x, y, z) {
    this.sun.target.position.set(x, y, z);
    this.sun.position.set(x + 14, y + 30, z + 10);
  }
  setAtmosphere(color) { this.world.background = new THREE.Color(color); this.world.fog = new THREE.Fog(color, 40, 130); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.aspect = w / h;
    this.onResize?.(this.aspect);
  }
  render(scene, camera) { this.renderer.render(scene, camera); }
  dispose() { this.fx.dispose(); this.renderer.dispose(); }
}
