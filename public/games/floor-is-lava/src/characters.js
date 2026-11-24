// Character stats + procedural character models (no external assets).
import * as THREE from 'three';
import { G, mat, mesh } from './assets.js';

export const CHARACTERS = {
  lazy: { id: 'lazy', name: 'The Lazy Guy', tag: 'Balanced', blurb: 'Sleepy, reliable and always in pajamas.', speed: 7, sprint: 1.5, jump: 11.5, jump2: 10, accel: 55, fric: 11 },
  froggy: { id: 'froggy', name: 'Froggy', tag: 'Jumps higher', blurb: 'Boing! Reaches ledges nobody else can.', speed: 6.5, sprint: 1.5, jump: 13.8, jump2: 11.5, accel: 50, fric: 10 },
  penguin: { id: 'penguin', name: 'Penguin', tag: 'Fast but slippery', blurb: 'Zooms ahead... and keeps on zooming.', speed: 9, sprint: 1.45, jump: 11, jump2: 9.5, accel: 24, fric: 3.2 },
};

const DARK = mat(0x2a1a2a);

export function buildCharacter(id) {
  const root = new THREE.Group();
  const parts = {};
  const skinC = id === 'lazy' ? 0xffd3a8 : id === 'froggy' ? 0x6fd45f : 0x2b2f4a;
  const bodyC = id === 'lazy' ? 0x5b8def : id === 'froggy' ? 0x58c14a : 0x2b2f4a;
  const skin = mat(skinC), body = mat(bodyC);

  const hip = new THREE.Group(); hip.position.y = 0.72; root.add(hip); parts.hip = hip;
  hip.add(mesh(G.cap(0.3, 0.22), body, 1, 1, 0.9, 0, 0.12, 0));
  if (id === 'penguin') hip.add(mesh(G.sph, mat(0xffffff), 0.26, 0.34, 0.16, 0, 0.12, 0.2));
  if (id === 'froggy') hip.add(mesh(G.sph, mat(0xd9f7a8), 0.24, 0.3, 0.14, 0, 0.1, 0.2));
  if (id === 'lazy') hip.add(mesh(G.box, mat(0xffffff), 0.5, 0.05, 0.5, 0, 0.12, 0.02)); // pajama stripe

  // head
  const head = new THREE.Group(); head.position.set(0, 0.72, 0); hip.add(head); parts.head = head;
  const hr = id === 'froggy' ? [0.46, 0.34, 0.38] : [0.38, 0.36, 0.36];
  head.add(mesh(G.sph, skin, ...hr));

  // face
  const white = mat(0xffffff);
  parts.pupils = []; parts.lids = [];
  const eye = (x, y, z, r) => {
    head.add(mesh(G.sph, white, r, r, r * 0.7, x, y, z, false));
    const p = mesh(G.sph, DARK, r * 0.5, r * 0.5, r * 0.4, x, y, z + r * 0.45, false);
    head.add(p); parts.pupils.push(p);
  };
  if (id === 'froggy') { eye(-0.2, 0.3, 0.12, 0.16); eye(0.2, 0.3, 0.12, 0.16); }
  else { eye(-0.13, 0.04, 0.3, 0.1); eye(0.13, 0.04, 0.3, 0.1); }
  if (id === 'lazy') for (const sx of [-1, 1]) {
    const lid = mesh(G.box, skin, 0.26, 0.1, 0.1, sx * 0.13, 0.1, 0.34, false);
    head.add(lid); parts.lids.push(lid);
  }
  parts.mouth = mesh(G.sph, DARK, 0.1, 0.045, 0.03, 0, -0.14, 0.34, false);
  parts.mouthBase = id === 'froggy' ? [0.24, 0.05] : [0.1, 0.045];
  if (id === 'froggy') parts.mouth.position.set(0, -0.1, 0.36);
  head.add(parts.mouth);

  if (id === 'penguin') {
    const beak = mesh(G.cone, mat(0xff9f1c), 0.1, 0.22, 0.1, 0, -0.06, 0.4, false);
    beak.rotation.x = Math.PI / 2; head.add(beak);
    parts.mouth.visible = false;
  }
  if (id === 'lazy') { // nightcap
    const cap = mesh(G.cone, mat(0xe8505b), 0.3, 0.55, 0.3, 0.08, 0.42, 0); cap.rotation.z = -0.6; head.add(cap);
    head.add(mesh(G.sph, white, 0.09, 0.09, 0.09, 0.23, 0.63, 0));
  }

  // limbs (pivots so rotation swings from shoulder / hip)
  const limb = (parent, x, y, r, len, color, handColor) => {
    const piv = new THREE.Group(); piv.position.set(x, y, 0);
    piv.add(mesh(G.cap(r, len), color, 1, 1, 1, 0, -(len / 2 + r), 0));
    if (handColor !== undefined) piv.add(mesh(G.sph, handColor, r * 1.15, r * 1.15, r * 1.15, 0, -(len + r * 1.6), 0));
    parent.add(piv); return piv;
  };
  const armColor = id === 'penguin' ? body : id === 'froggy' ? skin : body;
  parts.armL = limb(hip, -0.38, 0.4, 0.09, 0.28, armColor, id === 'penguin' ? undefined : skin);
  parts.armR = limb(hip, 0.38, 0.4, 0.09, 0.28, armColor, id === 'penguin' ? undefined : skin);
  const legColor = id === 'lazy' ? mat(0x4a6fc0) : id === 'froggy' ? mat(0x4aa83e) : mat(0xff9f1c);
  parts.legL = limb(root, -0.17, 0.5, 0.1, 0.3, legColor);
  parts.legR = limb(root, 0.17, 0.5, 0.1, 0.3, legColor);
  const shoe = id === 'penguin' ? mat(0xff9f1c) : mat(0xffffff);
  for (const l of [parts.legL, parts.legR]) l.add(mesh(G.sph, shoe, 0.13, 0.07, 0.19, 0, -0.5, 0.06));

  root.scale.setScalar(0.94);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  parts.setFace = (name) => {
    const [mw, mh] = parts.mouthBase;
    const m = parts.mouth;
    if (name === 'scared') m.scale.set(0.07, 0.1, 0.03);
    else if (name === 'cheer') m.scale.set(mw * 1.4, mh * 2.2, 0.03);
    else if (name === 'dead') m.scale.set(mw * 0.8, 0.09, 0.03);
    else m.scale.set(mw, mh, 0.03);
    const ps = name === 'scared' ? 0.35 : name === 'dead' ? 0.15 : 0.5;
    parts.pupils.forEach((p) => { const r = p.scale.x / (p.userData.k || 1); p.userData.k = ps / 0.5; p.scale.setScalar(r * p.userData.k); });
    parts.lids.forEach((l) => { l.visible = name === 'neutral' || name === 'happy'; });
  };
  parts.setFace('neutral');
  return { root, parts };
}
