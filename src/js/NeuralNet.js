import * as THREE from 'three'

const {
  Group, Vector3, BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial, Points, PointsMaterial,
  CanvasTexture, AdditiveBlending
} = THREE

// Neural network made from the scene's dots (ThreeScene.blendDots reads dotTarget): layers of glowing nodes, each a
// little ball of dots, fully linked layer to layer. Cyan pulses hop through it left to right; a node flashes as a pulse
// reaches it, the output node beats, and the node under the cursor lights up its links.

const glowTexture = () => {
  const s = 64, c = s / 2, ctx = document.createElement('canvas').getContext('2d')
  ctx.canvas.width = ctx.canvas.height = s
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(160,236,250,0.9)')
  g.addColorStop(1, 'rgba(124,223,242,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(ctx.canvas)
}

const PULSES = 12

export default class NeuralNet {
  constructor({ count, center = [0, -275, -250], width = 900, height = 430, layers = [8, 14, 14, 6, 1], nodeRadius = 10 }) {
    Object.assign(this, { count, layers })
    this.state = { s: 0, duration: 2.4 }
    this.ready = true
    this.time = 0
    this.center = new Vector3(...center)
    this.group = new Group()
    this.group.position.copy(this.center)

    // nodes: layers left to right, each layer centred vertically, bowed back a little in depth
    this.nodes = []
    layers.forEach((n, l) => {
      const gap = n > 1 ? Math.min(height / (n - 1), 46) : 0
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * gap
        this.nodes.push({
          layer: l, pos: new Vector3(-width / 2 + l * width / (layers.length - 1), y, -Math.abs(y) * 0.35 - Math.abs(l - 2) * 30),
          r: l === layers.length - 1 ? nodeRadius * 2.2 : nodeRadius, flash: 0, hover: 0,
          // live state, moved every frame: where the node is now (it drifts round pos), how far its ball has spun
          cur: new Vector3(), phase: Math.random() * Math.PI * 2, spin: Math.random() * Math.PI * 2,
          spinRate: (0.6 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1), tiltAxis: Math.random() * Math.PI,
        })
      }
    })
    this.nodes.forEach(nd => Object.assign(nd, { breath: 1, cs: 1, sn: 0, ct: 1, st: 0 }, { cur: nd.pos.clone() })) // until the first update
    const N = this.nodes.length
    this.byLayer = layers.map((_, l) => this.nodes.map((nd, i) => i).filter(i => this.nodes[i].layer === l))

    // dots: an equal share per node (the output node takes the remainder), on a small fibonacci ball
    const per = Math.floor(count / N), list = []
    for (let i = 0; i < N; i++) {
      const m = i === N - 1 ? count - per * (N - 1) : per
      for (let q = 0; q < m; q++) {
        const y = 1 - 2 * (q + 0.5) / m, r = Math.sqrt(1 - y * y), a = q * 2.399963229728653
        list.push({ node: i, off: [Math.cos(a) * r, y, Math.sin(a) * r] })
      }
    }
    // in lattice order: sorted top to bottom so rows of dots flow in together
    list.sort((p, q) => (this.nodes[q.node].pos.y + q.off[1] * this.nodes[q.node].r) - (this.nodes[p.node].pos.y + p.off[1] * this.nodes[p.node].r))
    this.dotNode = Int16Array.from(list, d => d.node)
    this.dotOff = Float32Array.from(list.flatMap(d => d.off))

    // links between neighbouring layers
    this.links = []
    for (let l = 0; l < layers.length - 1; l++) this.byLayer[l].forEach(a => this.byLayer[l + 1].forEach(b => this.links.push([a, b])))
    this.linkOf = new Map(this.links.map(([a, b], i) => [a + '-' + b, i]))
    const lp = new Float32Array(this.links.length * 6)
    this.links.forEach(([a, b], i) => { this.nodes[a].pos.toArray(lp, i * 6); this.nodes[b].pos.toArray(lp, i * 6 + 3) })
    this.linkHeat = new Float32Array(this.links.length)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(lp, 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(this.links.length * 8), 4)) // brightness in alpha
    this.lines = new LineSegments(geo, new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending }))
    this.lines.frustumCulled = false

    // pulses: each runs input -> output along random links, one hop at a time
    this.pulseGeo = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(PULSES * 3), 3))
    this.pulseMat = new PointsMaterial({ size: 11, sizeAttenuation: false, map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 })
    this.pulsePts = new Points(this.pulseGeo, this.pulseMat)
    this.pulsePts.frustumCulled = false
    this.pulses = Array.from({ length: PULSES }, (_, i) => ({ path: null, t: 0, wait: i * 0.25 }))

    this.group.add(this.lines, this.pulsePts)
    this.group.visible = false
    this.v = new Vector3()
  }

  newPath() {
    return this.byLayer.map(ids => ids[Math.floor(Math.random() * ids.length)])
  }

  // World position just above node i (for labels)
  nodeWorld(i, out) {
    const nd = this.nodes[i]
    return out.set(nd.cur.x, nd.cur.y + nd.r * 1.6 + 4, nd.cur.z).applyMatrix4(this.group.matrixWorld)
  }

  // World position of dot k (into out); returns its brightness
  dotTarget(k, out) {
    const nd = this.nodes[this.dotNode[k]]
      , r = nd.r * nd.breath * (1 + 0.25 * nd.flash)
      , m = this.group.matrixWorld.elements
      // the node's ball of dots spins on its own tilted axis
      , ox = this.dotOff[k * 3], oy = this.dotOff[k * 3 + 1], oz = this.dotOff[k * 3 + 2]
      , rx = ox * nd.cs + oz * nd.sn, rz = -ox * nd.sn + oz * nd.cs // spin about y
      , ry = oy * nd.ct - rz * nd.st, rz2 = oy * nd.st + rz * nd.ct // then the node's own tilt
      , x = nd.cur.x + rx * r, y = nd.cur.y + ry * r, z = nd.cur.z + rz2 * r
    out.set(
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    )
    // 1 = the dots' own yellow; flashes and hover add only a little (much more and the yellow washes out to white)
    return 1 + 0.6 * nd.flash + 0.35 * nd.hover
  }

  // fade: 0..1 for the links / pulses (the next scene fades them out)
  update(dt, { fade = 1, pointer, camera } = {}) {
    this.time += dt
    const t = this.time, show = this.state.s * fade
    // a slow sway so the depth reads
    this.group.rotation.y = Math.sin(t * 0.25) * 0.28
    this.group.rotation.x = Math.sin(t * 0.18) * 0.06
    this.group.updateMatrixWorld(true)
    this.group.visible = show > 0.01

    const N = this.nodes.length, out = this.nodes[N - 1]
    this.nodes.forEach(nd => {
      nd.flash *= Math.exp(-dt * 4)
      // each node drifts gently round its place and breathes, on its own phase; a flash spins it up for a moment
      const ph = nd.phase
      nd.cur.set(
        nd.pos.x + Math.sin(t * 0.7 + ph) * 7,
        nd.pos.y + Math.sin(t * 0.9 + ph * 1.7) * 9,
        nd.pos.z + Math.sin(t * 0.6 + ph * 2.3) * 12
      )
      nd.breath = 1 + 0.12 * Math.sin(t * 1.8 + ph)
      nd.spin += dt * nd.spinRate * (1 + 3 * nd.flash)
      nd.cs = Math.cos(nd.spin); nd.sn = Math.sin(nd.spin)
      nd.ct = Math.cos(nd.tiltAxis); nd.st = Math.sin(nd.tiltAxis)
    })
    // the output node beats like a pulse
    out.flash = Math.max(out.flash, Math.pow(Math.max(0, Math.sin(t * 2.6)), 12))

    // hover: the node nearest the cursor on screen, if close enough
    let hovered = -1
    if (pointer?.active && camera && show > 0.5) {
      let best = 0.05
      this.nodes.forEach((nd, i) => {
        const p = this.v.copy(nd.cur).applyMatrix4(this.group.matrixWorld).project(camera)
          , d = Math.hypot(p.x - pointer.x, (p.y - pointer.y) * 0.6)
        if (d < best) { best = d; hovered = i }
      })
    }
    this.nodes.forEach((nd, i) => { nd.hover += ((i === hovered ? 1 : 0) - nd.hover) * (1 - Math.exp(-dt * 10)) })

    // pulses
    this.linkHeat.forEach((h, i) => { this.linkHeat[i] = h * Math.exp(-dt * 3) })
    const pp = this.pulseGeo.attributes.position.array, hopTime = 0.38
    this.pulses.forEach((p, i) => {
      if (!p.path) {
        p.wait -= dt
        if (p.wait <= 0 && this.state.s > 0.9) { p.path = this.newPath(); p.t = 0 }
        pp[i * 3] = pp[i * 3 + 1] = pp[i * 3 + 2] = 1e5 // off out of sight
        return
      }
      p.t += dt / hopTime
      const hop = Math.floor(p.t)
      if (hop >= p.path.length - 1) {
        this.nodes[p.path[p.path.length - 1]].flash = 1
        p.path = null
        p.wait = 0.4 + Math.random() * 1.6
        return
      }
      const a = this.nodes[p.path[hop]], b = this.nodes[p.path[hop + 1]], f = p.t - hop
      if (f < dt / hopTime + 1e-4) a.flash = Math.max(a.flash, 0.8) // just left this node
      this.v.lerpVectors(a.cur, b.cur, f).toArray(pp, i * 3)
      const li = this.linkOf.get(p.path[hop] + '-' + p.path[hop + 1])
      this.linkHeat[li] = 1
    })
    this.pulseGeo.attributes.position.needsUpdate = true
    this.pulseMat.opacity = show

    if (!this.group.visible) return
    // links: they follow the drifting nodes; faint violet, brighter while a pulse runs along one or it touches the hovered node
    const lp = this.lines.geometry.attributes.position.array
    this.links.forEach(([a, b], i) => { this.nodes[a].cur.toArray(lp, i * 6); this.nodes[b].cur.toArray(lp, i * 6 + 3) })
    this.lines.geometry.attributes.position.needsUpdate = true
    const col = this.lines.geometry.attributes.color.array
    this.links.forEach(([a, b], i) => {
      const lit = Math.max(this.linkHeat[i] * 0.7, Math.max(this.nodes[a].hover, this.nodes[b].hover) * 0.6)
        , alpha = (0.09 + lit) * show
        , cy = lit > 0.05 ? lit / (lit + 0.09) : 0 // heated links lean cyan
      for (let e = 0; e < 2; e++) {
        const j = (i * 2 + e) * 4
        col[j] = 0.55 + (0.49 - 0.55) * cy
        col[j + 1] = 0.33 + (0.87 - 0.33) * cy
        col[j + 2] = 0.91 + (0.95 - 0.91) * cy
        col[j + 3] = Math.min(alpha, 1)
      }
    })
    this.lines.geometry.attributes.color.needsUpdate = true
  }
}
