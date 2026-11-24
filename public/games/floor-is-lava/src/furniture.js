// Procedural cartoon furniture. Every builder fills a group whose box matches the collider
// (w x h x d, centred at the origin) and extends "legs" downward into the lava for a big-furniture feel.
import * as THREE from 'three';
import { box, G, mat, mesh } from './assets.js';

const EXT = 5; // visual-only extension below the collider
const WOOD = 0xb9824a, DWOOD = 0x7d4f2a;

export const FURNITURE_INFO = {
  bed: ['Squishy Bed', 'Soft, warm and 100% not made this morning.'],
  mattress: ['Bouncy Mattress', 'Land on it hard and it launches you skyward!'],
  toy: ['Toy Block', 'Someone left this on the floor. Classic.'],
  plank: ['Wobbly Plank', 'Stand here too long and it gives up on you.'],
  chair: ['Spinny Chair', 'Rotates slowly. Keep your balance!'],
  desk: ['Messy Desk', 'Homework not included.'],
  table: ['Little Table', 'Spins like a very slow merry-go-round.'],
  ctable: ['Coffee Table', 'It has a mind of its own and it rotates.'],
  dining: ['Dining Table', 'Dinner is served. You are not invited.'],
  shelf: ['Bookshelf', 'Contains 3 books and 400 dust bunnies.'],
  wardrobe: ['Giant Wardrobe', 'Narnia is closed today.'],
  sofa: ['Comfy Sofa', 'Wobbles when you stand on it. Rude.'],
  tvstand: ['TV Stand', 'The TV has been watching you jump.'],
  box: ['Cardboard Box', 'Falls apart if you stay too long.'],
  book: ['Book Stack', 'Heavy reading. Easy landing.'],
  counter: ['Kitchen Counter', 'Wiped clean. Very slippery.'],
  cabinet: ['Cabinet', 'Full of mugs. Wobbly hinges.'],
  fridge: ['Refrigerator', 'Cold on the inside, hot on the outside.'],
  stove: ['Hot Stove', 'Burners are on. Obviously.'],
  plate: ['Flying Plate', 'Dinnerware with a sense of adventure.'],
  board: ['Cutting Board', 'Coated in oil. Careful!'],
  pan: ['Frying Pan', 'Sizzles, slides and moves around.'],
  mat: ['Doorstep', 'Freedom is right there!'],
};

const legs = (g, w, d, h, color, inset = 0.25, thick = 0.22) => {
  const top = h / 2 - 0.3, len = h + EXT - 0.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(thick, len, thick, color, sx * (w / 2 - inset), top - len / 2, sz * (d / 2 - inset)));
  }
};

