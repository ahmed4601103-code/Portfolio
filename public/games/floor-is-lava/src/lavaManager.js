// Animated lava surface, rising logic, surges, glow light, bubbles and floating debris.
import * as THREE from 'three';
import { mat, G } from './assets.js';

const VERT = `
uniform float uTime; varying vec2 vUv; varying float vH;
void main(){
  vUv = uv; vec3 p = position;
  float w = sin(p.x*0.35 + uTime*1.2)*0.14 + sin(p.y*0.5 + uTime*0.9)*0.11 + sin((p.x+p.y)*0.8 + uTime*1.7)*0.05;
  p.z += w; vH = w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
uniform float uTime; varying vec2 vUv; varying float vH;
void main(){
  float n = sin(vUv.x*70.0 + uTime*0.8) * sin(vUv.y*110.0 - uTime*0.6) + sin((vUv.x+vUv.y)*55.0 + uTime*1.3);
  vec3 deep = vec3(0.78, 0.07, 0.02), hot = vec3(1.0, 0.52, 0.06), glow = vec3(1.0, 0.92, 0.35);
  vec3 col = mix(deep, hot, smoothstep(-1.2, 1.4, n));
  float crack = smoothstep(0.82, 1.0, abs(sin(n*1.7 + uTime*0.4)));
  col = mix(col, glow, crack*0.55 + max(vH, 0.0)*2.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeLavaMesh(w, d) {
  const geo = new THREE.PlaneGeometry(w, d, 70, 90);
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime: { value: 0 } } });
  const m = new THREE.Mesh(geo, material);
  m.rotation.x = -Math.PI / 2;
  return m;
}

const DEBRIS = 36;
export class LavaManager {
  constructor(game) {
    this.game = game;
    this.mesh = makeLavaMesh(60, 160); this.mesh.frustumCulled = false;
    this.light = new THREE.PointLight(0xff5a1a, 90, 45, 1.4);
    this.game.sceneMgr.world.add(this.mesh, this.light);
    // instanced floating toy debris bobbing on the lava
    this.debris = new THREE.InstancedMesh(G.box, mat(0xffffff), DEBRIS);
    this.debris.frustumCulled = false;
    const c = new THREE.Color();
    this.seed = [];
    for (let i = 0; i < DEBRIS; i++) {
      this.seed.push({ x: (Math.random() - 0.5) * 26, z: -Math.random() * 90 + 10, s: 0.5 + Math.random() * 0.8, p: Math.random() * 6, r: Math.random() * 3 });
      this.debris.setColorAt(i, c.setHSL(Math.random(), 0.7, 0.6));
    }
    this.game.sceneMgr.world.add(this.debris);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.bubble = 0; this.reset({ lavaRate: 0, lavaMax: 0, bounds: { z: [-50, 12] } });
  }
  reset(def) {
    this.rate = def.lavaRate; this.max = def.lavaMax; this.surge = 0; this.escape = false; this.h = 0; this.time = 0;
    this.game.state.d.lavaHeight = 0;
    const [z0, z1] = def.bounds.z;
    this.mesh.position.set(0, 0, (z0 + z1) / 2);
    this.mesh.scale.set(1, (z1 - z0 + 20) / 160, 1);
  }
  startSurge(sec) { this.surge = sec; }
  update(dt, worldDt) {
    this.time += dt;
    this.mesh.material.uniforms.uTime.value = this.time;
    if (worldDt > 0) {
      const mult = (this.surge > 0 ? 5 : 1) * (this.escape ? 1.8 : 1);
      this.h = Math.min(this.max, this.h + this.rate * mult * worldDt);
    }
    if (this.surge > 0) this.surge -= dt;
    this.game.state.d.lavaHeight = this.h;
    this.mesh.position.y = this.h;
    const p = this.game.player.body;
    this.light.position.set(p.x, this.h + 3, p.z);
    this.light.intensity = 85 + Math.sin(this.time * 7) * 10;
    // bubbles near the player
    this.bubble -= dt;
    if (this.bubble <= 0) {
      this.bubble = 0.09;
      const x = p.x + (Math.random() - 0.5) * 22, z = p.z + (Math.random() - 0.5) * 22;
      this.game.sceneMgr.fx.emit(x, this.h + 0.1, z, 0xff7a1a, 2, 2.2, 1.1, 4, 1.4);
    }
    // debris
    for (let i = 0; i < DEBRIS; i++) {
      const s = this.seed[i];
      this._p.set(s.x + Math.sin(this.time * 0.3 + s.p) * 1.5, this.h + Math.sin(this.time * 1.6 + s.p) * 0.18 + 0.05, s.z);
      this._e.set(this.time * 0.4 + s.r, this.time * 0.3 + s.p, s.r);
      this._q.setFromEuler(this._e); this._s.setScalar(s.s);
      this._m.compose(this._p, this._q, this._s);
      this.debris.setMatrixAt(i, this._m);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }
  splash(x, z, n = 26) {
    this.game.sceneMgr.fx.emit(x, this.h + 0.2, z, 0xff8a2a, n, 8, 1.1, 14, 1.2);
    this.game.sceneMgr.fx.emit(x, this.h + 0.2, z, 0xffe066, n / 2, 5, 0.8, 14, 1.4);
    this.game.audio.play('splash');
  }
  dispose() {
    this.game.sceneMgr.world.remove(this.mesh, this.light, this.debris);
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.light.dispose(); this.debris.dispose();
  }
}
