import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

window.THREE = THREE
// Destructure here to avoid use of THREE namespace
const {
	WebGLRenderer, Scene, Object3D,
	PerspectiveCamera, Group,
	Vector3, Vector2, AxesHelper, FogExp2,
	CameraHelper, Fog, Color,
	GridHelper, SphereGeometry, Clock,
	Mesh, MeshPhongMaterial, MeshBasicMaterial,
	DirectionalLight, AmbientLight, TextureLoader,
	BufferGeometry, CatmullRomCurve3, PlaneGeometry,
	PlaneBufferGeometry, Plane, Ray
} = THREE

import gsap from 'gsap'
import Stats from 'stats.js'
import NProgress from 'nprogress'

import PlaneMesh from '@/js/PlaneMesh'
import Chart from '@/js/Chart'
import CryptoIcons from '@/js/CryptoIcons'
import Streaks from '@/js/Streaks'
import Globe, { globePoints } from '@/js/Globe'
import Helix from '@/js/Helix'
import Anubis from '@/js/Anubis'
import NeuralNet from '@/js/NeuralNet'
import CoinVortex from '@/js/CoinVortex'
import SceneMarkers from '@/js/SceneMarkers'
import { landAt } from '@/js/landMask'
import GUI from '@/js/utils/gui'
import Palette from '@/js/utils/palette'
import { l, cl, updateMatrix } from '@/js/utils/helpers'

