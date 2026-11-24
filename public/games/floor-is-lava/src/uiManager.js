// DOM user interface. Reads from GameState every frame (changed-value cache) and never keeps its own copy of game data.
// All dynamic text uses textContent (no innerHTML) so nothing can inject markup.
import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { CHARACTERS } from './characters.js';
import { POWERUPS } from './powerUpManager.js';
import { STATUS } from './gameState.js';

const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SCREENS = ['loading', 'menu', 'levels', 'chars', 'pause', 'complete', 'over'];
const MODALS = ['howto', 'settings'];

export class UIManager {
  constructor(game) {
    this.game = game; this.state = game.state; this.cache = {}; this.floaters = []; this.ac = new AbortController();
    this.current = 'loading'; this.modal = null; this.chaosTimer = 0;
    this.el = { hudPU: $('hud-powerups'), lives: $('hud-lives'), tooltip: $('tooltip') };
    this.buildPowerupSlots(); this.buildFloaters(); this.bind(); this.syncSettings(); this.buildCharStats();
  }
  on(id, fn) {
    $(id).addEventListener('click', (e) => { this.game.audio.unlock(); this.game.audio.play('click'); fn(e); e.currentTarget.blur(); }, { signal: this.ac.signal });
  }
  bind() {
    const g = this.game;
    this.on('btn-play', () => g.goChars(true)); this.on('btn-levels', () => g.goLevels()); this.on('btn-chars', () => g.goChars(false));
    this.on('btn-howto', () => this.openModal('howto')); this.on('btn-settings', () => this.openModal('settings'));
    this.on('btn-levels-back', () => g.goMenu()); this.on('btn-chars-back', () => g.goMenu()); this.on('btn-chars-next', () => g.goLevels());
    this.on('btn-resume', () => g.resume()); this.on('btn-restart', () => g.restartLevel()); this.on('btn-pause-menu', () => g.goMenu());
    this.on('btn-pause-settings', () => this.openModal('settings'));
    this.on('btn-hud-pause', () => g.pause()); this.on('btn-hud-sound', () => g.toggleSound());
    this.on('btn-comp-menu', () => g.goMenu()); this.on('btn-comp-retry', () => g.restartLevel()); this.on('btn-comp-next', () => g.nextLevel());
    this.on('btn-over-menu', () => g.goMenu()); this.on('btn-over-restart', () => g.restartLevel());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { g.audio.play('click'); this.closeModal(); b.blur(); }, { signal: this.ac.signal }));
    $('set-sound').addEventListener('change', (e) => g.setSound(e.target.checked), { signal: this.ac.signal });
    $('set-shake').addEventListener('change', (e) => { this.state.setSetting('shake', e.target.checked); g.cam.shakeEnabled = e.target.checked; }, { signal: this.ac.signal });
    $('set-unlock').addEventListener('change', (e) => { this.state.setSetting('unlockAll', e.target.checked); this.buildLevelCards(); }, { signal: this.ac.signal });
    $('btn-reset-save').addEventListener('click', () => { if (confirm('Erase all saved progress and best scores?')) { this.state.resetSave(); this.syncSettings(); this.refreshMenu(); g.applySettings(); } }, { signal: this.ac.signal });
  }
  syncSettings() { const s = this.state.save.settings; $('set-sound').checked = s.sound; $('set-shake').checked = s.shake; $('set-unlock').checked = s.unlockAll; $('btn-hud-sound').textContent = s.sound ? '🔊' : '🔇'; }

  show(name) {
    this.current = name;
    for (const n of SCREENS) $(`screen-${n}`).classList.remove('show');
    for (const m of MODALS) $(`modal-${m}`).classList.remove('show');
    this.modal = null;
    if (name) $(`screen-${name}`).classList.add('show');
    if (name === 'menu') this.refreshMenu();
    if (name === 'levels') this.buildLevelCards();
  }
  showHud(v) { $('hud').classList.toggle('hidden', !v); }
  openModal(name) { this.modal = name; $(`modal-${name}`).classList.add('show'); this.syncSettings(); }
  closeModal() { if (this.modal) $(`modal-${this.modal}`).classList.remove('show'); this.modal = null; }
  refreshMenu() { $('menu-best').textContent = this.state.totalBest().toLocaleString(); }

  buildLevelCards() {
    const wrap = $('level-cards'); wrap.replaceChildren();
    LEVELS.forEach((L) => {
      const b = document.createElement('button'); b.className = 'card'; b.disabled = !this.state.isUnlocked(L.id);
      const mk = (cls, t) => { const d = document.createElement('div'); d.className = cls; d.textContent = t; b.appendChild(d); };
      mk('num', String(L.id)); mk('nm', L.name); mk('df', L.difficulty);
      mk('bs', b.disabled ? 'Locked: finish the previous room' : this.state.save.best[L.id] ? `Best: ${this.state.save.best[L.id].toLocaleString()}` : 'Not played yet');
      b.addEventListener('click', () => { this.game.audio.unlock(); this.game.audio.play('click'); this.game.startLevel(L.id); }, { signal: this.ac.signal });
      wrap.appendChild(b);
    });
  }
  buildCharStats() {
    const wrap = $('char-stats'); wrap.replaceChildren(); this.statEls = {};
    const rows = [['Speed', 'speed', 6, 10], ['Jump', 'jump', 10, 14], ['Grip', 'grip', 0, 1]];
    rows.forEach(([label, key]) => { const d = document.createElement('div'); d.className = 'stat'; const t = document.createElement('span'); t.textContent = label; const i = document.createElement('i'); const b = document.createElement('b'); i.appendChild(b); d.append(t, i); wrap.appendChild(d); this.statEls[key] = b; });
  }
  showCharacter(id) {
    const c = CHARACTERS[id]; $('char-desc').textContent = `${c.name}: ${c.blurb}`;
    this.statEls.speed.style.width = `${((c.speed - 5) / 5) * 100}%`; this.statEls.jump.style.width = `${((c.jump - 9) / 5.5) * 100}%`; this.statEls.grip.style.width = `${Math.min(100, (c.fric / 11) * 100)}%`;
  }

  buildPowerupSlots() {
    Object.entries(POWERUPS).forEach(([id, c]) => {
      const d = document.createElement('div'); d.className = 'pu'; d.dataset.id = id; d.title = `${c.name}: ${c.blurb}`;
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = c.emoji; const nm = document.createElement('span'); nm.textContent = c.name.split(' ')[1] ?? c.name;
      const bar = document.createElement('i'); const fill = document.createElement('b'); bar.appendChild(fill); d.append(ic, nm, bar); this.el.hudPU.appendChild(d);
      this.cache[`pu-${id}`] = { d, fill };
    });
  }

  setText(id, v) { if (this.cache[id] !== v) { this.cache[id] = v; $(id).textContent = v; } }
  update(dt) {
    const d = this.state.d;
    if (d.status === STATUS.PLAYING || d.status === STATUS.PAUSED) {
      const L = LEVELS[d.level - 1];
      this.setText('hud-level', `Level ${d.level}: ${L.name}`); this.setText('hud-score', d.score.toLocaleString());
      this.setText('hud-coins', `${d.coins}/${d.totalCoins}`); this.setText('hud-stars', `${d.stars}/${d.totalStars}`);
      this.setText('hud-time', fmt(d.time));
      const lives = '❤️'.repeat(Math.max(0, d.lives)) + '🖤'.repeat(Math.max(0, 3 - d.lives)); if (this.cache.lives !== lives) { this.cache.lives = lives; this.el.lives.textContent = lives; }
      const pr = `${Math.round(d.progress * 100)}%`; if (this.cache.prog !== pr) { this.cache.prog = pr; $('hud-progress').style.width = pr; }
      const top = this.game.level.exitTop || 10, lf = Math.min(100, (d.lavaHeight / top) * 100), pf = Math.min(100, Math.max(0, (d.playerPos[1] / top) * 100));
      $('lava-fill').style.height = `${lf.toFixed(1)}%`; $('lava-player').style.bottom = `calc(${pf.toFixed(1)}% - 2px)`;
      const gap = d.playerPos[1] - d.lavaHeight, danger = d.status === STATUS.PLAYING && gap < 3.6 && !this.game.player.dead;
      $('lava-warn').style.opacity = danger ? String(Math.min(1, (3.6 - gap) / 3.6) * (0.6 + Math.sin(performance.now() / 120) * 0.25)) : '0';
      document.querySelector('.lava-gauge').classList.toggle('danger', danger && gap < 2.2);
      for (const [id, c] of Object.entries(POWERUPS)) { const rem = d.powerups[id], s = this.cache[`pu-${id}`]; s.d.classList.toggle('on', rem > 0); s.fill.style.width = rem > 0 ? `${(rem / c.dur) * 100}%` : '0'; }
    }
    if (this.chaosTimer > 0) { this.chaosTimer -= dt; if (this.chaosTimer <= 0) $('chaos-banner').classList.remove('show'); }
    this.updateFloaters(dt);
  }
  setObjective(t) { $('hud-objective').textContent = t; }

  toast(msg, kind = 'info') {
    const host = $('toasts'); while (host.children.length >= 3) host.firstChild.remove();
    const t = document.createElement('div'); t.className = `toast ${kind}`; t.textContent = msg; host.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
  }
  chaos(name, desc, emoji) {
    $('chaos-emoji').textContent = emoji; $('chaos-name').textContent = name; $('chaos-desc').textContent = desc;
    $('chaos-banner').classList.add('show'); this.chaosTimer = 2.8;
  }

  buildFloaters() { const host = $('floaters'); for (let i = 0; i < 16; i++) { const e = document.createElement('div'); e.className = 'floater'; host.appendChild(e); this.floaters.push({ e, life: 0, pos: new THREE.Vector3(), v: new THREE.Vector3() }); } this._p = new THREE.Vector3(); }
  floatText(pos, text, kind = 'coin') {
    const f = this.floaters.find((q) => q.life <= 0) ?? this.floaters[0];
    f.life = 1.1; f.max = 1.1; f.pos.copy(pos); f.e.textContent = text; f.e.className = `floater ${kind}`; f.e.style.display = 'block';
  }
  updateFloaters(dt) {
    const cam = this.game.cam.camera, w = window.innerWidth, h = window.innerHeight;
    for (const f of this.floaters) {
      if (f.life <= 0) continue; f.life -= dt; if (f.life <= 0) { f.e.style.display = 'none'; continue; }
      f.pos.y += dt * 1.6; this._p.copy(f.pos).project(cam);
      if (this._p.z > 1) { f.e.style.display = 'none'; continue; }
      f.e.style.display = 'block'; f.e.style.opacity = String(Math.min(1, f.life / 0.4));
      f.e.style.transform = `translate(${(this._p.x * 0.5 + 0.5) * w}px, ${(-this._p.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
    }
  }

  showComplete(d, lvl, isLast) {
    $('comp-title').textContent = isLast ? 'You escaped the house!' : `${lvl.name} cleared!`;
    $('comp-rating').textContent = d.rating; this.setStat('comp-time', fmt(d.time)); this.setStat('comp-coins', `${d.coins} / ${d.totalCoins}`);
    this.setStat('comp-stars', `${d.stars} / ${d.totalStars}`); this.setStat('comp-falls', String(d.falls)); this.setStat('comp-near', `${d.nearMisses} (+${d.nearMisses * 50})`);
    this.setStat('comp-bonus', `+${(d.bonusTime + d.bonusLives).toLocaleString()}`); this.setStat('comp-score', d.score.toLocaleString());
    $('comp-best').textContent = d.isNewBest ? 'New personal best!' : '';
    $('btn-comp-next').style.display = isLast ? 'none' : '';
    this.show('complete');
  }
  setStat(id, v) { $(id).textContent = v; this.cache[id] = v; }
  showGameOver(d) { $('over-reason').textContent = d.reason; $('over-score').textContent = d.score.toLocaleString(); this.show('over'); }
  destroy() { this.ac.abort(); }
}
