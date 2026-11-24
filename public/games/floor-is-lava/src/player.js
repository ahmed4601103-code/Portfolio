// Player: kinematic character controller (coyote time, jump buffer, double jump, slippery floors),
// procedural animation states and reactions.
import * as THREE from 'three';
import { CHARACTERS, buildCharacter } from './characters.js';

const GRAV_DOWN = 1.15, MAX_FALL = 45;
const lerp = (a, b, k) => a + (b - a) * k;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Player {
  constructor(game) {
    this.game = game;
    this.body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.38, h: 1.7, ground: null, onGround: false, landVy: 0 };
    this.group = new THREE.Group(); game.sceneMgr.world.add(this.group);
    this.model = null; this.charId = null; this.stats = CHARACTERS.lazy;
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shield.position.y = 0.85; this.shield.visible = false; this.group.add(this.shield);
    this.reset();
  }
  setCharacter(id) {
    if (this.charId === id) return;
    if (this.model) this.group.remove(this.model.root);
    this.charId = id; this.stats = CHARACTERS[id]; this.model = buildCharacter(id); this.group.add(this.model.root);
  }
  reset() {
    Object.assign(this, { dead: false, deadT: 0, celebrating: false, celT: 0, stun: 0, hitCd: 0, jumpBuf: 0, coyote: 0, extra: true, facing: 0, squash: 0, flip: 0, animT: 0, wasGround: false, minClear: Infinity, nmCd: 0, emojiCd: 0, outcome: null });
    const b = this.body; b.vx = b.vy = b.vz = 0; b.ground = null; b.onGround = false;
  }
  respawn(p) {
    this.reset(); const b = this.body; b.x = p.x; b.y = p.y; b.z = p.z;
    this.group.visible = true; this.group.rotation.set(0, 0, 0); this.model?.root.rotation.set(0, 0, 0); this.model?.parts.setFace('happy');
    this.group.position.set(b.x, b.y, b.z);
    this.game.sceneMgr.fx.emit(b.x, b.y + 0.5, b.z, 0xffffff, 14, 4, 0.7, 3);
  }
  queueJump() { this.jumpBuf = 0.13; }
  react(emoji) { if (this.emojiCd > 0) return; this.emojiCd = 1.2; this.game.ui.floatText(new THREE.Vector3(this.body.x, this.body.y + 2.3, this.body.z), emoji, 'emoji'); }

  hit(dx, dz, force) {
    if (this.dead || this.hitCd > 0 || this.celebrating) return;
    const b = this.body; b.vx = dx * force; b.vz = dz * force; b.vy = Math.max(b.vy, 8); this.stun = 0.35; this.hitCd = 1.1; this.squash = 0.6;
    this.game.audio.play('hurt'); this.game.cam.addShake(0.4); this.react('😵'); this.model.parts.setFace('scared');
    this.game.sceneMgr.fx.emit(b.x, b.y + 1, b.z, 0xffffff, 12, 5, 0.5, 8);
  }
  die(reason) {
    if (this.dead) return; this.dead = true; this.deadT = 0; this.reason = reason; this.model.parts.setFace('dead');
    const g = this.game, b = this.body; g.state.d.falls++; g.audio.play('splash'); g.lava.splash(b.x, b.z, 36); g.cam.addShake(0.6);
    this.react('😱'); this.spin = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 4);
    b.vy = Math.max(b.vy, 6); b.vx *= 0.3; b.vz *= 0.3;
  }
  celebrate() { this.celebrating = true; this.celT = 0; this.model.parts.setFace('cheer'); this.body.vx = this.body.vz = 0; }

  update(dt, inp, camYaw) {
    const g = this.game, b = this.body, s = this.stats, pu = g.powerups, st = g.state.d, lava = g.lava;
    this.hitCd = Math.max(0, this.hitCd - dt); this.emojiCd -= dt; this.nmCd -= dt;
    if (this.dead) return this.updateDead(dt);
    if (this.celebrating) { this.celT += dt; b.vx *= 0.9; b.vz *= 0.9; }
    this.stun = Math.max(0, this.stun - dt);
    const ctrl = this.stun <= 0 && !this.celebrating;

    // --- input -> desired direction (relative to camera)
    let mx = 0, mz = 0;
    if (ctrl) {
      const f = (inp.w || inp.up ? 1 : 0) - (inp.s || inp.down ? 1 : 0), r = (inp.d || inp.right ? 1 : 0) - (inp.a || inp.left ? 1 : 0);
      const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
      mx = -sy * f + cy * r; mz = -cy * f - sy * r; const l = Math.hypot(mx, mz); if (l > 0) { mx /= l; mz /= l; }
    }
    const moving = mx !== 0 || mz !== 0, ground = b.ground;
    const top = s.speed * (inp.shift ? s.sprint : 1) * pu.speedMul;
    const slip = ground?.slip;
    const accel = b.onGround ? (slip ? 6 : s.accel) : s.accel * 0.55, fric = b.onGround ? (slip ? 0.9 : s.fric) : 1.2;
    if (moving) {
      const dvx = mx * top - b.vx, dvz = mz * top - b.vz, l = Math.hypot(dvx, dvz), step = accel * dt;
      if (l > step) { b.vx += (dvx / l) * step; b.vz += (dvz / l) * step; } else { b.vx += dvx; b.vz += dvz; }
    } else { const k = Math.max(0, 1 - fric * dt); b.vx *= k; b.vz *= k; }
    if (b.onGround && ground?.slide) b.vx += ground.slide * dt;

    // --- jumping: buffer + coyote + one extra air jump
    this.jumpBuf -= dt; this.coyote = b.onGround ? 0.12 : this.coyote - dt; if (b.onGround) this.extra = true;
    if (this.jumpBuf > 0 && ctrl) {
      if (this.coyote > 0) { b.vy = s.jump * pu.jumpMul * (chaosJump(g)); this.coyote = 0; this.jumpBuf = 0; this.squash = -0.5; g.audio.play('jump'); g.sceneMgr.fx.emit(b.x, b.y, b.z, 0xffffff, 6, 3, 0.4, 4); }
      else if (this.extra) { b.vy = s.jump2 * pu.jumpMul * (chaosJump(g)); this.extra = false; this.jumpBuf = 0; this.flip = 0.0001; this.squash = -0.4; g.audio.play('doublejump'); g.sceneMgr.fx.emit(b.x, b.y + 0.5, b.z, 0x9ad8ff, 10, 4, 0.5, 2); }
    }
    // --- gravity (variable: falls a bit faster than it rises, low-gravity chaos event scales it)
    const gs = g.physics.gravity * g.chaos.gravityScale * (b.vy < 0 ? GRAV_DOWN : 1);
    b.vy = Math.max(-MAX_FALL, b.vy - gs * dt);

    const prevGround = this.wasGround;
    g.physics.step(b, dt);
    const [bx, bz] = [g.level.def.bounds.x, g.level.def.bounds.z];
    b.x = Math.min(bx[1] - 0.8, Math.max(bx[0] + 0.8, b.x)); b.z = Math.min(bz[1] - 0.8, Math.max(bz[0] + 0.8, b.z));

    // --- landing / take-off events
    if (b.onGround && !prevGround) this.onLand();
    if (!b.onGround && prevGround) this.minClear = Infinity;
    if (!b.onGround) this.minClear = Math.min(this.minClear, b.y - lava.h);
    this.wasGround = b.onGround;
    if (b.onGround && b.ground.routeIndex >= 0) st.progress = Math.max(st.progress, b.ground.routeIndex / Math.max(1, g.level.routeCount - 1));

    // --- lava
    if (b.y < lava.h + 0.05 && !this.celebrating) {
      if (pu.shield) { b.vy = 15; b.y = lava.h + 0.1; lava.splash(b.x, b.z, 10); this.squash = -0.5; this.extra = true; g.cam.addShake(0.15); }
      else this.die('lava');
    }

    // --- facing + animation
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.8 && ctrl) this.facing += angDiff(this.facing, Math.atan2(b.vx, b.vz)) * Math.min(1, dt * 14);
    this.animate(dt, sp, moving);
    this.group.position.set(b.x, b.y, b.z); this.group.rotation.y = this.facing;
    this.shield.visible = pu.shield; if (pu.shield) { this.shield.scale.setScalar(1 + Math.sin(g.level.time * 6) * 0.04); this.shield.rotation.y += dt; }
    if (pu.speedMul > 1 && sp > 4) g.sceneMgr.fx.emit(b.x, b.y + 0.2, b.z, 0xffd23f, 1, 1.5, 0.4, 0);
    if (pu.jumpMul > 1 && !b.onGround && b.vy > 0) g.sceneMgr.fx.emit(b.x, b.y + 0.1, b.z, 0x5dff7a, 1, 1.2, 0.35, 0);
    st.playerPos = [b.x, b.y, b.z];
  }

  onLand() {
    const g = this.game, b = this.body, impact = -b.landVy;
    if (b.ground.bounce) { b.vy = b.ground.bounce; b.onGround = false; b.ground = null; this.extra = true; this.squash = 0.7; g.audio.play('bounce'); g.sceneMgr.fx.emit(b.x, b.y, b.z, 0xff9ecb, 14, 5, 0.6, 5); this.react('🤪'); return; }
    if (impact > 9) { this.squash = Math.min(0.75, impact / 26); g.audio.play('land'); g.sceneMgr.fx.emit(b.x, b.y, b.z, 0xe8d8c0, Math.min(14, impact | 0), 4, 0.5, 6); if (impact > 20) g.cam.addShake(0.1); }
    if (impact > 17 && !b.ground.bounce) b.vy = 3.2; // funny little bounce on hard landings
    // near-miss: you were airborne and skimmed the lava before landing
    if (this.minClear > 0.05 && this.minClear < 0.9 && this.nmCd <= 0 && !this.celebrating) {
      this.nmCd = 3; g.state.d.nearMisses++; g.state.d.score += 50; g.audio.play('near'); g.ui.floatText(new THREE.Vector3(b.x, b.y + 2, b.z), 'NEAR MISS! +50', 'near'); this.react('😅');
    }
    this.minClear = Infinity;
  }

  updateDead(dt) {
    const b = this.body, g = this.game; this.deadT += dt;
    b.vy -= 25 * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.z += b.vz * dt;
    const m = this.model, P = m.parts, t = this.deadT;
    m.root.rotation.x += this.spin * dt * 0.6; m.root.rotation.z += this.spin * dt * 0.4;
    P.armL.rotation.x = Math.sin(t * 22) * 1.6; P.armR.rotation.x = -Math.sin(t * 22) * 1.6; P.legL.rotation.x = Math.sin(t * 18) * 1.2; P.legR.rotation.x = -Math.sin(t * 18) * 1.2;
    if (b.y < g.lava.h - 1.2) { b.y = g.lava.h - 1.2; b.vy = 0; this.group.visible = false; }
    this.group.position.set(b.x, b.y, b.z);
    if (this.deadT > 1.5 && !this.outcome) { this.outcome = 'done'; g.onPlayerDead(this.reason); }
  }

  animate(dt, sp, moving) {
    const P = this.model.parts, b = this.body, k = Math.min(1, dt * 16); this.animT += dt * (5 + sp * 1.15);
    const set = (o, x, z = 0) => { o.rotation.x = lerp(o.rotation.x, x, k); o.rotation.z = lerp(o.rotation.z, z, k); };
    let aL = 0, aR = 0, lL = 0, lR = 0, bob = 0, zA = 0;
    if (this.celebrating) { aL = aR = -2.8 + Math.sin(this.animT * 1.6) * 0.5; zA = 0.3; bob = Math.abs(Math.sin(this.celT * 7)) * 0.3; if (b.onGround && this.celT % 0.5 < dt) b.vy = 8; this.facing += dt * 5; }
    else if (!b.onGround) {
      if (b.vy > 0) { aL = aR = -2.5; lL = 0.5; lR = -0.3; } else { aL = Math.sin(this.animT * 1.8) * 1.2 - 1.8; aR = -Math.sin(this.animT * 1.8) * 1.2 - 1.8; lL = 0.4; lR = -0.4; zA = 0.5; }
    } else if (sp > 0.6) { const a = Math.min(1, sp / 7) * 0.95, ph = Math.sin(this.animT); aL = -ph * a; aR = ph * a; lL = ph * a * 1.1; lR = -ph * a * 1.1; bob = Math.abs(Math.cos(this.animT)) * 0.06 * Math.min(1, sp / 6); P.hip.rotation.x = lerp(P.hip.rotation.x, 0.12 * Math.min(1, sp / 7), k); }
    else { bob = Math.sin(this.animT * 0.5) * 0.02; aL = 0.05; aR = 0.05; }
    if (sp <= 0.6 || !b.onGround) P.hip.rotation.x = lerp(P.hip.rotation.x, 0, k);
    set(P.armL, aL, zA + 0.1); set(P.armR, aR, -zA - 0.1); set(P.legL, lL); set(P.legR, lR);
    if (this.flip > 0) { this.flip += dt * 14; P.hip.rotation.x = this.flip; if (this.flip >= Math.PI * 2) { this.flip = 0; P.hip.rotation.x = 0; } }
    this.squash = lerp(this.squash, 0, Math.min(1, dt * 9));
    const sq = this.squash, sc = 0.94; this.model.root.scale.set(sc * (1 + sq * 0.35), sc * (1 - sq * 0.45), sc * (1 + sq * 0.35));
    P.hip.position.y = 0.72 + bob;
    if (!this.celebrating && this.stun <= 0 && !this.dead && P.mouth) P.setFace(b.onGround || b.vy > 0 ? (sp > 8 ? 'cheer' : 'happy') : 'scared');
  }
}
const chaosJump = () => 1;
