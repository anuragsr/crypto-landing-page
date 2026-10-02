import * as THREE from 'three'
import gsap from 'gsap'

const {
  Group, BufferGeometry, BufferAttribute, Line, Points, PointsMaterial, ShaderMaterial, Mesh, MeshBasicMaterial,
  RingGeometry, CanvasTexture, Color, Vector3, AdditiveBlending, DoubleSide
} = THREE

// The globe's "live network" layer, drawn over the dot sphere: transaction arcs between crypto hubs with a bright
// head and fading trail, an expanding ping where each one lands, and now and then a small block label.
// The group is turned exactly like the dots (ThreeScene.updateDotTargets), so everything sits on the same globe.

const CYAN = '#7cdff2', VIOLET = '#8e54e9'
const SEGMENTS = 64, MAX_ARCS = 7, MAX_PINGS = 8, MAX_LABELS = 3

// lat, lon in degrees
const CITIES = [
  ['New York', 40.7, -74], ['San Francisco', 37.8, -122.4], ['Toronto', 43.7, -79.4], ['Mexico City', 19.4, -99.1],
  ['São Paulo', -23.5, -46.6], ['Buenos Aires', -34.6, -58.4], ['London', 51.5, -0.1], ['Frankfurt', 50.1, 8.7],
  ['Zurich', 47.4, 8.5], ['Istanbul', 41, 29], ['Lagos', 6.5, 3.4], ['Nairobi', -1.3, 36.8],
  ['Johannesburg', -26.2, 28], ['Dubai', 25.2, 55.3], ['Mumbai', 19.1, 72.9], ['Singapore', 1.35, 103.8],
  ['Hong Kong', 22.3, 114.2], ['Seoul', 37.6, 127], ['Tokyo', 35.7, 139.7], ['Sydney', -33.9, 151.2],
]
const COINS = [['BTC', 0.02, 3.5, 2], ['ETH', 0.4, 60, 2], ['SOL', 8, 900, 0]]

// unit vector for a latitude / longitude: lon 0 faces +z (the camera), east to the right
export const latLonToVec = (lat, lon, v = new Vector3()) => {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180
  return v.set(Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b))
}

// Points for the dot globe, most of them on land so the continents read clearly with only the scene's own dots:
// an even spread over the land and a sparser one over the sea, sorted from north to south.
// Returns { pts: unit xyz per point, land: 1 for a land point }.
export const globePoints = (total, landCount, landAt) => {
  const fib = (N, keep) => {
    const out = []
    for (let k = 0; k < N; k++) {
      const y = 1 - 2 * (k + 0.5) / N, r = Math.sqrt(1 - y * y), a = k * 2.399963229728653
        , x = Math.cos(a) * r, z = Math.sin(a) * r
      if (keep(landAt(Math.asin(y) * 180 / Math.PI, Math.atan2(x, z) * 180 / Math.PI) > 0.5)) out.push([x, y, z])
    }
    return out
  }
  // the smallest even spread with at least `want` points of one kind, thinned evenly to exactly `want`
  const spread = (want, isLand) => {
    let N = want, got = []
    while ((got = fib(N, l => l === isLand)).length < want) N = Math.ceil(N * Math.max(1.02, want / Math.max(got.length, 1)))
    return Array.from({ length: want }, (_, i) => got[Math.floor(i * got.length / want)])
  }
  const all = [
    ...spread(landCount, true).map(p => [...p, 1]),
    ...spread(total - landCount, false).map(p => [...p, 0]),
  ].sort((a, b) => b[1] - a[1])
  return { pts: Float32Array.from(all.flatMap(p => p.slice(0, 3))), land: Uint8Array.from(all, p => p[3]) }
}

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

// Trail along the arc: drawn only up to the head, bright just behind it and a faint trace further back.
// The far side of the globe is dimmed so arcs read as wrapping around it.
const arcMaterial = radius => new ShaderMaterial({
  uniforms: {
    uHead: { value: 0 }, uTail: { value: 0.3 }, uAlpha: { value: 0 }, uR: { value: radius },
    uHeadColor: { value: new Color(CYAN) }, uTraceColor: { value: new Color(VIOLET) },
  },
  vertexShader: `
    attribute float aT;
    uniform float uR;
    varying float vT;
    varying float vFront;
    void main(){
      vT = aT;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); // the globe centre
      vFront = smoothstep(-0.35, 0.25, (mv.z - c.z) / uR);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uHead, uTail, uAlpha;
    uniform vec3 uHeadColor, uTraceColor;
    varying float vT;
    varying float vFront;
    void main(){
      float behind = uHead - vT;
      if(behind < 0.0) discard;
      float trail = behind < uTail ? pow(1.0 - behind / uTail, 2.0) : 0.0;
      float a = (0.16 + trail) * uAlpha * mix(0.22, 1.0, vFront);
      gl_FragColor = vec4(mix(uTraceColor, uHeadColor, trail), a);
    }`,
  transparent: true, depthWrite: false, blending: AdditiveBlending,
})

