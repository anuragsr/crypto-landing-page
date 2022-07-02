import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshLine, MeshLineMaterial } from "@quatrefoil/meshline"

window.THREE = THREE
// Destructure here to avoid use of THREE namespace
const {
	WebGLRenderer, Scene, Object3D,
	PerspectiveCamera, Group,
	Vector3, Vector2, AxesHelper, FogExp2,
	CameraHelper, Fog, Color,
	GridHelper, SphereGeometry,
	Mesh, MeshPhongMaterial, MeshBasicMaterial,
	DirectionalLight, AmbientLight,
	BufferGeometry, CatmullRomCurve3, PlaneGeometry
} = THREE

import gsap from 'gsap'
import Stats from 'stats.js'

import PlaneMesh from '@/js/PlaneMesh'
import GUI from '@/js/utils/gui'
import Palette from '@/js/utils/palette'
import { l, cl, updateMatrix, randomNum, randomInt } from '@/js/utils/helpers'

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

		// Third spotlight for anubis bust
		this.spotLightMesh3 = this.createMesh(
			new SphereGeometry(5, 50, 50, 0, Math.PI * 2, 0, Math.PI * 2),
			new MeshPhongMaterial({ color: 0xffff00 })
		)
		this.spotLight3 = new DirectionalLight(0xffffff, 3)
		this.lightPos3 = new Vector3(500, -650, 100)

		// Planes data
		const distFromCenter = 200
		this.planeUpDefaults = {
			dotColor: Palette.DOTS,
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
			dotColor: Palette.DOTS,
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

		// First section
		this.currentSection = 'section1'

		// Mesh lines
		this.meshLines = []
		this.meshLineMeshes = []
		this.volMeshArr = []
		this.materialArr = []
		this.meshArr = []
		this.tls = {
			section1: {},
			section2: { tweens: [] },
			section3: { tweens: [] },
		}

		// Mouse
		this.mouse = { x: 0, y: 0 }
	}
	init(){
		this.initScene()
		// this.initGUI()
		this.addObjects();
		[
			'section1',
			'section2'
		].forEach(s => this.createTls(s))
		this.addListeners()
	}
	initScene(){
		const {
			ctn, w, h, orbitCamera, scene, renderer,
			cameraTransforms, origin, sceneCamera,
			spotLightMesh1, spotLight1, lightPos1,
			spotLightMesh2, spotLight2, lightPos2,
			spotLightMesh3, spotLight3, lightPos3,
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

		spotLightMesh3.position.copy(lightPos3)
		spotLight3.position.copy(lightPos3)

		scene.add(
			orbitCamera, sceneCamera,
			new AmbientLight(0xffffff, .2),
			spotLight1, spotLight2, spotLight3
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
				spotLightMesh1, spotLightMesh2, spotLightMesh3,
				orbitCameraHelper, sceneCameraHelper,
				orbitCamera, cameraTransforms
			} = this
			, i = 5

			switch(param){
				case 'helpers':
					val ?
						scene.add(axesHelper, gridHelper, orbitCameraHelper, sceneCameraHelper, spotLightMesh1, spotLightMesh2, spotLightMesh3)
						:
						scene.remove(axesHelper, gridHelper, orbitCameraHelper, sceneCameraHelper, spotLightMesh1, spotLightMesh2, spotLightMesh3)
					break;

				case 'fog':
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
		// f.add(params, 'resetCamera').onChange(() => toggleGUIParam('resetCamera'))
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

				// this.shouldAnimateWave = true
				this.planes = [planeUp, planeDown, planeBack]
				this.planes.forEach(plane => {
					this.scene.add(plane.group)
					// plane.animateWave('start')
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
				scene.add(gr)

				const modelVertices = []
				const loader = new GLTFLoader().setPath("assets/models/anubis_bust/")
				loader.load('scene.gltf', gltf => {
					const modelGraph = gltf.scene
					gr.add(modelGraph)

					const newMaterial = new THREE.MeshBasicMaterial({
						color: 0xff0000,
						wireframe: true,
						transparent: true,
						opacity: 0.1
					});

					modelGraph.traverse((o) => {
						if (o.isMesh) {
							// o.material = newMaterial // For debugging particles

							o.material.transparent = true
							o.material.opacity = 0
							this.meshArr.push(o)
							this.materialArr.push(o.material)

							o.scale.multiplyScalar(200)
							o.position.x-= 50
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

					this.modelVertices = modelVertices
					this.createTls('section3')
				})
		  }
			, addGraphLines = () => {
				const meshLinePoints = [
					[
						{ x: -100, y: 200, z: 500 },
						{ x: -50, y: 200, z: 400 },
						{ x: 50, y: 200, z: 300 },
						{ x: 200, y: 200, z: 200 },
						{ x: 100, y: 200, z: 100 },
						{ x: 150, y: 200, z: 0 },
						{ x: 300, y: 200, z: -100 },
						{ x: 200, y: 200, z: -200 },
						{ x: 250, y: 200, z: -300 },
						{ x: 350, y: 200, z: -400 },
						{ x: 150, y: 200, z: -500 },
						{ x: 250, y: 200, z: -600 },
					],
					[
						{ x: 300, y: 200, z: 500 },
						{ x: -150, y: 200, z: 400 },
						{ x: 100, y: 200, z: 300 },
						{ x: 0, y: 200, z: 200 },
						{ x: -50, y: 200, z: 100 },
						{ x: -100, y: 200, z: 0 },
						{ x: 100, y: 200, z: -100 },
						{ x: 50, y: 200, z: -200 },
						{ x: 50, y: 200, z: -400 },
						{ x: 100, y: 200, z: -500 },
						{ x: 50, y: 200, z: -600 },
					],
				]
				, colors = [ Palette.DOTS, Palette.MESH_LIGHT ]

				meshLinePoints.forEach((points, idx) => {
					const geometry = new BufferGeometry().setFromPoints(
						new CatmullRomCurve3( points.map(
							obj => new Vector3(obj.x, obj.y, obj.z)
						)).getPoints(100)
					)
					, line = new MeshLine()
					, material = new MeshLineMaterial({
						color: colors[idx],
						resolution: new Vector2( window.innerWidth, window.innerHeight ),
						sizeAttenuation: true,
						lineWidth: 2,
						transparent: true,
						opacity: .5,
					})

					line.setGeometry( geometry, function( p ) { return 2 + Math.sin( 50 * p ) } );
					// line.setDrawRange(0, 650)
					line.setDrawRange(0, 0)

					this.meshLines.push(line)
					const mesh = this.createMesh(line, material)
					this.meshLineMeshes.push(mesh)
					scene.add(mesh)
				})
			}
			, addCandleSticks = () => {
				const candlePoints = [
					{ x: 300, y: 200, z: -600 },
					{ x: 50, y: 100, z: -600 },
					{ x: 150, y: 0, z: -600 },
					{ x: 0, y: -100, z: -600 },
					{ x: 50, y: -200, z: -600 },
					{ x: -50, y: -300, z: -600 },
					{ x: -200, y: -400, z: -600 },
					{ x: 100, y: -500, z: -600 },
				]
				, volVertices = new CatmullRomCurve3( candlePoints.map(
					obj => new Vector3(obj.x, obj.y, obj.z)
				)).getPoints(20)
				, volColors = [0x299645, 0xE11C23]

				// Placing each volume shape on the volume vertices
				volVertices.forEach(obj => {
					const pgroup = new Object3D()
						, currColor = new Color(volColors[randomInt(0, 1)])
						, plane = this.createMesh(
							new PlaneGeometry( 2, 200 ),
							new MeshBasicMaterial({ color: currColor, transparent: true, opacity: 0 })
						)
						, plane2 = this.createMesh(
							new PlaneGeometry( 15, 120 ),
							new MeshBasicMaterial({ color: currColor, transparent: true, opacity: 0 })
						)
						, currScale = randomNum(.3, .8)

					plane.scale.y = currScale
					plane2.scale.y = currScale
					plane.visible = false
					plane2.visible = false

					// Creating single planes for volume
					pgroup.add(plane, plane2)

					pgroup.position.x = obj.x
					pgroup.position.y = obj.y
					pgroup.position.z = obj.z
					pgroup.rotation.z = Math.PI/2

					this.volMeshArr.push(pgroup)
					scene.add(pgroup)
				})
			}

		// PLANES UP, DOWN & AUXILIARY
		addPlanes()
		// FOG
		addFog()
		// ANUBIS MODEL
		addAnubis()
		// GRAPH LINES
    addGraphLines()
		// CANDLE STICK, VOLUME
    addCandleSticks()
	}
	createTls(section){
		// Common Vars
		const {
			scene, sceneCamera, meshLineMeshes,
			planes, meshLines, volMeshArr, meshArr,
			cameraTransforms, materialArr, tls
		} = this
		, duration = 1
		, fog = { value: 0 }
		, repObj = { paused: true, repeat:-1, repeatDelay:1, yoyo:true }

		switch(section){
			case 'section1': // Section 1 animation
				// eslint-disable-next-line no-case-declarations
				const tl = new gsap.timeline({
					paused: true,
					onStart: () => {
						tls["section2"].tweens.forEach(t => t.progress(0).pause())
					},
					onComplete: () => {
						tls["section2"].tl.seek(0).pause()
					}
				})

				{
					let [x, y, z] = cameraTransforms[0].position
						, [rotX, rotY, rotZ] = cameraTransforms[0].rotation

					tl.set([
						planes[0].plane,
						planes[2].plane
					],  { visible: true })

					tl
						.to(sceneCamera.position, {
							duration, x, y, z,
						}, 'lb0')
						.to(sceneCamera.rotation, {
							duration, x: rotX, y: rotY, z: rotZ,
						}, 'lb0')
						.to(planes[0].plane.material, {
							duration, opacity: .3,
						}, 'lb0')
						.to(planes[1].group.position, {
							duration, y: 0,
						}, 'lb0')
						.to(planes[2].plane.material, {
							duration, opacity: 0,
						}, 'lb0')
						.to(planes[2].particles.material, {
							duration, opacity: 0,
						}, 'lb0')
						.fromTo(fog, {
							value: .00025 * 1,
						}, {
							duration, value: .00025 * 5,
							onUpdate: function() {
								scene.fog = new FogExp2(Palette.DARK, fog.value)
							},
						}, 'lb0')
				}

				volMeshArr.forEach((obj, i) => {
					tl.fromTo([
						obj.children[0].material,
						obj.children[1].material
					], { opacity: 1 }, {
						duration, opacity: 0
					}, 'lb0')
				})

				tls["section1"].tl = tl
				break;

			case 'section2': // Section 2 animation
				// eslint-disable-next-line no-case-declarations
				const tl2 = new gsap.timeline({
					paused: true,
					onStart: () => {
						planes.forEach(plane => plane.animateWave('stop'))
						meshLines.forEach(line => line.setDrawRange(0, 0))
						tls["section2"].tweens.forEach(t => t.play())
					},
					onComplete: () => {
						tls["section1"].tl.seek(0).pause()
						tls["section3"].tl?.seek(0).pause()
					}
				})
				, drawRange = { value: 0 }
				, volTween = { duration, ...repObj }

				{
					let [x, y, z] = cameraTransforms[1].position
						, [rotX, rotY, rotZ] = cameraTransforms[1].rotation

					tl2
						.to(sceneCamera.position, {
							duration, x, y, z,
						}, 'lb0')
						.to(sceneCamera.rotation, {
							duration, x: rotX, y: rotY, z: rotZ,
						}, 'lb0')
						.to(planes[0].plane.material, {
							duration, opacity: .1 * 0,
						}, 'lb0')
						.to(planes[0].plane.position, {
							duration, z: -500,
						}, 'lb0')
						.to(planes[1].group.position, {
							duration, y: '-=' + 500,
						}, 'lb0')
						.to(planes[2].plane.material, {
							duration, opacity: .1 * 0,
						}, 'lb0')
						.to(planes[2].particles.material, {
							duration, opacity: 1,
						}, 'lb0')
						.fromTo(fog, {
							value: .00025 * 5
						},{
							duration, value: .00025 * 1,
							onUpdate: function() {
								scene.fog = new FogExp2(Palette.DARK, fog.value)
							},
						}, 'lb0')
				}

				tls["section2"].tweens.push(gsap.to(drawRange, {
					...repObj, value: 650, duration: 5,
					onUpdate: () => {
						meshLines.forEach(l => l.setDrawRange(0, drawRange.value))
					}
				}))
				volMeshArr.forEach((obj, i) => {
					tl2.set([
						obj.children[0],
						obj.children[1]
					],  { visible: true }, 'lb0')

					tl2.fromTo([
						obj.children[0].material,
						obj.children[1].material
					], { opacity: 0 }, {
						duration, opacity: 1
					}, 'lb0')

					tls["section2"].tweens.push(
						gsap.to(obj.children[1].scale, {
							...volTween, delay: i*0.02, y:"-=0.5"
						}),
						gsap.to(obj.children[0].position, {
							...volTween, delay: i*0.04, y:"-=100"
						}),
						gsap.to(obj.children[1].position, {
							...volTween, delay: i*0.06, y:"-=50"
						})
					)
				})

				tl2.set([
					planes[0].plane,
					planes[2].plane
				],  { visible: false })

				tls["section2"].tl = tl2
				break;

			case 'section3': // Section 3 animation
				// eslint-disable-next-line no-case-declarations
				const tl3 = new gsap.timeline({
					paused: true,
					onStart: () => {
						tls["section3"].tweens.forEach(t => t.progress(0).pause())
						tls["section3"].tweens.forEach(t => t.play())
					},
					onComplete: () => {
						tls["section2"].tweens.forEach(t => t.progress(0).pause())
					},
					onReverseComplete: () => {
						meshLines.forEach(line => line.setDrawRange(0, 0))
						tls["section2"].tweens.forEach(t => t.play())
						tls["section3"].tweens.forEach(t => t.progress(0).pause())
					}
				})
				, pointsGeo1 = this.planes[0].particles.geometry
				, pointsGeo2 = this.planes[2].particles.geometry
				, vertices1 = this.planes[0].plane.userData.vertices
				, vertices2 = this.planes[2].plane.userData.vertices
				, spacing = 7
				, yValue = { value: 0 }

				vertices1.forEach((vertex, i) => {
					const tempvertex = new Vector3()
					tempvertex.fromBufferAttribute( pointsGeo1.attributes.position, i )

					const initPos = this.planes[0].group.localToWorld( tempvertex )
					const { x, y, z } = this.modelVertices[i*spacing]

					tl3.to(initPos, {
						x, y, z,
						duration,
						delay: .0001 * i,
						onUpdate: function() {
							pointsGeo1.attributes.position.setXYZ(i, initPos.x, initPos.y, initPos.z)
							pointsGeo1.attributes.position.needsUpdate = true
						},
					}, 'lb0')
				})

				vertices2.forEach((vertex, i) => {
					const tempvertex = new Vector3()
					tempvertex.fromBufferAttribute( pointsGeo2.attributes.position, i )

					const initPos = this.planes[0].group.localToWorld( tempvertex )
					const { x, y, z } = this.modelVertices[this.modelVertices.length - i*spacing - 1]

					tl3.to(initPos, {
						x, y, z,
						duration,
						delay: .0001 * i,
						onUpdate: function() {
							pointsGeo2.attributes.position.setXYZ(i, initPos.x, initPos.y, initPos.z)
							pointsGeo2.attributes.position.needsUpdate = true
						},
					}, 'lb0')
				})

				pointsGeo1.computeVertexNormals()
				pointsGeo2.computeVertexNormals()

				meshLineMeshes.forEach((obj, i) => {
					tl3.fromTo(obj.material, {
						opacity: .5
					}, {
						duration, opacity: 0
					}, 'lb0')

					tl3.set(obj, { visible: false })
				})

				volMeshArr.forEach((obj, i) => {
					tl3.fromTo([
						obj.children[0].material,
						obj.children[1].material
					], { opacity: 1 }, {
						duration, opacity: 0
					}, 'lb0')
				})

				materialArr.forEach((obj, i) => {
					tl3.fromTo(obj, { opacity: 0 }, {
						duration: .2, opacity: 1
					}, 'lb1')
				})

				tl3.fromTo([
					planes[0].particles.material,
					planes[2].particles.material
				], { opacity: 1 }, {
					duration: .2, opacity: 0
				}, 'lb1')

				tl3.set([
					planes[0].particles,
					planes[2].particles
				], { visible: false })

				tls["section3"].tl = tl3
				tls["section3"].tweens.push(gsap.to(yValue, {
					...repObj, value: "+=50", duration: 2,
					delay: 3, repeatDelay: 0, ease: "power2.inOut",
					onUpdate: () => {
						meshArr.forEach(m => m.position.x = yValue.value)
					}
				}))
				break;

			default:
				break;
		}
	}
	setCameraForScene(idx) {
		this.sceneCamera.position.fromArray(this.cameraTransforms[idx - 1].position)
		this.sceneCamera.rotation.fromArray(this.cameraTransforms[idx - 1].rotation)
	}
	render(){
		const { stats, currentSection } = this
		try{
			stats.begin()

			switch(currentSection){
				case 'section1':
					// this.shouldAnimateWave &&
					this.planes.forEach(plane => plane.animateWave('start'))
					break;

				case 'section2':
					break;
			}

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
	onMouseMove(event){
		// Update the mouse variable
		event.preventDefault()
		const { currentCamera, orbitCamera } = this
		this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1
		this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

		// Make the sphere follow the mouse
		const vector = new Vector3(this.mouse.x, this.mouse.y, .5)
		vector.unproject(currentCamera)

		const dir = vector.sub(currentCamera.position).normalize()
			, distance = -currentCamera.position.z / dir.z
			, pos = currentCamera.position.clone().add(dir.multiplyScalar(distance))
			, posVector = new Vector3(pos.x - 500, pos.y - 500, pos.z + 500)

		this.spotLightMesh3.position.copy(posVector)
		this.spotLight3.position.copy(posVector)
	}
	addListeners(){
		gsap.ticker.add(this.render.bind(this))
		window.addEventListener("resize", this.resize.bind(this), false)
		document.addEventListener('mousemove', this.onMouseMove.bind(this), false)
	}
	animateToSection(section){
		l("Prev ->", this.currentSection, ", Next ->", section)
		const { tls } = this

		switch(section){
			case 'section1': tls["section1"].tl.play(); break;

			case 'section2': tls["section2"].tl.play(); break;

			case 'section3': tls["section3"].tl.play(); break;

			default:
				break;
		}

		this.currentSection = section
	}
}