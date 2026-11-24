// Shared geometries + toon materials (created once, reused everywhere, never disposed per-level).
import * as THREE from 'three';

const ramp = new Uint8Array([85, 150, 215, 255]);
const gradient = new THREE.DataTexture(ramp, 4, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = `${color}|${opts.emissive ?? 0}|${opts.ei ?? 0}|${opts.opacity ?? 1}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    if (opts.emissive !== undefined) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.ei ?? 0.6;
    }
    if (opts.opacity !== undefined && opts.opacity < 1) { m.transparent = true; m.opacity = opts.opacity; m.depthWrite = false; }
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

const capCache = new Map();
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 20, 14),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cone: new THREE.ConeGeometry(1, 1, 20),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 28),
  ring: new THREE.RingGeometry(0.82, 1, 40),
  cap(r, len) {
    const k = `${r}|${len}`;
    let g = capCache.get(k);
    if (!g) { g = new THREE.CapsuleGeometry(r, len, 4, 10); capCache.set(k, g); }
    return g;
  },
};

export function mesh(geo, material, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
export const box = (w, h, d, color, x = 0, y = 0, z = 0) => mesh(G.box, mat(color), w, h, d, x, y, z);

export function disposeSharedAssets() {
  matCache.forEach((m) => m.dispose());
  matCache.clear();
  Object.values(G).forEach((g) => g?.dispose?.());
  capCache.forEach((g) => g.dispose());
  capCache.clear();
}