export function buildFurniture(kind, w, h, d, c) {
  const g = new THREE.Group();
  const T = h / 2;
  const ext = (color, wd = w, dd = d) => g.add(box(wd, h + EXT, dd, color, 0, -EXT / 2, 0)); // box reaching down
  const lighter = new THREE.Color(c ?? WOOD).offsetHSL(0, 0, 0.12).getHex();

  switch (kind) {
    case 'bed': {
      g.add(box(w * 0.96, h * 0.5, d * 0.96, c, 0, T - h * 0.25, 0));
      g.add(box(w, h * 0.5 + EXT, d, DWOOD, 0, -h * 0.25 - EXT / 2, 0));
      g.add(box(w * 0.55, 0.25, d * 0.2, 0xffffff, 0, T + 0.1, -d * 0.36));
      break;
    }
    case 'mattress': {
      g.add(box(w, h, d, c, 0, 0, 0));
      g.add(box(w * 1.02, h * 0.18, d * 1.02, lighter, 0, T - h * 0.09, 0));
      g.add(box(w * 0.2, EXT, d * 0.2, DWOOD, 0, -h / 2 - EXT / 2, 0));
      break;
    }
    case 'toy': case 'book': {
      const cols = kind === 'toy' ? [c, 0xffd23f, 0x4aa8ff] : [c, 0xe2574c, 0x5cc8a8];
      g.add(box(w, h, d, cols[0], 0, 0, 0));
      g.add(box(w * 0.98, h * 0.22, d * 0.98, cols[1], 0, T - h * 0.11, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.cyl, mat(cols[2]), 0.28, 0.1, 0.28, sx * w * 0.24, T + 0.04, sz * d * 0.24));
      g.add(box(w * 0.4, EXT, d * 0.4, cols[0], 0, -h / 2 - EXT / 2, 0));
      break;
    }
    case 'plank': case 'board': case 'plate': case 'pan': case 'shelf': {
      const col = kind === 'plank' ? WOOD : c ?? WOOD;
      g.add(box(w, h, d, col, 0, 0, 0));
      if (kind === 'plank' || kind === 'board') {
        for (let i = -1; i <= 1; i += 2) g.add(box(w * 0.9, 0.02, 0.05, DWOOD, 0, T + 0.005, i * d * 0.2));
        g.add(mesh(G.cyl, mat(0x777777), 0.07, 0.04, 0.07, -w * 0.4, T + 0.01, d * 0.35));
        g.add(mesh(G.cyl, mat(0x777777), 0.07, 0.04, 0.07, w * 0.4, T + 0.01, -d * 0.35));
      }
      if (kind === 'plate') g.add(box(w * 0.7, 0.04, d * 0.7, 0xdfe9ff, 0, T + 0.01, 0));
      if (kind === 'pan') { g.add(box(w * 0.85, 0.05, d * 0.85, 0x2b2b35, 0, T + 0.01, 0)); g.add(box(w * 0.5, 0.15, 0.3, 0x888899, 0, 0, d / 2 + 0.1)); }
      if (kind === 'shelf') {
        g.add(box(w, h * 0.6 + EXT, d, DWOOD, 0, -EXT / 2 - h * 0.2, 0));
        for (let i = 0; i < 5; i++) g.add(box(0.28, 0.8, 0.6, [0xe2574c, 0x4aa8ff, 0xffd23f, 0x5cc8a8, 0xc58bd9][i], -w * 0.4 + i * 0.3, -0.6, d / 2 - 0.2));
      }
      break;
    }
    case 'chair': {
      g.add(box(w, h * 0.6, d, c ?? 0x5cc8a8, 0, T - h * 0.3, 0)); legs(g, w, d, h, DWOOD, 0.15, 0.18);
      g.add(box(w, 0.9, 0.18, c ?? 0x5cc8a8, 0, T + 0.4, -d / 2 + 0.09));
      break;
    }
    case 'desk': case 'table': case 'ctable': case 'dining': {
      const col = kind === 'dining' ? 0xdcae6a : c ?? WOOD;
      g.add(box(w, 0.32, d, col, 0, T - 0.16, 0)); g.add(box(w * 1.02, 0.08, d * 1.02, lighter, 0, T - 0.04, 0));
      legs(g, w, d, h, DWOOD, 0.3, 0.28);
      if (kind === 'desk') { g.add(box(w * 0.3, 0.5, 0.08, 0x333344, 0.2 * w, T + 0.2, -d / 2 + 0.1)); } // monitor-ish prop
      break;
    }
    case 'sofa': {
      ext(c, w, d);
      g.add(box(w * 0.31, 0.12, d * 0.9, lighter, -w * 0.33, T + 0.01, 0.0)); g.add(box(w * 0.31, 0.12, d * 0.9, lighter, 0, T + 0.01, 0)); g.add(box(w * 0.31, 0.12, d * 0.9, lighter, w * 0.33, T + 0.01, 0));
      g.add(box(w, 0.9, 0.35, c, 0, T + 0.4, -d / 2 + 0.17));
      break;
    }
    case 'tvstand': case 'counter': case 'cabinet': {
      ext(c ?? WOOD);
      g.add(box(w * 1.03, 0.14, d * 1.03, kind === 'counter' ? 0xffffff : lighter, 0, T - 0.05, 0));
      const n = Math.max(2, Math.round(w / 1.6));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * (w / n);
        g.add(box(w / n - 0.2, h * 0.7, 0.05, DWOOD, x, T - h * 0.5, d / 2 + 0.02));
        g.add(mesh(G.sph, mat(0xffd23f), 0.07, 0.07, 0.07, x, T - h * 0.5, d / 2 + 0.07));
      }
      break;
    }
    case 'wardrobe': {
      ext(c ?? 0xc58bd9);
      g.add(box(w * 1.04, 0.2, d * 1.04, lighter, 0, T - 0.1, 0));
      for (const sx of [-1, 1]) g.add(box(w / 2 - 0.2, h * 0.6, 0.06, DWOOD, sx * (w / 4), -h * 0.15, d / 2 + 0.03));
      g.add(mesh(G.sph, mat(0xffd23f), 0.1, 0.1, 0.1, -0.25, -h * 0.15, d / 2 + 0.1)); g.add(mesh(G.sph, mat(0xffd23f), 0.1, 0.1, 0.1, 0.25, -h * 0.15, d / 2 + 0.1));
      break;
    }
    case 'fridge': {
      ext(0xf4f6fa);
      g.add(box(w * 1.02, 0.15, d * 1.02, 0xdfe5ee, 0, T - 0.07, 0));
      g.add(box(w * 0.9, 0.05, 0.05, 0x99a, 0, -h * 0.25, d / 2 + 0.03));
      g.add(box(0.12, 1.6, 0.12, 0x99a, w * 0.35, -1.2, d / 2 + 0.1)); g.add(box(0.12, 1.2, 0.12, 0x99a, w * 0.35, -3.2, d / 2 + 0.1));
      break;
    }
    case 'stove': {
      ext(0x555a66);
      g.add(box(w, 0.1, d, 0x2a2d35, 0, T + 0.01, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        g.add(mesh(G.cyl, mat(0x3a1a10, { emissive: 0xff4a1a, ei: 0.8 }), 0.9, 0.06, 0.9, sx * w * 0.24, T + 0.07, sz * d * 0.22, false));
        g.add(mesh(G.cyl, mat(0x2a2d35), 0.45, 0.07, 0.45, sx * w * 0.24, T + 0.1, sz * d * 0.22, false));
      }
      break;
    }
    case 'box': {
      g.add(box(w, h, d, 0xc99a5b, 0, 0, 0)); g.add(box(w * 1.01, h * 0.14, 0.4, 0xe8d9a0, 0, T - 0.05, 0));
      g.add(box(0.4, h * 0.14, d * 1.01, 0xe8d9a0, 0, T - 0.05, 0));
      g.add(box(w * 0.5, EXT, d * 0.5, 0xc99a5b, 0, -h / 2 - EXT / 2, 0));
      break;
    }
    case 'mat': {
      g.add(box(w, h, d, c ?? 0xffd23f, 0, 0, 0)); g.add(box(w * 0.7, 0.04, d * 0.5, 0xe2574c, 0, T + 0.01, 0));
      g.add(box(w * 0.3, EXT, d * 0.3, DWOOD, 0, -h / 2 - EXT / 2, 0));
      break;
    }
    default: g.add(box(w, h, d, c ?? WOOD, 0, 0, 0));
  }
  return g;
}

// Non-collidable wall-side scenery (so the room never feels empty).
export const DECOR_KINDS = {
  bedroom: ['wardrobe', 'desk', 'shelf', 'bed', 'toy'],
  living: ['sofa', 'tvstand', 'shelf', 'wardrobe', 'table'],
  kitchen: ['fridge', 'cabinet', 'stove', 'counter', 'dining'],
};
