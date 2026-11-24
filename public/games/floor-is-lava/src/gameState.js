// Centralised game state: the single source of truth. The UI only reads from here.
export const STATUS = Object.freeze({
  MENU: 'MENU', CHAR_SELECT: 'CHAR_SELECT', PLAYING: 'PLAYING', PAUSED: 'PAUSED',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE', GAME_OVER: 'GAME_OVER',
});
const S = STATUS;
const ALLOWED = {
  [S.MENU]: [S.CHAR_SELECT, S.PLAYING],
  [S.CHAR_SELECT]: [S.MENU, S.PLAYING],
  [S.PLAYING]: [S.PAUSED, S.LEVEL_COMPLETE, S.GAME_OVER, S.MENU],
  [S.PAUSED]: [S.PLAYING, S.MENU],
  [S.LEVEL_COMPLETE]: [S.MENU, S.PLAYING],
  [S.GAME_OVER]: [S.MENU, S.PLAYING],
};
export const POWERUP_IDS = ['superJump', 'lavaShield', 'timeFreeze', 'speedBoost'];
export const CHARACTER_IDS = ['lazy', 'froggy', 'penguin'];
export const SAVE_KEY = 'dont-touch-the-floor:v1';
const LEVEL_COUNT = 3;

const defaultSave = () => ({
  best: { 1: 0, 2: 0, 3: 0 }, unlocked: 1, character: 'lazy',
  settings: { sound: true, shake: true, unlockAll: false },
});

// localStorage is user-editable, so never trust it: validate type, range and whitelist every field.
export function sanitizeSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const clampInt = (v, lo, hi, fallback) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : fallback);
  for (let i = 1; i <= LEVEL_COUNT; i++) d.best[i] = clampInt(raw.best?.[i], 0, 999999, 0);
  d.unlocked = clampInt(raw.unlocked, 1, LEVEL_COUNT, 1);
  d.character = CHARACTER_IDS.includes(raw.character) ? raw.character : 'lazy';
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  d.settings.sound = typeof s.sound === 'boolean' ? s.sound : true;
  d.settings.shake = typeof s.shake === 'boolean' ? s.shake : true;
  d.settings.unlockAll = typeof s.unlockAll === 'boolean' ? s.unlockAll : false;
  return d;
}
function loadSave() {
  try { return sanitizeSave(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return defaultSave(); }
}

export class GameState {
  constructor() {
    this.listeners = new Map();
    this.save = loadSave();
    this.d = this.fresh(S.MENU, 1);
  }
  fresh(status, level) {
    return {
      status, character: this.save.character, level, score: 0, coins: 0, stars: 0, lives: 3, time: 0,
      lavaHeight: 0, checkpoint: 0, powerups: { superJump: 0, lavaShield: 0, timeFreeze: 0, speedBoost: 0 },
      chaos: null, playerPos: [0, 0, 0], completed: false, falls: 0, nearMisses: 0, reason: '',
      totalCoins: 0, totalStars: 0, progress: 0, rating: '', bonusTime: 0, bonusLives: 0, isNewBest: false,
    };
  }
  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, new Set());
    this.listeners.get(evt).add(fn);
    return () => this.listeners.get(evt)?.delete(fn);
  }
  emit(evt, payload) { this.listeners.get(evt)?.forEach((fn) => fn(payload)); }
  transition(next) {
    const cur = this.d.status;
    if (cur === next) return true;
    if (!ALLOWED[cur].includes(next)) { console.warn(`Illegal status change ${cur} -> ${next}`); return false; }
    this.d.status = next;
    this.emit('status', { from: cur, to: next });
    return true;
  }
  resetRun(level) {
    const keepStatus = this.d.status;
    this.d = this.fresh(keepStatus, level);
  }
  addScore(n) { this.d.score += n; }
  isUnlocked(level) { return this.save.settings.unlockAll || level <= this.save.unlocked; }
  totalBest() { return Object.values(this.save.best).reduce((a, b) => a + b, 0); }
  setSetting(key, value) { this.save.settings[key] = value; this.persist(); this.emit('settings', key); }
  setCharacter(id) { if (CHARACTER_IDS.includes(id)) { this.save.character = id; this.d.character = id; this.persist(); } }
  recordResult(level, score) {
    const isBest = score > this.save.best[level];
    if (isBest) this.save.best[level] = Math.min(999999, Math.floor(score));
    if (level < LEVEL_COUNT) this.save.unlocked = Math.max(this.save.unlocked, level + 1);
    this.persist();
    return isBest;
  }
  resetSave() { this.save = defaultSave(); this.persist(); this.d.character = this.save.character; }
  persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage may be disabled */ } }
}
