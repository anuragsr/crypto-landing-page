import * as THREE from 'three'
const {
  Group, Vector3, PlaneGeometry,
  Mesh, MeshBasicMaterial,
  BufferGeometry, CanvasTexture,
  PointsMaterial, Points,
  BufferAttribute
} = THREE

import gsap from 'gsap'
import { l, cl, updateMatrix } from '@/js/utils/helpers'

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

    const ctx = document.createElement('canvas').getContext('2d');
    ctx.canvas.width = 256
    ctx.canvas.height = 256
    ctx.fillStyle = dotColor
    ctx.beginPath()
    ctx.arc(128, 128, 128, 0, Math.PI * 2)
    ctx.fill()

    // This material responds to fog
    const material = new PointsMaterial({
    	size: 5, map: new CanvasTexture(ctx.canvas), transparent: true
    })
    , particles = new Points(geometry, material)

    particles.rotation.fromArray(this.opts.particlesRotation)
    particles.position.fromArray(offset)
    updateMatrix(particles)
    this.group.add(particles)
    this.particles = particles
  }
  animateWave(type){
    if(!this.opts.hasWaves) return

    const { plane, particles } = this
      , planeGeo = plane.geometry
      , { vertices } = plane.userData
      , pointsGeo = particles.geometry
      , { offset } = this.opts

    switch(type){
      case 'start':
        // Also possible with a gsap repeat -1
        vertices.forEach((vertex, i) => {
          vertex.y = Math.sin(( i + this.count * 0.0002)) * (vertex._myY - (vertex._myY* 0.6))
          planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + offset[1], vertex.z)
          pointsGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + offset[1], vertex.z)
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
              pointsGeo.attributes.position.setY(i, initPos.y)
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