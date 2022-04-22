import * as THREE from 'three'
const {
  WebGLRenderer, Scene,
  PerspectiveCamera, Group,
  Vector3, AxesHelper,
  GridHelper, SphereGeometry,
  PlaneGeometry, CylinderGeometry,
  Mesh, MeshPhongMaterial,
  MeshBasicMaterial, Fog,
  DirectionalLight, AmbientLight,
  DoubleSide,
  BufferGeometry,
  CanvasTexture,
  PointsMaterial,
  Points,
  BufferAttribute
} = THREE
import gsap from 'gsap'

import { l, cl } from '@/js/utils/helpers'
import Palette from '@/js/utils/palette'

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
      , { color } = this.opts
      , saveVerticesInfo = plane => {
        const planeGeo = plane.geometry
          , pos = planeGeo.attributes.position
          , vertexHeight = 35

        for(let i = 0; i < pos.count; i++){
          const vertex = new Vector3().fromBufferAttribute(pos, i)
          vertex.z = Math.random() * vertexHeight - vertexHeight
          vertex._myZ = vertex.z
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
    mesh.position.fromArray(position)
    mesh.userData = { vertices: [] }
    saveVerticesInfo(mesh)
    this.group.add(mesh)
  }
  createPoints(){
    const SEPARATION = 50, AMOUNTX = 25, AMOUNTY = 25
    , numParticles = AMOUNTX * AMOUNTY
    , positions = new Float32Array( numParticles * 3 )
    , geometry = new BufferGeometry()

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
    // ctx.fillStyle = Palette.MESH_LIGHT
    ctx.fillStyle = Palette.DOTS
    ctx.beginPath()
    ctx.arc(128, 128, 128, 0, Math.PI * 2)
    ctx.fill()

    // This material responds to fog
    const material = new PointsMaterial({
    	size: 5, map: new CanvasTexture(ctx.canvas), transparent: true
    })
    , particles = new Points(geometry, material)

    particles.rotation.fromArray(this.opts.rotation)
    particles.position.fromArray(this.opts.position)
    this.group.add(particles)
  }
  animateVertices(type){
    const plane = this.group.children[0]
      , planeGeo = plane.geometry
      , { vertices } = plane.userData
      , pointsGeo = this.group.children[1].geometry

    switch(type){
      case 'start':
        vertices.forEach((vertex, i) => {
          vertex.z = Math.sin(( i + this.count * 0.0002)) * (vertex._myZ - (vertex._myZ* 0.6))
          planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
          pointsGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
          this.count += .1
        })
        break;

      default: // stop
        // if(this.count === 0) return

        vertices.forEach((vertex, i) => {
          planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, 0)
          pointsGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, 0)
          // planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex._myZ - this.count)
          // pointsGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex._myZ - this.count)
          // this.count -= .0001
        })

        // this.count = 0
        break;
    }

    planeGeo.attributes.position.needsUpdate = true
    pointsGeo.attributes.position.needsUpdate = true
    planeGeo.computeVertexNormals()
    pointsGeo.computeVertexNormals()
  }
  animate(position, rotation){
    this.animateVertices('stop')
    new gsap
    .timeline({
      // onComplete: () => {
      //   this.shouldAnimateWave = true
      //   this.animateVertices('start')
      // }
    })
    .to(this.group.position, {
      duration: 1,
      x: position[0],
      y: position[1],
      z: position[2],
    }, 'lb0')
    .to(this.group.rotation, {
      duration: 1,
      x: rotation[0],
      y: rotation[1],
      z: rotation[2],
    }, 'lb0')
  }
}