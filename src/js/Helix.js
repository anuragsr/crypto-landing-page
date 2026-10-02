import * as THREE from 'three'
import gsap from 'gsap'

const {
  Matrix4, Vector3, Quaternion, Euler, BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial, AdditiveBlending
} = THREE

// Blockchain double helix, made from the scene's dots (ThreeScene.updateDotTargets blends them in).
// Every block is a small 3 x 3 x 3 cube of dots. Two strands of blocks wind around a tilted axis that spins slowly,
// joined by rungs across, with links between neighbouring blocks on each strand tracing the spirals. Every couple of seconds the whole chain steps
// along by one slot: the oldest block at the high end flies back through the middle of the helix and snaps on, bright,
// as the fresh block at the low end. No dots are ever hidden, so it is always the same dots moving.

const CELL = 27 // dots per block
const ease = gsap.parseEase('power2.inOut')
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t) }

export default class Helix {
  constructor({
    count, center = [0, -275, -250], radius = 105, halfLength = 560, slots = 23, spacing = 10,
    tilt = [0.15, -0.35, 0.28], period = 2.4, step = 1.8, // step: how long the chain takes to move one slot (the recycled block crosses the whole helix in that time)
  }) {
    Object.assign(this, { count, radius, halfLength, slots, period, step })
    this.state = { s: 0, duration: 2.2 } // 0 = not shown, 1 = fully formed
    this.time = 0
    this.matrix = new Matrix4().compose(new Vector3(...center), new Quaternion().setFromEuler(new Euler(...tilt)), new Vector3(1, 1, 1))

    // which block each dot belongs to, and its place in the little cube
    const blocks = slots * 2
    this.dotBlock = new Int16Array(count)
    this.dotOff = new Float32Array(count * 3)
    for (let g = 0; g < count; g++) {
      const inCube = g < blocks * CELL
      this.dotBlock[g] = inCube ? Math.floor(g / CELL) : (g - blocks * CELL) % blocks // spare dots sit at block centres
      if (!inCube) continue
      const c = g % CELL
      this.dotOff[g * 3] = (c % 3 - 1) * spacing
      this.dotOff[g * 3 + 1] = (Math.floor(c / 3) % 3 - 1) * spacing
      this.dotOff[g * 3 + 2] = (Math.floor(c / 9) - 1) * spacing
    }

    // per block, refreshed every frame: centre (helix-local), turn, size and glow
    this.bPos = new Float32Array(blocks * 3)
    this.bAngle = new Float32Array(blocks)
    this.bScale = new Float32Array(blocks)
    this.bGlow = new Float32Array(blocks)
    this.bSlot = new Float32Array(blocks)

    // rungs across the strands and links along each strand (none across the wrap from the oldest block to the newest)
    const segs = slots * 3
    this.lineGeo = new BufferGeometry()
    this.lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(segs * 6), 3))
    // rgba: the brightness goes in alpha, so a faint link is see-through rather than a dim opaque line
    this.lineGeo.setAttribute('color', new BufferAttribute(new Float32Array(segs * 8), 4))
    this.lines = new LineSegments(this.lineGeo, new LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending,
    }))
    this.lines.matrixAutoUpdate = false
    this.lines.matrix.copy(this.matrix)
    this.lines.frustumCulled = false
    this.lines.visible = false
  }

  update(dt, fade = 1) {
    const { slots, halfLength, radius, period, step } = this
    this.time += dt
    const t = this.time
      , conv = Math.floor(t / period) + ease(Math.min((t % period) / step, 1)) // steps by one slot each period
      , gap = 2 * halfLength / (slots - 1)
      , spin = t * 0.4
    Object.assign(this, { gap, spin, step: Math.floor(t / period) })

    for (let b = 0; b < slots * 2; b++) {
      const k = b >> 1, strand = b & 1
        , pos = (k + conv) % slots // 0 = the fresh end, slots - 1 = the oldest
        , turn = strand * Math.PI + spin
      let x = -halfLength + pos * gap, a = pos * 0.55 + turn, r = radius
      if (pos > slots - 1) {
        // recycled: from the oldest slot back to slot 0, swinging in through the axis on the way
        const f = pos - (slots - 1)
        x = halfLength + (-halfLength - halfLength) * f
        a = (slots - 1) * 0.55 * (1 - f) + turn
        r = radius * (1 - 0.85 * Math.sin(Math.PI * f))
      }
      this.bSlot[b] = pos
      this.bAngle[b] = a
      this.bScale[b] = pos > slots - 1 ? 0 : 1 // only used to leave the travelling blocks out of the rungs / links
      this.bGlow[b] = 1 + 0.5 * smooth(1.6, 0, pos > slots - 1 ? 0 : pos) // the fresh block a little brighter (more washes the yellow out)
      this.bPos[b * 3] = x
      this.bPos[b * 3 + 1] = Math.cos(a) * r
      this.bPos[b * 3 + 2] = Math.sin(a) * r
    }

    const show = this.state.s * fade
    this.lines.visible = show > 0.01
    if (this.lines.visible) this.writeLines(show)
  }

  writeLines(show) {
    const { slots, bPos, bScale, bSlot } = this
      , pos = this.lineGeo.attributes.position.array
      , col = this.lineGeo.attributes.color.array
    let n = 0
    const seg = (a, b, strength) => {
      const k = Math.min(bScale[a], bScale[b]) * strength * show
      // a hidden link is collapsed to a point rather than drawn black: on the transparent canvas, additive black
      // still makes the pixels opaque and shows as a dark line over the page
      for (const blk of k > 0.001 ? [a, b] : [a, a]) {
        pos[n * 3] = bPos[blk * 3]; pos[n * 3 + 1] = bPos[blk * 3 + 1]; pos[n * 3 + 2] = bPos[blk * 3 + 2]
        col[n * 4] = 0.55; col[n * 4 + 1] = 0.33; col[n * 4 + 2] = 0.91; col[n * 4 + 3] = Math.min(k, 1)
        n++
      }
    }
    for (let k = 0; k < slots; k++) {
      seg(k * 2, k * 2 + 1, 0.5) // rung
      const next = (k + 1) % slots
        , joined = bSlot[next * 2] > bSlot[k * 2] ? 1 : 0 // no link across the wrap from the oldest to the newest
      seg(k * 2, next * 2, 0.8 * joined)
      seg(k * 2 + 1, next * 2 + 1, 0.8 * joined)
    }
    this.lineGeo.attributes.position.needsUpdate = true
    this.lineGeo.attributes.color.needsUpdate = true
  }

  // World position of a point on the helix at slot p (0 = fresh end) on a strand, lifted off it by `lift` (for labels)
  slotWorld(p, strand, out, lift = 0) {
    const a = p * 0.55 + this.spin + strand * Math.PI, r = this.radius + lift
    return out.set(-this.halfLength + p * this.gap, Math.cos(a) * r, Math.sin(a) * r).applyMatrix4(this.matrix)
  }

  // World position of dot g in the helix (into out); returns its brightness
  dotTarget(g, out) {
    const b = this.dotBlock[g]
      , a = this.bAngle[b]
      , ox = this.dotOff[g * 3], oy = this.dotOff[g * 3 + 1], oz = this.dotOff[g * 3 + 2]
      , ca = Math.cos(a), sa = Math.sin(a)
      // the cube turns with its place on the helix
      , x = this.bPos[b * 3] + ox
      , y = this.bPos[b * 3 + 1] + oy * ca - oz * sa
      , z = this.bPos[b * 3 + 2] + oy * sa + oz * ca
      , m = this.matrix.elements
    out.set(
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14]
    )
    return this.bGlow[b]
  }
}
