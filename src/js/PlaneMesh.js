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
import { l, cl } from '@/js/utils/helpers'

export default class PlaneMesh {
  constructor(opts) {
    this.opts = opts
    this.count = 0
    this.group = new Group()
    this.createPlane()
    this.createPoints()
    l(this.group)
  }
  createPlane(){
    const planeDefinition = 24
      , planeSize = 1200
      , { color } = this.opts
      , saveVerticesInfo = plane => {
        const planeGeo = plane.geometry
          , pos = planeGeo.attributes.position
          , vertexHeight = 20

        for(let i = 0; i < pos.count; i++){
          const vertex = new Vector3().fromBufferAttribute(pos, i)
            // , dot = createMesh(
            //   new SphereGeometry(1, 10, 10, 0, Math.PI * 2, 0, Math.PI * 2),
            //   new MeshPhongMaterial({ color: 0xffff00 })
            // )

          vertex.y = Math.random() * vertexHeight - vertexHeight
          vertex._myZ = vertex.y

          // dot.position.copy(vertex)
          // scene.add(dot)

          plane.userData.vertices.push(vertex)
          // plane.userData.dots.push(dot)
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
    , position = this.opts.position || [0, 0, 0]

    let i = 0, j = 0;
    for (let ix = 0; ix < AMOUNTX; ix++) {
    	for (let iy = 0; iy < AMOUNTY; iy++) {
    		positions[ i ] = 25 + ix * SEPARATION - ( ( AMOUNTX * SEPARATION ) / 2 ); // x
    		positions[ i + 1 ] = position[1]; // y
    		positions[ i + 2 ] = 25 + iy * SEPARATION - ( ( AMOUNTY * SEPARATION ) / 2 ); // z
    		i += 3;
    		j ++;
    	}
    }

    geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );

    const ctx = document.createElement('canvas').getContext('2d');
    ctx.canvas.width = 256
    ctx.canvas.height = 256
    ctx.fillStyle = '#FF0'
    ctx.beginPath()
    ctx.arc(128, 128, 128, 0, Math.PI * 2)
    ctx.fill()
    const texture = new CanvasTexture(ctx.canvas)

    // This material responds to fog
    const material = new PointsMaterial({
    	size: 5, map: texture, transparent: true
    });

    const particles = new Points(geometry, material)
    this.group.add(particles)
  }
  animateVertices(){
    const plane = this.group.children[0]
      , planeGeo = plane.geometry
      , { vertices, distFromCenter } = plane.userData

    vertices.forEach((vertex, i) => {
      vertex.y = Math.sin(( i + this.count * 0.0002)) * (vertex._myZ - (vertex._myZ* 0.6))
      planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
      // plane.userData.dots[i].position.set(vertex.x, vertex.y + distFromCenter, vertex.z)
      this.count += 0.1
    })

    planeGeo.attributes.position.needsUpdate = true
    planeGeo.computeVertexNormals()
  }
  normalizeVertices(){}
  animatePlane(){}
}