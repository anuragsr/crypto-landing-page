import * as THREE from 'three'
const {
  Group, Vector3, PlaneGeometry,
  Mesh, MeshBasicMaterial,
  BufferGeometry, CanvasTexture,
  PointsMaterial, Points,
  BufferAttribute, AdditiveBlending, Color
} = THREE

import gsap from 'gsap'
import { l, cl, updateMatrix } from '@/js/utils/helpers'

// One soft glowing sprite per colour, shared by every plane: white-hot core, coloured body, faded halo.
// Small (128px) and reused, so it costs less memory than a separate large texture per plane.
const dotTextures = {}
const dotTexture = color => dotTextures[color] || (dotTextures[color] = (() => {
  const size = 128, c = size / 2
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.canvas.width = ctx.canvas.height = size

  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  const tint = new Color(color)
  const rgba = (k, a) => `rgba(${Math.round(255 * Math.min(tint.r * k, 1))},${Math.round(255 * Math.min(tint.g * k, 1))},${Math.round(255 * Math.min(tint.b * k, 1))},${a})`
  g.addColorStop(0, 'rgba(255,255,245,1)')
  g.addColorStop(0.12, 'rgba(255,255,220,1)')
  g.addColorStop(0.28, rgba(1, 1))
  g.addColorStop(0.55, rgba(0.9, 0.42))
  g.addColorStop(1, rgba(0.7, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(ctx.canvas)
})())

// Shared clock for the twinkle, advanced by GSAP's ticker
const dotTime = { value: 0 }
gsap.ticker.add(time => { dotTime.value = time })

// Patches the stock points shader: each dot pulses on its own phase, mostly dim with brief bright flashes,
// and grows a little at the peak. Fog, the sprite and size attenuation keep working as before.
export const twinkleShader = shader => {
  shader.uniforms.uTime = dotTime
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      attribute float aPhase;
      uniform float uTime;
      varying float vTw;`)
    .replace('gl_PointSize = size;', `float tw = 0.5 + 0.5 * sin(uTime * (1.4 + aPhase * 2.6) + aPhase * 50.0);
      tw = tw * tw * tw;
      vTw = 1.0 + 1.8 * tw;
      gl_PointSize = size * (0.85 + 0.13 * tw);`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vTw;')
    .replace('outgoingLight = diffuseColor.rgb;', 'outgoingLight = diffuseColor.rgb * vTw;')
}

export default class PlaneMesh {
  constructor(opts) {
    this.opts = opts
    this.count = 0
    this.group = new Group()
    this.createPlane()
    this.createPoints()
  }
  createPlane(){
    const planeDefinition = 24
      , planeSize = 1200
      , { color, offset } = this.opts
      , saveVerticesInfo = plane => {
        const planeGeo = plane.geometry
          , pos = planeGeo.attributes.position
          , vertexHeight = 50

        for(let i = 0; i < pos.count; i++){
          const vertex = new Vector3().fromBufferAttribute(pos, i)
          vertex.y = Math.random() * vertexHeight - vertexHeight
          vertex._myY = vertex.y
          plane.userData.vertices.push(vertex)
        }
      }

    let position = this.opts.position || [0, 0, 0]
      , rotation = this.opts.rotation || [0, 0, 0]

    const mesh = new Mesh(
      new PlaneGeometry(planeSize, planeSize, planeDefinition, planeDefinition),
      new MeshBasicMaterial({
        color: color,
        wireframe: true,
        transparent: true,
        opacity: .3,
      })
    )

    mesh.rotation.fromArray(rotation)
    mesh.position.fromArray(offset)
    mesh.userData = { vertices: [] }
    updateMatrix(mesh)
    saveVerticesInfo(mesh)
    this.group.add(mesh)
    this.plane = mesh
  }
  createPoints(){
    const SEPARATION = 50, AMOUNTX = 25, AMOUNTY = 25
    , numParticles = AMOUNTX * AMOUNTY
    , positions = new Float32Array( numParticles * 3 )
    , geometry = new BufferGeometry()
    , { dotColor, offset } = this.opts

    let i = 0, j = 0;
    for (let ix = 0; ix < AMOUNTX; ix++) {
    	for (let iy = 0; iy < AMOUNTY; iy++) {
    		positions[ i ] = 25 + ix * SEPARATION - ( ( AMOUNTX * SEPARATION ) / 2 ); // x
    		// positions[ i + 1 ] = position[1]; // y
    		positions[ i + 1 ] = 0; // y
    		positions[ i + 2 ] = 25 + iy * SEPARATION - ( ( AMOUNTY * SEPARATION ) / 2 ); // z
    		i += 3;
    		j ++;
    	}
    }

    geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );

    // Static per-dot tint and brightness (warm orange to near white), so the field twinkles a little
    const tint = new Color(dotColor), warm = new Color('#ff9d2e'), hot = new Color('#ffffff')
    , colors = new Float32Array( numParticles * 3 )
    for (let k = 0; k < numParticles; k++) {
    	const c = tint.clone().lerp(Math.random() < 0.15 ? hot : warm, Math.random() * 0.4)
    	c.multiplyScalar(0.85 + Math.random() * 0.15)
    	c.toArray(colors, k * 3)
    }
    geometry.setAttribute( 'color', new BufferAttribute( colors, 3 ) );
    geometry.setAttribute( 'aPhase', new BufferAttribute( Float32Array.from( { length: numParticles }, Math.random ), 1 ) );

    // Additive blending makes the soft edges glow instead of showing a hard disc. Still one draw call, fog-aware.
    const material = new PointsMaterial({
    	size: 11, map: dotTexture(dotColor), transparent: true, vertexColors: true,
    	depthWrite: false, blending: AdditiveBlending
    })
    , particles = new Points(geometry, material)
    material.onBeforeCompile = twinkleShader

    particles.rotation.fromArray(this.opts.particlesRotation)
    particles.position.fromArray(offset)
    updateMatrix(particles)
    this.group.add(particles)
    this.particles = particles
    // Live dot positions of the wave, kept up to date even while the dots themselves are locked
    this.waveDots = particles.geometry.attributes.position.array.slice()
  }
  animateWave(type){
    if(!this.opts.hasWaves) return

    const { plane, particles } = this
      , planeGeo = plane.geometry
      , { vertices } = plane.userData
      , pointsGeo = particles.geometry
      , { offset } = this.opts
      , self = this

    switch(type){
      case 'start':
        // Also possible with a gsap repeat -1
        vertices.forEach((vertex, i) => {
          vertex.y = Math.sin(( i + this.count * 0.0002)) * (vertex._myY - (vertex._myY* 0.6))
          planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + offset[1], vertex.z)
          this.waveDots[i * 3] = vertex.x
          this.waveDots[i * 3 + 1] = vertex.y + offset[1]
          this.waveDots[i * 3 + 2] = vertex.z
          if(!this.dotsLocked) pointsGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + offset[1], vertex.z)
          this.count += .1
        })
        planeGeo.attributes.position.needsUpdate = true
        pointsGeo.attributes.position.needsUpdate = true
        break;

      default: // stop
        vertices.forEach((vertex, i) => {
          const initPos = { y: vertex.y + offset[1] }
          gsap.to(initPos, {
            y: offset[1],
            duration: .25,
            delay: .0001 * i,
            onUpdate: function() {
              planeGeo.attributes.position.setY(i, initPos.y)
              if(!self.dotsLocked) pointsGeo.attributes.position.setY(i, initPos.y)
              planeGeo.attributes.position.needsUpdate = true
              pointsGeo.attributes.position.needsUpdate = true
            }
          })
        })
        break;
    }

    planeGeo.computeVertexNormals()
    pointsGeo.computeVertexNormals()
  }
}