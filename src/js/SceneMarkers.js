import * as THREE from 'three'

const { Vector3 } = THREE

// Small HTML labels pinned to points in the 3D scene (same look as the globe's block labels, .globe-label): a title and
// a line of text above a short leader. The owner works out where each one sits every frame and passes it to update.
export default class SceneMarkers {
  constructor(container, items) {
    this.v = new Vector3()
    this.items = items.map(({ title, text }) => {
      const el = document.createElement('div')
      el.className = 'globe-label scene-marker'
      el.innerHTML = '<div class="gl-in"><b></b><span></span></div>'
      container.appendChild(el)
      const m = { el, b: el.querySelector('b'), span: el.querySelector('span') }
      this.set(m, title, text)
      return m
    })
  }

  set(m, title, text) {
    if (title != null && m.title !== title) { m.title = title; m.b.textContent = title }
    if (text != null && m.text !== text) { m.text = text; m.span.textContent = text }
  }
  setText(i, text) { this.set(this.items[i], null, text) }

  // spots: per marker { pos: world Vector3, alpha: 0..1 }
  update(spots, camera, w, h) {
    this.items.forEach((m, i) => {
      const s = spots[i], a = s ? s.alpha : 0
      m.el.style.opacity = a.toFixed(3)
      if (a < 0.005) return
      const p = this.v.copy(s.pos).project(camera)
      m.el.style.transform = `translate3d(${((p.x + 1) / 2 * w).toFixed(1)}px, ${((1 - p.y) / 2 * h).toFixed(1)}px, 0)`
    })
  }
}
