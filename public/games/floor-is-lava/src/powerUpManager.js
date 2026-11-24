// Four temporary power-ups: pickup meshes, activation, timers and their gameplay modifiers.
import * as THREE from 'three';
import { mat, G, mesh } from './assets.js';

export const POWERUPS = {
  superJump: { name: 'Super Jump', emoji: '🦘', color: 0x5dff7a, dur: 10, blurb: 'Jump 40% higher' },
  lavaShield: { name: 'Lava Shield', emoji: '🛡️', color: 0x4aa8ff, dur: 8, blurb: 'Lava bounces you away' },
  timeFreeze: { name: 'Time Freeze', emoji: '⏱️', color: 0x7af0ff, dur: 6, blurb: 'Obstacles and lava pause' },
  speedBoost: { name: 'Speed Boost', emoji: '⚡', color: 0xffd23f, dur: 8, blurb: 'Run 45% faster' },
};
const TOUCH = 1.5, REACH_CLICK = 8;

export class PowerUpManager {
  constructor(game) { this.game = game; this.items = []; this._w = new THREE.Vector3(); }
  get active() { return this.game.state.d.powerups; }
  get jumpMul() { return this.active.superJump > 0 ? 1.4 : 1; }
  get speedMul() { return this.active.speedBoost > 0 ? 1.45 : 1; }
  get shield() { return this.active.lavaShield > 0; }
  get freeze() { return this.active.timeFreeze > 0; }

  build(def, level) {
    this.dispose(); let n = 0;
    def.platforms.forEach((p) => {
      if (!p.pu) return; const cfg = POWERUPS[p.pu];
      const root = new THREE.Group();
      root.add(mesh(G.sph, mat(cfg.color, { emissive: cfg.color, ei: 0.9 }), 0.5, 0.5, 0.5));
      const ring = mesh(G.torus, mat(0xffffff, { emissive: 0xffffff, ei: 0.5 }), 0.85, 0.85, 0.85, 0, 0, 0, false); ring.rotation.x = Math.PI / 2; root.add(ring);
      level.attach(p, 0, 1.5, 0, root);
      const id = `pu-${n++}`;
      const item = { id, type: p.pu, root, ring, base: root.position.y, collected: false, shrink: 0, t: Math.random() * 6 };
      item.entry = this.game.raycast.register({
        id, type: 'powerup', name: cfg.name, interaction: 'collect', mesh: root, scope: 'game', hint: `${cfg.blurb} · click to grab`, reach: REACH_CLICK,
        onSelect: (e, info) => this.onSelect(item, info),
      });
      this.items.push(item);
    });
  }
  onSelect(item) {
    if (item.collected) return;
    if (this.dist(item) > REACH_CLICK) { this.game.ui.toast('Too far away: get closer first!', 'warn'); return; }
    this.collect(item);
  }
  dist(item) { item.root.getWorldPosition(this._w); const b = this.game.player.body; return Math.hypot(b.x - this._w.x, b.y + 0.9 - this._w.y, b.z - this._w.z); }
  collect(item) {
    if (item.collected) return; item.collected = true; item.entry.collected = true; item.shrink = 0.35;
    const g = this.game, cfg = POWERUPS[item.type]; item.root.getWorldPosition(this._w);
    g.sceneMgr.fx.emit(this._w.x, this._w.y, this._w.z, cfg.color, 34, 7, 1, 4); g.audio.play('powerup');
    g.ui.floatText(this._w, `${cfg.emoji} ${cfg.name}!`, 'power'); g.state.d.score += 25;
    g.ui.toast(`${cfg.emoji} ${cfg.name}: ${cfg.blurb}`, 'power');
    this.activate(item.type); g.player.react('😎');
  }
  activate(type) { this.active[type] = POWERUPS[type].dur; }
  clearAll() { for (const k of Object.keys(this.active)) this.active[k] = 0; }
  update(dt, now) {
    const p = this.game.player.body;
    for (const k of Object.keys(this.active)) {
      if (this.active[k] > 0) { this.active[k] = Math.max(0, this.active[k] - dt); if (this.active[k] === 0) { this.game.audio.play('expire'); this.game.ui.toast(`${POWERUPS[k].emoji} ${POWERUPS[k].name} ran out`, 'info'); } }
    }
    for (const it of this.items) {
      if (it.shrink > 0) { it.shrink -= dt; const k = Math.max(0.001, it.shrink / 0.35); it.root.scale.setScalar(2 - k); if (it.shrink <= 0) it.root.visible = false; continue; }
      if (it.collected) continue;
      it.root.position.y = it.base + Math.sin(now * 2.6 + it.t) * 0.18; it.ring.rotation.z += dt * 3; it.root.rotation.y += dt * 1.2;
      it.root.getWorldPosition(this._w);
      const d2 = (this._w.x - p.x) ** 2 + (this._w.y - (p.y + 0.9)) ** 2 + (this._w.z - p.z) ** 2;
      if (d2 < (TOUCH + 0.4) ** 2 && !this.game.player.dead) this.collect(it);
    }
  }
  dispose() { this.items = []; }
}
