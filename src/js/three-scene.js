import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// Destructure here to avoid use of THREE namespace
const {
	WebGLRenderer, Scene,
	PerspectiveCamera, Group,
	Vector3, AxesHelper,
	GridHelper, SphereGeometry,
	PlaneGeometry, CylinderGeometry,
	Mesh, MeshPhongMaterial,
	MeshBasicMaterial, Fog,
	DirectionalLight, AmbientLight,
	DoubleSide
} = THREE

import gsap from 'gsap'
import Stats from 'stats.js'

import GUI from './utils/gui'
import { l, cl } from './utils/helpers'

let count = 0

export default class THREEScene {
	constructor(opts){
		this.ctn = opts.ctn
		this.w = this.ctn.offsetWidth
		this.h = this.ctn.offsetHeight

		this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
		this.scene = new Scene()
		this.camera = new PerspectiveCamera(45, this.w / this.h, 1, 10000)

		this.origin = new Vector3(0, 0, 0)
		this.cameraStartPos = new Vector3(0, 0, 750)
		this.controls = new OrbitControls(this.camera, this.renderer.domElement)

		const axesHelper = new AxesHelper(500)
		// axesHelper.material.opacity = .5
		axesHelper.material.transparent = true
		axesHelper.name = "Axes Helper"
		this.axesHelper = axesHelper

		const gridHelper = new GridHelper( 1000, 50 )
		// gridHelper.material.opacity = .3
		gridHelper.material.transparent = true
		gridHelper.name = "Grid Helper"
		this.gridHelper = gridHelper

		// First spotlight
		this.spotLightMesh1 = this.createMesh(
			new SphereGeometry(5, 50, 50, 0, Math.PI * 2, 0, Math.PI * 2),
			new MeshPhongMaterial({ color: 0xffff00 })
		)
		this.spotLight1 = new DirectionalLight(0xffffff, 1)
		this.lightPos1 = new Vector3(500, 350, 500)

		// Second spotlight diagonally opposite
		this.spotLightMesh2 = this.createMesh(
			new SphereGeometry(5, 50, 50, 0, Math.PI * 2, 0, Math.PI * 2),
			new MeshPhongMaterial({ color: 0xffff00 })
		)
		this.spotLight2 = new DirectionalLight(0xffffff, 1)
		this.lightPos2 = new Vector3(-500, 350, -500)

		this.currMesh = { name: "Blank" }

		this.stats = new Stats()
		this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
		document.body.appendChild(this.stats.dom)
	}
	init(){
		const {
			ctn, w, h, camera, scene, renderer,
			cameraStartPos, origin,
			spotLightMesh1, spotLight1, lightPos1,
			spotLightMesh2, spotLight2, lightPos2
		} = this

		// Renderer settings
		renderer.setClearColor(0x000000, 0)
		renderer.setSize(w, h)
		renderer.domElement.style.position = "absolute"
		renderer.domElement.style.top = 0
		renderer.domElement.style.left = 0
		ctn.append(renderer.domElement)

		// Cameras and ambient light
		camera.position.copy(cameraStartPos)
		camera.lookAt(origin)
		scene.add(camera)
		scene.add(new AmbientLight(0xffffff, .2))

		// Spotlight and representational mesh
		spotLightMesh1.position.copy(lightPos1)
		spotLight1.position.copy(lightPos1)
		scene.add(spotLight1)

		spotLightMesh2.position.copy(lightPos2)
		spotLight2.position.copy(lightPos2)
		scene.add(spotLight2)

		// Initialize the scene
		this.initGUI()
		this.toggleGUIParam('helpers', !1)
		this.createPlaneWaves()
		this.addListeners()
	}
	initGUI() {
		const guiObj = new GUI()
			, gui = guiObj.gui
			, params = guiObj.getParams(this.currMesh)
			, he = gui.add(params, 'helpers')
			, st = gui.add(params, 'stats')
			, fg = gui.add(params, 'fog')

		he.onChange(v => this.toggleGUIParam('helpers', v))
		st.onChange(v => this.toggleGUIParam('stats', v))
		fg.onChange(v => this.toggleGUIParam('fog', v))

		gui.add(params, 'getState')
		this.guiObj = guiObj
	}
	toggleGUIParam(param, val){
		const {
			scene, gridHelper, axesHelper,
			spotLightMesh1, spotLightMesh2
		} = this

		switch(param){
			case 'helpers':
				val ?
					scene.add(axesHelper, gridHelper, spotLightMesh1, spotLightMesh2)
					:
					scene.remove(axesHelper, gridHelper, spotLightMesh1, spotLightMesh2)
				break;

			case 'fog':
				scene.fog = val ? new Fog("#002135", 1, 1000) : null
				break;

			default: // stats
				this.stats.dom.style.display = val ? "block" : "none"
				break;
		}
	}
	createMesh(geometry, material, materialOptions){
		if(materialOptions) {
			let { wrapping, repeat, minFilter } = materialOptions
			material.map.wrapS = material.map.wrapT = wrapping
			material.map.repeat = repeat
			material.map.minFilter = minFilter
		}

		return new Mesh(geometry, material)
	}
	addObjects(){
		const { scene, guiObj, createMesh } = this
		const cylinder = createMesh(
			new CylinderGeometry( 50, 50, 50, 32, 1, false ),
			new MeshPhongMaterial({ side: DoubleSide, color: 0x000000 })
		)

		cylinder.name = "Base Object"
		cylinder.position.set(0, 25, 0)
		scene.add(cylinder)

		this.currMesh = cylinder

		const gui = guiObj.gui
			, params = guiObj.getParams(this.currMesh)
		gui.add(params, 'currMesh')
	}
	createPlaneWaves(){
		const { scene, updateTransform, createMesh } = this
			, distFromCenter = 200
			, planeDefinition = 25
			, planeSize = 1200
			, background = "#002135"
			, meshColor = "#005e97"
			, createDots = plane => {
				const planeGeo = plane.geometry
					, pos = planeGeo.attributes.position
					, vertexHeight = 20

				for(let i = 0; i < pos.count; i++){
					const vertex = new Vector3().fromBufferAttribute(pos, i)
					vertex.y = Math.random() * vertexHeight - vertexHeight
					vertex._myZ = vertex.y

					const dot = createMesh(
						new SphereGeometry(1, 10, 10, 0, Math.PI * 2, 0, Math.PI * 2),
						new MeshPhongMaterial({ color: 0xffff00 })
					)
					dot.position.copy(vertex)
					scene.add(dot)

					planeGeo.userData.vertices.push(vertex)
					planeGeo.userData.dots.push(dot)
				}
			}
		// scene.fog = new Fog(background, 1, 1000);

		const planeUp = createMesh(
			new PlaneGeometry(planeSize, planeSize, planeDefinition, planeDefinition),
			new MeshBasicMaterial({
			color: meshColor,
			wireframe: true,
			// transparent: true,
			opacity: .3,
		})
		)
		planeUp.rotation.x -= Math.PI * .5
		planeUp.position.y = distFromCenter
		updateTransform(planeUp)

		const planeDown = createMesh(
			new PlaneGeometry(planeSize, planeSize, planeDefinition, planeDefinition),
			new MeshBasicMaterial({
			color: meshColor,
			wireframe: true,
			// transparent: true,
			opacity: .3,
		})
		)
		planeDown.rotation.x -= Math.PI * .5
		planeDown.position.y = -distFromCenter
		updateTransform(planeDown)

		planeUp.geometry.userData = { distFromCenter: 200, vertices: [], dots: [] }
		planeDown.geometry.userData = { distFromCenter: -200, vertices: [], dots: [] }

		scene.add(planeUp, planeDown)
		this.planes = [planeUp, planeDown]
		this.planes.forEach(plane => createDots(plane))
	}
	animateWave(plane){
		const planeGeo = plane.geometry, { vertices, distFromCenter } = planeGeo.userData

		vertices.forEach((vertex, i) => {
			vertex.y = Math.sin(( i + count * 0.0002)) * (vertex._myZ - (vertex._myZ* 0.6))
			planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + distFromCenter, vertex.z)
			planeGeo.userData.dots[i].position.set(vertex.x, vertex.y + distFromCenter, vertex.z)
			count += 0.1
		})

		planeGeo.attributes.position.needsUpdate = true
		planeGeo.computeVertexNormals()
	}
	render() {
		const { renderer, scene, camera, stats } = this
		try{
			stats.begin()

			this.planes.forEach(plane => this.animateWave(plane))
			renderer.render(scene, camera)

			stats.end()
		} catch (err){
			l(err)
			gsap.ticker.removeEventListener("tick", render)
		}
	}
	updateTransform(mesh){
		mesh.updateMatrix();
		mesh.geometry.applyMatrix( mesh.matrix );
		mesh.matrix.identity();
		mesh.position.set( 0, 0, 0 );
		mesh.rotation.set( 0, 0, 0 );
		mesh.scale.set( 1, 1, 1 );
	}
	resize() {
		const { ctn, camera, renderer } = this
			, w = ctn.offsetWidth
			, h = ctn.offsetHeight

		camera.aspect = w / h
		camera.updateProjectionMatrix()

		renderer.setSize(w, h)

		l("[Scene Resized]")
	}
	addListeners(){
		gsap.ticker.add(this.render.bind(this))
		window.addEventListener("resize", this.resize.bind(this), false)
	}
}