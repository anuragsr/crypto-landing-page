import * as THREE from 'three'
import gsap from 'gsap'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const {
  Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, TorusGeometry,
  PlaneGeometry, ConeGeometry, EdgesGeometry, LineSegments, LineBasicMaterial, CanvasTexture,
  PMREMGenerator, Color, Vector3, PerspectiveCamera, BufferAttribute, Shape, ExtrudeGeometry
} = THREE

// Current colour scheme: deep purple base, violet/blue/cyan accents, yellow highlight
const C = {
  deep: 0x2a1060,
  violet: 0x8e54e9,
  blue: 0x4776e6,
  cyan: 0x7cdff2,
  yellow: 0xffe45c,
  edge: 0xe6d3ff,
}

const easeOutBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }

const bitcoinTexture = () => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const ctx = cv.getContext('2d')
  ctx.shadowColor = '#ffd23f'
  ctx.shadowBlur = 16
  ctx.fillStyle = '#ffe45c'
  ctx.font = 'bold 176px Arial, Helvetica, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('B', 128, 140)
  // the two strokes that turn B into the bitcoin mark
  ;[100, 132].forEach(x => {
    ctx.fillRect(x, 40, 11, 42)
    ctx.fillRect(x, 190, 11, 42)
  })
  const tex = new CanvasTexture(cv)
  tex.anisotropy = 4
  return tex
}

// Flat-shaded faces, each tinted from the palette by which way it points
const paintFaces = geometry => {
  const geo = geometry.toNonIndexed()
  geo.computeVertexNormals()
  const n = geo.attributes.normal
  const col = new Float32Array(n.count * 3)
  const base = [C.blue, C.cyan, C.violet, 0x5a3fd0]
  for (let i = 0; i < n.count; i += 3) {
    const c = new Color(base[(n.getX(i) > 0 ? 1 : 0) + (n.getZ(i) > 0 ? 2 : 0)])
    c.multiplyScalar(n.getY(i) > 0 ? 1 : 0.6)
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3)
  }
  geo.setAttribute('color', new BufferAttribute(col, 3))
  return geo
}

export default class CryptoIcons {
  constructor(renderer) {
    this.group = new Group()
    this.time = 0
    this.state = { show: 1 }

    // Reflections are applied to these materials only, so the rest of the scene keeps its look
    const pmrem = new PMREMGenerator(renderer)
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.items = [
      this.buildBitcoin(),
      this.buildEther(),
      this.buildSolana(),
    ]
    this.items.forEach(item => this.group.add(item.root))
  }

  std(opts) {
    return new MeshStandardMaterial({ envMap: this.env, envMapIntensity: 1, fog: false, ...opts })
  }

  // Shared coin: body, raised bezels and an inner ring on both faces
  coinBase({ R, T, body, bezel, ring }) {
    const coin = new Group()
    coin.add(new Mesh(new CylinderGeometry(R, R, T, 72).rotateX(Math.PI / 2), this.std({ color: body, metalness: 0.85, roughness: 0.3 })))

    const bezelMat = this.std({ color: bezel, metalness: 1, roughness: 0.22 })
    const ringMat = this.std({ color: ring, emissive: ring, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.4 })
    ;[1, -1].forEach(side => {
      const b = new Mesh(new TorusGeometry(R - 3, 4.4, 16, 72), bezelMat)
      b.position.z = side * T / 2
      const r = new Mesh(new TorusGeometry(R * 0.76, 1.3, 8, 72), ringMat)
      r.position.z = side * (T / 2 + 0.3)
      coin.add(b, r)
    })
    return coin
  }

  buildBitcoin() {
    const R = 78, T = 16
    const coin = this.coinBase({ R, T, body: C.deep, bezel: C.violet, ring: C.yellow })
    const symbolMat = new MeshBasicMaterial({ map: bitcoinTexture(), transparent: true, depthWrite: false, fog: false })

    ;[1, -1].forEach(side => {
      const symbol = new Mesh(new PlaneGeometry(R * 1.25, R * 1.25), symbolMat)
      symbol.position.z = side * (T / 2 + 0.7)
      if (side < 0) symbol.rotation.y = Math.PI
      coin.add(symbol)
    })

    return { root: this.wrap(coin), model: coin, kind: 'coin', anchor: [0.46, 0.12], z: -220, scale: 1, depth: 1, phase: 0 }
  }

