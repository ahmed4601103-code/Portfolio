// Coins, stars and hidden stars: spawning, animation, touch/click collection.
import * as THREE from 'three';
import { mat, G, mesh } from './assets.js';

const REACH_CLICK = 8, TOUCH = 1.25;
const STAR_GEO = (() => {
  const s = new THREE.Shape(), R = 0.55, r = 0.25;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, k = i % 2 ? r : R; i ? s.lineTo(Math.cos(a) * k, Math.sin(a) * k) : s.moveTo(Math.cos(a) * k, Math.sin(a) * k); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  g.center(); return g;
})();

export class CollectibleManager {
  constructor(game) { this.game = game; this.items = []; this.t = 0; this._w = new THREE.Vector3(); this.coinMat = mat(0xffc400, { emissive: 0xff9a00, ei: 0.55 }); this.starMat = mat(0xffe34d, { emissive: 0xffb300, ei: 0.8 }); }

  build(def, level) {
    this.dispose(); const { raycast, state } = this.game; let n = 0, coins = 0, stars = 0;
    const add = (type, p, ox, oy, oz, hidden = false) => {
      const root = new THREE.Group();
      if (type === 'coin') { const c = mesh(G.cyl, this.coinMat, 0.42, 0.07, 0.42); c.rotation.x = Math.PI / 2; root.add(c); }
      else root.add(mesh(STAR_GEO, this.starMat, 1.35, 1.35, 1.35));
      level.attach(p, ox, oy, oz, root);
      const id = `${type}-${n++}`;
      const item = { id, type, root, base: root.position.y, collected: false, hidden, t: Math.random() * 6, shrink: 0 };
      item.entry = raycast.register({
        id, type, name: hidden ? 'Hidden Star' : type === 'coin' ? 'Golden Coin' : 'Rare Star', interaction: 'collect', mesh: root, scope: 'game',
        hint: type === 'coin' ? '+10 points · click to grab' : hidden ? '+150 points · click to grab' : '+100 points · click to grab', reach: REACH_CLICK,
        onSelect: (e, info) => this.onSelect(item, info),
      });
      this.items.push(item);
      if (type === 'coin') coins++; else stars++;
      if (hidden) { root.visible = false; }
    };
    def.platforms.forEach((p) => {
      for (let i = 0; i < (p.coins ?? 0); i++) add('coin', p, (i - ((p.coins - 1) / 2)) * 1.1, 0.95, p.spawn ? -p.d * 0.3 : 0.4);
      if (p.star) add('star', p, 0, 1.4, 0); if (p.hstar) add('star', p, 0, 1.4, 0, true);
    });
    // reward jumping: one coin hovering over each wide gap on the route
    const route = def.platforms.filter((p) => p.route);
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 4.5) continue;
      add('coin', { x: (a.x + b.x) / 2, top: Math.max(a.top, b.top), z: (a.z + b.z) / 2, k: 'air' }, 0, 2.2, 0);
    }
    state.d.totalCoins = coins; state.d.totalStars = stars;
  }

  onSelect(item, info) {
    const g = this.game, d = this.dist(item);
    if (item.collected) return;
    if (d > REACH_CLICK) { g.ui.toast('Too far away: get closer first!', 'warn'); return; }
    this.collect(item, info?.source ?? 'click');
  }
  dist(item) { item.root.getWorldPosition(this._w); const b = this.game.player.body; return Math.hypot(b.x - this._w.x, b.y + 0.9 - this._w.y, b.z - this._w.z); }

  collect(item, source = 'touch') {
    if (item.collected) return; // prevents repeated collection
    item.collected = true; item.entry.collected = true; item.shrink = 0.25;
    const g = this.game, st = g.state.d; item.root.getWorldPosition(this._w);
    const pos = this._w.clone();
    if (item.type === 'coin') {
      st.coins++; st.score += 10; g.audio.play('coin'); g.sceneMgr.fx.emit(pos.x, pos.y, pos.z, 0xffd23f, 10, 4, 0.6, 6);
      g.ui.floatText(pos, '+10', 'coin');
    } else {
      const pts = item.hidden ? 150 : 100; st.stars++; st.score += pts; g.audio.play('star');
      g.sceneMgr.fx.emit(pos.x, pos.y, pos.z, 0xfff27a, 26, 6.5, 1, 6); g.sceneMgr.fx.emit(pos.x, pos.y, pos.z, 0xffffff, 12, 3, 0.8, 3);
      g.ui.floatText(pos, `+${pts} ★`, 'star'); g.cam.addShake(0.08); g.player.react('😎');
    }
    void source;
  }

  update(dt, now) {
    const p = this.game.player.body;
    for (const it of this.items) {
      if (it.shrink > 0) { it.shrink -= dt; const k = Math.max(0, it.shrink / 0.25); it.root.scale.setScalar(k * 1.4 + 0.001); it.root.position.y += dt * 4; if (it.shrink <= 0) it.root.visible = false; continue; }
      if (it.collected) continue;
      it.root.rotation.y += dt * (it.type === 'star' ? 2.2 : 3);
      it.root.position.y = it.base + Math.sin(now * 3 + it.t) * 0.1;
      it.root.getWorldPosition(this._w);
      const d2 = (this._w.x - p.x) ** 2 + (this._w.y - (p.y + 0.9)) ** 2 + (this._w.z - p.z) ** 2;
      if (it.hidden) it.root.visible = d2 < 16 * 16; // hidden stars only glint when you're near
      if (it.root.visible && d2 < (TOUCH + 0.5) ** 2 && !this.game.player.dead) this.collect(it, 'touch');
    }
  }
  dispose() { this.items = []; }
}
