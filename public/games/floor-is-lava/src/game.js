// Game: owns the loop and wires all managers together. Managers talk through GameState and this object.
import * as THREE from 'three';
import { GameState, STATUS } from './gameState.js';
import { SceneManager } from './scene.js';
import { CameraRig } from './camera.js';
import { Physics } from './physics.js';
import { Player } from './player.js';
import { LevelManager } from './levelManager.js';
import { LavaManager } from './lavaManager.js';
import { CollectibleManager } from './collectibleManager.js';
import { PowerUpManager } from './powerUpManager.js';
import { ChaosManager } from './chaosManager.js';
import { RaycastManager } from './raycasting.js';
import { UIManager } from './uiManager.js';
import { AudioManager } from './audioManager.js';
import { PreviewScene } from './preview.js';
import { LEVELS } from './levels.js';
import { mat, disposeSharedAssets } from './assets.js';

const MAX_DT = 0.033;

export class Game {
  constructor(canvas) {
    this.canvas = canvas; this.ac = new AbortController();
    this.state = new GameState(); this.audio = new AudioManager();
    this.sceneMgr = new SceneManager(canvas); this.physics = new Physics(); this.cam = new CameraRig(this.physics);
    this.raycast = new RaycastManager(canvas, document.getElementById('tooltip'));
    this.preview = new PreviewScene(this);
    this.level = new LevelManager(this); this.lava = new LavaManager(this); this.player = new Player(this);
    this.collect = new CollectibleManager(this); this.powerups = new PowerUpManager(this); this.chaos = new ChaosManager(this);
    this.ui = new UIManager(this);
    this.input = { w: 0, a: 0, s: 0, d: 0, up: 0, down: 0, left: 0, right: 0, shift: 0 };
    this.finishing = false; this.finishT = 0; this.last = performance.now(); this.raf = 0; this.drag = null; this._pp = new THREE.Vector3();
    this.sceneMgr.onResize = (a) => { this.cam.setAspect(a); this.preview.setAspect(a); };
    this.sceneMgr.resize();
    this.applySettings(); this.ui.showCharacter(this.state.d.character); this.player.setCharacter(this.state.d.character);
    this.lava.mesh.visible = this.lava.debris.visible = this.lava.light.visible = false; this.player.group.visible = false;
    this.bindEvents(); this.goMenu(true);
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------ events (registered once, removed by destroy())
  bindEvents() {
    const o = { signal: this.ac.signal }, c = this.canvas;
    window.addEventListener('resize', () => this.sceneMgr.resize(), o);
    window.addEventListener('blur', () => { this.clearKeys(); if (this.state.d.status === STATUS.PLAYING && !this.finishing) this.pause(); }, o);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state.d.status === STATUS.PLAYING && !this.finishing) this.pause(); }, o);
    window.addEventListener('keydown', (e) => this.onKey(e, true), o);
    window.addEventListener('keyup', (e) => this.onKey(e, false), o);
    c.addEventListener('contextmenu', (e) => e.preventDefault(), o);
    c.addEventListener('pointerdown', (e) => { this.audio.unlock(); this.drag = { x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; c.setPointerCapture(e.pointerId); this.raycast.setPointer(e); }, o);
    c.addEventListener('pointermove', (e) => {
      this.raycast.setPointer(e);
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved > 5 && this.state.d.status === STATUS.PLAYING) this.cam.rotate(dx, dy);
    }, o);
    c.addEventListener('pointerup', (e) => {
      const d = this.drag; this.drag = null; try { c.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (d && d.moved <= 5 && d.btn === 0) this.raycast.click();
    }, o);
    c.addEventListener('pointerleave', () => { if (!this.drag) this.raycast.pointerLeft(); }, o);
    c.addEventListener('wheel', (e) => { if (this.state.d.status === STATUS.PLAYING) this.cam.zoom(e.deltaY); }, { ...o, passive: true });
  }
  clearKeys() { for (const k of Object.keys(this.input)) this.input[k] = 0; }
  onKey(e, down) {
    const k = this.input;
    const map = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ShiftLeft: 'shift', ShiftRight: 'shift' };
    if (map[e.code]) { k[map[e.code]] = down ? 1 : 0; if (e.code.startsWith('Arrow')) e.preventDefault(); }
    const playing = this.state.d.status === STATUS.PLAYING;
    if (e.code === 'Space') { if (playing) { e.preventDefault(); if (down && !e.repeat && !this.finishing) this.player.queueJump(); } else if (!document.activeElement || document.activeElement === document.body) e.preventDefault(); }
    if (!down) return;
    if (e.code === 'Escape') {
      if (this.ui.modal) this.ui.closeModal(); else if (playing && !this.finishing) this.pause(); else if (this.state.d.status === STATUS.PAUSED) this.resume();
    }
    if (e.code === 'KeyE' && playing && !e.repeat) this.interactNearest();
  }

  // ------------------------------------------------------------ navigation
  applySettings() { const s = this.state.save.settings; this.audio.setEnabled(s.sound); this.cam.shakeEnabled = s.shake; this.ui?.syncSettings?.(); }
  setSound(v) { this.state.setSetting('sound', v); this.audio.setEnabled(v); this.ui.syncSettings(); }
  toggleSound() { this.setSound(!this.state.save.settings.sound); }
  showStage(view) { this.preview.setView(view); this.raycast.setScope('preview'); this.ui.showHud(false); this.lava.mesh.visible = this.lava.debris.visible = this.lava.light.visible = false; this.player.group.visible = false; }
  goMenu(first = false) {
    if (!first) this.level.dispose(), this.raycast.clear('game');
    this.state.transition(STATUS.MENU); this.finishing = false; this.showStage('menu'); this.ui.show('menu');
  }
  goChars() { this.state.transition(STATUS.CHAR_SELECT); this.showStage('chars'); this.ui.show('chars'); this.ui.showCharacter(this.state.d.character); }
  goLevels() { this.state.transition(STATUS.MENU); this.showStage('menu'); this.ui.show('levels'); }
  selectCharacter(id) { this.state.setCharacter(id); this.ui.showCharacter(id); this.audio.unlock(); this.audio.play('powerup'); }
  pause() { if (this.state.transition(STATUS.PAUSED)) { this.clearKeys(); this.ui.show('pause'); } }
  resume() { if (this.state.transition(STATUS.PLAYING)) { this.ui.show(null); this.last = performance.now(); } }
  nextLevel() { this.startLevel(Math.min(LEVELS.length, this.state.d.level + 1)); }
  restartLevel() { this.startLevel(this.state.d.level); }

  startLevel(n) {
    if (!this.state.isUnlocked(n)) return;
    this.audio.unlock(); const def = LEVELS[n - 1];
    this.raycast.clear('game'); this.level.load(def);
    this.state.resetRun(n); this.lava.reset(def); this.chaos.reset(); this.collect.build(def, this.level); this.powerups.build(def, this.level);
    this.lava.mesh.visible = this.lava.debris.visible = this.lava.light.visible = true;
    this.player.setCharacter(this.state.d.character); this.player.respawn(this.level.respawns[0]); this.cam.snap(this.player.body);
    this.sceneMgr.fx.clear(); this.clearKeys(); this.finishing = false; this.raycast.enabled = true;
    this.state.d.playerPos = [this.player.body.x, this.player.body.y, this.player.body.z];
    this.raycast.setScope('game'); this.ui.setObjective(def.objective); this.ui.show(null); this.ui.showHud(true);
    this.state.transition(STATUS.PLAYING); this.last = performance.now(); this.ui.toast(def.objective, 'info');
    this.player.group.visible = true;
  }

  // ------------------------------------------------------------ gameplay events
  inspect(entry) { this.ui.toast(`${entry.info[0]}: ${entry.info[1]}`, 'info'); this.audio.play('tick'); }
  interactNearest() {
    let best = null, bd = 6;
    for (const e of this.raycast.listByScope('game')) {
      if (e.collected || e.interaction === 'inspect') continue;
      const d = this.raycast.distanceTo(e); if (d < bd) { best = e; bd = d; }
    }
    if (best) { best.onSelect(best, { source: 'key' }); return; }
    const g = this.player.body.ground; const f = g && this.raycast.entries.get(`furn-${g.id}`); if (f) f.onSelect(f, { source: 'key' });
  }
  interactCheckpoint(cp) {
    if (cp.active) { this.ui.toast('Checkpoint already active', 'info'); return; }
    if (this.raycast.distanceTo(cp.entry) > 9) { this.ui.toast('Too far away: get closer first!', 'warn'); return; }
    this.activateCheckpoint(cp);
  }
  activateCheckpoint(cp) {
    if (cp.active) return; cp.active = true; const d = this.state.d;
    const m = mat(0x4cff6a, { emissive: 0x22ff44, ei: 0.8 }); if (cp.cloth.userData.origMat) cp.cloth.userData.origMat = m; else cp.cloth.material = m;
    d.checkpoint = Math.max(d.checkpoint, cp.idx); d.score += 50; this.audio.play('checkpoint');
    const w = cp.flag.getWorldPosition(this._pp); this.sceneMgr.fx.emit(w.x, w.y + 2, w.z, 0x4cff6a, 24, 6, 0.9, 5); this.ui.floatText(w.clone().setY(w.y + 3), 'CHECKPOINT +50', 'near');
    this.ui.toast('Checkpoint reached!', 'good');
    if (cp.platform.def.escape) this.startEscape(cp);
  }
  startEscape(cp) {
    this.lava.escape = true; this.lava.h = Math.min(this.lava.h, cp.platform.def.top - 7);
    this.ui.chaos('ESCAPE!', 'The lava is racing you to the exit!', '🏃'); this.audio.play('chaos'); this.cam.addShake(0.5);
  }
  onPlayerDead(reason) {
    const d = this.state.d; d.lives--; this.chaos.lowGrav = false;
    if (d.lives <= 0) { this.gameOver(reason === 'lava' ? 'You ran out of lives. The lava always wins... this time.' : 'You ran out of lives.'); return; }
    const rp = this.level.respawns[d.checkpoint], safe = Math.max(0, rp.y - 3);
    if (this.lava.h > safe) { this.lava.h = safe; this.ui.toast('The lava backs off a little...', 'info'); }
    this.level.restoreAll(); this.player.respawn(rp); this.cam.snap(this.player.body); this.powerups.clearAll();
    this.ui.toast(`Back to ${d.checkpoint ? `checkpoint ${d.checkpoint}` : 'the start'}. ${d.lives} ${d.lives === 1 ? 'life' : 'lives'} left`, 'warn');
  }
  gameOver(reason) {
    const d = this.state.d; d.reason = reason; if (!this.state.transition(STATUS.GAME_OVER)) return;
    this.audio.play('over'); this.ui.showGameOver(d);
  }
  completeLevel() {
    if (this.finishing) return; this.finishing = true; this.finishT = 2.6; const d = this.state.d, def = LEVELS[d.level - 1];
    this.player.celebrate(); this.audio.play('win'); this.cam.addShake(0.2);
    d.bonusTime = Math.max(0, Math.round(def.par - d.time)) * 5; d.bonusLives = d.lives * 100; d.score += d.bonusTime + d.bonusLives; d.completed = true;
    const pct = (d.totalCoins ? d.coins / d.totalCoins : 1) * 40 + (d.totalStars ? d.stars / d.totalStars : 1) * 30 + Math.max(0, 30 - d.falls * 10);
    d.rating = pct >= 90 ? 'S' : pct >= 70 ? 'A' : pct >= 45 ? 'B' : 'C';
    d.isNewBest = this.state.recordResult(d.level, d.score);
  }
  checkExit() {
    const e = this.level.exit, b = this.player.body;
    if (e && !this.finishing && !this.player.dead && Math.hypot(b.x - e.x, b.z - e.z) < 1.7 && Math.abs(b.y - e.y) < 2.4) this.completeLevel();
  }

  // ------------------------------------------------------------ loop
  tick(real) {
    const d = this.state.d, b = this.player.body, dt = real;
    if (!this.player.dead && !this.finishing) d.time += dt;
    const worldDt = this.powerups.freeze ? 0 : dt;
    this.level.update(worldDt, dt);
    this.lava.update(dt, this.finishing ? 0 : worldDt);
    if (!this.finishing && !this.player.dead) this.chaos.update(dt);
    this.player.update(dt, this.input, this.cam.yaw);
    this.collect.update(dt, this.level.time); this.powerups.update(dt, this.level.time);
    this.checkExit();
    if (this.finishing) {
      this.finishT -= dt; if (Math.random() < 0.5) this.sceneMgr.fx.emit(b.x + (Math.random() - 0.5) * 4, b.y + 3.5, b.z + (Math.random() - 0.5) * 4, [0xff5a5a, 0xffd23f, 0x4aa8ff, 0x5dff7a][(Math.random() * 4) | 0], 3, 3, 1.4, 6, 0.2);
      if (this.finishT <= 0 && this.state.transition(STATUS.LEVEL_COMPLETE)) { this.ui.showComplete(d, LEVELS[d.level - 1], d.level >= LEVELS.length); }
    }
    this.raycast.playerPos = this._pp.set(b.x, b.y, b.z);
    this.sceneMgr.followSun(b.x, b.y, b.z); this.cam.update(dt, b); this.sceneMgr.fx.update(dt);
  }
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const real = Math.min(MAX_DT, (now - this.last) / 1000); this.last = now;
    const st = this.state.d.status, inGame = st === STATUS.PLAYING || st === STATUS.PAUSED || st === STATUS.LEVEL_COMPLETE || st === STATUS.GAME_OVER;
    if (st === STATUS.PLAYING) this.tick(real);
    else if (inGame) { this.lava.update(real, 0); this.sceneMgr.fx.update(real); }
    else this.preview.update(real);
    // raycasting uses the camera of whichever scene is visible; only live while playing or on the stage
    const live = st === STATUS.PLAYING && !this.finishing || !inGame;
    this.raycast.enabled = live && !(this.drag && this.drag.moved > 5);
    this.raycast.setCamera(inGame ? this.cam.camera : this.preview.camera); this.raycast.setScope(inGame ? 'game' : 'preview');
    this.raycast.update(); this.ui.update(real);
    if (inGame) this.sceneMgr.render(this.sceneMgr.world, this.cam.camera); else this.sceneMgr.render(this.preview.scene, this.preview.camera);
  }
  destroy() {
    cancelAnimationFrame(this.raf); this.ac.abort(); this.ui.destroy(); this.level.dispose(); this.lava.dispose(); this.sceneMgr.dispose(); disposeSharedAssets();
  }
}