  // Solana: the three slanted bars, in violet / blue / cyan, standing off a dark blue medallion
  buildSolana() {
    const R = 66, T = 14
    const coin = this.coinBase({ R, T, body: 0x121a4a, bezel: C.blue, ring: C.cyan })

    const W = R * 1.05, H = R * 0.2, gap = R * 0.09, slant = R * 0.2, depth = 5
    const bar = leansRight => {
      const sh = new Shape()
      if (leansRight) sh.moveTo(0, 0).lineTo(W - slant, 0).lineTo(W, H).lineTo(slant, H)
      else sh.moveTo(slant, 0).lineTo(W, 0).lineTo(W - slant, H).lineTo(0, H)
      sh.closePath()
      return new ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.4, bevelSegments: 2 })
    }
    const rows = [
      { y: H + gap, lean: true, color: C.cyan },
      { y: 0, lean: false, color: C.blue },
      { y: -(H + gap), lean: true, color: C.violet },
    ]
    ;[1, -1].forEach(side => {
      const face = new Group()
      rows.forEach(row => {
        const mat = this.std({ color: row.color, emissive: row.color, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.25 })
        face.add(new Mesh(bar(row.lean).translate(-W / 2, row.y - H / 2, 0), mat))
      })
      face.position.z = side * (T / 2 + 0.4)
      if (side < 0) face.rotation.y = Math.PI
      coin.add(face)
    })

    return { root: this.wrap(coin), model: coin, kind: 'coin', anchor: [0.58, -0.33], z: -160, scale: 0.95, depth: 1.3, phase: 2.6 }
  }

  buildEther() {
    const r = 50, hTop = 92, hMid = 68, hLow = 52, gap = 10
    const eth = new Group()

    // upper diamond (two pyramids sharing a base) and the detached lower pyramid
    const pieces = [
      new ConeGeometry(r, hTop, 4, 1, true).translate(0, hTop / 2, 0),
      new ConeGeometry(r, hMid, 4, 1, true).rotateX(Math.PI).translate(0, -hMid / 2, 0),
      new ConeGeometry(r * 0.95, hLow, 4, 1, false).rotateX(Math.PI).translate(0, -(hMid + gap) - hLow / 2, 0),
    ]
    const mat = this.std({ vertexColors: true, flatShading: true, metalness: 0.5, roughness: 0.28, envMapIntensity: 1.15 })
    const edgeMat = new LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55, fog: false })

    pieces.forEach(p => {
      const geo = p.rotateY(Math.PI / 4)
      const mesh = new Mesh(paintFaces(geo), mat)
      mesh.add(new LineSegments(new EdgesGeometry(geo, 20), edgeMat))
      eth.add(mesh)
    })
    eth.position.y = (hTop - (hMid + gap + hLow)) / 2 // centre the whole crystal on the origin

    const holder = new Group()
    holder.add(eth)
    return { root: this.wrap(holder), model: holder, kind: 'eth', anchor: [0.30, -0.22], z: -80, scale: 0.72, depth: 1.6, phase: 1.7 }
  }

  // root: positioned/scaled by layout and the show tween. model: rotated by the mouse.
  wrap(model) {
    const root = new Group()
    root.add(model)
    return root
  }

  // Places the icons on the right of the hero, as seen from the section-1 camera
  layout(aspect, fov, camZ = 750, viewportHeight = window.innerHeight) {
    const cam = new PerspectiveCamera(fov, aspect, 1, 10000)
    cam.position.set(0, 0, camZ)
    cam.updateMatrixWorld(true)

    this.items.forEach(item => {
      const dir = new Vector3(item.anchor[0], item.anchor[1], 0.5).unproject(cam).sub(cam.position).normalize()
      const t = (item.z - cam.position.z) / dir.z
      item.base = cam.position.clone().add(dir.multiplyScalar(t))
      // world units per screen pixel at this depth, so the icons can follow the page scroll
      item.pxToWorld = 2 * Math.tan(fov * Math.PI / 360) * (camZ - item.z) / viewportHeight
      item.mx = item.mx || 0
      item.my = item.my || 0
    })
  }

  animateIn() {
    gsap.to(this.state, { show: 1, duration: 1.1, delay: 0.25, ease: 'power2.out', overwrite: true })
  }
  animateOut() {
    gsap.to(this.state, { show: 0, duration: 0.7, ease: 'power2.in', overwrite: true })
  }

  update(dt, pointer, scrollPx = 0) {
    const show = this.state.show
    this.group.visible = show > 0.001
    if (!this.group.visible) return
    this.time += dt
    const t = this.time
    const grow = easeOutBack(Math.min(show, 1))

    this.items.forEach((item, i) => {
      if (!item.base) return
      // eased follow of the cursor, a touch slower for the second icon
      const k = 1 - Math.exp(-dt * (i ? 3.2 : 4.5))
      item.mx += (pointer.x - item.mx) * k
      item.my += (pointer.y - item.my) * k

      const bob = Math.sin(t * 1.1 + item.phase) * 5
      item.root.position.set(
        item.base.x + item.mx * 22 * item.depth,
        item.base.y + item.my * 14 * item.depth + bob + scrollPx * item.pxToWorld,
        item.base.z
      )
      item.root.scale.setScalar(Math.max(item.scale * grow, 1e-4))

      if (item.kind === 'coin') {
        item.model.rotation.set(-item.my * 0.55 + Math.sin(t * 0.7 + 1 + item.phase) * 0.06, Math.sin(t * 0.55 + item.phase) * 0.25 + item.mx * 0.95, -item.mx * 0.12)
      } else {
        item.model.rotation.set(-item.my * 0.4, t * 0.55 + item.mx * 0.6, Math.sin(t * 0.8) * 0.05 + item.mx * 0.1)
      }
    })
  }
}
