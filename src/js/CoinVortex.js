import * as THREE from 'three'

const { Group, Vector3 } = THREE

// The ANUMYS coin made from the scene's dots (ThreeScene.blendDots reads dotTarget): a thick rim, a raised ring on each
// face, an inner ring, and a pyramid "A" with an eye on the front, over a faint fill. Brightness stays near 1 (the dots'
// own yellow); the fill is dimmer so the emblem stands out without washing out to white. The dots swirl into it down a
// funnel (swirl), then the coin turns slowly.

export default class CoinVortex {
  constructor({ count, center = [0, -275, -250], radius = 230, thickness = 26 }) {
    this.state = { s: 0, duration: 2.6 }
    this.ready = true
    this.time = 0
    this.center = new Vector3(...center)
    this.swirl = Math.PI * 2.2 // how far the dots wind round the coin's axis on the way in
    this.group = new Group()
    this.group.position.copy(this.center)

    const R = radius, T = thickness, pts = []
    const add = (x, y, z, glow) => pts.push([x, y, z, glow])
    const ring = (n, r, z, glow) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; add(Math.cos(a) * r, Math.sin(a) * r, z, glow) } }
    const line = (n, ax, ay, bx, by, z, glow) => { for (let i = 0; i < n; i++) { const f = i / (n - 1); add(ax + (bx - ax) * f, ay + (by - ay) * f, z, glow) } }

    // rim: the coin's edge, three rows deep
    ;[-T / 2, 0, T / 2].forEach(z => ring(110, R, z, 1))
    // raised ring just inside the edge, both faces
    ring(118, R - 14, T / 2 + 2, 1)
    ring(118, R - 14, -T / 2 - 2, 1)
    // inner ring on the front
    ring(96, R * 0.72, T / 2 + 1, 0.85)
    // the emblem on the front: a pyramid that reads as an A, its crossbar, and an eye
    const zf = T / 2 + 3, top = [0, R * 0.5], bl = [-R * 0.46, -R * 0.36], br = [R * 0.46, -R * 0.36]
    line(52, ...top, ...bl, zf, 1.15)
    line(52, ...top, ...br, zf, 1.15)
    line(46, ...bl, ...br, zf, 1.15)
    line(26, -R * 0.27, -R * 0.12, R * 0.27, -R * 0.12, zf, 1.1)
    for (let i = 0; i < 30; i++) { // eye: almond outline
      const a = i / 30 * Math.PI * 2
      add(Math.cos(a) * R * 0.13, R * 0.13 + Math.sin(a) * R * 0.055 * (1 - 0.35 * Math.abs(Math.cos(a))), zf, 1.15)
    }
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(Math.cos(a) * 4, R * 0.13 + Math.sin(a) * 4, zf, 1.3) } // pupil
    // faint fill over both faces with whatever dots are left
    const left = count - pts.length
    for (let i = 0; i < left; i++) {
      const front = i % 2 === 0, q = i >> 1, n = Math.ceil(left / 2)
        , r = Math.sqrt((q + 0.5) / n) * (R - 24), a = q * 2.399963229728653
      add(Math.cos(a) * r, Math.sin(a) * r, front ? T / 2 : -T / 2, 0.45)
    }
    pts.length = count

    // in lattice order: top to bottom, so rows of dots flow in together
    pts.sort((p, q) => q[1] - p[1])
    this.pts = Float32Array.from(pts.flatMap(p => p.slice(0, 3)))
    this.glow = Float32Array.from(pts, p => p[3])
  }

  // World position of dot k (into out); returns its brightness
  dotTarget(k, out) {
    const m = this.group.matrixWorld.elements
      , x = this.pts[k * 3], y = this.pts[k * 3 + 1], z = this.pts[k * 3 + 2]
    out.set(
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    )
    return this.glow[k]
  }

  update(dt, pointer) {
    this.time += dt
    // eased follow of the cursor: the coin drifts a little towards it and leans its face that way
    const k = 1 - Math.exp(-dt * 3)
    this.mx = (this.mx || 0) + ((pointer?.active ? pointer.x : 0) - (this.mx || 0)) * k
    this.my = (this.my || 0) + ((pointer?.active ? pointer.y : 0) - (this.my || 0)) * k
    // a slow turn, tipped back a touch, with a gentle bob
    this.group.rotation.set(0.18 - this.my * 0.25, this.time * 0.55 + this.mx * 0.4, 0)
    this.group.position.set(
      this.center.x + this.mx * 45,
      this.center.y + this.my * 30 + Math.sin(this.time * 0.9) * 8,
      this.center.z
    )
    this.group.updateMatrixWorld(true)
  }
}
