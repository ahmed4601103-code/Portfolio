// Declarative level data (no three.js imports so tools can validate it in Node).
// P(kind, x, topY, z, width(x), depth(z), options)
//   route:1  -> part of the critical path (ordered)       nc:1   -> optional/bonus platform
//   b        -> behaviour: collapse | move | rotate | tilt | bounce | slip
//   coins:n  -> n coins above the platform   star / hstar -> star / hidden star
//   pu       -> power-up type   cp:1 -> checkpoint   exit:1 -> level exit   spawn:1 -> start
const DEFAULT_H = {
  bed: 1.2, mattress: 0.8, toy: 0.9, plank: 0.35, chair: 0.4, desk: 0.5, table: 0.5, ctable: 0.5,
  dining: 0.5, shelf: 0.5, wardrobe: 'full', sofa: 1.0, tvstand: 1.2, box: 1.0, book: 0.7, counter: 1.0,
  cabinet: 1.0, fridge: 'full', stove: 1.2, plate: 0.3, board: 0.3, mat: 0.3, pan: 0.3,
};
const P = (k, x, top, z, w, d, o = {}) => ({ k, x, top, z, w, d, h: o.h ?? DEFAULT_H[k] ?? 0.5, ...o });

export const LEVELS = [
  {
    id: 1, name: 'The Bedroom', difficulty: 'Easy', theme: 'bedroom', par: 110,
    objective: 'Hop across the furniture and reach the bedroom door!',
    lavaRate: 0.035, lavaMax: 8.5, bounds: { x: [-13, 13], z: [-54, 12] }, ceiling: 30,
    fog: 0xffa97c, wall: { kind: 'stripes', colors: ['#ffd3e6', '#fff0f6'] },
    platforms: [
      P('bed', 0, 1.6, 2, 6, 8, { route: 1, spawn: 1, c: 0x7aa7ff, coins: 2, name: 'Squishy Bed' }),
      P('toy', -1, 2.2, -5.2, 2.6, 2.6, { route: 1, c: 0xff6b6b, name: 'Toy Block' }),
      P('plank', 1.5, 2.9, -9, 2.4, 3.2, { route: 1, b: 'collapse', coins: 1 }),
      P('chair', 4.5, 3.5, -12.5, 2.6, 2.6, { route: 1, b: 'rotate', spd: 0.6, c: 0x5cc8a8 }),
      P('desk', 3, 4.3, -17.5, 7, 4, { route: 1, cp: 1, coins: 3 }),
      P('plank', -3.5, 5.0, -21.5, 2.6, 2.6, { route: 1, b: 'collapse' }),
      P('shelf', -6, 6.0, -26, 3, 6, { route: 1, coins: 3, c: 0xe9a25d }),
      P('plank', -2, 6.7, -30.5, 3, 2.4, { route: 1, b: 'move', ax: 'x', amp: 2.2, spd: 0.7 }),
      P('wardrobe', 4, 7.8, -35, 6, 5, { route: 1, coins: 2, c: 0xc58bd9 }),
      P('plank', 4.5, 8.6, -40.2, 2.4, 2.4, { route: 1, b: 'collapse' }),
      P('toy', 1.5, 9.4, -44, 2.6, 2.6, { route: 1, c: 0x6bd6ff }),
      P('mat', 0, 10, -48.5, 4, 3.5, { route: 1, exit: 1, c: 0xffd23f, name: 'Doorstep' }),
      // bonus platforms
      P('mattress', -8, 2.0, 0, 4, 4, { nc: 1, b: 'bounce', bounce: 17, star: 1, c: 0xff9ecb, name: 'Bouncy Mattress' }),
      P('book', -3.2, 4.6, -13.5, 2.4, 2.4, { nc: 1, pu: 'speedBoost', c: 0x4aa8ff }),
      P('plank', 9, 5.6, -22, 2.6, 2.6, { nc: 1, b: 'collapse', hstar: 1 }),
      P('plank', -10.5, 7.4, -31, 2.4, 2.4, { nc: 1, star: 1, b: 'collapse' }),
      P('plank', 9, 9.2, -38, 2.4, 2.4, { nc: 1, pu: 'lavaShield', b: 'collapse' }),
      P('book', 5.5, 3.2, -6, 2.4, 2.4, { nc: 1, pu: 'superJump', c: 0xff6b6b }),
    ],
    hazards: [
      { t: 'fall', x: 3, z: -19, every: 6, delay: 3 },
      { t: 'fall', x: -6, z: -27, every: 7, delay: 5 },
      { t: 'fall', x: 4, z: -36, every: 6.5, delay: 2 },
    ],
  },
  {
    id: 2, name: 'The Living Room', difficulty: 'Medium', theme: 'living', par: 150,
    objective: 'Rocking tables, rolling balls and rising lava. Find the front door!',
    lavaRate: 0.06, lavaMax: 10.7, bounds: { x: [-13, 13], z: [-62, 12] }, ceiling: 32,
    fog: 0xff8f6b, wall: { kind: 'diamonds', colors: ['#9fd8d0', '#7cc4ba'] },
    platforms: [
      P('sofa', 0, 1.8, 2, 7, 4, { route: 1, spawn: 1, c: 0xe2574c, coins: 2, name: 'Comfy Sofa' }),
      P('box', -1.5, 2.5, -4, 2.8, 2.8, { route: 1, b: 'collapse', delay: 2.4, coins: 1 }),
      P('ctable', 2, 3.3, -9, 4, 4, { route: 1, b: 'rotate', spd: 0.5, coins: 2 }),
      P('sofa', -1, 4.2, -15.5, 7, 3.4, { route: 1, b: 'tilt', c: 0x5b8def, coins: 2 }),
      P('shelf', -6.5, 5.0, -20.5, 3, 3, { route: 1, c: 0xe9a25d }),
      P('tvstand', -1, 6.0, -26, 8, 3.5, { route: 1, cp: 1, coins: 3, c: 0x6b4a8a }),
      P('box', 4.5, 6.9, -31, 3, 3, { route: 1, b: 'move', ax: 'x', amp: 2.5, spd: 0.6 }),
      P('table', 4, 7.9, -37, 3.8, 3.8, { route: 1, b: 'rotate', spd: -0.7, coins: 2 }),
      P('box', -1, 8.7, -41.5, 2.8, 2.8, { route: 1, b: 'collapse', delay: 2.2, pu: 'timeFreeze' }),
      P('sofa', -4, 9.6, -47, 6, 3.4, { route: 1, b: 'tilt', cp: 1, c: 0x4cc9a0, coins: 2 }),
      P('plank', -2, 10.5, -52, 2.8, 2.8, { route: 1, b: 'collapse' }),
      P('box', 2.5, 11.4, -55.5, 2.8, 2.8, { route: 1, b: 'collapse', delay: 2 }),
      P('mat', 0, 12.2, -59.5, 4, 3, { route: 1, exit: 1, c: 0xffd23f, name: 'Doorstep' }),
      // bonus platforms
      P('plank', 8.5, 3.6, -5, 2.6, 2.6, { nc: 1, star: 1, b: 'collapse' }),
      P('mattress', -8, 3.0, -15, 3.5, 3.5, { nc: 1, b: 'bounce', bounce: 17, pu: 'speedBoost', c: 0xffb347, name: 'Bouncy Mattress' }),
      P('plank', 7.5, 8.2, -33, 2.6, 2.6, { nc: 1, pu: 'lavaShield', b: 'collapse' }),
      P('plank', -8, 7.6, -31, 2.6, 2.6, { nc: 1, star: 1, b: 'collapse' }),
      P('plank', -7.5, 10.9, -52, 2.6, 2.6, { nc: 1, hstar: 1, b: 'collapse' }),
    ],
    hazards: [
      { t: 'roll', y: 4.2, z: -15.5, x0: -4.2, x1: 2.2, r: 0.6, spd: 1.0, ph: 0 },
      { t: 'roll', y: 6.0, z: -26, x0: -4.6, x1: 2.6, r: 0.6, spd: 1.15, ph: 1.5 },
      { t: 'roll', y: 9.6, z: -47, x0: -6.6, x1: -1.4, r: 0.55, spd: 1.35, ph: 0.5 },
      { t: 'fall', x: -1, z: -26, every: 7, delay: 4 },
      { t: 'fall', x: -1, z: -41.5, every: 8, delay: 3 },
      { t: 'fall', x: 2.5, z: -55.5, every: 7, delay: 6 },
    ],
  },
  {
    id: 3, name: 'The Kitchen', difficulty: 'Hard', theme: 'kitchen', par: 190,
    objective: 'Slippery counters, flying pans, and the lava is HUNGRY. Escape!',
    lavaRate: 0.085, lavaMax: 14, bounds: { x: [-13, 13], z: [-78, 12] }, ceiling: 34,
    fog: 0xff7a55, wall: { kind: 'checker', colors: ['#f4f4f4', '#7fd0e8'] },
    platforms: [
      P('counter', 0, 2.0, 2, 8, 5, { route: 1, spawn: 1, c: 0xf2f2f2, coins: 2, name: 'Kitchen Counter' }),
      P('plate', 3, 2.8, -5, 3, 3, { route: 1, b: 'move', ax: 'y', amp: 0.7, spd: 0.9, c: 0xffffff }),
      P('counter', -1, 3.6, -10.5, 5, 3.2, { route: 1, b: 'slip', c: 0xbfe8ff, coins: 2, name: 'Slippery Counter' }),
      P('cabinet', 3.5, 4.4, -15, 3, 3, { route: 1, b: 'collapse', c: 0xe9a25d }),
      P('stove', 0, 5.2, -20, 6, 4, { route: 1, cp: 1, coins: 3, name: 'Hot Stove' }),
      P('fridge', -5.5, 6.6, -26, 3.6, 3.6, { route: 1, coins: 2 }),
      P('pan', -1, 7.4, -31, 3.2, 3.2, { route: 1, b: 'move', ax: 'x', amp: 2.5, spd: 0.7, c: 0x555566, name: 'Frying Pan' }),
      P('board', 3.5, 8.3, -36, 4, 2.6, { route: 1, b: 'slip', coins: 2, name: 'Cutting Board' }),
      P('cabinet', 0, 9.2, -41, 3, 3, { route: 1, b: 'collapse', delay: 0.7, c: 0x6bd6ff }),
      P('dining', -4.5, 10.1, -46, 5, 5, { route: 1, b: 'rotate', spd: 0.45, cp: 1, coins: 2, name: 'Dining Table' }),
      P('plate', -1, 11.0, -52, 3, 3, { route: 1, b: 'move', ax: 'x', amp: 2.2, spd: 0.8, c: 0xffe27a }),
      P('shelf', 4, 11.9, -57, 4, 2.6, { route: 1, b: 'slip', coins: 2, c: 0xc58bd9 }),
      P('cabinet', 0, 12.9, -62, 5, 3.6, { route: 1, cp: 1, escape: 1, coins: 3, c: 0xff8c42, name: 'Escape Cabinet' }),
      P('plank', -3.5, 13.8, -66, 2.6, 2.6, { route: 1, b: 'collapse', delay: 0.6 }),
      P('plate', 0.5, 14.7, -69, 3, 2, { route: 1, b: 'collapse', delay: 0.6 }),
      P('mat', 0, 15.5, -73.5, 4, 3, { route: 1, exit: 1, c: 0xffd23f, name: 'Doorstep' }),
      // bonus platforms
      P('plate', -8, 2.6, 2, 2.8, 2.8, { nc: 1, pu: 'speedBoost', b: 'collapse', c: 0xffffff }),
      P('plate', 8, 3.8, -8, 2.8, 2.8, { nc: 1, star: 1, b: 'collapse', c: 0xffffff }),
      P('plate', -8, 5.0, -14, 2.8, 2.8, { nc: 1, pu: 'timeFreeze', c: 0xffffff }),
      P('plate', 9.5, 9.2, -36, 2.8, 2.8, { nc: 1, hstar: 1, b: 'collapse', c: 0xffffff }),
      P('plate', -9.5, 11.0, -50, 2.8, 2.8, { nc: 1, star: 1, b: 'collapse', c: 0xffffff }),
      P('plate', 8, 13.0, -62, 2.8, 2.8, { nc: 1, pu: 'superJump', c: 0xffffff }),
      P('plate', 9, 3.4, -1, 2.8, 2.8, { nc: 1, pu: 'lavaShield', c: 0xffffff }),
    ],
    hazards: [
      { t: 'roll', kind: 'pin', y: 5.2, z: -20, x0: -2.6, x1: 2.6, r: 0.5, spd: 1.3, ph: 0 },
      { t: 'swing', x: 3.5, z: -36, top: 8.3, len: 6.5, amp: 0.8, spd: 1.2, ph: 0 },
      { t: 'swing', x: -1, z: -52, top: 11.0, len: 6.5, amp: 0.8, spd: 1.4, ph: 1 },
      { t: 'fall', x: 0, z: -20, every: 6, delay: 3 },
      { t: 'fall', x: -4.5, z: -46, every: 6.5, delay: 2 },
      { t: 'fall', x: 0, z: -62, every: 5.5, delay: 3 },
    ],
  },
];

export const routeOf = (level) => level.platforms.filter((p) => p.route);
export const exitOf = (level) => level.platforms.find((p) => p.exit);
