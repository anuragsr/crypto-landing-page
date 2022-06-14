import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

window.THREE = THREE
// Destructure here to avoid use of THREE namespace
const {
	WebGLRenderer, Scene,
	PerspectiveCamera, Group,
	Vector3, AxesHelper, FogExp2,
	CameraHelper, Fog,
	GridHelper, SphereGeometry,
	Mesh, MeshPhongMaterial,
	DirectionalLight, AmbientLight,
} = THREE

import gsap from 'gsap'
import Stats from 'stats.js'

import PlaneMesh from '@/js/PlaneMesh'
import GUI from '@/js/utils/gui'
import Palette from '@/js/utils/palette'
import { l, cl, updateMatrix } from '@/js/utils/helpers'

export default class ThreeScene {
	constructor(opts){
		this.ctn = opts.ctn
		this.w = this.ctn.offsetWidth
		this.h = this.ctn.offsetHeight

		this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
		this.scene = new Scene()

		// Camera for OrbitControls
		this.orbitCamera = new PerspectiveCamera(45, this.w / this.h, 1, 10000)
		this.orbitCameraHelper = new CameraHelper(this.orbitCamera)

    // Camera for actual rendering
		this.sceneCamera = new PerspectiveCamera(45, this.w / this.h, 1, 10000)
		this.sceneCameraHelper = new CameraHelper(this.sceneCamera)

		this.origin = new Vector3(0, 0, 0)
		new OrbitControls(this.orbitCamera, this.renderer.domElement)

		const axesHelper = new AxesHelper(500)
		axesHelper.name = "Axes Helper"
		this.axesHelper = axesHelper

		const gridHelper = new GridHelper( 1000, 50 )
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

		// Planes data
		const distFromCenter = 200
		this.planeUpDefaults = {
			dotColor: '#00ff00',
			color: Palette.MESH_LIGHT,
			offset: [0, distFromCenter, 0],
			rotation: [-Math.PI / 2, 0, 0],
			particlesRotation: [0, 0, 0],
			hasWaves: true
		}
		this.planeDownDefaults = {
			dotColor: Palette.DOTS,
			color: Palette.MESH_LIGHT,
			offset: [0, -distFromCenter, 0],
			rotation: [Math.PI / 2, 0, 0],
			particlesRotation: [0, 0, 0],
			hasWaves: true
		}
		this.planeBackDefaults = {
			dotColor: '#c555e5',
			color: Palette.MESH_LIGHT,
			offset: [0, -2*distFromCenter, -3*distFromCenter],
			rotation: [0, 0, 0],
			particlesRotation: [-Math.PI / 2, 0, 0],
			hasWaves: false
		}

		// Scene camera positions + rotations
		this.cameraTransforms = [
			// Scene 1
			{
				rotation: [0, 0, 0],
				position: [0, 0, 750]
			},
			// Scene 2
			{
				rotation: [.5, 0, -Math.PI/2],
				position: [0, -275, 700]
			},
		]
	}
	init(){
		this.initScene()
		// this.initGUI()
		this.addObjects()
		this.addListeners()
	}
	initScene(){
		const {
			ctn, w, h, orbitCamera, scene, renderer,
			cameraTransforms, origin, sceneCamera,
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
		orbitCamera.position.fromArray(cameraTransforms[0].position)
		orbitCamera.lookAt(origin)

		// Set camera for scene
		this.setCameraForScene(1)

		// Spotlight and representational mesh
		spotLightMesh1.position.copy(lightPos1)
		spotLight1.position.copy(lightPos1)

		spotLightMesh2.position.copy(lightPos2)
		spotLight2.position.copy(lightPos2)
		scene.add(
			orbitCamera, sceneCamera,
			new AmbientLight(0xffffff, .2),
			spotLight1, spotLight2
		)

		// this.currentCamera = orbitCamera
		this.currentCamera = sceneCamera
	}
	initGUI(){
		const guiObj = new GUI({
			helpers: false,
			stats: true,
			fog: false,
			animateWave: false,
			normalizeWave: function(){},
			getState: function(){ l(this) },
			resetCamera: function(){},
			orbitCamera: function(){},
			sceneCamera: function(){},
		})
		, gui = guiObj.gui
		, params = guiObj.getParams()
		, toggleGUIParam = (param, val) => {
			const {
				scene, gridHelper, axesHelper,
				spotLightMesh1, spotLightMesh2,
				orbitCameraHelper, sceneCameraHelper,
				orbitCamera, cameraTransforms
			} = this

			switch(param){
				case 'helpers':
					val ?
						scene.add(axesHelper, gridHelper, orbitCameraHelper, sceneCameraHelper, spotLightMesh1, spotLightMesh2)
						:
						scene.remove(axesHelper, gridHelper, orbitCameraHelper, sceneCameraHelper, spotLightMesh1, spotLightMesh2)
					break;

				case 'fog':
					const i = 5
					scene.fog = val ? new FogExp2(Palette.DARK, .00025 * i) : null
					break;

				case 'animateWave':
					this.shouldAnimateWave = val
					break;

				case 'normalizeWave':
					this.shouldAnimateWave = false
					params.animateWave = false
					gui.updateDisplay()
					this.planes.forEach(plane => plane.animateWave('stop'))
					break;

				case 'resetCamera':
					orbitCamera.position.copy(cameraTransforms[0].position)
					orbitCamera.lookAt(0, 0, 0)
					break;

				default: // stats
					this.stats.dom.style.display = val ? "block" : "none"
					break;
			}
		}

		gui.add(params, 'helpers').onChange(v  => toggleGUIParam('helpers', v))
		gui.add(params, 'stats').onChange(v  => toggleGUIParam('stats', v))
		gui.add(params, 'fog').onChange(v  => toggleGUIParam('fog', v))
		gui.add(params, 'animateWave').onChange(v  => toggleGUIParam('animateWave', v))
		gui.add(params, 'normalizeWave').onChange(() => toggleGUIParam('normalizeWave'))
		gui.add(params, 'getState')

		const f = gui.addFolder('Cameras')
		f.add(params, 'resetCamera').onChange(() => toggleGUIParam('resetCamera'))
		f.add(params, 'orbitCamera').onChange(() => this.currentCamera = this.orbitCamera)
		f.add(params, 'sceneCamera').onChange(() => this.currentCamera = this.sceneCamera)
		f.open()

		this.stats = new Stats()
		this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
		document.body.appendChild(this.stats.dom)
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
		const { renderer, scene, currentCamera } = this
			, addPlanes = () => {
				const planeUp = new PlaneMesh(this.planeUpDefaults)
					, planeDown = new PlaneMesh(this.planeDownDefaults)
					, planeBack = new PlaneMesh(this.planeBackDefaults)

				// Hide this plane for first scene
			  planeBack.plane.material.opacity = 0
				planeBack.particles.material.opacity = 0

				this.shouldAnimateWave = true
				this.planes = [planeUp, planeDown, planeBack]
				this.planes.forEach(plane => {
					this.scene.add(plane.group)
					plane.animateWave('start')
					// plane.animateWave('stop')
				})
				renderer.render(scene, currentCamera)
			}
			, addFog = () => {
				// If we want custom distances
				// this.scene.fog = new Fog(Palette.DARK, 100, 1500)

				// If we want exponential fall-off
				const i = 5
				this.scene.fog = new FogExp2(Palette.DARK, .00025 * i)
			}
			, addAnubis = () => {
				const gr = new Group()
				gr.name = "anubis"
        // gr.visible = false
				scene.add(gr)

				const modelVertices = []
				const loader = new GLTFLoader().setPath("assets/models/anubis_bust/")
				loader.load('scene.gltf', function(gltf){
					// l(gltf)
					const modelGraph = gltf.scene
					// modelGraph.scale.multiplyScalar(200)
					gr.add(modelGraph)

					const newMaterial = new THREE.MeshBasicMaterial({
						color: 0xff0000,
						wireframe: true,
						transparent: true,
						opacity: 0.1
					});

					modelGraph.traverse((o) => {
						if (o.isMesh) {
							o.material = newMaterial
							o.scale.multiplyScalar(200)
							// o.position.x-= 250
							o.position.y+= 250
							o.position.z+= 225
							o.rotation.x+= .9
							o.rotation.z-=Math.PI/2
							updateMatrix(o)

							const planeGeo = o.geometry
								, pos = planeGeo.attributes.position

							for(let i = 0; i < pos.count; i++){
								const vertex = new Vector3().fromBufferAttribute(pos, i)
								modelVertices.push(vertex)
							}
						}
					})
					// l(modelVertices.length)
				})

				this.modelVertices = modelVertices
		  }

		// PLANES UP & DOWN
		addPlanes()
		// FOG
		addFog()
		// ANUBIS MODEL
		addAnubis()
	}
	setCameraForScene(idx) {
		this.sceneCamera.position.fromArray(this.cameraTransforms[idx - 1].position)
		this.sceneCamera.rotation.fromArray(this.cameraTransforms[idx - 1].rotation)
	}
	render(){
		const { stats } = this
		try{
			stats.begin()

			this.shouldAnimateWave && this.planes.forEach(plane => plane.animateWave('start'))
			this.renderer.render(this.scene, this.currentCamera)

			stats.end()
		} catch (err){
			l(err)
			gsap.ticker.remove(this.render.bind(this))
		}
	}
	resize(){
		const { ctn, currentCamera, renderer } = this
			, w = ctn.offsetWidth
			, h = ctn.offsetHeight

		currentCamera.aspect = w / h
		currentCamera.updateProjectionMatrix()

		renderer.setSize(w, h)

		l("[Scene Resized]")
	}
	addListeners(){
		gsap.ticker.add(this.render.bind(this))
		window.addEventListener("resize", this.resize.bind(this), false)
	}
	animateToSection(section){
		const {
				scene, sceneCamera,
				planes, cameraTransforms
			} = this
			, fog = { value: 0 }
			, tl = new gsap.timeline()

		switch(section){
			case 'section1':
				this.shouldAnimateWave = true
				planes.forEach(plane => plane.animateWave('start'))

				{
					let [x, y, z] = cameraTransforms[0].position
						, [rotX, rotY, rotZ] = cameraTransforms[0].rotation

					fog.value = .00025 * 1

					tl
						.to(sceneCamera.position, {
							duration: 1, x, y, z
						}, "lb0")
						.to(sceneCamera.rotation, {
							duration: 1, x: rotX, y: rotY, z: rotZ
						}, "lb0")
						.to(planes[0].plane.material, {
							duration: 1, opacity: .3
						}, "lb0")
						.to(planes[1].group.position, {
							duration: 1, y: 0
						}, "lb0")
						.to(planes[2].plane.material, {
							duration: 1, opacity: 0
						}, "lb0")
						.to(planes[2].particles.material, {
							duration: 1, opacity: 0
						}, "lb0")
						.to(fog, {
							duration: 1, value: .00025 * 5,
							onUpdate: function() {
								scene.fog = new FogExp2(Palette.DARK, fog.value)
							},
						}, "lb0")
				}
				break;

			case 'section2':
				this.shouldAnimateWave = false
				planes.forEach(plane => plane.animateWave('stop'))

				{
					let [x, y, z] = cameraTransforms[1].position
						, [rotX, rotY, rotZ] = cameraTransforms[1].rotation

					fog.value = .00025 * 5
					tl
						.to(sceneCamera.position, {
							duration: 1, x, y, z
						}, "lb0")
						.to(sceneCamera.rotation, {
							duration: 1, x: rotX, y: rotY, z: rotZ
						}, "lb0")
						.to(planes[0].plane.material, {
							duration: 1, opacity: .1
						}, "lb0")
						.to(planes[1].group.position, {
							duration: 1, y: "-=" + 500
						}, "lb0")
						.to(planes[2].plane.material, {
							duration: 1, opacity: .1
						}, "lb0")
						.to(planes[2].particles.material, {
							duration: 1, opacity: 1
						}, "lb0")
						.to(fog, {
							duration: 1, value: .00025 * 1,
							onUpdate: function() {
								scene.fog = new FogExp2(Palette.DARK, fog.value)
							}
						}, "lb0")

          this.tweenArr?.forEach(tw => tw.reverse())
				}
				break;

			case 'section3':
				const pointsGeo1 = this.planes[0].particles.geometry
					, pointsGeo2 = this.planes[2].particles.geometry
					, vertices1 = this.planes[0].plane.userData.vertices
					, vertices2 = this.planes[2].plane.userData.vertices
					, spacing = 7
					, duration = 1
          , tweenArr = []

				vertices1.forEach((vertex, i) => {
					const tempvertex = new THREE.Vector3();
					tempvertex.fromBufferAttribute( pointsGeo1.attributes.position, i );
					// i === 0 && l(tempvertex)

					// const initPos = this.planes[0].group.children[1].localToWorld( tempvertex )
					const initPos = this.planes[0].group.localToWorld( tempvertex )

					// i === 0 && l(initPos)

					const { x, y, z } = this.modelVertices[i*spacing]
					let tw = gsap.to(initPos, {
						x, y, z,
						duration,
						delay: .0001 * i,
						onUpdate: function() {
							// const target = this.vars
							// i === 0 && l(initPos)
							pointsGeo1.attributes.position.setXYZ(i, initPos.x, initPos.y, initPos.z)
							// pointsGeo1.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
							pointsGeo1.attributes.position.needsUpdate = true
						},
					})
          tweenArr.push(tw)
					// setTimeout(() => {
					// 	tw.pause()
					// }, 50)
				})

				vertices2.forEach((vertex, i) => {
					const tempvertex = new THREE.Vector3();
					tempvertex.fromBufferAttribute( pointsGeo2.attributes.position, i );
					// i === 0 && l(tempvertex)

					// const initPos = this.planes[0].group.children[1].localToWorld( tempvertex )
					const initPos = this.planes[0].group.localToWorld( tempvertex )

					// i === 0 && l(initPos)
					const { x, y, z } = this.modelVertices[this.modelVertices.length - i*spacing - 1]
					let tw = gsap.to(initPos, {
						x, y, z,
						duration,
						delay: .0001 * i,
						onUpdate: function() {
							// const target = this.vars
							// i === 0 && l(initPos)
							pointsGeo2.attributes.position.setXYZ(i, initPos.x, initPos.y, initPos.z)
							// pointsGeo1.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
							pointsGeo2.attributes.position.needsUpdate = true
						},
					})

          tweenArr.push(tw)
					// setTimeout(() => {
					// 	tw.pause()
					// }, 50)
				})

				pointsGeo1.computeVertexNormals()
				pointsGeo2.computeVertexNormals()
        this.tweenArr = tweenArr
				break;

			default:
				break;
		}
	}
}