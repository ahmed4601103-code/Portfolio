// THREE.Raycaster-based mouse interaction: hover, highlight, tooltip, click selection.
// Movement/collision NEVER uses this; it is only for pointing at things.
import * as THREE from 'three';

/**
 * Interactive entry metadata:
 * { id, type, name, interaction, mesh, scope, collected, reach?, hint?, getDistance?(playerPos), onSelect(entry, info) }
 */
export class RaycastManager {
  constructor(dom, tooltipEl) {
    this.dom = dom; this.tooltip = tooltipEl;
    this.raycaster = new THREE.Raycaster(); this.raycaster.far = 120;
    this.pointer = new THREE.Vector2(); this.hasPointer = false; this.cx = 0; this.cy = 0;
    this.entries = new Map(); this.camera = null; this.scope = 'preview';
    this.hover = null; this.enabled = true; this._cands = []; this._w = new THREE.Vector3(); this.playerPos = null; this.hint = null;
  }
  setCamera(cam) { this.camera = cam; }
  setScope(scope) { if (this.scope !== scope) { this.clearHover(); this.scope = scope; } }
  register(entry) {
    entry.collected = entry.collected ?? false;
    entry.mesh.userData.entryId = entry.id;
    this.entries.set(entry.id, entry);
    return entry;
  }
  unregister(id) { const e = this.entries.get(id); if (e === this.hover) this.clearHover(); this.entries.delete(id); }
  clear(scope) {
    this.clearHover();
    for (const [id, e] of this.entries) if (!scope || e.scope === scope) this.entries.delete(id);
  }
  listByScope(scope) { return [...this.entries.values()].filter((e) => e.scope === scope); }
  setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.cx = e.clientX; this.cy = e.clientY; this.hasPointer = true;
  }
  pointerLeft() { this.hasPointer = false; this.clearHover(); }

  isVisible(o) { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; }
  pick() {
    if (!this.camera || !this.hasPointer) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const c = this._cands; c.length = 0;
    for (const e of this.entries.values()) if (e.scope === this.scope && !e.collected && this.isVisible(e.mesh)) c.push(e.mesh);
    const hits = this.raycaster.intersectObjects(c, true);
    for (const h of hits) {
      for (let o = h.object; o; o = o.parent) {
        const id = o.userData?.entryId;
        if (id !== undefined) { const entry = this.entries.get(id); if (entry) return { entry, hit: h }; }
      }
    }
    return null;
  }
  update() {
    if (!this.enabled) { this.clearHover(); return; }
    const r = this.pick(), e = r ? r.entry : null;
    if (e !== this.hover) {
      this.restore(this.hover); this.hover = e; if (e) this.highlight(e);
      this.dom.style.cursor = e ? 'pointer' : 'default';
    }
    this.updateTooltip(e);
  }
  distanceTo(e) {
    if (!this.playerPos) return 0;
    return e.getDistance ? e.getDistance(this.playerPos) : e.mesh.getWorldPosition(this._w).distanceTo(this.playerPos);
  }
  updateTooltip(e) {
    const t = this.tooltip; if (!t) return;
    if (!e) { t.classList.remove('show'); return; }
    let sub = e.hint || '';
    if (e.reach && this.playerPos && this.distanceTo(e) > e.reach) sub = 'Too far away: get closer!';
    t.replaceChildren();
    const b = document.createElement('b'); b.textContent = e.name; t.appendChild(b);
    if (sub) { const s = document.createElement('span'); s.textContent = sub; t.appendChild(s); }
    t.style.left = `${this.cx + 16}px`; t.style.top = `${this.cy + 18}px`; t.classList.add('show');
  }
  highlight(e) {
    e.mesh.traverse((o) => {
      if (!o.isMesh || o.userData.origMat) return;
      o.userData.origMat = o.material;
      const m = o.material.clone();
      if (m.emissive) { m.emissive = new THREE.Color(0xffe066); m.emissiveIntensity = 0.65; }
      o.material = m;
    });
  }
  restore(e) {
    if (!e) return;
    e.mesh.traverse((o) => {
      if (!o.isMesh || !o.userData.origMat) return;
      o.material.dispose(); o.material = o.userData.origMat; delete o.userData.origMat;
    });
  }
  clearHover() { this.restore(this.hover); this.hover = null; this.dom.style.cursor = 'default'; this.tooltip?.classList.remove('show'); }
  click() {
    const r = this.pick();
    if (r && r.entry.onSelect) { r.entry.onSelect(r.entry, { source: 'click', hit: r.hit }); return r.entry; }
    return null;
  }
}
