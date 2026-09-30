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
		this.chart = new Chart({ note: document.querySelector('#chart-note') })
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
				magnet: { reach: 130, lift: 90, k: 0, seeded: false, p: new Vector3() }
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
			section3: { tweens: [] },
		}

		// Mouse
		this.mouse = { x: 0, y: 0 }
	}
	init(){
		NProgress.start()
		this.initScene()
		this.addHero()
		// this.initGUI()
		this.addObjects()
		this.initDotMorph()
		this.layoutChart()
		;[ 'section1', 'section2', 'sphere', 'chart' ].forEach(s => this.createTls(s))
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
					},
					onComplete: () => tl5.seek(0).pause()
				})
				tl5.to({}, { duration: .5 })

				tls["chart"].tl = tl5
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
			for(let i = 0; i < vertices.length; i++){
				const k = (rows - 1 - pair.rows[i]) * 50 + pair.cols[i]
					, y = 1 - 2 * (k + .5) / (rows * 50)
					, ring = Math.sqrt(1 - y * y)
					, a = k * 2.399963229728653 // golden angle
				pair.sph[i * 3] = Math.cos(a) * ring
				pair.sph[i * 3 + 1] = y
				pair.sph[i * 3 + 2] = Math.sin(a) * ring
			}
		})
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
			, tl = corner(-1, 1), tr = corner(1, 1), bl = corner(-1, -1), br = corner(1, -1)
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
			const ease = gsap.parseEase("power2.inOut")
				, span = 1 - dots.maxDelay
				, [cx, cy, cz] = sph.center
				, R = sph.radius
				, ca = Math.cos(sph.angle), sa = Math.sin(sph.angle)
				, ct = Math.cos(sph.tilt), st = Math.sin(sph.tilt)
				, mg = sph.magnet
				, follow = dt > 0 ? 1 - Math.exp(-dt * 9) : 0 // how fast each dot eases toward / away from the cursor

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

			dots.pairs.forEach(({ sph: u, to, mag }) => {
				for(let i = 0; i < u.length / 3; i++){
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
				}
			})
		}
	}

	morphSphere(to){
		const { sphere } = this.dots

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
		const { dots } = this
			, ease = gsap.parseEase("power2.inOut")
			, span = 1 - dots.maxDelay

		dots.pairs.forEach(({ plane, to }) => {
			const pos = plane.particles.geometry.attributes.position
				, from = plane.waveDots // live in section 1, frozen once the wave stops

			for(let i = 0; i < pos.count; i++){
				const e = ease(Math.min(Math.max((dots.p - dots.delays[i]) / span, 0), 1))
					, j = i * 3

				pos.setXYZ(
					i,
					from[j] + (to[j] - from[j]) * e,
					from[j + 1] + (to[j + 1] - from[j + 1]) * e,
					from[j + 2] + (to[j + 2] - from[j + 2]) * e
				)
			}
			pos.needsUpdate = true
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
			this.icons.update(dt, this.pointer, this.smoother ? this.smoother.scrollTop() : window.scrollY)

			// after the chart has scrolled, so the dots stay locked to its grid this frame
			if(this.dots.pairs[0]?.plane.dotsLocked){
				this.updateDotTargets(dt)
				this.applyDotMorph()
			}

			const { renderer, scene, iconScene, currentCamera } = this
			renderer.render(scene, currentCamera)
			renderer.autoClear = false
			renderer.clearDepth()
			renderer.render(iconScene, currentCamera)
			renderer.autoClear = true

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
		
		this.w = w
		this.h = h
		this.layoutChart()
		this.icons.layout(w / h, currentCamera.fov)
		
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
		gsap.ticker.add(this.render.bind(this))
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