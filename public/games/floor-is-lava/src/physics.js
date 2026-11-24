// Lightweight arcade physics: a vertical-cylinder (AABB) body vs yaw-rotated boxes.
// Chosen over a WASM engine because platformer feel needs deterministic, tweakable kinematics.
export class Physics {
  constructor() { this.solids = []; this.gravity = 30; }
  clear() { this.solids = []; }
  add(s) { this.solids.push(s); return s; }

  overlapXZ(s, x, z, r) {
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), dx = x - s.x, dz = z - s.z;
    return Math.abs(dx * c - dz * sn) < s.hx + r && Math.abs(dx * sn + dz * c) < s.hz + r;
  }
  /** Highest active surface under (x,z) that is at or below maxY. -Infinity if none. */
  topAt(x, z, maxY) {
    let best = -Infinity;
    for (const s of this.solids) {
      if (!s.active) continue;
      const top = s.y + s.hy;
      if (top <= maxY && top > best && this.overlapXZ(s, x, z, 0)) best = top;
    }
    return best;
  }

  /** Move a body one step. body: {x,y(feet),z,vx,vy,vz,r,h,ground,onGround,landVy} */
  step(b, dt) {
    const g = b.ground;
    if (g && g.active) { // ride the platform: translation + rotation about its centre
      const rx = b.x - (g.x - g.dx), rz = b.z - (g.z - g.dz);
      const c = Math.cos(g.dyaw), s = Math.sin(g.dyaw);
      b.x = g.x + rx * c + rz * s;
      b.z = g.z - rx * s + rz * c;
      b.y += g.dy;
    }
    b.onGround = false; b.ground = null; b.landVy = 0;

    // ---- vertical ----
    let ny = b.y + b.vy * dt;
    const footR = b.r * 0.9;
    if (b.vy <= 0) {
      let best = null, bestTop = -Infinity;
      for (const s of this.solids) {
        if (!s.active) continue;
        const top = s.y + s.hy;
        if (top - b.y <= 0.35 && ny <= top + 1e-4 && top > bestTop && this.overlapXZ(s, b.x, b.z, footR)) { best = s; bestTop = top; }
      }
      if (best) { ny = bestTop; b.landVy = b.vy; b.vy = 0; b.onGround = true; b.ground = best; }
    } else {
      for (const s of this.solids) {
        if (!s.active) continue;
        const bottom = s.y - s.hy;
        if (b.y + b.h <= bottom + 0.05 && ny + b.h > bottom && this.overlapXZ(s, b.x, b.z, footR)) { ny = bottom - b.h; b.vy = 0; }
      }
    }
    b.y = ny;

    // ---- horizontal ----
    b.x += b.vx * dt; b.z += b.vz * dt;
    for (const s of this.solids) {
      if (!s.active) continue;
      if (b.y >= s.y + s.hy - 0.05 || b.y + b.h <= s.y - s.hy + 0.05) continue;
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), dx = b.x - s.x, dz = b.z - s.z;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      const ox = s.hx + b.r - Math.abs(lx), oz = s.hz + b.r - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        let px = 0, pz = 0;
        if (ox < oz) px = (lx < 0 ? -1 : 1) * ox; else pz = (lz < 0 ? -1 : 1) * oz;
        const wx = px * c + pz * sn, wz = -px * sn + pz * c;
        b.x += wx; b.z += wz;
        const l = Math.hypot(wx, wz) || 1, nx = wx / l, nz = wz / l, vd = b.vx * nx + b.vz * nz;
        if (vd < 0) { b.vx -= vd * nx; b.vz -= vd * nz; }
      }
    }
  }

  /** Distance along a ray to the first box hit (for camera collision). Returns maxT if none. */
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    for (const s of this.solids) {
      if (!s.active) continue;
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const rx = ox - s.x, rz = oz - s.z;
      const lo = [rx * c - rz * sn, oy - s.y, rx * sn + rz * c];
      const ld = [dx * c - dz * sn, dy, dx * sn + dz * c];
      const h = [s.hx, s.hy, s.hz];
      let t0 = 0, t1 = best, hit = true;
      for (let i = 0; i < 3 && hit; i++) {
        if (Math.abs(ld[i]) < 1e-8) { if (Math.abs(lo[i]) > h[i]) hit = false; continue; }
        let a = (-h[i] - lo[i]) / ld[i], z = (h[i] - lo[i]) / ld[i];
        if (a > z) [a, z] = [z, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, z);
        if (t0 > t1) hit = false;
      }
      const startsInside = Math.abs(lo[0]) < h[0] && Math.abs(lo[1]) < h[1] && Math.abs(lo[2]) < h[2];
      if (hit && !startsInside && t0 > 0 && t0 < best) best = t0;
    }
    return best;
  }
}
