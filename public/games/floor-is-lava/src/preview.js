// 3D character-select stage: three podiums, hover/click picked with the same RaycastManager.
import * as THREE from 'three';
import { CHARACTERS, buildCharacter } from './characters.js';
import { mat, G, mesh } from './assets.js';
import { makeLavaMesh } from './lavaManager.js';

export class PreviewScene {
  constructor(game) {
    this.game = game; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x2a1236); this.scene.fog = new THREE.Fog(0x2a1236, 14, 40);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); this.t = 0; this.items = []; this.view = 'menu';
    this.scene.add(new THREE.HemisphereLight(0xffe6d0, 0x6a2a1a, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(4, 8, 8); this.scene.add(sun);
    const lava = makeLavaMesh(80, 80); lava.position.y = -0.2; this.scene.add(lava); this.lava = lava;
    const glow = new THREE.PointLight(0xff5a1a, 120, 25, 1.4); glow.position.set(0, 0.4, 2); this.scene.add(glow);
    Object.keys(CHARACTERS).forEach((id, i) => {
      const g = new THREE.Group(); g.position.x = (i - 1) * 3.4;
      g.add(mesh(G.cyl, mat(0xffffff), 1.1, 0.7, 1.1, 0, 0.35, 0)); g.add(mesh(G.cyl, mat(0xffd23f), 1.15, 0.12, 1.15, 0, 0.74, 0));
      const model = buildCharacter(id); model.root.position.y = 0.8; model.root.scale.setScalar(1.45); g.add(model.root);
      const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.scale.setScalar(1.7); g.add(ring);
      this.scene.add(g);
      const item = { id, g, model, ring, hover: false, ph: i * 1.3 }; this.items.push(item);
      game.raycast.register({
        id: `char-${id}`, type: 'character', name: CHARACTERS[id].name, interaction: 'select-character', mesh: g, scope: 'preview',
        hint: `${CHARACTERS[id].tag} · click to choose`, onSelect: () => game.selectCharacter(id),
      });
    });
    this.setView('menu');
  }
  setView(v) { this.view = v; this.camera.position.set(0, v === 'menu' ? 3.0 : 2.8, 11); this.camY = v === 'menu' ? 3.7 : 1.9; }
  setAspect(a) { this.camera.aspect = a; this.camera.fov = a < 1 ? 70 : 45; this.camera.updateProjectionMatrix(); }
  update(dt) {
    this.t += dt; this.lava.material.uniforms.uTime.value = this.t;
    this.camera.lookAt(0, this.camY, 0);
    const sel = this.game.state.d.character, hov = this.game.raycast.hover?.id;
    for (const it of this.items) {
      const isSel = it.id === sel, isHov = hov === `char-${it.id}`;
      it.model.root.rotation.y += dt * (isSel ? 1.6 : 0.5);
      const bounce = isSel || isHov ? Math.abs(Math.sin(this.t * 4 + it.ph)) * 0.35 : 0;
      it.model.root.position.y = 0.8 + bounce;
      it.model.parts.armL.rotation.x = isSel ? -2.6 + Math.sin(this.t * 8) * 0.4 : 0; it.model.parts.armR.rotation.x = isSel ? -2.6 - Math.sin(this.t * 8) * 0.4 : 0;
      it.ring.visible = isSel; it.ring.rotation.z += dt;
      it.model.parts.setFace(isSel ? 'cheer' : isHov ? 'happy' : 'neutral');
    }
  }
}
