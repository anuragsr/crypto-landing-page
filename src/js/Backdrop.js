import gsap from 'gsap'

// Page backdrop behind the 3D canvas: faint circuit traces on the left and right edges (with a few signal pulses
// running along them and the odd Egyptian glyph at a trace end), plus soft colour glows in the corners.
// Everything is generated once as inline SVG and stays fixed on screen (pass parallax > 0 to make it drift with the scroll).
// Self-contained: remove the `new Backdrop(...)` call in SinglePage and the #backdrop element to take it out.

const TILE_W = 420, TILE_H = 640, STEP = 20
const GLYPH_SCALE = 2
const VIOLET = '#8e54e9', CYAN = '#7cdff2'

// small seeded random so each side always draws the same pattern
const rng = seed => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

// glyphs drawn around (0, 0), about 22px tall, stroke only; shown at GLYPH_SCALE
const GLYPHS = {
  ankh: 'M0,-3 C-6,-8 -5,-15 0,-15 C5,-15 6,-8 0,-3 Z M0,-3 V12 M-7,0 H7',
  eye: 'M-10,0 Q0,-8 10,0 Q0,6 -10,0 Z M0,-2.6 a2.6,2.6 0 1,0 0.01,0 M-2,4 L-4,11 M3,4 Q6,10 10,8',
  scarab: 'M0,-4 C-6,-4 -6,10 0,10 C6,10 6,-4 0,-4 Z M0,-4 V10 M-2.5,-6.5 a2.5,2.5 0 1,0 5,0 a2.5,2.5 0 1,0 -5,0 M-5,0 L-10,-3 M-5,4 L-10,5 M-4,8 L-8,12 M5,0 L10,-3 M5,4 L10,5 M4,8 L8,12',
}

// One tile of traces. x = 0 is the outer screen edge, growing towards the centre of the page.
const buildTile = rand => {
  const traces = [], pads = [], glyphs = []
  const buses = [28, 48, 68]

  // vertical buses running the full tile height, so tiles join up seamlessly
  buses.forEach(x => traces.push(`M${x},0 V${TILE_H}`))

  // branches leaving the buses towards the centre, each on its own row so they don't cross
  const rows = []
  for (let y = STEP * 2; y < TILE_H - STEP * 2; y += STEP * 2) rows.push(y)
  rows.sort(() => rand() - 0.5)
  const branches = []
  rows.slice(0, 13).forEach((y0, k) => {
    const bx = buses[Math.floor(rand() * buses.length)]
      , run1 = STEP * (2 + Math.floor(rand() * 5))
      , diag = STEP * (1 + Math.floor(rand() * 2)) * (rand() < 0.5 ? -1 : 1)
      , run2 = STEP * (2 + Math.floor(rand() * 8))
      , x1 = bx + run1, x2 = x1 + Math.abs(diag), y2 = y0 + diag
      , x3 = Math.min(x2 + run2, TILE_W - (k < 2 ? 40 + 12 * GLYPH_SCALE : 30)) // room for the glyph past the end
      , d = `M${bx},${y0} H${x1} L${x2},${y2} H${x3}`
    traces.push(d)
    branches.push(d)
    pads.push([bx, y0, 2.2, true]) // junction on the bus
    if (k < 2) glyphs.push([x3 + 6 + 10 * GLYPH_SCALE, y2, Object.keys(GLYPHS)[Math.floor(rand() * 3)]])
    else pads.push([x3, y2, 3.2, false])
  })

  return { traces, pads, glyphs, branches }
}

const tileSVG = (tile, rand, offsetY) => {
  const g = `transform="translate(0 ${offsetY})"`
  // pulses: a short bright dash sweeping along a few branches, each on its own timing
  const pulses = tile.branches
    .filter(() => rand() < 0.3)
    .map(d => {
      const dur = (5 + rand() * 5).toFixed(2), delay = (rand() * 8).toFixed(2)
      return `<path class="bd-pulse" d="${d}" pathLength="1000" style="animation-duration:${dur}s;animation-delay:-${delay}s"/>`
    }).join('')

  return `
    <g ${g}>
      <g class="bd-traces" fill="none" stroke="${VIOLET}" stroke-width="1">${tile.traces.map(d => `<path d="${d}"/>`).join('')}</g>
      <g class="bd-pads" stroke="${CYAN}" stroke-width="1">${tile.pads.map(([x, y, r, solid]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${solid ? CYAN : 'none'}"/>`).join('')}</g>
      <g class="bd-glyphs" fill="none" stroke="${CYAN}" stroke-width="1.1" stroke-linejoin="round">${tile.glyphs.map(([x, y, k]) =>
        `<path transform="translate(${x} ${y}) scale(${GLYPH_SCALE})" d="${GLYPHS[k]}" vector-effect="non-scaling-stroke"/>`).join('')}</g>
      <g fill="none" stroke="${CYAN}" stroke-width="1.6" stroke-linecap="round">${pulses}</g>
    </g>`
}

const sideSVG = seed => {
  const rand = rng(seed)
    , tile = buildTile(rand)
    , reps = Math.ceil(Math.max(window.screen.height, window.innerHeight) / TILE_H) + 1
    , h = reps * TILE_H
  let body = ''
  for (let i = 0; i < reps; i++) body += tileSVG(tile, rand, i * TILE_H)
  return `<svg width="${TILE_W}" height="${h}" viewBox="0 0 ${TILE_W} ${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
}

export default class Backdrop {
  constructor({ el, smoother, parallax = 0 }) {
    if (!el) return
    el.innerHTML = `
      <div class="bd-glow"></div>
      <div class="bd-side bd-left"><div class="bd-move">${sideSVG(7)}</div></div>
      <div class="bd-side bd-right"><div class="bd-move">${sideSVG(23)}</div></div>`

    this.sides = el.querySelectorAll('.bd-side')
    if (!parallax) return
    const movers = el.querySelectorAll('.bd-move')
    let last = -1
    gsap.ticker.add(() => {
      // drifts up at a fraction of the scroll speed; wraps every tile so the strip never runs out
      const y = -((smoother ? smoother.scrollTop() : window.scrollY) * parallax % TILE_H)
      if (Math.abs(y - last) < 0.05) return
      last = y
      movers.forEach(m => { m.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)` })
    })
  }

  // circuits on / off (the corner glows stay); faded by the CSS transition on .bd-side
  toggle(on) {
    this.sides?.forEach(side => side.classList.toggle('bd-on', on))
  }
}
