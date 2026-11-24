// Builds a level from data: room, scenery, platforms (visual + collider), checkpoints, exit and hazards.
// Also owns the per-frame behaviour of platforms (move / rotate / tilt / collapse) and hazards.
import * as THREE from 'three';
import { box, G, mat, mesh } from './assets.js';
import { buildFurniture, DECOR_KINDS, FURNITURE_INFO } from './furniture.js';

const RESPAWN_TIME = 5;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function wallTexture(kind, [a, b]) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 256, 256); x.fillStyle = b;
  if (kind === 'stripes') for (let i = 0; i < 256; i += 64) x.fillRect(i, 0, 32, 256);
  else if (kind === 'diamonds') {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      x.beginPath(); x.moveTo(i * 128 + 64, j * 128 + 8); x.lineTo(i * 128 + 120, j * 128 + 64); x.lineTo(i * 128 + 64, j * 128 + 120); x.lineTo(i * 128 + 8, j * 128 + 64); x.closePath(); x.fill();
    }
  } else for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) x.fillRect(i * 64, j * 64, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class LevelManager {
  constructor(game) {
    this.game = game; this.group = null; this.solids = []; this.def = null; this.own = [];
    this.checkpoints = []; this.respawns = []; this.hazards = []; this.fallers = []; this.exit = null;
    this.byPlatform = new Map(); this.time = 0; this.bobAmt = 0; this.routeCount = 0; this.exitTop = 0;
  }

  // ------------------------------------------------------------------ build
  load(def) {
    this.dispose();
    const { sceneMgr, physics, raycast } = this.game;
    this.def = def; this.time = 0; this.bobAmt = 0;
    this.group = new THREE.Group(); sceneMgr.world.add(this.group);
    this.itemRoot = new THREE.Group(); this.group.add(this.itemRoot);
    sceneMgr.setAtmosphere(def.fog);
    this.buildRoom(def); this.buildDecor(def);

    def.platforms.forEach((p, i) => this.buildPlatform(p, i, physics, raycast));
    this.routeCount = def.platforms.filter((p) => p.route).length;
    this.exitTop = def.platforms.find((p) => p.exit).top;
    const spawn = def.platforms.find((p) => p.spawn);
    this.respawns = [{ x: spawn.x, y: spawn.top + 0.05, z: spawn.z + spawn.d * 0.2 }];
    this.buildCheckpoints(def); this.buildExit(def); this.buildHazards(def);
  }

  buildRoom(def) {
    const [x0, x1] = def.bounds.x, [z0, z1] = def.bounds.z;
    const W = x1 - x0 + 9, D = z1 - z0 + 8, H = def.ceiling + 6;
    const tex = wallTexture(def.wall.kind, def.wall.colors); tex.repeat.set(5, 5);
    const wm = new THREE.MeshLambertMaterial({ map: tex, side: THREE.BackSide });
    const geo = new THREE.BoxGeometry(W, H, D);
    const room = new THREE.Mesh(geo, wm); room.position.set((x0 + x1) / 2, H / 2 - 6, (z0 + z1) / 2); room.receiveShadow = true;
    this.group.add(room); this.own.push(geo, wm, tex);
    this.roomHalfW = W / 2; this.roomCenterZ = (z0 + z1) / 2;
    // windows, hanging lamps
    const glass = new THREE.MeshBasicMaterial({ color: 0xbfe9ff }); this.own.push(glass);
    for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
      const z = z1 - 8 - i * ((z1 - z0 - 14) / 4), y = 14 + (i % 2) * 3;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), glass); this.own.push(win.geometry);
      win.position.set(side * (W / 2 - 0.05) + (x0 + x1) / 2, y, z); win.rotation.y = -side * Math.PI / 2; this.group.add(win);
      const fr = box(0.3, 5.4, 4.4, 0xffffff, side * (W / 2 - 0.2) + (x0 + x1) / 2, y, z); this.group.add(fr);
    }
    const bulb = mat(0xfff2b0, { emissive: 0xfff2b0, ei: 1 });
    for (let i = 0; i < 6; i++) {
      const z = z1 - 4 - i * ((z1 - z0) / 6), y = def.ceiling - 4;
      this.group.add(box(0.12, 6, 0.12, 0x333333, (i % 2 ? 6 : -6), def.ceiling - 1, z));
      this.group.add(mesh(G.cone, mat(0xe2574c), 1.6, 1.2, 1.6, (i % 2 ? 6 : -6), y, z));
      this.group.add(mesh(G.sph, bulb, 0.5, 0.5, 0.5, (i % 2 ? 6 : -6), y - 0.5, z, false));
    }
  }

  buildDecor(def) {
    const rnd = mulberry32(def.id * 977), kinds = DECOR_KINDS[def.theme], [z0, z1] = def.bounds.z;
    const cols = [0xff9ecb, 0x7aa7ff, 0xffd23f, 0x5cc8a8, 0xc58bd9, 0xff8c42, 0xe9a25d];
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1, w = 2.4 + rnd() * 1.6, d = 3 + rnd() * 2.5, top = 4 + rnd() * 16, h = top + 7;
      const z = z1 - 4 - (i / 18) * (z1 - z0 - 6) - rnd() * 2;
      const g = buildFurniture(kinds[i % kinds.length], w, h, d, cols[Math.floor(rnd() * cols.length)]);
      g.position.set(side * (def.bounds.x[1] + 2.6), top - h / 2, z); g.rotation.y = side * -Math.PI / 2;
      this.group.add(g);
    }
  }

  buildPlatform(p, i, physics, raycast) {
    const h = p.h === 'full' ? p.top + 1.5 : p.h;
    const dynamic = ['move', 'rotate', 'tilt', 'collapse', 'bounce'].includes(p.b);
    const g = buildFurniture(p.k, p.w, h, p.d, p.c);
    g.position.set(p.x, p.top - h / 2, p.z); this.group.add(g);
    const s = physics.add({
      id: i, def: p, group: g, x: p.x, y: p.top - h / 2, z: p.z, hx: p.w / 2, hy: h / 2, hz: p.d / 2, yaw: 0,
      active: true, dx: 0, dy: 0, dz: 0, dyaw: 0, bx: p.x, by: p.top - h / 2, bz: p.z, byaw: 0, yawAcc: 0,
      b: p.b, spd: p.spd ?? 1, amp: p.amp ?? 0, ax: p.ax ?? 'x', ph: (i * 1.7) % 6.28, t: (i * 0.37) % 3,
      slip: p.b === 'slip', bounce: p.b === 'bounce' ? p.bounce : 0, tilt: 0, slide: 0,
      routeIndex: p.route ? this.def.platforms.filter((q, j) => q.route && j <= i).length - 1 : -1,
      nc: !!p.nc, dynamic, cs: 'idle', ct: 0, delay: p.delay ?? 0.9, respawn: RESPAWN_TIME, fv: 0, jx: 0, hasCp: false,
    });
    this.solids.push(s); this.byPlatform.set(p, s);
    const info = FURNITURE_INFO[p.k] ?? [p.k, 'A piece of furniture.'];
    raycast.register({
      id: `furn-${i}`, type: 'furniture', name: p.name ?? info[0], interaction: 'inspect', mesh: g, scope: 'game',
      hint: p.b === 'collapse' ? 'Click to inspect (unstable!)' : 'Click to inspect',
      getDistance: (pp) => Math.hypot(Math.max(0, Math.abs(pp.x - s.x) - s.hx), Math.max(0, Math.abs(pp.z - s.z) - s.hz)),
      reach: 18, info: p.name ? [p.name, info[1]] : info,
      onSelect: (e) => this.game.inspect(e),
    });
  }

  /** Attach an object above a platform; follows the platform if it moves. */
  attach(p, ox, oy, oz, obj) {
    const s = this.byPlatform.get(p);
    if (s && s.dynamic) { s.group.add(obj); obj.position.set(ox, s.hy + oy, oz); }
    else { this.itemRoot.add(obj); obj.position.set(p.x + ox, p.top + oy, p.z + oz); }
  }

  buildCheckpoints(def) {
    def.platforms.forEach((p) => {
      if (!p.cp) return;
      const s = this.byPlatform.get(p), idx = this.checkpoints.length + 1;
      const flag = new THREE.Group();
      flag.add(box(0.14, 2.6, 0.14, 0xdddddd, 0, 1.3, 0));
      const cloth = mesh(G.box, mat(0x999999, { emissive: 0x333333, ei: 0.4 }), 1.1, 0.7, 0.06, 0.55, 2.2, 0);
      flag.add(cloth); flag.add(mesh(G.sph, mat(0xffd23f), 0.16, 0.16, 0.16, 0, 2.65, 0));
      this.attach(p, p.w / 2 - 0.7, 0, -p.d * 0.22, flag);
      const cp = { idx, platform: s, flag, cloth, active: false, entry: null };
      cp.entry = this.game.raycast.register({
        id: `cp-${idx}`, type: 'checkpoint', name: `Checkpoint ${idx}`, interaction: 'checkpoint', mesh: flag, scope: 'game',
        hint: 'Click or press E to activate', reach: 9, onSelect: (e, info) => this.game.interactCheckpoint(cp, info),
        getDistance: (pp) => { const w = flag.getWorldPosition(this._v ??= new THREE.Vector3()); return Math.hypot(pp.x - w.x, pp.z - w.z); },
      });
      s.hasCp = true;
      this.checkpoints.push(cp);
      this.respawns[idx] = { x: p.x, y: p.top + 0.05, z: p.z, platform: s };
    });
  }

  buildExit(def) {
    const p = def.platforms.find((q) => q.exit), s = this.byPlatform.get(p);
    const door = new THREE.Group();
    door.add(box(0.3, 3.8, 0.3, 0x8a5a30, -1.2, 1.9, 0)); door.add(box(0.3, 3.8, 0.3, 0x8a5a30, 1.2, 1.9, 0));
    door.add(box(2.7, 0.3, 0.3, 0x8a5a30, 0, 3.8, 0));
    const portal = mesh(G.box, mat(0xfff1a8, { emissive: 0xffe066, ei: 1 }), 2.1, 3.6, 0.08, 0, 1.85, 0, false); door.add(portal);
    door.add(mesh(G.sph, mat(0xffd23f), 0.1, 0.1, 0.1, 0.7, 1.7, 0.1));
    door.position.set(p.x, p.top, p.z - p.d / 2 + 0.5); this.group.add(door);
    this.exit = { x: door.position.x, y: p.top, z: door.position.z, portal, door };
    this.game.raycast.register({
      id: 'exit', type: 'exit', name: 'Exit Door', interaction: 'inspect', mesh: door, scope: 'game', hint: 'Walk through it to escape!',
      reach: 30, getDistance: (pp) => Math.hypot(pp.x - door.position.x, pp.z - door.position.z),
      info: ['Exit Door', 'Walk right through the glow to escape!'], onSelect: (e) => this.game.inspect(e),
    });
    void s;
  }

  // ------------------------------------------------------------------ hazards
  themeFaller(theme) {
    const g = new THREE.Group();
    if (theme === 'bedroom') {
      g.add(mesh(G.cone, mat(0xffd23f), 0.7, 0.6, 0.7, 0, 0.55, 0)); g.add(mesh(G.cyl, mat(0x8a5a30), 0.12, 0.6, 0.12, 0, 0, 0));
      g.add(mesh(G.sph, mat(0xfff2b0, { emissive: 0xfff2b0, ei: 1 }), 0.2, 0.2, 0.2, 0, 0.2, 0, false));
    } else if (theme === 'living') {
      g.add(mesh(G.cyl, mat(0x4a90d9), 0.38, 0.55, 0.38, 0, 0, 0)); g.add(mesh(G.sph, mat(0x4a90d9), 0.55, 0.5, 0.55, 0, 0.45, 0)); g.add(mesh(G.sph, mat(0x4cc96a), 0.45, 0.4, 0.45, 0, 1.0, 0));
    } else {
      g.add(mesh(G.cyl, mat(0x44444f), 0.6, 0.45, 0.6, 0, 0, 0)); g.add(mesh(G.cyl, mat(0x888899), 0.65, 0.07, 0.65, 0, 0.45, 0));
      g.add(mesh(G.box, mat(0x44444f), 0.9, 0.12, 0.14, 0.9, 0.1, 0));
    }
    return g;
  }

  buildHazards(def) {
    const world = this.group;
    // pool of falling objects (lamps/pots/vases + warning ring) used by scheduled hazards and object rain
    for (let i = 0; i < 18; i++) {
      const obj = this.themeFaller(def.theme); obj.visible = false; world.add(obj);
      const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.visible = false; world.add(ring); this.own.push(ring.material);
      this.fallers.push({ obj, ring, st: 'off', x: 0, y: 0, z: 0, landY: 0, t: 0, warn: 1.2, vy: 0 });
    }
    def.hazards.forEach((h) => {
      if (h.t === 'fall') this.hazards.push({ ...h, timer: h.delay ?? 2 });
      else if (h.t === 'roll') {
        const kind = h.kind ?? 'ball', m = new THREE.Group();
        if (kind === 'pin') { const pin = mesh(G.cyl, mat(0xc99a5b), h.r, 2.6, h.r); pin.rotation.z = Math.PI / 2; m.add(pin); }
        else { m.add(mesh(G.sph, mat(0xff5a5a), h.r, h.r, h.r)); m.add(mesh(G.torus, mat(0xffffff), h.r, h.r, h.r)); const t2 = mesh(G.torus, mat(0xffd23f), h.r, h.r, h.r); t2.rotation.y = Math.PI / 2; m.add(t2); }
        world.add(m); this.hazards.push({ ...h, mesh: m, prevX: 0 });
      } else if (h.t === 'swing') {
        const piv = new THREE.Group(); piv.position.set(h.x, h.top + 1.3 + h.len, h.z);
        piv.add(box(0.07, h.len, 0.07, 0x666677, 0, -h.len / 2, 0));
        const bob = new THREE.Group(); bob.position.y = -h.len;
        bob.add(mesh(G.sph, mat(0x9aa0b0), 0.6, 0.6, 0.6)); bob.add(mesh(G.cyl, mat(0x9aa0b0), 0.2, 0.9, 0.2, 0, 0.9, 0));
        piv.add(bob); world.add(piv); this.hazards.push({ ...h, mesh: piv, r: 0.6 });
      }
    });
  }

  startFaller(x, z, warn = 1.3, landY = null) {
    const f = this.fallers.find((q) => q.st === 'off'); if (!f) return false;
    const ground = landY ?? this.game.physics.topAt(x, z, 1e9);
    if (!Number.isFinite(ground) || ground < this.game.lava.h) return false;
    Object.assign(f, { st: 'warn', x, z, landY: ground, t: 0, warn, vy: 0 });
    f.ring.visible = true; f.ring.position.set(x, ground + 0.06, z); f.ring.scale.setScalar(1.2);
    return true;
  }

  hitTest(px, py, pz, r, ox, oy, oz) {
    const dx = ox - px, dz = oz - pz;
    for (const off of [0.4, 0.95, 1.5]) { const dy = oy - (py + off); if (dx * dx + dy * dy + dz * dz < (r + 0.38) * (r + 0.38)) return true; }
    return false;
  }
  knock(ox, oz, force = 11) {
    const b = this.game.player.body; let dx = b.x - ox, dz = b.z - oz; const l = Math.hypot(dx, dz);
    if (l < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; } else { dx /= l; dz /= l; }
    this.game.player.hit(dx, dz, force);
  }

  // ------------------------------------------------------------------ per-frame
  update(dt, real) {
    const g = this.game, chaos = g.chaos, now = (this.time += dt), b = g.player.body;
    this.bobAmt += ((chaos.bob ? 1 : 0) - this.bobAmt) * Math.min(1, real * 3);
    const quake = chaos.quake;
    for (const s of this.solids) {
      const ox = s.x, oy = s.y, oz = s.z, oyaw = s.yaw;
      s.t += dt;
      let nx = s.bx, ny = s.by, nz = s.bz, nyaw = s.byaw;
      if (s.b === 'move') { const v = Math.sin(s.t * s.spd + s.ph) * s.amp; if (s.ax === 'x') nx += v; else if (s.ax === 'z') nz += v; else ny += v; }
      else if (s.b === 'rotate') { s.yawAcc += s.spd * dt; nyaw = s.yawAcc; }
      else if (s.b === 'tilt') { s.tilt = Math.sin(s.t * 0.9 + s.ph) * 0.1; s.slide = -s.tilt * 34; }
      if (s.b === 'collapse' || s.cs !== 'idle') this.updateCollapse(s, dt);
      if (s.cs === 'idle' || s.cs === 'shake') {
        if (this.bobAmt > 0.01) ny += this.bobAmt * Math.sin(now * 9 + s.ph) * 0.22;
        s.dx = nx - ox; s.dy = ny - oy; s.dz = nz - oz; s.dyaw = nyaw - oyaw;
        s.x = nx; s.y = ny; s.z = nz; s.yaw = nyaw;
        const jx = quake || s.cs === 'shake' ? (Math.random() - 0.5) * (s.cs === 'shake' ? 0.16 : 0.09) : 0;
        s.group.position.set(s.x + jx, s.y, s.z); s.group.rotation.set(0, s.yaw, s.tilt);
      } else { s.dx = s.dy = s.dz = s.dyaw = 0; }
    }
    this.updateCheckpoints(b);
    this.updateHazards(dt, b, now);
    // glowing exit
    if (this.exit) this.exit.portal.material.emissiveIntensity = 0.8 + Math.sin(now * 4) * 0.3;
  }

  updateCollapse(s, dt) {
    const g = this.game;
    if (s.cs === 'idle') {
      if (g.player.body.ground === s && !g.player.dead) { s.cs = 'shake'; s.ct = 0; g.audio.play('tick'); }
    } else if (s.cs === 'shake') {
      s.ct += dt;
      if (s.ct >= s.delay) {
        s.cs = 'fall'; s.active = false; s.ct = 0; s.fv = 0; s.splashed = false;
        g.audio.play('break'); g.sceneMgr.fx.emit(s.x, s.y + s.hy, s.z, 0xc99a5b, 18, 5, 0.9, 12);
        g.cam.addShake(0.2);
      }
    } else if (s.cs === 'fall') {
      s.ct += dt; s.fv += 26 * dt;
      s.group.position.y -= s.fv * dt; s.group.rotation.x += dt * 2.2; s.group.rotation.z += dt * 1.4;
      if (s.group.position.y < g.lava.h - 0.4) { g.lava.splash(s.x, s.z, 14); s.group.visible = false; s.cs = 'gone'; s.ct = 0; }
      else if (s.ct > 3) { s.group.visible = false; s.cs = 'gone'; s.ct = 0; }
    } else if (s.cs === 'gone') {
      s.ct += dt;
      if (s.ct >= s.respawn) {
        s.cs = 'idle'; s.active = true; s.group.visible = true; s.group.rotation.set(0, 0, 0);
        s.x = s.bx; s.y = s.by; s.z = s.bz; s.group.position.set(s.x, s.y, s.z);
        g.sceneMgr.fx.emit(s.x, s.y + s.hy, s.z, 0xffffff, 10, 3, 0.6, 2);
      }
    }
  }
  /** Put every crumbled platform back (called on respawn so you never wake up next to a missing platform). */
  restoreAll() {
    for (const s of this.solids) {
      if (s.cs === 'idle') continue;
      s.cs = 'idle'; s.ct = 0; s.active = true; s.group.visible = true; s.group.rotation.set(0, 0, 0);
      s.x = s.bx; s.y = s.by; s.z = s.bz; s.group.position.set(s.x, s.y, s.z);
    }
  }
  /** Chaos event: make a bonus platform crumble (never touches the critical path). */
  forceCollapse(s, respawn = 8) { if (s.cs === 'idle') { s.cs = 'shake'; s.ct = 0; s.delay = 0.9; s.respawn = respawn; } }

  updateCheckpoints(b) {
    for (const cp of this.checkpoints) {
      if (cp.active) continue;
      const w = cp.flag.getWorldPosition(this._cw ??= new THREE.Vector3());
      if (Math.hypot(b.x - w.x, b.z - w.z) < 2.3 && Math.abs(b.y - w.y) < 3) this.game.activateCheckpoint(cp);
    }
  }

  updateHazards(dt, b, now) {
    const g = this.game;
    for (const h of this.hazards) {
      if (h.t === 'fall') { h.timer -= dt; if (h.timer <= 0) { if (this.startFaller(h.x, h.z)) h.timer = h.every; else h.timer = 1; } }
      else if (h.t === 'roll') {
        const mid = (h.x0 + h.x1) / 2, half = (h.x1 - h.x0) / 2, x = mid + Math.sin(now * h.spd + h.ph) * half;
        h.mesh.position.set(x, h.y + h.r, h.z); h.mesh.rotation.z -= (x - h.prevX) / h.r; h.prevX = x;
        if (!g.player.dead && g.player.hitCd <= 0 && this.hitTest(b.x, b.y, b.z, h.r, x, h.y + h.r, h.z)) this.knock(x, h.z, 9);
      } else if (h.t === 'swing') {
        const th = Math.sin(now * h.spd + h.ph) * h.amp; h.mesh.rotation.z = th;
        const bx = h.x + Math.sin(th) * h.len, by = h.top + 1.3 + h.len - Math.cos(th) * h.len;
        if (!g.player.dead && g.player.hitCd <= 0 && this.hitTest(b.x, b.y, b.z, h.r, bx, by, h.z)) this.knock(bx, h.z, 9);
      }
    }
    for (const f of this.fallers) {
      if (f.st === 'off') continue;
      if (f.st === 'warn') {
        f.t += dt; const k = f.t / f.warn;
        f.ring.scale.setScalar(1.6 - k * 0.5); f.ring.material.opacity = 0.35 + 0.5 * Math.abs(Math.sin(f.t * 12));
        if (f.t >= f.warn) { f.st = 'fall'; f.y = Math.min(this.def.ceiling - 1, f.landY + 22); f.vy = 0; f.obj.visible = true; }
      } else if (f.st === 'fall') {
        f.vy = Math.min(38, f.vy + 55 * dt); f.y -= f.vy * dt;
        f.obj.position.set(f.x, f.y, f.z); f.obj.rotation.y += dt * 4; f.obj.rotation.x += dt * 2;
        if (!g.player.dead && g.player.hitCd <= 0 && this.hitTest(b.x, b.y, b.z, 0.7, f.x, f.y, f.z)) this.knock(f.x, f.z, 10);
        if (f.y <= f.landY + 0.3) {
          g.sceneMgr.fx.emit(f.x, f.landY + 0.3, f.z, 0xffd27a, 16, 6, 0.8, 12); g.audio.play('break'); g.cam.addShake(0.18);
          f.st = 'off'; f.obj.visible = false; f.ring.visible = false;
        }
      }
    }
  }

  // ------------------------------------------------------------------ teardown
  dispose() {
    if (this.group) {
      this.game.sceneMgr.world.remove(this.group);
      this.own.forEach((o) => o.dispose?.());
    }
    this.game.physics?.clear();
    this.group = null; this.own = []; this.solids = []; this.checkpoints = []; this.respawns = []; this.hazards = [];
    this.fallers = []; this.exit = null; this.byPlatform = new Map();
  }
}
