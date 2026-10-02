import * as THREE from 'three'
import gsap from 'gsap'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const {
  Group, Scene, Mesh, Vector3, Box3, Matrix4, PointLight, AmbientLight, DirectionalLight, Color
} = THREE

// The Anubis bust (public/assets/models/anubis_bust, "Anubis Bust" by lucasthx88 on Sketchfab, CC-BY-4.0).
// First the scene's dots gather onto points spread over its surface (ThreeScene.updateDotTargets reads dotTarget),
// then the real model fades in over them, lit by a light that follows the cursor.
// The bust is drawn in its own pass (scene) after the main one, so it sits cleanly over the dots and the mouse light
// touches nothing else.

// small seeded random so the dot layout is the same on every load
const rng = seed => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

export default class Anubis {
  constructor({
    count, center = [-280, -290, -250], height = 470, turn = 0.45, envMap = null,
    url = '/assets/models/anubis_bust/', file = 'scene.gltf',
  }) {
    Object.assign(this, { count, height, envMap })
    this.state = { s: 0, duration: 2.4, model: 0 } // s: dots on the bust (0..1), model: the real bust's fade
    this.ready = false
    this.pts = new Float32Array(count * 3)

    this.scene = new Scene()
    this.group = new Group()
    this.group.position.fromArray(center)
    this.baseY = center[1]
    this.time = 0
    this.group.rotation.y = turn // a three-quarter view, looking towards the page content on the right
    this.group.updateMatrixWorld(true)
    this.group.visible = false

    // mouse light (moved in update), a faint fill so the unlit side isn't black, and a violet rim from behind
    this.light = new PointLight(0xfff2d6, 1.8, 0)
    this.scene.add(this.group, this.light, new AmbientLight(0xffffff, 0.14))
    const rim = new DirectionalLight(new Color('#8e54e9'), 0.7)
    rim.position.set(-1, 0.6, -1.2)
    this.scene.add(rim)
    this.lightPos = new Vector3()

    new GLTFLoader().setPath(url).load(file, gltf => this.setModel(gltf.scene))
  }

  setModel(model) {
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model)
      , size = box.getSize(new Vector3())
      , mid = box.getCenter(new Vector3())
      , k = this.height / size.y
      // into the group: centred on the origin and scaled to the set height
      , fit = new Matrix4().makeScale(k, k, k).multiply(new Matrix4().makeTranslation(-mid.x, -mid.y, -mid.z))
      , tris = []

    model.traverse(o => {
      if (!o.isMesh) return
      const geo = o.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(fit, o.matrixWorld))
        , mat = o.material.clone()
      Object.assign(mat, { transparent: true, opacity: 0, fog: false, depthWrite: true })
      if (this.envMap) Object.assign(mat, { envMap: this.envMap, envMapIntensity: 0.6 })
      this.group.add(new Mesh(geo, mat))

      // triangles for spreading the dots over the surface
      const p = geo.attributes.position, idx = geo.index
      for (let t = 0; t < (idx ? idx.count : p.count) / 3; t++) {
        const [a, b, c] = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, idx ? idx.getX(t * 3 + j) : t * 3 + j))
        tris.push({ a, b, c, area: new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() / 2 })
      }
    })

    // area-weighted random points over the surface, sorted top to bottom so the dots arrive in rows
    const rand = rng(29)
      , total = tris.reduce((s, t) => s + t.area, 0)
      , cum = []
    tris.reduce((s, t) => { cum.push(s + t.area); return s + t.area }, 0)
    const pts = []
    for (let i = 0; i < this.count; i++) {
      const r = rand() * total
      let lo = 0, hi = cum.length - 1
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m }
      const { a, b, c } = tris[lo]
      let u = rand(), v = rand()
      if (u + v > 1) { u = 1 - u; v = 1 - v }
      pts.push(new Vector3().copy(a).addScaledVector(new Vector3().subVectors(b, a), u).addScaledVector(new Vector3().subVectors(c, a), v))
    }
    pts.sort((p, q) => q.y - p.y).forEach((p, i) => p.toArray(this.pts, i * 3))
    this.ready = true
  }

  // World position of dot k on the bust (into out); returns its brightness. k: the dot's place in the lattice, top row first.
  dotTarget(k, out) {
    const m = this.group.matrixWorld.elements
      , x = this.pts[k * 3], y = this.pts[k * 3 + 1], z = this.pts[k * 3 + 2]
    out.set(
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    )
    return 1 // brightness: the dots' own yellow
  }

  // in: dots gather, then the model fades in once they are in place (modelDelay: extra wait, e.g. while the dots are
  // still coming back from a later scene). out: the model goes first, then the dots leave.
  animate(on, modelDelay = 0) {
    this.tl?.kill()
    const st = this.state
    this.tl = on
      ? gsap.timeline()
        .to(st, { s: 1, duration: st.duration * (1 - st.s), ease: 'none' })
        .to(st, { model: 1, duration: 1.4, ease: 'power2.out' }, `+=${modelDelay}`)
      : gsap.timeline()
        .to(st, { model: 0, duration: 0.4, ease: 'power2.in' })
        .to(st, { s: 0, duration: st.duration * st.s, ease: 'none' }, 0.1)
  }
  // only the real model goes (the dots stay on the bust for the next scene to take them from there)
  hideModel() {
    this.tl?.kill()
    this.tl = gsap.to(this.state, { model: 0, duration: 0.5, ease: 'power2.in' })
  }

  update(pointer, dt = 0) {
    const show = this.state.model
    // a slow float once the real bust is in (the dots on it ride along, as they follow the group)
    this.time += dt
    this.group.position.y = this.baseY + Math.sin(this.time * 0.9) * 12 * show
    this.group.updateMatrixWorld(true)
    this.group.visible = this.ready && show > 0.005
    if (!this.group.visible) return
    this.group.children.forEach(m => { m.material.opacity = show })
    // the light sits in front of the bust and follows the cursor across it, easing a little
    const c = this.group.position
    this.lightPos.set(c.x + pointer.x * 420, c.y + pointer.y * 320, c.z + 300)
    this.light.position.lerp(this.lightPos, 0.12)
  }
}
