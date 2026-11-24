import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
try {
  const game = new Game(canvas);
  document.getElementById('screen-loading').classList.remove('show');
  if (new URLSearchParams(location.search).has('debug')) window.__game = game; // dev hook: window.__game.chaos.trigger('quake')
  if (import.meta.hot) import.meta.hot.dispose(() => game.destroy());
} catch (err) {
  console.error(err);
  const p = document.querySelector('#screen-loading p');
  if (p) p.textContent = 'Could not start WebGL. Please use a recent browser with hardware acceleration enabled.';
}