// Per-dot ease for every morph (lattice, globe, helix, bust, network, coin, menu jumps): a small back-swing as a dot
// sets off and a small overshoot as it arrives, so it settles rather than stopping dead
const morphEase = gsap.parseEase('back.inOut(1.7)') // 1.7: about 5% swing each end; lower for less

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
				rotation: [0, 0, 0],
				position: [0, -275, 700]
			},
		]

		// Single chart shown in section 2 (see Chart.js), fitted to the screen in layoutChart(). Its plane is also where the dots settle.
		this.chart = new Chart()
		this.chartPose = { position: [0, -275, -200], rotation: [.05, -.3, 0] }
		this.clock = new Clock()
		this.pointer = { x: 0, y: 0, active: false } // cursor in -1..1 (used by the hero icons and the sphere); active once it has moved, until it leaves

		// Section-2 dot morph state (see initDotMorph / morphDots)
		this.dots = {
			p: 0, duration: 1.5, maxDelay: .4, pairs: [], delays: null,
			// Sphere state: dots blend from the chart lattice into a slowly rotating sphere (s = 0 lattice, 1 sphere)
			sphere: {
				s: 0, duration: 2.2, angle: 0, speed: .15, tilt: .35, radius: 280, center: [0, -275, -250],
				// Magnet: dots near the cursor are pulled radially outward. reach = influence radius, lift = how far out at the centre of it
				magnet: { reach: 130, lift: 22.5, k: 0, seeded: false, p: new Vector3() }
			}
		}

		// First section
		this.currentSection = 'section1'

		this.materialArr = []
		this.meshArr = []
		this.tls = {
			section1: {},
			section2: { tweens: [] },
			sphere: {},
			chart: {},
			helix: {},
			anubis: {},
			neural: {},
			coin: {},
			section3: { tweens: [] },
		}

		// Mouse
		this.mouse = { x: 0, y: 0 }

		// FPS panel: made here rather than in initGUI so render() can always use it, even if setup after init() fails
		this.stats = new Stats()
		this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
	}
	init(){
		NProgress.start()
		this.initScene()
		this.addHero()
		// this.initGUI()
		this.addObjects()
		this.initDotMorph()
		this.addGlobe()
		this.addHelix()
		this.addAnubisBust()
		this.addLaterShapes()
		this.layoutChart()
		;[ 'section1', 'section2', 'sphere', 'chart', 'helix', 'anubis', 'neural', 'coin' ].forEach(s => this.createTls(s))
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
		renderer.localClippingEnabled = true // used by the chart to clip at the plot edges
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
			orbitCamera, sceneCamera, this.chart.group,
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

		this.gui = gui
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
			gr.visible = false // only the old section-3 scene (switched off) used this copy; the bust now comes from Anubis.js
			scene.add(gr)

			const modelVertices = []
			const loader = new GLTFLoader().setPath("/assets/models/anubis_bust/")
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
				NProgress.done()
				new gsap.timeline({
					onComplete: () => {
						gsap.set("body", { overflowY: "auto", overflowX: "hidden" })
						gsap.set(".loader", { display: "none" })
					}
				})
				.to(".loader", { duration: 1.5, opacity: 0 })
			})
	  }

		// PLANES UP, DOWN & AUXILIARY
		addPlanes()
		// FOG
		addFog()
		// ANUBIS MODEL
		addAnubis()
	}
	createTls(section){
		// Common Vars
		const {
			scene, sceneCamera,
			planes, meshArr,
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
						this.morphDots(0)
						this.morphSphere(0)
						this.morphHelix(0)
						this.leaveAnubis()
						this.leaveLater()
						this.chart.animateOut()
						this.icons.animateIn()
						this.streaks.animateIn()
						tls["section2"].tweens.forEach(t => t.progress(0).pause())
					},
					onComplete: () => {
						tls["section2"].tl.seek(0).pause()
					}
				})

				{
					let [x, y, z] = cameraTransforms[0].position

					tl.set([
						planes[0].plane,
						planes[2].plane
					],  { visible: true })

					tl
						.to(sceneCamera.position, {
							duration, x, y, z,
						}, 'lb0')
						.to(planes[0].plane.material, {
							duration, opacity: .3,
						}, 'lb0')
						.to(planes[0].plane.position, {
							duration, z: 0,
						}, 'lb0')
						.to(planes[1].plane.material, {
							duration, opacity: .3,
						}, 'lb0')
						.to(planes[1].plane.position, {
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

				tls["section1"].tl = tl
				break;

			case 'section2': // Section 2 animation
				// eslint-disable-next-line no-case-declarations
				const tl2 = new gsap.timeline({
					paused: true,
					onStart: () => {
						this.morphDots(1)
						this.icons.animateOut()
						this.streaks.animateOut()
						planes.forEach(plane => plane.animateWave('stop'))
						this.chart.animateIn()
						tls["section2"].tweens.forEach(t => t.play())
					},
					onComplete: () => {
						tls["section1"].tl.seek(0).pause()
						tls["section3"].tl?.seek(0).pause()
					}
				})

				{
					let [x, y, z] = cameraTransforms[1].position

					tl2
						.to(sceneCamera.position, {
							duration, x, y, z,
						}, 'lb0')
						.to(planes[0].plane.material, {
							duration, opacity: .1 * 0,
						}, 'lb0')
						.to(planes[0].plane.position, {
							duration, z: -500,
						}, 'lb0')
						.to(planes[1].plane.material, {
							duration, opacity: 0,
						}, 'lb0')
						.to(planes[1].plane.position, {
							duration, y: '-=' + 500,
						}, 'lb0')
						.to(planes[2].plane.material, {
							duration, opacity: .1 * 0,
						}, 'lb0')
						.to(planes[2].particles.material, {
							duration, opacity: 0,
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

				tl2.set([
					planes[0].plane,
					planes[2].plane
				],  { visible: false })

				tls["section2"].tl = tl2
				break;

			case 'sphere': // Leaving the live pulse section: everything chart-related goes, the dots become a rotating sphere
				// eslint-disable-next-line no-case-declarations
				const tl4 = new gsap.timeline({
					paused: true,
					onStart: () => {
						this.chart.animateOut() // candles, lines, labels, the note box
						this.morphSphere(1)
						this.morphHelix(0) // coming back up from the helix
						this.leaveAnubis()
						this.leaveLater()
					},
					// nothing here animates properties, so it is safe to rewind and play again on the next visit
					onComplete: () => tl4.seek(0).pause()
				})
				tl4.to({}, { duration: .5 })

				tls["sphere"].tl = tl4
				break;

			case 'chart': // Scrolling back up into the live pulse section: the chart draws in again, the sphere dissolves back to the lattice
				// eslint-disable-next-line no-case-declarations
				const tl5 = new gsap.timeline({
					paused: true,
					onStart: () => {
						this.chart.animateIn()
						this.morphSphere(0)
						this.morphHelix(0)
						this.leaveAnubis()
						this.leaveLater()
					},
					onComplete: () => tl5.seek(0).pause()
				})
				tl5.to({}, { duration: .5 })

				tls["chart"].tl = tl5
				break;

			case 'helix': // After the globe: the dots leave it and build the blockchain helix (see Helix.js)
				// eslint-disable-next-line no-case-declarations
				const tl6 = new gsap.timeline({
					paused: true,
					onStart: () => {
						this.morphHelix(1)
						this.leaveAnubis() // coming back up from the bust
						this.leaveLater()
					},
					onComplete: () => tl6.seek(0).pause()
				})
				tl6.to({}, { duration: .5 })

				tls["helix"].tl = tl6
				break;

			case 'anubis': // Below section 3: the dots gather into the Anubis bust, then the real model fades in (see Anubis.js)
				// eslint-disable-next-line no-case-declarations
				const tl7 = new gsap.timeline({
					paused: true,
					onStart: () => {
						// coming back up from the network: the model waits until the dots are back on the bust
						const returning = this.neural.state.s > .05
						this.leaveLater()
						this.anubis.animate(true, returning ? this.neural.state.duration * .9 : 0)
					},
					onComplete: () => tl7.seek(0).pause()
				})
				tl7.to({}, { duration: .5 })

				tls["anubis"].tl = tl7
				break;

			case 'neural': // Below section 4: the bust's model goes and its dots stream into a neural network (see NeuralNet.js)
				// eslint-disable-next-line no-case-declarations
				const tl8 = new gsap.timeline({
					paused: true,
					onStart: () => {
						this.anubis.hideModel()
						if(this.coin.state.s > 0) this.morphShape(this.coin, 0) // coming back up from the coin
						this.morphShape(this.neural, 1)
					},
					onComplete: () => tl8.seek(0).pause()
				})
				tl8.to({}, { duration: .5 })

				tls["neural"].tl = tl8
				break;

			case 'coin': // Below section 5: the dots swirl down into the ANUMYS coin (see CoinVortex.js)
				// eslint-disable-next-line no-case-declarations
				const tl9 = new gsap.timeline({
					paused: true,
					onStart: () => this.morphShape(this.coin, 1),
					onComplete: () => tl9.seek(0).pause()
				})
				tl9.to({}, { duration: .5 })

				tls["coin"].tl = tl9
				break;

			case 'section3': // Section 3 animation
				// eslint-disable-next-line no-case-declarations
				const tl3 = new gsap.timeline({
					paused: true,
					onStart: () => {
						this.chart.animateOut()
						tls["section3"].tweens.forEach(t => t.progress(0).pause())
						tls["section3"].tweens.forEach(t => t.play())
					},
					onComplete: () => {
						tls["section2"].tweens.forEach(t => t.progress(0).pause())
					},
					onReverseComplete: () => {
						planes.forEach(plane => plane.animateWave('stop'))
						this.chart.animateIn()
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

				tl3.to("#ctn-three-bg", {
					duration: .5, opacity: .15
				}, 'lb1')

				tl3.set([
					planes[0].particles,
					planes[2].particles
				], { visible: false })

				tls["section3"].tl = tl3
				tls["section3"].tweens.push(gsap.to(yValue, {
					...repObj, value: "+=20", duration: 4,
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
	initDotMorph(){
		const { planes, dots } = this
			, rows = 25
			// Globe points: ~3/4 of the dots on land (about 3.5 deg apart), the rest sparse over the sea for the outline.
			// Sorted north to south, so lattice rows still flow into latitude bands in order.
			, total = planes[0].plane.userData.vertices.length + planes[1].plane.userData.vertices.length
			, globe = globePoints(total, Math.round(total * .76), landAt)

		// Ceiling and floor dots interleave (even/odd columns) into one dot lattice on the chart plane.
		// Each dot follows the plane vertex with the same index (see PlaneMesh.animateWave), which fixes its column and row.
		dots.pairs = [
			{ plane: planes[0], colOffset: 0, flipRows: true },
			{ plane: planes[1], colOffset: 1, flipRows: false },
		]
		dots.pairs.forEach(pair => {
			const { vertices } = pair.plane.plane.userData
				, xs = vertices.map(v => v.x)
				, zs = vertices.map(v => v.z)
				, minX = Math.min(...xs), spanX = Math.max(...xs) - minX
				, minZ = Math.min(...zs), spanZ = Math.max(...zs) - minZ

			pair.cols = Int16Array.from(vertices, v => Math.round((v.x - minX) / spanX * (rows - 1)) * 2 + pair.colOffset)
			pair.rows = Int16Array.from(vertices, v => {
				const r = Math.round((v.z - minZ) / spanZ * (rows - 1))
				return pair.flipRows ? rows - 1 - r : r
			})
			pair.to = new Float32Array(vertices.length * 3)
			// Sphere point for each dot: rows of the lattice become latitude bands, so the dots flow into the sphere in order
			pair.sph = new Float32Array(vertices.length * 3)
			pair.mag = new Float32Array(vertices.length) // current outward pull of each dot, eased
			pair.land = new Float32Array(vertices.length) // 1 on land, 0 at sea
			pair.k = new Int16Array(vertices.length) // place in the lattice, top row first (shapes that list points top to bottom use it)
			for(let i = 0; i < vertices.length; i++){
				const k = (rows - 1 - pair.rows[i]) * 50 + pair.cols[i]
				pair.k[i] = k
				pair.sph.set(globe.pts.subarray(k * 3, k * 3 + 3), i * 3)
				pair.land[i] = globe.land[k]
			}
			pair.baseCol = pair.plane.particles.geometry.attributes.color.array.slice() // the dots' own tint, restored off the globe
		})
		// Sea dots on the globe: dimmed to about a fifth with a touch of violet, enough to keep the globe's outline
		dots.sea = [.55 * .08, .33 * .08, .91 * .08]
		dots.delays = Float32Array.from(
			{ length: planes[0].plane.userData.vertices.length },
			() => Math.random() * dots.maxDelay
		)
	}

	// Sizes the chart so it fills the screen as seen from the section-2 camera, keeping its tilt.
	layoutChart(){
		const { chart, chartPose, cameraTransforms } = this
			, cam = new PerspectiveCamera(this.sceneCamera.fov, this.w / this.h, 1, 10000)
			, group = chart.group

		cam.position.fromArray(cameraTransforms[1].position)
		cam.updateMatrixWorld(true)

		group.position.fromArray(chartPose.position)
		group.rotation.fromArray(chartPose.rotation)
		group.updateMatrixWorld(true)

		const normal = new Vector3(0, 0, 1).applyQuaternion(group.quaternion)
			, plane = new Plane(normal, -normal.dot(group.position))
			// Where each screen corner lands on the chart plane, in chart-local coordinates
			, corner = (nx, ny) => {
				const dir = new Vector3(nx, ny, .5).unproject(cam).sub(cam.position).normalize()
					, hit = new Ray(cam.position.clone(), dir).intersectPlane(plane, new Vector3())
				return group.worldToLocal(hit)
			}
			// Keep clear of the scroll timeline on the left (#scroll-dots, 50px in): the chart starts after this many pixels
			, leftClear = 80
			, nxL = -1 + 2 * leftClear / this.w
			, tl = corner(nxL, 1), tr = corner(1, 1), bl = corner(nxL, -1), br = corner(1, -1)
			// Largest axis-aligned rectangle inside the visible quad, with a small inset
			, x0 = Math.max(tl.x, bl.x), x1 = Math.min(tr.x, br.x)
			, y0 = Math.max(bl.y, br.y), y1 = Math.min(tl.y, tr.y)
			, inset = .03
			, iw = (x1 - x0) * inset, ih = (y1 - y0) * inset
			, lx0 = x0 + iw, lx1 = x1 - iw, ly0 = y0 + ih, ly1 = y1 - ih
			, cx = (lx0 + lx1) / 2, cy = (ly0 + ly1) / 2

		// Slide the group within its plane so the layout is centred on the local origin
		group.position.add(new Vector3(cx, cy, 0).applyQuaternion(group.quaternion))
		group.updateMatrixWorld(true)

		// A plain rectangle: left/right edges and one bottom and one top height
		const hw = (lx1 - lx0) / 2, hh = (ly1 - ly0) / 2
		chart.setFrame({ xL: -hw, xR: hw, bl: { x: -hw, y: -hh }, br: { x: hw, y: -hh }, tl: { x: -hw, y: hh }, tr: { x: hw, y: hh } })

		chart.updateClip()
		this.updateDotTargets()
	}
	// The dot lattice IS the chart's grid: one column per candle slot (scrolling with the candles) and the same
	// evenly spaced rows the horizontal gridlines sit on, so lines, candles and dots always line up.
	updateDotTargets(dt = 0){
		const { dots, chart } = this
			, { dx, xRight, head, rowsN } = chart
			, cols = 50
			, rowF = (chart.fPlotT - chart.fPlotB) / (rowsN - 1) // rows span the plot area, where the horizontal gridlines sit
			, m = chart.group.matrixWorld.elements

		dots.pairs.forEach(({ cols: c, rows: r, to }) => {
			for(let i = 0; i < c.length; i++){
				const q = (((c[i] + head) % cols) + cols) % cols // slot 0 is the newest candle, moving left as the chart scrolls
					, x = xRight - dx * .5 - q * dx
					, y = chart.Y(x, chart.fPlotB + r[i] * rowF)
					, z = -10 // a little behind the candles
					, j = i * 3

				to[j] = m[0] * x + m[4] * y + m[8] * z + m[12]
				to[j + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
				to[j + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
			}
		})

		// Blend from the chart lattice into a slowly rotating sphere, dot by dot with a random stagger
		const sph = dots.sphere
		sph.angle += dt * sph.speed
		if(sph.s > 0){
			const ease = morphEase
				, span = 1 - dots.maxDelay
				, [cx, cy, cz] = sph.center
				, R = sph.radius
				, ca = Math.cos(sph.angle), sa = Math.sin(sph.angle)
				, ct = Math.cos(sph.tilt), st = Math.sin(sph.tilt)
				, mg = sph.magnet
				, follow = dt > 0 ? 1 - Math.exp(-dt * 9) : 0 // how fast each dot eases toward / away from the cursor
				// towards the camera from the globe centre: dots on the far side are dimmed so its continents don't show through
				, cd = new Vector3().copy(this.currentCamera.position).sub(new Vector3(cx, cy, cz)).normalize()

			if(dt > 0){
				// Where the cursor points on the sphere: the ray hit, or the nearest surface point when the cursor is just off the edge
				const cam = this.currentCamera
					, o = cam.position
					, dir = new Vector3(this.pointer.x, this.pointer.y, .5).unproject(cam).sub(o).normalize()
					, oc = new Vector3(o.x - cx, o.y - cy, o.z - cz)
					, b = oc.dot(dir)
					, disc = b * b - (oc.lengthSq() - R * R)
					, t = disc >= 0 ? -b - Math.sqrt(disc) : -b
					, hit = o.clone().addScaledVector(dir, t)

				hit.set(hit.x - cx, hit.y - cy, hit.z - cz).setLength(R) // relative to the centre, on the surface
				if(!mg.seeded){ mg.p.copy(hit); mg.seeded = true }
				else mg.p.lerp(hit, 1 - Math.exp(-dt * 10))
				mg.k += ((this.pointer.active ? 1 : 0) - mg.k) * (1 - Math.exp(-dt * 5)) // fades in and out with the cursor
			}

			dots.pairs.forEach(({ plane, sph: u, to, mag, land, baseCol }) => {
				const col = plane.particles.geometry.attributes.color
					, c = col.array
					, n = u.length / 3
				for(let i = 0; i < n; i++){
					const j = i * 3
						// spin around the vertical axis, then tip the whole sphere a little toward the viewer
						, x1 = u[j] * ca + u[j + 2] * sa
						, z1 = -u[j] * sa + u[j + 2] * ca
						, y2 = u[j + 1] * ct - z1 * st
						, z2 = u[j + 1] * st + z1 * ct
						, e = ease(Math.min(Math.max((sph.s - dots.delays[i]) / span, 0), 1))
						// distance from this dot (on the surface) to the cursor's point, and the pull that gives
						, dd = Math.hypot(x1 * R - mg.p.x, y2 * R - mg.p.y, z2 * R - mg.p.z)
						, near = Math.min(Math.max(1 - dd / mg.reach, 0), 1)
						, pull = mg.k * mg.lift * near * near * (3 - 2 * near)

					mag[i] += (pull - mag[i]) * follow
					const r = R + mag[i] * e // radially outward, so the surface bulges toward the cursor

					to[j] += (cx + x1 * r - to[j]) * e
					to[j + 1] += (cy + y2 * r - to[j + 1]) * e
					to[j + 2] += (cz + z2 * r - to[j + 2]) * e

					// land keeps its colour, sea fades down as the dot reaches the globe
					const sea = e * (1 - land[i])
						, f = Math.min(Math.max((x1 * cd.x + y2 * cd.y + z2 * cd.z + .15) / .5, 0), 1)
						, back = 1 - e * (1 - (.1 + .9 * f * f * (3 - 2 * f))) // far side down to a tenth
					c[j] = (baseCol[j] + (baseCol[j] * .2 + dots.sea[0] - baseCol[j]) * sea) * back
					c[j + 1] = (baseCol[j + 1] + (baseCol[j + 1] * .2 + dots.sea[1] - baseCol[j + 1]) * sea) * back
					c[j + 2] = (baseCol[j + 2] + (baseCol[j + 2] * .2 + dots.sea[2] - baseCol[j + 2]) * sea) * back
				}
				col.needsUpdate = true
			})
			sph.tinted = true
		} else if(sph.tinted){
			// back to the lattice: put the dots' own colours back
			dots.pairs.forEach(({ plane, baseCol }) => {
				const col = plane.particles.geometry.attributes.color
				col.array.set(baseCol)
				col.needsUpdate = true
			})
			sph.tinted = false
		}

		// Blend on into the blockchain helix, with the same per-dot stagger. Runs on top of whatever is underneath
		// (normally the globe), so leaving the helix reveals the globe again.
		const hs = this.helix.state.s
		if(hs > 0){
			const ease = morphEase
				, span = 1 - dots.maxDelay
				, v = new Vector3()

			dots.pairs.forEach(({ plane, to, baseCol }, p) => {
				const col = plane.particles.geometry.attributes.color
					, c = col.array
					, n = to.length / 3
				for(let i = 0; i < n; i++){
					const t = Math.min(Math.max((hs - dots.delays[i]) / span, 0), 1)
					if(t <= 0) continue
					const e = ease(t)
					const glow = this.helix.dotTarget(p * n + i, v)
						, j = i * 3
					to[j] += (v.x - to[j]) * e
					to[j + 1] += (v.y - to[j + 1]) * e
					to[j + 2] += (v.z - to[j + 2]) * e
					// the dots' own colour (no globe shading), brighter on the fresh block
					c[j] += (baseCol[j] * glow - c[j]) * e
					c[j + 1] += (baseCol[j + 1] * glow - c[j + 1]) * e
					c[j + 2] += (baseCol[j + 2] * glow - c[j + 2]) * e
				}
				col.needsUpdate = true
			})
			sph.tinted = true // so the colours get restored once both are gone
		}

		// Then the later shapes, each on top of the one before: the Anubis bust, the neural network, the coin
		this.blendDots(this.anubis)
		this.blendDots(this.neural)
		this.blendDots(this.coin)
	}
	// Blends every dot onto a shape (anything with state.s, ready and dotTarget(k, out) returning a brightness), with the
	// usual per-dot stagger, over whatever the dots are doing underneath. Dots take the shape's points in lattice order.
	// A shape with swirl winds the dots round its centre on the way in, pulled in towards it like a funnel.
	blendDots(shape){
		const s = shape.state.s
		if(!(s > 0) || !shape.ready) return
		const { dots } = this
			, ease = morphEase
			, span = 1 - dots.maxDelay
			, v = new Vector3()
			, c = shape.center

		dots.pairs.forEach(({ plane, to, baseCol, k }) => {
			const col = plane.particles.geometry.attributes.color
				, cl = col.array
			for(let i = 0; i < k.length; i++){
				const t = Math.min(Math.max((s - dots.delays[i]) / span, 0), 1)
				if(t <= 0) continue
				const e = ease(t)
				const glow = shape.dotTarget(k[i], v) ?? 1
					, j = i * 3
				let x = to[j] + (v.x - to[j]) * e
					, y = to[j + 1] + (v.y - to[j + 1]) * e
				if(shape.swirl){
					const w = Math.sin(Math.PI * e) // 0 at both ends, so the start and end positions are untouched
						, a = shape.swirl * w, f = 1 - .45 * w
						, dx = (x - c.x) * f, dy = (y - c.y) * f
					x = c.x + dx * Math.cos(a) - dy * Math.sin(a)
					y = c.y + dx * Math.sin(a) + dy * Math.cos(a)
				}
				to[j] = x
				to[j + 1] = y
				to[j + 2] += (v.z - to[j + 2]) * e
				cl[j] += (baseCol[j] * glow - cl[j]) * e
				cl[j + 1] += (baseCol[j + 1] * glow - cl[j + 1]) * e
				cl[j + 2] += (baseCol[j + 2] * glow - cl[j + 2]) * e
			}
			col.needsUpdate = true
		})
		dots.sphere.tinted = true // so the dots' own colours are restored once every shape is gone
	}
	addAnubisBust(){
		const count = this.dots.pairs.reduce((n, pair) => n + pair.to.length / 3, 0)
		this.anubis = new Anubis({ count, envMap: this.icons.env })
	}
	addLaterShapes(){
		const count = this.dots.pairs.reduce((n, pair) => n + pair.to.length / 3, 0)
		this.neural = new NeuralNet({ count })
		this.coin = new CoinVortex({ count })
		this.scene.add(this.neural.group)
		this.addSceneLabels()
	}
	// Labels on the helix and the neural network, saying what the shape stands for
	addSceneLabels(){
		const el = document.createElement('div')
		el.id = 'scene-labels'
		this.ctn.appendChild(el)
		this.helixMarks = new SceneMarkers(el, [
			{ title: 'New block', text: '' },
			{ title: 'Chained', text: '' },
			{ title: 'Final', text: '6+ confirmations · immutable' },
		])
		this.neuralMarks = new SceneMarkers(el, [
			{ title: 'Inputs', text: 'price · volume · on-chain flows · sentiment' },
			{ title: 'Hidden layers', text: 'patterns learned from years of market data' },
			{ title: 'Prediction', text: '' },
		])
		this.marks = { block: 847300 + Math.floor(Math.random() * 400), step: -1, predictIn: 0, pos: [0, 1, 2].map(() => new Vector3()) }
	}
	updateSceneLabels(dt){
		const { helix, neural, anubis, coin, marks, currentCamera: cam, w, h } = this
			, formed = s => Math.min(Math.max((s - .85) / .15, 0), 1) // only once the shape has formed
			, hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')

		// helix: a new block number every time the chain steps on
		if(helix.step !== marks.step){
			marks.step = helix.step
			marks.block += 1
			this.helixMarks.setText(0, `#${marks.block.toLocaleString('en-US')} · ${1800 + Math.floor(Math.random() * 1400)} transactions`)
			this.helixMarks.setText(1, `prev hash 0x${hex()}…${hex()}`)
		}
		const ha = formed(helix.state.s) * (1 - anubis.state.s)
		this.helixMarks.update([
			{ pos: helix.slotWorld(.6, 0, marks.pos[0], 26), alpha: ha },
			{ pos: helix.slotWorld(11, 1, marks.pos[1], 26), alpha: ha },
			{ pos: helix.slotWorld(21.4, 0, marks.pos[2], 26), alpha: ha },
		], cam, w, h)

		// neural network: the prediction changes every few seconds
		marks.predictIn -= dt
		if(marks.predictIn <= 0){
			marks.predictIn = 3.5
			const up = Math.random() < .7
			this.neuralMarks.setText(2, `BTC 24h ${up ? '▲' : '▼'} · ${61 + Math.floor(Math.random() * 18)}% confidence`)
		}
		const L = neural.byLayer, na = formed(neural.state.s) * (1 - coin.state.s)
		this.neuralMarks.update([
			{ pos: neural.nodeWorld(L[0][L[0].length - 1], marks.pos[0]), alpha: na },
			{ pos: neural.nodeWorld(L[2][L[2].length - 1], marks.pos[1]), alpha: na },
			{ pos: neural.nodeWorld(L[L.length - 1][0], marks.pos[2]), alpha: na },
		], cam, w, h)
	}
	morphShape(shape, to){
		const { state } = shape
		gsap.to(state, { s: to, duration: state.duration, ease: "none", overwrite: true })
	}
	// back up the page past the later shapes: send the dots back out of them
	leaveLater(){
		;[this.neural, this.coin].forEach(shape => { if(shape.state.s > 0) this.morphShape(shape, 0) })
	}
	leaveAnubis(){
		const { state } = this.anubis
		if(state.s > 0 || state.model > 0) this.anubis.animate(false)
	}
	addHelix(){
		const count = this.dots.pairs.reduce((n, pair) => n + pair.to.length / 3, 0)
		const [cx, cy, cz] = this.dots.sphere.center
		// shifted left / down from the globe centre because the tilt brings the right end nearer the camera (fits about +-0.75 of the screen width)
		this.helix = new Helix({ count, center: [cx - 80, cy - 20, cz], halfLength: 480 })
		this.scene.add(this.helix.lines)
	}
	morphHelix(to){
		const { state } = this.helix
		gsap.to(state, { s: to, duration: state.duration, ease: "none", overwrite: true })
	}
	// Transaction arcs, landing pings and block labels on the dot globe (see Globe.js)
	addGlobe(){
		const labelsEl = document.createElement('div')
		labelsEl.id = 'globe-labels'
		this.ctn.appendChild(labelsEl)
		this.globe = new Globe({ radius: this.dots.sphere.radius, labelsEl })
		this.scene.add(this.globe.group)
	}

	morphSphere(to){
		const { sphere } = this.dots

		// Forming from scratch: turn the globe so it has Europe / Africa (about 15 deg E) facing the camera by the time it
		// has formed, rather than whatever side the free-running spin happens to be on (often the Pacific).
		// Longitude L faces the camera at angle -L; the spin keeps going during the ~70% of the morph it takes to settle.
		if(to > 0 && sphere.s < .05){
			const facing = 15 * Math.PI / 180
			sphere.angle = -facing - sphere.speed * sphere.duration * .7
		}

		gsap.to(sphere, { s: to, duration: sphere.duration, ease: "none", overwrite: true })
	}
	morphDots(to){
		const { dots } = this

		if(to > 0) dots.pairs.forEach(({ plane }) => { plane.dotsLocked = true })

		gsap.to(dots, {
			p: to,
			duration: dots.duration,
			ease: "none",
			overwrite: true,
			onComplete: () => {
				if(to === 0) dots.pairs.forEach(({ plane }) => { plane.dotsLocked = false })
			}
		})
	}
	applyDotMorph(){
		const { dots, jump } = this
			, ease = morphEase
			, span = 1 - dots.maxDelay

		dots.pairs.forEach(({ plane, to }, p) => {
			const pos = plane.particles.geometry.attributes.position
				, from = plane.waveDots // live in section 1, frozen once the wave stops
				, snap = jump?.snap[p]

			for(let i = 0; i < pos.count; i++){
				const e = ease(Math.min(Math.max((dots.p - dots.delays[i]) / span, 0), 1))
					, j = i * 3
				let x = from[j] + (to[j] - from[j]) * e
					, y = from[j + 1] + (to[j + 1] - from[j + 1]) * e
					, z = from[j + 2] + (to[j + 2] - from[j + 2]) * e

				if(snap){
					// menu jump: from where the dot was when it started, straight to where the new scene wants it
					const k = ease(Math.min(Math.max((jump.k - dots.delays[i]) / span, 0), 1))
					x = snap[j] + (x - snap[j]) * k
					y = snap[j + 1] + (y - snap[j + 1]) * k
					z = snap[j + 2] + (z - snap[j + 2]) * k
				}
				pos.setXYZ(i, x, y, z)
			}
			pos.needsUpdate = true
		})
	}
	// Menu jumps: the page glides past several scenes at once, so rather than starting (and interrupting) each one on the
	// way, everything is set straight to the destination scene and each dot travels once, from where it is now to where
	// that scene wants it. Normal scrolling still steps through the scenes one by one.
	jumpTo(dest, duration = 2.4){
		const order = [ 'section1', 'section2', 'sphere', 'helix', 'anubis', 'neural', 'coin' ]
			, d = order.indexOf(dest)
			, from = this.currentSection === 'chart' ? 'section2' : this.currentSection
		if(d < 0 || dest === from) return
		const { dots, tls } = this
			, on = name => d >= order.indexOf(name) ? 1 : 0

		// where every dot is right now
		const snap = dots.pairs.map(({ plane }) => plane.particles.geometry.attributes.position.array.slice())

		// crossing between the hero and the rest also moves the camera, the wave planes and the fog: play that part as usual
		if(from === 'section1') tls.section2.tl.play()
		if(dest === 'section1') tls.section1.tl.play()
		this.currentSection = dest

		// a moment later (after those timelines' own start-up), put every scene's state straight to the destination's
		gsap.delayedCall(.05, () => {
			const sph = dots.sphere
			gsap.killTweensOf([ dots, sph, this.helix.state, this.anubis.state, this.neural.state, this.coin.state ])
			this.anubis.tl?.kill()

			if(on('sphere') && sph.s < .05) sph.angle = -15 * Math.PI / 180 // the same opening view as forming it normally
			dots.p = on('section2')
			sph.s = on('sphere')
			this.helix.state.s = on('helix')
			this.anubis.state.s = on('anubis')
			this.anubis.state.model = 0
			this.neural.state.s = on('neural')
			this.coin.state.s = on('coin')
			dots.pairs.forEach(({ plane }) => { plane.dotsLocked = true })

			if(dest === 'section2') this.chart.animateIn()
			else this.chart.animateOut()
			if(dest === 'section1'){ this.icons.animateIn(); this.streaks.animateIn() }
			else { this.icons.animateOut(); this.streaks.animateOut() }
			if(dest === 'anubis') this.anubis.animate(true, duration) // the real bust once the dots have arrived

			this.jump = { k: 0, snap }
			gsap.to(this.jump, {
				k: 1, duration, ease: "none",
				onComplete: () => {
					this.jump = null
					if(dest === 'section1') dots.pairs.forEach(({ plane }) => { plane.dotsLocked = false }) // back to the live waves
				}
			})
		})
	}
	// Hero (section 1): 3D bitcoin/ether icons on the right and shooting streaks between the planes
	addHero(){
		const { renderer, scene, sceneCamera } = this

		this.icons = new CryptoIcons(renderer)
		this.icons.layout(this.w / this.h, sceneCamera.fov)
		this.streaks = new Streaks({ enabled: false }) // set enabled: true to bring the comets back
		scene.add(this.streaks.mesh)
		
		// The icons get their own scene, drawn in a second pass after a depth clear. That way the wave planes and their dots
		// can never draw across them, e.g. when they scroll up through the ceiling plane, while they still depth-sort correctly
		// among themselves. The pass needs its own copy of the lights.
		this.iconScene = new Scene()
		this.iconScene.add(new AmbientLight(0xffffff, .2), this.icons.group)
		; [this.spotLight1, this.spotLight2, this.spotLight3].forEach(l => {
			const copy = new DirectionalLight(l.color, l.intensity)
			copy.position.copy(l.position)
			this.iconScene.add(copy)
		})
	}
	setCameraForScene(idx) {
		this.sceneCamera.position.fromArray(this.cameraTransforms[idx - 1].position)
		this.sceneCamera.rotation.fromArray(this.cameraTransforms[idx - 1].rotation)
	}
	render(){
		const { stats, currentSection, planes } = this
		try{
			stats.begin()

			if(currentSection === 'section1'){
				planes.forEach(plane => plane.animateWave('start'))
			}

			const dt = Math.min(this.clock.getDelta(), .1)
			this.chart.update(dt)
			this.streaks.update(dt)
			this.icons.update(dt, this.pointer, this.iconScroll())

			this.helix.update(dt, 1 - this.anubis.state.s) // its links fade as the dots leave for the bust
			this.anubis.update(this.pointer, dt)
			this.neural.update(dt, { fade: 1 - this.coin.state.s, pointer: this.pointer, camera: this.currentCamera }) // its links go as the coin forms
			this.coin.update(dt, this.pointer)
			this.updateSceneLabels(dt)
			// the dots dim once the real bust is in, so it isn't covered in sparkles (opacity keeps the additive glow see-through)
			const dim = 1 - .85 * this.anubis.state.model
			this.dots.pairs.forEach(({ plane }) => { plane.particles.material.opacity = dim })
			// after the chart has scrolled, so the dots stay locked to its grid this frame
			if(this.dots.pairs[0]?.plane.dotsLocked){
				this.updateDotTargets(dt)
				this.applyDotMorph()
			}
			const sph = this.dots.sphere
			this.globe.update(dt, {
				on: sph.s > .75 && this.helix.state.s < .02, // arcs while the globe is still settling; they fade when it dissolves or the helix starts
				center: sph.center, angle: sph.angle, tilt: sph.tilt,
				camera: this.currentCamera, w: this.w, h: this.h,
			})

			const { renderer, scene, iconScene, currentCamera } = this
			renderer.render(scene, currentCamera)
			renderer.autoClear = false
			renderer.clearDepth()
			renderer.render(iconScene, currentCamera)
			if(this.anubis.group.visible) renderer.render(this.anubis.scene, currentCamera)
			renderer.autoClear = true

			stats.end()
		} catch (err){
			l(err)
			gsap.ticker.remove(this.renderFn) // stop after the first error instead of logging it every frame
		}
	}
	// How far the hero icons follow the page up: they hold still until the hero text on the left has scrolled away,
	// then move with the page. A short ease (k) rounds off the start so they don't jerk into motion.
	iconScroll(){
		const y = this.smoother ? this.smoother.scrollTop() : window.scrollY
		if(this.iconHold == null){
			const text = document.querySelector('#section1 .col-7')
			// the scroll at which the text's bottom is 10% from the top of the screen
			this.iconHold = text ? Math.max(0, text.getBoundingClientRect().bottom + y - this.h * .1) : 0
		}
		const d = y - this.iconHold, k = 150
		if(d <= 0) return 0
		return d < k ? d * d / (2 * k) : d - k / 2
	}
	resize(){
		const { ctn, currentCamera, renderer } = this
			, w = ctn.offsetWidth
			, h = ctn.offsetHeight

		currentCamera.aspect = w / h
		currentCamera.updateProjectionMatrix()

		renderer.setSize(w, h)
		
		this.w = w
		this.h = h
		this.layoutChart()
		this.icons.layout(w / h, currentCamera.fov)
		this.iconHold = null // measured again on the next frame
		
		l("[Scene Resized]")
	}
	onMouseMove(event){
		this.pointer.active = true
		this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1
		this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
	
		if(this.currentSection !== "section3") return

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
		this.renderFn = this.render.bind(this)
		gsap.ticker.add(this.renderFn)
		window.addEventListener("resize", this.resize.bind(this), false)
		document.addEventListener('mousemove', this.onMouseMove.bind(this), false)
		document.addEventListener('mouseleave', () => { this.pointer.active = false }, false)
	}
	animateToSection(section){
		l("Prev ->", this.currentSection, ", Next ->", section)
		this.tls[section].tl.play()

		// switch(section){
		// 	case 'section1': tls["section1"].tl.play(); break;
		//
		// 	case 'section2': tls["section2"].tl.play(); break;
		//
		// 	case 'section3': tls["section3"].tl.play(); break;
		//
		// 	default: break;
		// }

		this.currentSection = section
	}
}