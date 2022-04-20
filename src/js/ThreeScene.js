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

import PlaneMesh from '@/js/PlaneMesh'
import GUI from '@/js/utils/gui'
import { l, cl } from '@/js/utils/helpers'

export default class ThreeScene {
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

		const distFromCenter = 200
		this.planeUpDefaults = {
			color: 0x005e97,
			position: [0, distFromCenter, 0],
			rotation: [-Math.PI / 2, 0, 0]
		}
		this.planeDownDefaults = {
			color: 0x005e97,
			position: [0, -distFromCenter, 0],
			rotation: [-Math.PI / 2, 0, 0]
		}

		this.stats = new Stats()
		this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
		document.body.appendChild(this.stats.dom)
	}
	init(){
		// Initialize the scene
		this.initScene()
		this.initGUI()
		this.createPlanes()
		this.addListeners()
	}
	initScene(){
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

		// Spotlight and representational mesh
		spotLightMesh1.position.copy(lightPos1)
		spotLight1.position.copy(lightPos1)

		spotLightMesh2.position.copy(lightPos2)
		spotLight2.position.copy(lightPos2)
		scene.add(
			camera, new AmbientLight(0xffffff, .2),
			spotLight1, spotLight2
		)
	}
	initGUI(){
		const guiObj = new GUI({
			helpers: false,
			fog: false,
			stats: true,
			animateVertices: false,
			normalizeVertices: function(){},
			getState: function () { l(this) },
			resetCamera: function(){},
		})
		, gui = guiObj.gui
		, params = guiObj.getParams()
		, toggleGUIParam = (param, val) => {
			const {
				scene, gridHelper, axesHelper,
				spotLightMesh1, spotLightMesh2,
				camera, cameraStartPos
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

				case 'animateVertices':
					this.shouldAnimateWave = val
					break;

				case 'normalizeVertices':
					this.shouldAnimateWave = false
					params.animateVertices = false
					gui.updateDisplay()
					this.planes.forEach(plane => plane.animateVertices('stop'))
					break;

				case 'resetCamera':
					camera.position.copy(cameraStartPos)
					camera.lookAt(0, 0, 0)
					break;

				default: // stats
					this.stats.dom.style.display = val ? "block" : "none"
					break;
			}
		}

		gui.add(params, 'helpers').onChange(v  => toggleGUIParam('helpers', v))
		gui.add(params, 'stats').onChange(v  => toggleGUIParam('stats', v))
		gui.add(params, 'fog').onChange(v  => toggleGUIParam('fog', v))
		gui.add(params, 'animateVertices').onChange(v  => toggleGUIParam('animateVertices', v))
		gui.add(params, 'normalizeVertices').onChange(() => toggleGUIParam('normalizeVertices'))
		gui.add(params, 'resetCamera').onChange(() => toggleGUIParam('resetCamera'))

		// toggleGUIParam('helpers', 1)
		gui.add(params, 'getState')
		// this.guiObj = guiObj
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
	createPlanes(){
		const planeUp = new PlaneMesh(this.planeUpDefaults)
		, planeDown = new PlaneMesh(this.planeDownDefaults)

		this.planes = [planeUp, planeDown]
		this.planes.forEach(plane => {
			this.scene.add(plane.group)
			plane.animateVertices('start')
			plane.animateVertices('stop')
		})
		this.renderer.render(this.scene, this.camera)
	}
	render(){
		const { stats } = this
		try{
			stats.begin()

			this.shouldAnimateWave && this.planes.forEach(plane => plane.animateVertices('start'))
			this.renderer.render(this.scene, this.camera)

			stats.end()
		} catch (err){
			l(err)
			gsap.ticker.remove(this.render.bind(this))
		}
	}
	resize(){
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
	animateToSection(section){
		switch(section){
			case 'section0':
				this.planes[0].animate(
					[0, 0, 0],
					[0, 0, 0],
				)
				this.planes[1].animate(
					[0, 0, 0],
					[0, 0, 0],
				)
				break;

			case 'section1':
				this.shouldAnimateWave = false
				this.planes[0].animate(
					[-100, 0, 0],
					[-Math.PI/2, 0, Math.PI/4],
				)
				this.planes[1].animate(
					[750, 0, -282],
					[-Math.PI/2, 0, -Math.PI/4],
				)
				break;

			default:
				break;
		}
	}
}