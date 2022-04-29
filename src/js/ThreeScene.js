import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Destructure here to avoid use of THREE namespace
const {
	WebGLRenderer, Scene,
	PerspectiveCamera, Group,
	Vector3, AxesHelper, FogExp2,
	GridHelper, SphereGeometry,
	Mesh, MeshPhongMaterial, Fog,
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
			dotColor: '#00ff00',
			color: Palette.MESH_LIGHT,
			position: [0, distFromCenter, 0],
			rotation: [-Math.PI / 2, 0, 0]
		}
		this.planeDownDefaults = {
			dotColor: Palette.DOTS,
			color: Palette.MESH_LIGHT,
			position: [0, -distFromCenter, 0],
			rotation: [-Math.PI / 2, 0, 0]
		}
	}
	init(){
		this.initScene()
		// this.initGUI()
		this.addObjects()
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
			stats: true,
			fog: false,
			animateWave: false,
			normalizeWave: function(){},
			getState: () => { l(this) },
			resetCamera: function(){},
			animateAnubis: function(){},
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
					scene.fog = val ? new Fog(Palette.DARK, 100, 1500) : null
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
					camera.position.copy(cameraStartPos)
					camera.lookAt(0, 0, 0)
					break;

				case 'animateAnubis':
					// l(this.planes[0], this.modelVertices)
					const pointsGeo1 = this.planes[0].group.children[1].geometry
						, pointsGeo2 = this.planes[1].group.children[1].geometry
						, vertices1 = this.planes[0].group.children[0].userData.vertices
						, vertices2 = this.planes[1].group.children[0].userData.vertices
						, spacing = 7

					vertices1.forEach((vertex, i) => {
						const tempvertex = new THREE.Vector3();
						tempvertex.fromBufferAttribute( pointsGeo1.attributes.position, i );
						// i === 0 && l(tempvertex)

						const initPos = this.planes[0].group.children[1].localToWorld( tempvertex )

						// i === 0 && l(initPos)
						const { x, y, z } = this.modelVertices[i*spacing]
						let tw = gsap.to(initPos, {
							x, y, z,
							duration: 5,
							delay: .0001 * i,
							onUpdate: function() {
								// const target = this.vars
								// i === 0 && l(initPos)
								pointsGeo1.attributes.position.setXYZ(i, initPos.x, initPos.y, initPos.z)
								// pointsGeo1.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
								pointsGeo1.attributes.position.needsUpdate = true
							},
						})
					})

					vertices2.forEach((vertex, i) => {
						const tempvertex = new THREE.Vector3();
						tempvertex.fromBufferAttribute( pointsGeo2.attributes.position, i );
						// i === 0 && l(tempvertex)

						const initPos = this.planes[0].group.children[1].localToWorld( tempvertex )

						// i === 0 && l(initPos)
						const { x, y, z } = this.modelVertices[this.modelVertices.length - i*spacing - 1]
						let tw = gsap.to(initPos, {
							x, y, z,
							duration: 5,
							delay: .0001 * i,
							onUpdate: function() {
								// const target = this.vars
								// i === 0 && l(initPos)
								pointsGeo2.attributes.position.setXYZ(i, initPos.x, initPos.y, initPos.z)
								// pointsGeo1.attributes.position.setXYZ(i, vertex.x, vertex.y, vertex.z)
								pointsGeo2.attributes.position.needsUpdate = true
							},
						})
					})

					pointsGeo1.computeVertexNormals()
					pointsGeo2.computeVertexNormals()
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
		gui.add(params, 'resetCamera').onChange(() => toggleGUIParam('resetCamera'))
		gui.add(params, 'animateAnubis').onChange(() => toggleGUIParam('animateAnubis'))
		gui.add(params, 'getState')

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
		const { renderer, scene, camera } = this
			, self = this

		// PLANES UP & DOWN
		const planeUp = new PlaneMesh(this.planeUpDefaults)
		, planeDown = new PlaneMesh(this.planeDownDefaults)

		this.shouldAnimateWave = !true
		this.planes = [planeUp, planeDown]
		this.planes.forEach(plane => {
			this.scene.add(plane.group)
			// plane.animateWave('start')
			// plane.animateWave('stop')
			// plane.group.children[0].updateMatrixWorld()
			// plane.group.children[1].updateMatrixWorld()
			// updateMatrix(plane.group.children[0])
			// updateMatrix(plane.group.children[1])
		})
		renderer.render(scene, camera)

		// // FOG
		// // If we want custom distances
		// // this.scene.fog = new Fog(Palette.DARK, 100, 1500)
		//
		// // If we want exponential fall-off
		// const i = 5
		// this.scene.fog = new FogExp2(Palette.DARK, .00025 * i)

		const gr = new Group()
		gr.name = "anubis"
		scene.add(gr)
		// gr.position.x =  300

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
				opacity: 0.3
			});

			modelGraph.traverse((o) => {
				if (o.isMesh) {
					// o.material = newMaterial
					o.scale.multiplyScalar(200)
					// o.rotation.x+=Math.PI/2
					updateMatrix(o)
					// o.rotation.x-=Math.PI/2

					const planeGeo = o.geometry
						, pos = planeGeo.attributes.position

					for(let i = 0; i < pos.count; i++){
						const vertex = new Vector3().fromBufferAttribute(pos, i)
						modelVertices.push(vertex)
					}
				}
			});
			// l(modelVertices.length)
		})

		this.modelVertices = modelVertices
	}
	render(){
		const { stats } = this
		try{
			if(stats) stats.begin()

			this.shouldAnimateWave && this.planes.forEach(plane => plane.animateWave('start'))
			this.renderer.render(this.scene, this.camera)

			if(stats) stats.end()
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
		const { scene } = this, self = this
			, fog = { value: 0 }

		switch(section){
			case 'section1':
				this.shouldAnimateWave = true
				this.planes.forEach(plane => plane.animateWave('start'))
				this.planes[0].animate(
					[0, 0, 0],
					[0, 0, 0],
					1
				)
				this.planes[1].animate(
					[0, 0, 0],
					[0, 0, 0],
					1
				)

				fog.value = .00025 * 1
				gsap.to(fog, {
					duration: 1,
					value: .00025 * 5,
					onUpdate: function() {
						// scene.fog = new FogExp2(Palette.DARK, fog.value)
					},
					onComplete: function() {
						// l(fog.value)
					},
				})
				break;

			case 'section2':
				this.shouldAnimateWave = false
				this.planes.forEach(plane => plane.animateWave('stop'))
				this.planes[0].animate(
					[-100, 0, 0],
					// [-Math.PI/2, 0, Math.PI/4],
					[0, 0, 0],
					1
				)
				this.planes[1].animate(
					[750, 0, -282],
					// [-Math.PI/2, 0, -Math.PI/4],
					[0, 0, 0],
					1
				)

				fog.value = .00025 * 5
				gsap.to(fog, {
					duration: 1,
					value: .00025 * 1,
					onUpdate: function() {
						// scene.fog = new FogExp2(Palette.DARK, fog.value)
					},
					onComplete: function() {
						// updateMatrix(plane.group.children[1])
						// l(fog.value)
						updateMatrix(self.planes[0].group.children[1])
						updateMatrix(self.planes[1].group.children[1])
					},
				})
				break;

			default:
				break;
		}
	}
}