export default class Globe {
  constructor({ radius = 280, labelsEl = null } = {}) {
    this.R = radius
    this.group = new Group()
    this.group.visible = false
    this.show = 0
    this.active = false
    this.spawnIn = 0.4
    this.block = 847213 + Math.floor(Math.random() * 400)
    this.labelsEl = labelsEl
    this.camLocal = new Vector3()

    const glow = glowTexture()
    this.cities = CITIES.map(([name, lat, lon]) => ({ name, n: latLonToVec(lat, lon) }))


    this.arcs = Array.from({ length: MAX_ARCS }, () => {
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(new Float32Array((SEGMENTS + 1) * 3), 3))
      geo.setAttribute('aT', new BufferAttribute(Float32Array.from({ length: SEGMENTS + 1 }, (_, i) => i / SEGMENTS), 1))
      const line = new Line(geo, arcMaterial(radius))
        , head = new Points(
          new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(3), 3)),
          new PointsMaterial({ size: 15, sizeAttenuation: false, map: glow, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 })
        )
      line.frustumCulled = head.frustumCulled = false
      line.visible = head.visible = false
      this.group.add(line, head)
      return { line, head, busy: false, state: { head: 0, alpha: 0 } }
    })

    this.pings = Array.from({ length: MAX_PINGS }, () => {
      const mesh = new Mesh(
        new RingGeometry(0.82, 1, 48),
        new MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })
      )
      mesh.visible = false
      this.group.add(mesh)
      return { mesh, busy: false }
    })

    this.labels = Array.from({ length: MAX_LABELS }, () => {
      const el = document.createElement('div')
      el.className = 'globe-label'
      el.innerHTML = '<div class="gl-in"><b></b><span></span></div>'
      labelsEl?.appendChild(el)
      return { el, busy: false, n: new Vector3(), k: { v: 0 } }
    })
  }

  // a point on the arc from a to b: along the great circle, lifted off the surface in the middle
  arcPoint(a, b, omega, lift, t, v) {
    const s = Math.sin(omega)
      , wa = Math.sin((1 - t) * omega) / s, wb = Math.sin(t * omega) / s
      , r = this.R + 3 + lift * Math.sin(Math.PI * t)
    return v.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb).multiplyScalar(r)
  }

  // facing the camera (in the globe's own frame)
  facing(n) { return n.dot(this.camLocal) > this.R * 1.05 }

  spawnArc() {
    const arc = this.arcs.find(a => !a.busy)
    if (!arc) return
    const { cities } = this
    let from, to, omega
    // pick a pair a good distance apart, landing on the side we can see
    for (let tries = 0; tries < 12; tries++) {
      from = cities[Math.floor(Math.random() * cities.length)]
      to = cities[Math.floor(Math.random() * cities.length)]
      omega = Math.acos(Math.min(1, Math.max(-1, from.n.dot(to.n))))
      if (from !== to && omega > 0.45 && omega < 2.3 && this.facing(to.n)) break
      to = null
    }
    if (!to) return

    const pos = arc.line.geometry.attributes.position
      , v = new Vector3()
      , lift = this.R * (0.07 + 0.3 * omega / Math.PI)
    for (let i = 0; i <= SEGMENTS; i++) this.arcPoint(from.n, to.n, omega, lift, i / SEGMENTS, v).toArray(pos.array, i * 3)
    pos.needsUpdate = true
    Object.assign(arc, { busy: true, from, to, omega, lift })

    const travel = 1.3 + omega * 0.45
      , st = arc.state
    st.head = 0
    st.alpha = 1
    arc.line.visible = arc.head.visible = true
    gsap.timeline({ onComplete: () => { arc.busy = false; arc.line.visible = arc.head.visible = false } })
      .to(st, { head: 1, duration: travel, ease: 'sine.inOut', onComplete: () => this.land(to) })
      .to(st, { head: 1.35, alpha: 0, duration: 1, ease: 'power1.in' }, '>-0.05')
  }

  // an arc has arrived: a ping on the surface, and sometimes a block label
  land(city) {
    ;[0, 0.28].forEach(delay => {
      const ping = this.pings.find(p => !p.busy)
      if (!ping) return
      const { mesh } = ping, s = { r: 3, o: 0.95 }
      ping.busy = true
      mesh.position.copy(city.n).multiplyScalar(this.R + 2)
      mesh.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), city.n)
      gsap.to(s, {
        r: 34, o: 0, duration: 1.4, delay, ease: 'power2.out',
        onStart: () => { mesh.visible = true },
        onUpdate: () => { mesh.scale.setScalar(s.r); mesh.material.opacity = s.o * this.show },
        onComplete: () => { mesh.visible = false; ping.busy = false },
      })
    })

    // the first couple of landings after the globe appears always get a label, then about half of them
    if (this.labelsShown < 2 || Math.random() < 0.45) this.showLabel(city)
  }

  showLabel(city) {
    const label = this.labels.find(l => !l.busy)
    if (!label || !this.labelsEl) return
    const [coin, lo, hi, dp] = COINS[Math.floor(Math.random() * COINS.length)]
      , amount = (lo + Math.random() * (hi - lo)).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    this.block += 1 + Math.floor(Math.random() * 3)
    label.el.querySelector('b').textContent = `${city.name} · Block #${this.block.toLocaleString('en-US')}`
    label.el.querySelector('span').textContent = `${amount} ${coin}`
    label.n.copy(city.n)
    this.labelsShown = (this.labelsShown || 0) + 1
    label.busy = true
    gsap.timeline({ onComplete: () => { label.busy = false } })
      .fromTo(label.k, { v: 0 }, { v: 1, duration: 0.4, ease: 'power2.out' })
      .to(label.k, { v: 0, duration: 0.6, ease: 'power2.in' }, '+=2.2')
  }

  // on: the sphere is formed and on its own (spawn arcs); ctx: the dot sphere's transform and the camera
  update(dt, { on, center, angle, tilt, camera, w, h }) {
    const { group } = this
    if (on && !this.wasOn) {
      // just appeared: start a few arcs straight away rather than waiting out the usual gap
      this.spawnIn = 0
      this.burst = 2
      this.labelsShown = 0
    }
    this.wasOn = on
    this.show += ((on ? 1 : 0) - this.show) * (1 - Math.exp(-dt * 4))
    group.visible = this.show > 0.01
    this.labelsEl && (this.labelsEl.style.display = group.visible ? '' : 'none')
    if (!group.visible) return

    group.position.fromArray(center)
    group.rotation.set(tilt, angle, 0)
    group.updateMatrixWorld(true)
    this.camLocal.copy(camera.position)
    group.worldToLocal(this.camLocal)

    if (on) {
      this.spawnIn -= dt
      if (this.spawnIn <= 0) {
        this.spawnArc()
        this.spawnIn = this.burst-- > 0 ? 0.2 : 0.45 + Math.random() * 0.5
      }
    }

    const v = new Vector3()
    this.arcs.forEach(arc => {
      if (!arc.busy) return
      const { state: st, line, head } = arc
      line.material.uniforms.uHead.value = st.head
      line.material.uniforms.uAlpha.value = st.alpha * this.show
      const t = Math.min(st.head, 1)
      this.arcPoint(arc.from.n, arc.to.n, arc.omega, arc.lift, t, v)
      v.toArray(head.geometry.attributes.position.array)
      head.geometry.attributes.position.needsUpdate = true
      const front = v.clone().normalize().dot(this.camLocal) > this.R ? 1 : 0.3
      head.material.opacity = (st.head <= 1 ? 1 : 0) * front * this.show
    })

    // labels: projected to the screen each frame, hidden while their spot is round the back
    this.labels.forEach(label => {
      if (!label.busy) { label.el.style.opacity = 0; return }
      v.copy(label.n).multiplyScalar(this.R + 4)
      const front = this.facing(label.n) ? 1 : 0
      group.localToWorld(v).project(camera)
      label.el.style.opacity = (label.k.v * front * this.show).toFixed(3)
      label.el.style.transform = `translate3d(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px, 0)`
    })
  }
}
