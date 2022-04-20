// Test import of a JavaScript module
// import { example } from '@/js/example'
// import gsap from 'gsap'

// Test import of an asset
// import webpackLogo from '@/images/webpack-logo.svg'

// Test import of styles
import '@/styles/index.scss'

// const l = console.log.bind(window.console)

// // Appending to the DOM
// const logo = document.createElement('img')
// logo.src = webpackLogo
//
// const heading = document.createElement('h1')
// heading.textContent = example()
//
// // Test a background image url in CSS
// const imageBackground = document.createElement('div')
// imageBackground.classList.add('image')
//
// // Test a public folder asset
// const imagePublic = document.createElement('img')
// imagePublic.src = '/assets/example.png'
//
// const app = document.querySelector('#root')
// app.append(logo, heading, imageBackground, imagePublic)

// l(gsap.version)
// l(document.querySelectorAll('p'))

// import 'normalize.css/normalize.css'
// import './styles/index.scss'

// import $ from "jquery"
// import ThreeScene from './js/ThreeScene'
// import { l, cl, t, te } from './js/utils/helpers'
import SinglePage from '@/js/SinglePage'

window.onload = () => {
	new SinglePage({
		threeDctn: document.querySelector("#ctn-three")
	})
	// setTimeout(() => {
	// }, 50)
}
