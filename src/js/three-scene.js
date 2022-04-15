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
		// Initialize the scene
		this.initScene()
		this.initGUI()
		this.toggleGUIParam('helpers', !1)
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
	initGUI() {
		const guiObj = new GUI()
			, gui = guiObj.gui
			, params = guiObj.getParams(this.currMesh)
			, he = gui.add(params, 'helpers')
			, st = gui.add(params, 'stats')
			, fg = gui.add(params, 'fog')
			, aw = gui.add(params, 'animateWave')
			, ap = gui.add(params, 'animatePlane')
			, rc = gui.add(params, 'resetCamera')

		he.onChange(v => this.toggleGUIParam('helpers', v))
		st.onChange(v => this.toggleGUIParam('stats', v))
		fg.onChange(v => this.toggleGUIParam('fog', v))
		aw.onChange(v => this.toggleGUIParam('animateWave', v))
		ap.onChange(() => this.toggleGUIParam('animatePlane'))
		rc.onChange(() => this.toggleGUIParam('resetCamera'))

		gui.add(params, 'getState')
		this.guiObj = guiObj
	}
	toggleGUIParam(param, val){
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

			case 'animateWave':
				this.shouldAnimateWave = val
				break;

			case 'animatePlane':
				const plane = this.planes[0]
					, { position, rotation, scale } = plane
					, self = this
				// gsap.to(this.planes[0].position, {z: "+=100", duration: 1})
				// gsap.to(this.planes[0].rotation, {x: -Math.PI/2, duration: 1})
				// gsap.to(position, {
				// 	z: "+=100", duration: 1,
				// 	onComplete: function(){
				// 		// self.updateTransform(plane)
				// 		// l(this)
				// 		// const planeGeo = plane.geometry
				// 		// 	, pos = planeGeo.attributes.position
				// 		// 	, { vertices, distFromCenter } = plane.userData
				// 		//
				// 		// for(let i = 0; i < pos.count; i++){
				// 		// 	const vertex = new Vector3().fromBufferAttribute(pos, i)
				// 		// 	plane.userData.dots[i].position.set(vertex.x, vertex.y, vertex.z)
				// 		//
				// 		// 	// , dot = createMesh(
				// 		// 	// 	new SphereGeometry(1, 10, 10, 0, Math.PI * 2, 0, Math.PI * 2),
				// 		// 	// 	new MeshPhongMaterial({ color: 0xffff00 })
				// 		// 	// )
				// 		// 	//
				// 		// 	// vertex.y = Math.random() * vertexHeight - vertexHeight
				// 		// 	// vertex._myZ = vertex.y
				// 		// 	//
				// 		// 	// dot.position.copy(vertex)
				// 		// 	// scene.add(dot)
				// 		// 	//
				// 		// 	// plane.userData.vertices.push(vertex)
				// 		// 	// plane.userData.dots.push(dot)
				// 		// }
				// 		// // vertices.forEach((vertex, i) => {
				// 		// // 	// vertex.y = Math.sin(( i + count * 0.0002)) * (vertex._myZ - (vertex._myZ* 0.6))
				// 		// // 	// planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + distFromCenter, vertex.z)
				// 		// // 	plane.userData.dots[i].position.set(vertex.x, vertex.y, vertex.z)
				// 		// // 	// count += 0.1
				// 		// // })
				// 	}
				// })
				// gsap.to(rotation, {x: "+=" + Math.PI/2, duration: 1})
				// gsap.to(scale, {y: 2, duration: 1})
				gsap.to(this.group.rotation, {x: "+=" + Math.PI/2, duration: 1})
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
		const {
			scene, renderer, camera,
			updateTransform, createMesh,
			animateWave
		} = this
		, distFromCenter = 200
		, planeDefinition = 24
		, planeSize = 1200
		, meshColor = "#005e97"
		, planeMaterial = new MeshBasicMaterial({
			color: meshColor,
			wireframe: true,
			transparent: true,
			opacity: .3,
		})
		// , createDots = plane => {
		// 	const planeGeo = plane.geometry
		// 	, pos = planeGeo.attributes.position
		// 	, vertexHeight = 20
		//
		// 	for(let i = 0; i < pos.count; i++){
		// 		const vertex = new Vector3().fromBufferAttribute(pos, i)
		// 		, dot = createMesh(
		// 			new SphereGeometry(1, 10, 10, 0, Math.PI * 2, 0, Math.PI * 2),
		// 			new MeshPhongMaterial({ color: 0xffff00 })
		// 		)
		//
		// 		vertex.y = Math.random() * vertexHeight - vertexHeight
		// 		vertex._myZ = vertex.y
		//
		// 		dot.position.copy(vertex)
		// 		scene.add(dot)
		//
		// 		plane.userData.vertices.push(vertex)
		// 		plane.userData.dots.push(dot)
		// 	}
		// }
		, planeUp = createMesh(
			new PlaneGeometry(planeSize, planeSize, planeDefinition, planeDefinition),
			planeMaterial
		)
		, planeDown = createMesh(
			new PlaneGeometry(planeSize, planeSize, planeDefinition, planeDefinition),
			planeMaterial
		)

		planeUp.userData = { distFromCenter, vertices: [], dots: [] }
		planeDown.userData = { distFromCenter: -distFromCenter, vertices: [], dots: [] }

		this.planes = [planeDown]
		// this.planes = [planeUp, planeDown]
		// this.planes.forEach(plane => {
		// 	plane.rotation.x = -Math.PI/2
		// 	// plane.position.y = plane.userData.distFromCenter
		//
		// 	scene.add(plane)
		// 	// updateTransform(plane)
		// 	// createDots(plane)
		// 	// animateWave(plane)
		// })
		// renderer.render(scene, camera)

		l("Create particles")
		const group = new Group()
		scene.add(group)

		planeUp.rotation.x = -Math.PI/2
		group.add(planeUp)

		let particles, count = 0;
		const SEPARATION = 50, AMOUNTX = 25, AMOUNTY = 25;
		const numParticles = AMOUNTX * AMOUNTY;

		const positions = new Float32Array( numParticles * 3 );
		const scales = new Float32Array( numParticles );
		const colors = []
		const color = new THREE.Color();
		let i = 0, j = 0;

		for ( let ix = 0; ix < AMOUNTX; ix ++ ) {

			for ( let iy = 0; iy < AMOUNTY; iy ++ ) {

				positions[ i ] = 25 + ix * SEPARATION - ( ( AMOUNTX * SEPARATION ) / 2 ); // x
				positions[ i + 1 ] = 0; // y
				positions[ i + 2 ] = 25 + iy * SEPARATION - ( ( AMOUNTY * SEPARATION ) / 2 ); // z

				scales[ j ] = 12;
				const vx = ( positions[ i ] / AMOUNTX ) + 0.5;
				const vy = ( positions[ i + 1 ] / AMOUNTX ) + 0.5;
				const vz = ( positions[ i + 2 ] / AMOUNTX ) + 0.5;

				color.setRGB( vx, vy, vz );

				colors.push( color.r, color.g, color.b );

				i += 3;
				j ++;

			}

		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
		geometry.setAttribute( 'scale', new THREE.BufferAttribute( scales, 1 ) );

		// const material = new THREE.ShaderMaterial({
		// 	uniforms: {
		// 		color: { value: new THREE.Color( 0xffff00 ) },
		// 	},
		// 	vertexShader: document.getElementById('vertexshader').textContent,
		// 	fragmentShader: document.getElementById('fragmentshader').textContent
		// })

		const ctx = document.createElement('canvas').getContext('2d');
		ctx.canvas.width = 256;
		ctx.canvas.height = 256;
		ctx.fillStyle = '#FF0';
		ctx.beginPath();
		// ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.arc(128, 128, 128, 0, Math.PI * 2);
		ctx.fill();
		const texture = new THREE.CanvasTexture(ctx.canvas);

		geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
		const material = new THREE.PointsMaterial( {
			size: 5
			// , color: 0xffff00
			, map: texture
			, transparent: true
			// , vertexColors: true
		} );

		particles = new THREE.Points( geometry, material )
		group.add( particles )

		this.group = group
	}
	animateWave(plane){
		const planeGeo = plane.geometry, { vertices, distFromCenter } = plane.userData

		vertices.forEach((vertex, i) => {
			vertex.y = Math.sin(( i + count * 0.0002)) * (vertex._myZ - (vertex._myZ* 0.6))
			planeGeo.attributes.position.setXYZ(i, vertex.x, vertex.y + distFromCenter, vertex.z)
			plane.userData.dots[i].position.set(vertex.x, vertex.y + distFromCenter, vertex.z)
			count += 0.1
		})

		planeGeo.attributes.position.needsUpdate = true
		planeGeo.computeVertexNormals()
	}
	render() {
		const { stats } = this

		try{
			stats.begin()

			this.shouldAnimateWave && this.planes.forEach(plane => this.animateWave(plane))
			this.renderer.render(this.scene, this.camera)

			stats.end()
		} catch (err){
			l(err)
			gsap.ticker.remove(this.render.bind(this))
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