// Procedural sound effects via Web Audio (no asset files, so nothing can 404).
const COOLDOWN = { jump: 0.08, land: 0.12, coin: 0.04, splash: 0.15, break: 0.12, click: 0.04, hurt: 0.2, bounce: 0.1 };
const MAX_VOICES = 10;

export class AudioManager {
  constructor() { this.ctx = null; this.enabled = true; this.last = {}; this.voices = 0; this.master = null; }
  setEnabled(v) { this.enabled = !!v; if (this.master) this.master.gain.value = this.enabled ? 0.5 : 0; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 0.5 : 0; this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    this.voices++; o.onended = () => { this.voices--; };
  }
  hiss(dur, vol, freq, delay = 0, q = 1) {
    const t = this.ctx.currentTime + delay, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur);
    this.voices++; s.onended = () => { this.voices--; };
  }
  play(name) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < (COOLDOWN[name] ?? 0.05)) return; // no uncontrolled overlap
    if (this.voices > MAX_VOICES) return;
    this.last[name] = now;
    switch (name) {
      case 'jump': this.tone('square', 260, 560, 0.14, 0.14); break;
      case 'doublejump': this.tone('square', 420, 900, 0.16, 0.14); this.tone('triangle', 600, 1200, 0.12, 0.1, 0.05); break;
      case 'land': this.hiss(0.12, 0.25, 220, 0, 0.7); this.tone('sine', 120, 50, 0.1, 0.25); break;
      case 'bounce': this.tone('sine', 200, 700, 0.25, 0.3); break;
      case 'coin': this.tone('square', 988, 988, 0.07, 0.12); this.tone('square', 1319, 1319, 0.16, 0.12, 0.07); break;
      case 'star': [660, 880, 1109, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.2, i * 0.07)); break;
      case 'powerup': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.12, 0.13, i * 0.05)); break;
      case 'expire': this.tone('sawtooth', 500, 180, 0.3, 0.15); break;
      case 'checkpoint': [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.25, i * 0.09)); break;
      case 'splash': this.hiss(0.5, 0.5, 700, 0, 0.5); this.tone('sine', 300, 60, 0.4, 0.3); break;
      case 'break': this.hiss(0.25, 0.4, 1800, 0, 0.4); this.tone('sawtooth', 160, 60, 0.2, 0.15); break;
      case 'hurt': this.tone('sawtooth', 320, 90, 0.28, 0.25); break;
      case 'chaos': for (let i = 0; i < 3; i++) { this.tone('sawtooth', 440, 330, 0.18, 0.18, i * 0.22); } this.hiss(0.7, 0.3, 200, 0, 0.5); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.18, 0.16, i * 0.12)); break;
      case 'over': [440, 392, 330, 262].forEach((f, i) => this.tone('sawtooth', f, f * 0.96, 0.3, 0.2, i * 0.22)); break;
      case 'near': this.tone('triangle', 700, 1400, 0.18, 0.2); break;
      case 'click': this.tone('triangle', 700, 520, 0.06, 0.15); break;
      case 'tick': this.tone('sine', 900, 900, 0.04, 0.1); break;
      default: break;
    }
  }
}
