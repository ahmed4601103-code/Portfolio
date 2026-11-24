// Random chaos events every 30-45 s. Designed so none of them can make a level impossible:
// collapse only touches bonus platforms, lava surge is bounded and skipped when the player is close to the lava.
const EVENTS = [
  { id: 'quake', name: 'EARTHQUAKE!', emoji: '🌋', desc: 'Hold on tight!', dur: 6 },
  { id: 'bounce', name: 'FURNITURE CHAOS!', emoji: '🛋️', desc: 'The furniture is dancing!', dur: 8 },
  { id: 'lowgrav', name: 'LOW GRAVITY!', emoji: '🌙', desc: 'Jump higher... for now!', dur: 8 },
  { id: 'collapse', name: 'PLATFORM COLLAPSE!', emoji: '💥', desc: 'Some platforms are crumbling!', dur: 4 },
  { id: 'rain', name: 'OBJECT RAIN!', emoji: '☔', desc: 'Watch for the red circles!', dur: 7 },
  { id: 'surge', name: 'LAVA SURGE!', emoji: '🔥', desc: 'The lava is rising fast!', dur: 5 },
];
const rand = (a, b) => a + Math.random() * (b - a);

export class ChaosManager {
  constructor(game) { this.game = game; this.reset(); }
  reset() { this.timer = rand(30, 45); this.active = null; this.remaining = 0; this.last = null; this.rainT = 0; this.quake = false; this.bob = false; this.lowGrav = false; }
  get gravityScale() { return this.lowGrav ? 0.42 : 1; }

  eligible() {
    const g = this.game, b = g.player.body;
    return EVENTS.filter((e) => {
      if (e.id === this.last?.id) return false;
      if (e.id === 'surge' && (g.lava.h > b.y - 3.5 || g.lava.h + 5 * g.lava.rate * 5 > g.lava.max + 1)) return false;
      if (e.id === 'collapse' && !g.level.solids.some((s) => s.nc && s.cs === 'idle')) return false;
      return true;
    });
  }
  trigger(id) {
    const g = this.game, pool = id ? EVENTS.filter((e) => e.id === id) : this.eligible();
    if (!pool.length) { this.timer = 8; return; }
    const ev = pool[Math.floor(Math.random() * pool.length)];
    this.active = ev; this.last = ev; this.remaining = ev.dur; g.state.d.chaos = ev.name;
    g.ui.chaos(ev.name, ev.desc, ev.emoji); g.audio.play('chaos'); g.cam.addShake(ev.id === 'quake' ? 0.5 : 0.3);
    switch (ev.id) {
      case 'quake': this.quake = true; break;
      case 'bounce': this.bob = true; break;
      case 'lowgrav': this.lowGrav = true; break;
      case 'collapse': {
        const p = g.player.body;
        const cands = g.level.solids.filter((s) => s.nc && s.cs === 'idle').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
        cands.slice(0, 4).forEach((s) => g.level.forceCollapse(s, 8));
        break;
      }
      case 'rain': this.rainT = 0; break;
      case 'surge': g.lava.startSurge(ev.dur); break;
      default: break;
    }
  }
  end() {
    this.quake = false; this.bob = false; this.lowGrav = false; this.active = null; this.game.state.d.chaos = null; this.timer = rand(30, 45);
  }
  update(dt) {
    if (this.active) {
      this.remaining -= dt;
      if (this.quake) this.game.cam.addShake(0.22);
      if (this.active.id === 'rain') {
        this.rainT -= dt;
        if (this.rainT <= 0) { this.rainT = 0.55; const b = this.game.player.body; this.game.level.startFaller(b.x + rand(-7, 7), b.z + rand(-7, 7), 1.4); }
      }
      if (this.remaining <= 0) this.end();
    } else { this.timer -= dt; if (this.timer <= 0) this.trigger(); }
  }
}
