import * as THREE from 'three'
import gsap from 'gsap'

const {
  Group, Mesh, InstancedMesh, BoxGeometry, PlaneGeometry, BufferGeometry, BufferAttribute,
  MeshBasicMaterial, MeshPhongMaterial, LineSegments, LineBasicMaterial, CanvasTexture,
  Object3D, Color, AdditiveBlending, DynamicDrawUsage, DoubleSide, LinearFilter
} = THREE

const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b)
const smooth = t => t * t * (3 - 2 * t)
const easeOut = t => 1 - Math.pow(1 - t, 3)
const fmt = (v, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

const UP = new Color('#34c9b0')
const DOWN = new Color('#e9556f')
const LINE = new Color('#e6d3ff')
const GLOW = new Color('#9421a6')

const mulberry32 = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0
  let t = Math.imul(a ^ a >>> 15, 1 | a)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

// Random-walk price with GARCH-like volatility clustering, so quiet and busy stretches alternate
class PriceFeed {
  constructor(seed, price) {
    this.rnd = mulberry32(seed)
    this.price = price
    this.vol = 0.0018
  }
  gauss() {
    let u = 0, v = 0
    while (!u) u = this.rnd()
    while (!v) v = this.rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  tick() {
    const r = 0.00003 + this.vol * this.gauss()
    this.vol = clamp(Math.sqrt(0.00000015 + 0.1 * r * r + 0.87 * this.vol * this.vol), 0.0009, 0.0055)
    this.price *= Math.exp(r)
    return { price: this.price, move: Math.abs(r) }
  }
}

// Triangle strip with per-vertex RGBA, rewritten in place every frame
class Strip {
  constructor(max, material, order) {
    this.max = max
    this.pos = new Float32Array(max * 2 * 3)
    this.col = new Float32Array(max * 2 * 4)
    const idx = []
    for (let i = 0; i < max - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3
      idx.push(a, b, c, b, d, c)
    }
    const geo = new BufferGeometry()
    geo.setIndex(idx)
    geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage))
    geo.setAttribute('color', new BufferAttribute(this.col, 4).setUsage(DynamicDrawUsage))
    geo.setDrawRange(0, 0)
    this.geo = geo
    this.mesh = new Mesh(geo, material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = order
  }
  set(i, ax, ay, ac, bx, by, bc) {
    const p = i * 6, c = i * 8
    this.pos[p] = ax; this.pos[p + 1] = ay; this.pos[p + 2] = 0
    this.pos[p + 3] = bx; this.pos[p + 4] = by; this.pos[p + 5] = 0
    this.col[c] = ac[0]; this.col[c + 1] = ac[1]; this.col[c + 2] = ac[2]; this.col[c + 3] = ac[3]
    this.col[c + 4] = bc[0]; this.col[c + 5] = bc[1]; this.col[c + 6] = bc[2]; this.col[c + 7] = bc[3]
  }
  done(n) {
    this.geo.setDrawRange(0, n > 1 ? (n - 1) * 6 : 0)
    this.geo.attributes.position.needsUpdate = true
    this.geo.attributes.color.needsUpdate = true
  }
}

const softTexture = (w, h, draw) => {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  draw(cv.getContext('2d'), w, h)
  const tex = new CanvasTexture(cv)
  return tex
}

export default class Chart {
  constructor({ candles = 48, seed = 11, price = 14723, note = null } = {}) {
    // Optional DOM box that fades in shortly after the chart starts drawing, and out with it
    this.note = note
    if (note) gsap.set(note, { opacity: 0, y: 14 })
    this.N = candles
    this.cap = candles + 4
    this.axisW = 96
    // Vertical layout is in fractions of the visible height at each x (see setFrame), so the chart can fill a tilted screen
    this.fVolB = 0; this.fVolT = 0.15 // volume strip along the bottom
    this.fPlotB = 0.2 // candle area bottom
    this.fPlotT = 0.91 // candle area top; the header sits above it
    this.fHeader = 0.965
    this.setFrame({ xL: -550, xR: 550, bl: { x: -550, y: -290 }, br: { x: 550, y: -290 }, tl: { x: -550, y: 290 }, tr: { x: 550, y: 290 } })

    this.group = new Group()
    this.group.visible = false
    this.state = { intro: 0 }
    this.time = 0
    this.tickAcc = 0
    this.tickDt = 0.09
    this.ticksPerCandle = 20
    this.labelAcc = 1
    this.labelDue = true
    this.rowsN = 25 // rows of the background dot lattice
    this.fades = []

    this.feed = new PriceFeed(seed, price)
    this.emaK = 2 / (8 + 1)
    this.buildHistory()

    this.dummy = new Object3D()
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0)
    this.color = new Color()
    this.initRange = false

    this.buildGrid()
    this.buildVolume()
    this.buildGlowTexture()
    this.buildCandles()
    this.buildLine()
    this.buildLabels()
    this.buildMarker()

    // Clip the scrolling content at the left edge of the plot and at the price axis, instead of shrinking candles away.
    // Needs renderer.localClippingEnabled (set by the scene). Planes are in world space, see updateClip().
    this.clipPlanes = [new THREE.Plane(), new THREE.Plane()]
    ;[this.bodies, this.wicks, this.volume, this.fill.mesh, this.halo.mesh, this.core.mesh]
      .forEach(m => { m.material.clippingPlanes = this.clipPlanes })
  }
  updateClip() {
    this.group.updateMatrixWorld(true)
    this.clipPlanes[0].set(new THREE.Vector3(1, 0, 0), -this.xLeft).applyMatrix4(this.group.matrixWorld)
    this.clipPlanes[1].set(new THREE.Vector3(-1, 0, 0), this.xRight).applyMatrix4(this.group.matrixWorld)
  }

  // The chart is laid out to fill the visible screen. f gives the screen quad's corners in chart-local coordinates:
  // xL/xR the left and right edges, and bl/br/tl/tr the bottom and top corners. Because the plane is tilted the quad is
  // a trapezoid, so heights are taken per x (yb/yt below) rather than as one fixed rectangle. Safe to call on resize.
  setFrame(f) {
    const line = (a, b) => { const sl = (b.y - a.y) / (b.x - a.x); return [a.y - sl * a.x, sl] }
    ;[this.bB, this.sB] = line(f.bl, f.br)
    ;[this.bT, this.sT] = line(f.tl, f.tr)
    this.xLeft = f.xL
    this.xRight = f.xR - this.axisW // the price axis takes the last strip
    this.dx = (this.xRight - this.xLeft) / this.N
    this.bw = this.dx * 0.4
    if (this.axes) this.updateStatic()
  }
  yb(x) { return this.bB + this.sB * x } // bottom of the visible area at x
  yt(x) { return this.bT + this.sT * x } // top of the visible area at x
  Y(x, f) { const b = this.yb(x); return b + f * (this.yt(x) - b) } // height fraction f (0..1) of the visible area at x
  mapY(p, x) { return this.Y(x, this.fPlotB + (p - this.yMin) / (this.yMax - this.yMin) * (this.fPlotT - this.fPlotB)) }
  updateStatic() {
    const { xLeft: xl, xRight: xr } = this
    const sep = this.fPlotB - 0.025
    // right axis, baseline, volume separator
    this.axes.geometry.attributes.position.array.set([
      xr, this.Y(xr, 0), 0, xr, this.Y(xr, this.fPlotT), 0,
      xl, this.Y(xl, 0), 0, xr, this.Y(xr, 0), 0,
      xl, this.Y(xl, sep), 0, xr, this.Y(xr, sep), 0])
    this.axes.geometry.attributes.position.needsUpdate = true

    const dashes = this.dashY.length / 6
    const step = (xr - xl) / dashes
    for (let i = 0; i < dashes; i++) {
      this.dashY[i * 6] = xl + i * step
      this.dashY[i * 6 + 3] = xl + i * step + step * 0.55
    }
  }

  // ---------- data ----------
  newCandle() {
    const p = this.feed.price
    // dc/dh/dl/dv/de/col are what gets drawn: they glide toward the true values instead of jumping on each tick
    return { o: p, h: p, l: p, c: p, v: 0, ema: 0, ticks: 0, dc: p, dh: p, dl: p, dv: 0, de: 0, col: new Color(UP) }
  }
  syncDisplay(c) {
    c.dc = c.c; c.dh = c.h; c.dl = c.l; c.dv = c.v; c.de = c.ema
    c.col.copy(c.c >= c.o ? UP : DOWN)
  }
  // Critically damped follow, so the last candles move fluidly between the discrete price ticks
  smoothCandles(dt) {
    const k = 1 - Math.exp(-dt * 12)
    for (let i = Math.max(0, this.candles.length - 3); i < this.candles.length; i++) {
      const c = this.candles[i]
      c.dc += (c.c - c.dc) * k
      c.dh += (c.h - c.dh) * k
      c.dl += (c.l - c.dl) * k
      c.dv += (c.v - c.dv) * k
      c.de += (c.ema - c.de) * k
      c.col.lerp(c.c >= c.o ? UP : DOWN, k)
    }
  }
  applyTick(c) {
    const t = this.feed.tick()
    c.c = t.price
    c.h = Math.max(c.h, t.price)
    c.l = Math.min(c.l, t.price)
    c.v += 1 + t.move * 500
    c.ticks++
  }
  setEma(k) {
    const c = this.candles[k], prev = this.candles[k - 1]
    c.ema = prev ? prev.ema + this.emaK * (c.c - prev.ema) : c.c
  }
  buildHistory() {
    this.candles = []
    const total = this.N + 8
    for (let i = 0; i < total; i++) {
      const c = this.newCandle()
      const ticks = i === total - 1 ? 11 : this.ticksPerCandle
      for (let t = 0; t < ticks; t++) this.applyTick(c)
      this.candles.push(c)
      this.setEma(i)
      this.syncDisplay(c)
    }
    this.head = this.candles.length - 1
    this.headTarget = this.head
    this.open0 = this.candles[Math.max(0, this.candles.length - this.N)].o
  }
  advance() {
    const live = this.candles[this.candles.length - 1]
    this.applyTick(live)
    this.setEma(this.candles.length - 1)
    if (live.ticks >= this.ticksPerCandle) {
      this.candles.push(this.newCandle())
      this.setEma(this.candles.length - 1)
      this.syncDisplay(this.candles[this.candles.length - 1])
      this.headTarget = this.candles.length - 1
      if (this.candles.length > 300) {
        this.candles.splice(0, 100)
        this.head -= 100
        this.headTarget -= 100
      }
    }
  }

  // ---------- meshes ----------
  track(mat, base) {
    this.fades.push({ mat, base })
    return mat
  }
  buildGrid() {
    const mk = (n, opacity, order) => {
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 6), 3).setUsage(DynamicDrawUsage))
      geo.setDrawRange(0, 0)
      const mat = this.track(new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false }), opacity)
      const ls = new LineSegments(geo, mat)
      ls.frustumCulled = false
      ls.renderOrder = order
      this.group.add(ls)
      return ls
    }
    this.gridH = mk(10, 0.07, 1)
    this.gridV = mk(14, 0.045, 1)
    this.axes = mk(3, 0.2, 1)
    this.axes.geometry.setDrawRange(0, 6)

    // dashed last-price line
    const dashes = 64
    const geo = new BufferGeometry()
    this.dashY = new Float32Array(dashes * 6)
    geo.setAttribute('position', new BufferAttribute(this.dashY, 3).setUsage(DynamicDrawUsage))
    const mat = this.track(new LineBasicMaterial({ color: UP, transparent: true, opacity: 0.55, depthWrite: false }), 0.55)
    this.dash = new LineSegments(geo, mat)
    this.dash.frustumCulled = false
    this.dash.renderOrder = 2
    this.group.add(this.dash)
    this.updateStatic()
  }
  instanced(geo, mat, order) {
    const m = new InstancedMesh(geo, mat, this.cap)
    m.instanceMatrix.setUsage(DynamicDrawUsage)
    m.frustumCulled = false
    m.renderOrder = order
    m.setColorAt(0, UP)
    m.instanceColor.setUsage(DynamicDrawUsage)
    this.group.add(m)
    return m
  }
  buildVolume() {
    const mat = this.track(new MeshBasicMaterial({ transparent: true, opacity: 0.32, depthWrite: false }), 0.32)
    this.volume = this.instanced(new BoxGeometry(1, 1, 1), mat, 3)
  }
  buildGlowTexture() {
    const tex = softTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    })
    this.glowTex = tex
  }
  buildCandles() {
    const bodyMat = this.track(new MeshPhongMaterial({
      transparent: true, opacity: 1, shininess: 70, specular: 0x555555
    }), 1)
    const wickMat = this.track(new MeshPhongMaterial({
      transparent: true, opacity: 1, shininess: 30, specular: 0x333333
    }), 1)
    this.bodies = this.instanced(new BoxGeometry(1, 1, 1), bodyMat, 5)
    this.wicks = this.instanced(new BoxGeometry(1, 1, 1), wickMat, 5)
  }
  buildLine() {
    const mk = (blend, opacity, order) => new Strip(this.cap, this.track(new MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity, depthWrite: false, side: DoubleSide,
      blending: blend
    }), opacity), order)
    this.fill = mk(AdditiveBlending, 1, 2)
    this.halo = mk(AdditiveBlending, 1, 6)
    this.core = mk(AdditiveBlending, 1, 7)
    ;[this.fill, this.halo, this.core].forEach(s => this.group.add(s.mesh))
  }
  makeLabel(w, h) {
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = Math.max(32, Math.round(256 * h / w))
    const tex = new CanvasTexture(cv)
    tex.minFilter = LinearFilter
    tex.generateMipmaps = false
    const mat = this.track(new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), 1)
    const mesh = new Mesh(new PlaneGeometry(w, h), mat)
    mesh.renderOrder = 8
    mesh.frustumCulled = false
    this.group.add(mesh)
    return { mesh, cv, ctx: cv.getContext('2d'), tex, key: '' }
  }
  buildLabels() {
    this.font = 'Ozone, monospace'
    this.ticks = Array.from({ length: 8 }, () => this.makeLabel(90, 22))
    this.tag = this.makeLabel(90, 24)
    this.header = this.makeLabel(420, 34)
    this.tag.mesh.renderOrder = 9
    if (document.fonts && document.fonts.load) {
      document.fonts.load('28px Ozone').then(() => { this.ticks.concat(this.tag, this.header).forEach(l => { l.key = '' }); this.labelAcc = 1 })
    }
  }
  drawLabel(label, key, draw) {
    if (label.key === key) return
    label.key = key
    const { ctx, cv, tex } = label
    ctx.clearRect(0, 0, cv.width, cv.height)
    draw(ctx, cv.width, cv.height)
    tex.needsUpdate = true
  }
  buildMarker() {
    const mat = this.track(new MeshBasicMaterial({
      map: this.glowTex, transparent: true, opacity: 1, depthWrite: false, blending: AdditiveBlending
    }), 1)
    this.marker = new Mesh(new PlaneGeometry(46, 46), mat)
    this.marker.renderOrder = 9
    this.marker.frustumCulled = false
    this.group.add(this.marker)
    this.markerMat = mat
  }

  // ---------- control ----------
  animateIn() {
    gsap.to(this.state, { intro: 1, duration: 2.4, delay: 0.3, ease: 'power2.inOut', overwrite: true })
    // the first candles show up ~0.7s in; the note follows once the chart is clearly under way
    if (this.note) gsap.to(this.note, { opacity: 1, y: 0, duration: 0.9, delay: 1.3, ease: 'power2.out', overwrite: true })
  }
  animateOut() {
    gsap.to(this.state, { intro: 0, duration: 0.9, ease: 'power2.in', overwrite: true })
    if (this.note) gsap.to(this.note, { opacity: 0, y: 14, duration: 0.4, ease: 'power1.in', overwrite: true })
  }

  // ---------- frame ----------
  update(dt) {
    const intro = this.state.intro
    this.group.visible = intro > 0.001
    if (!this.group.visible) return

    this.time += dt
    const alpha = smooth(clamp(intro / 0.15))
    this.fades.forEach(f => { f.mat.opacity = f.base * alpha })

    // live ticking only once the intro has finished
    if (intro >= 0.999) {
      this.tickAcc += dt
      while (this.tickAcc >= this.tickDt) {
        this.tickAcc -= this.tickDt
        this.advance()
      }
    }
    this.smoothCandles(dt)
    this.head += (this.headTarget - this.head) * (1 - Math.exp(-dt * 7))
    if (Math.abs(this.headTarget - this.head) < 1e-4) this.head = this.headTarget

    const len = this.candles.length
    const kMax = len - 1
    const first = Math.max(0, kMax - this.cap + 1)
    const visFirst = kMax - this.N + 1

    // price range over the plotted candles, eased so the axis rescales smoothly
    let lo = Infinity, hi = -Infinity, vMax = 0
    for (let k = Math.max(0, Math.floor(this.head) - this.N + 1); k <= kMax; k++) {
      const c = this.candles[k]
      lo = Math.min(lo, c.dl); hi = Math.max(hi, c.dh); vMax = Math.max(vMax, c.dv)
    }
    const pad = (hi - lo) * 0.14 || 1
    if (!this.initRange) {
      this.yMin = lo - pad; this.yMax = hi + pad; this.vMax = vMax; this.initRange = true
    } else {
      const s = 1 - Math.exp(-dt * 2.5)
      this.yMin += (lo - pad - this.yMin) * s
      this.yMax += (hi + pad - this.yMax) * s
      this.vMax += (vMax - this.vMax) * s
    }

    const { dummy, color, dx, bw } = this
    const p = intro * (this.N + 6)
    const linePts = []
    let n = 0

    for (let k = first; k <= kMax; k++, n++) {
      const c = this.candles[k]
      const x = this.xRight - dx * 0.5 - (this.head - k) * dx
      const j = k - visFirst
      const g = j < 0 ? 1 : easeOut(clamp((p - j) / 6))
      const f = g > 0 ? 1 : 0 // candles are clipped at the plot edges (see updateClip), not shrunk
      color.copy(c.col)

      const cd = c.o + (c.dc - c.o) * g
      const hd = c.o + (c.dh - c.o) * g
      const ld = c.o + (c.dl - c.o) * g
      const yo = this.mapY(c.o, x), yc = this.mapY(cd, x)
      const yh = this.mapY(hd, x), yl = this.mapY(ld, x)

      // body
      dummy.position.set(x, (yo + yc) / 2, 0)
      dummy.scale.set(Math.max(bw * f, 1e-4), Math.max(Math.abs(yc - yo) * f, 1.2 * f, 1e-4), 3)
      dummy.updateMatrix()
      this.bodies.setMatrixAt(n, dummy.matrix)
      this.bodies.setColorAt(n, color)

      // wick
      dummy.position.set(x, (yh + yl) / 2, 0)
      dummy.scale.set(Math.max(1.1 * f, 1e-4), Math.max((yh - yl) * f, 1e-4), 1.1)
      dummy.updateMatrix()
      this.wicks.setMatrixAt(n, dummy.matrix)
      this.wicks.setColorAt(n, color)

      // volume
      const vb = this.Y(x, this.fVolB)
      const vh = Math.max(c.dv / this.vMax * (this.fVolT - this.fVolB) * (this.yt(x) - this.yb(x)) * g * f, 1e-4)
      dummy.position.set(x, vb + vh / 2, 0)
      dummy.scale.set(Math.max(bw * f, 1e-4), vh, 2)
      dummy.updateMatrix()
      this.volume.setMatrixAt(n, dummy.matrix)
      this.volume.setColorAt(n, color)

      // EMA line follows the drawn candles
      if (g > 0 && x > this.xLeft - dx) {
        const prev = this.candles[k - 1]
        const e = prev ? prev.de + (c.de - prev.de) * g : c.de
        linePts.push(x, this.mapY(e, x))
      }
    }
    const zero = this.zero
    for (; n < this.cap; n++) {
      ;[this.bodies, this.wicks, this.volume].forEach(m => m.setMatrixAt(n, zero))
    }
    ;[this.bodies, this.wicks, this.volume].forEach(m => {
      m.instanceMatrix.needsUpdate = true
      m.instanceColor.needsUpdate = true
    })

    this.writeLine(linePts, intro)
    this.labelAcc += dt
    this.labelDue = this.labelAcc > 0.1
    if (this.labelDue) this.labelAcc = 0
    this.writeGrid(kMax)
    this.writeOverlay(dt, intro)
  }

  writeLine(pts, intro) {
    const m = pts.length / 2
    const hw = 1.5, hh = 6
    const core = [LINE.r, LINE.g, LINE.b], halo = [GLOW.r * 1.4, GLOW.g * 1.4, GLOW.b * 1.4]
    for (let i = 0; i < m; i++) {
      const x = pts[i * 2], y = pts[i * 2 + 1]
      const a = i > 0 ? i - 1 : i, b = i < m - 1 ? i + 1 : i
      let nx = -(pts[b * 2 + 1] - pts[a * 2 + 1]), ny = pts[b * 2] - pts[a * 2]
      const l = Math.hypot(nx, ny) || 1
      nx /= l; ny /= l
      const t = m > 1 ? i / (m - 1) : 1
      const fade = 0.08 + 0.92 * Math.pow(t, 1.4)
      this.core.set(i, x + nx * hw, y + ny * hw, [...core, fade], x - nx * hw, y - ny * hw, [...core, fade])
      this.halo.set(i, x + nx * hh, y + ny * hh, [...halo, 0.42 * fade], x - nx * hh, y - ny * hh, [...halo, 0.42 * fade])
      // gradient area under the line
      this.fill.set(i, x, y, [halo[0], halo[1], halo[2], 0.34 * fade], x, this.Y(x, this.fPlotB), [halo[0], halo[1], halo[2], 0])
    }
    this.core.done(m)
    this.halo.done(m)
    this.fill.done(m)
    this.lineHead = m ? [pts[(m - 1) * 2], pts[(m - 1) * 2 + 1]] : null
  }

  writeGrid(kMax) {
    // Horizontal lines sit on every 4th row of the dot lattice, so lines and dots share the same rows.
    // Vertical lines sit on candle centres, which are the dot columns. The axis shows the price at each row.
    const h = this.gridH.geometry.attributes.position.array
    const range = this.yMax - this.yMin
    const decimals = range < 40 ? 2 : range < 400 ? 1 : 0
    const xLab = this.xRight + 6 + 45
    let c = 0
    for (let r = 0; r < this.rowsN && c < this.ticks.length; r += 4, c++) {
      const f = this.fPlotB + r / (this.rowsN - 1) * (this.fPlotT - this.fPlotB)
      h.set([this.xLeft, this.Y(this.xLeft, f), 0, this.xRight, this.Y(this.xRight, f), 0], c * 6)
      const lab = this.ticks[c]
      lab.mesh.visible = true
      lab.mesh.position.set(xLab, this.Y(xLab, f), 0)
      if (this.labelDue) {
        const txt = fmt(this.yMin + (f - this.fPlotB) / (this.fPlotT - this.fPlotB) * range, decimals)
        this.drawLabel(lab, txt, (ctx, w, hh) => {
          ctx.font = `${Math.round(hh * 0.58)}px ${this.font}`
          ctx.fillStyle = 'rgba(214,196,242,0.75)'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(txt, 6, hh / 2)
        })
      }
    }
    for (let i = c; i < this.ticks.length; i++) this.ticks[i].mesh.visible = false
    this.gridH.geometry.setDrawRange(0, c * 2)
    this.gridH.geometry.attributes.position.needsUpdate = true

    const v = this.gridV.geometry.attributes.position.array
    let vc = 0
    for (let k = Math.max(0, kMax - this.cap); k <= kMax && vc < 14; k++) {
      if (k % 6) continue
      const x = this.xRight - this.dx * 0.5 - (this.head - k) * this.dx
      if (x < this.xLeft + 2 || x > this.xRight - 2) continue
      v.set([x, this.Y(x, 0), 0, x, this.Y(x, this.fPlotT), 0], vc * 6)
      vc++
    }
    this.gridV.geometry.setDrawRange(0, vc * 2)
    this.gridV.geometry.attributes.position.needsUpdate = true
  }

  writeOverlay(dt, intro) {
    const live = this.candles[this.candles.length - 1]
    const up = live.dc >= live.o
    const tint = live.col
    const ready = smooth(clamp((intro - 0.85) / 0.15))
    // the dashed line follows the price across the tilted plane, so its height is taken per point
    for (let i = 0; i < this.dashY.length / 6; i++) {
      this.dashY[i * 6 + 1] = this.mapY(live.dc, this.dashY[i * 6])
      this.dashY[i * 6 + 4] = this.mapY(live.dc, this.dashY[i * 6 + 3])
    }
    this.dash.geometry.attributes.position.needsUpdate = true
    this.dash.material.color.copy(tint)
    this.dash.visible = ready > 0
    this.dash.material.opacity = 0.55 * ready * smooth(clamp(intro / 0.15))
    this.fades.find(f => f.mat === this.dash.material).base = 0.55 * ready

    // last price tag on the axis
    this.tag.mesh.visible = ready > 0
    this.tag.mesh.position.set(this.xRight + 6 + 45, this.mapY(live.dc, this.xRight + 6 + 45), 1)
    this.tag.mesh.material.opacity = ready * smooth(clamp(intro / 0.15))
    this.fades.find(f => f.mat === this.tag.mesh.material).base = ready

    if (this.labelDue) {
      const txt = fmt(live.dc)
      this.drawLabel(this.tag, txt + (up ? 'u' : 'd'), (ctx, w, h) => {
        ctx.fillStyle = up ? '#34c9b0' : '#e9556f'
        const r = h * 0.22
        ctx.beginPath()
        ctx.moveTo(r, 2); ctx.lineTo(w - r, 2); ctx.quadraticCurveTo(w - 2, 2, w - 2, r)
        ctx.lineTo(w - 2, h - r); ctx.quadraticCurveTo(w - 2, h - 2, w - r, h - 2)
        ctx.lineTo(r, h - 2); ctx.quadraticCurveTo(2, h - 2, 2, h - r)
        ctx.lineTo(2, r); ctx.quadraticCurveTo(2, 2, r, 2)
        ctx.fill()
        ctx.font = `${Math.round(h * 0.5)}px ${this.font}`
        ctx.fillStyle = '#0d0a1a'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(txt, w / 2, h / 2 + 1)
      })

      const chg = (live.dc / this.open0 - 1) * 100
      const key = fmt(live.dc) + fmt(chg)
      this.drawLabel(this.header, key, (ctx, w, h) => {
        ctx.font = `${Math.round(h * 0.6)}px ${this.font}`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(230,214,255,0.9)'
        ctx.fillText('BTC/USD', 4, h / 2)
        ctx.fillStyle = chg >= 0 ? '#34c9b0' : '#e9556f'
        const s = `${fmt(live.dc)}  ${chg >= 0 ? '+' : ''}${fmt(chg)}%`
        ctx.fillText(s, 4 + ctx.measureText('BTC/USD   ').width, h / 2)
      })
    }
    const hx = this.xLeft + 210
    this.header.mesh.position.set(hx, this.Y(hx, this.fHeader), 0)

    // pulsing marker on the latest price
    if (this.lineHead) {
      const s = 1 + 0.22 * Math.sin(this.time * 4.2)
      this.marker.visible = ready > 0
      const mx = this.xRight - this.dx * 0.5 - (this.head - (this.candles.length - 1)) * this.dx
      this.marker.position.set(mx, this.mapY(live.dc, mx), 2)
      this.marker.scale.set(s, s, 1)
      this.markerMat.color.copy(tint)
      this.fades.find(f => f.mat === this.markerMat).base = 0.9 * ready
    }
  }
}
