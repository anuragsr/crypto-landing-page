import * as $ from 'jquery'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Parallax from 'parallax-js'

import ThreeScene from '@/js/ThreeScene'
import Carousel from '@/js/Carousel'
import GUI from '@/js/utils/gui'
import { l, cl, t, te } from '@/js/utils/helpers'

export default class SinglePage {
  constructor(opts) {
    this.opts = opts
    gsap.registerPlugin(ScrollTrigger)
    this.init()
  }
  init(){
    this.init2D()
    this.init3D()
    this.initGUI()
    this.hideGUI()
  }
  init2D(){
    // Parallax scene for first section
    new Parallax(document.getElementById('parallax-scene'), {
      relativeInput: true, hoverOnly: true,
      inputElement: document.getElementById('section1')
    })

    // Ticker
    const tickerWrapper = $(".ticker-wrapper")
      , list = tickerWrapper.find("ul.list")
      , clonedList = list.clone()
      , duration = 50

    let listWidth = 30

    list.find("li").each(function(i) {
      listWidth += $(this, i).outerWidth(true);
    })
    list.add(clonedList).css({ width: listWidth + "px" })
    clonedList.addClass("cloned").appendTo(tickerWrapper)

    new gsap.timeline({
        repeat: -1,
        // paused: true
      })
      .fromTo(list,
        { rotation: 0.01, x: 0 },
        { duration, force3D: true, x: -listWidth, ease: "none" }
      , 0)
      .fromTo(clonedList,
        { rotation: 0.01, x: listWidth },
        { duration, force3D: true, x: 0, ease: "none" }
      , 0)
      .set(list, { force3D: true, rotation: 0.01, x: listWidth })
      .to(clonedList, {
        duration,
        force3D: true,
        rotation: 0.01,
        x: -listWidth,
        ease: "none"
      }, duration)
      .to(list, {
        duration,
        force3D: true,
        rotation: 0.01,
        x: 0,
        ease: "none"
      }, duration)

    // Testimonial carousel
    new Carousel('.carousel').init()

    // Scroll trigger timelines
    const markers = false
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#section2",
        markers,
        start: "top 50%",
        onEnter: () => {
          this.scene3D.animateToSection('section2')
        },
        onLeaveBack: () => {
          this.scene3D.animateToSection('section1')
        }
      }
    })

    new gsap.timeline({
      scrollTrigger: {
        trigger: "#section5",
        markers,
        start: "top 50%",
        onEnter: () => {
          this.scene3D.animateToSection('section3')
        },
        onLeaveBack: () => {
          this.scene3D.tls.section3.tl.reverse()
          this.scene3D.animateToSection('section2')
        }
      }
    })
  }
  init3D(){
    // THREE.js scene
    const ctn = this.opts.threeDctn
    t('[Scene init]')
    const scene = new ThreeScene({ ctn })
    scene.init()
    te('[Scene init]')

    window.scene3D = scene
    this.scene3D = scene
  }
  initGUI(){
    this.scene3D.initGUI()

    const guiObj = new GUI({
      section1: () => {},
      section2: () => {},
      section3: () => {},
    })
    , gui = guiObj.gui
    , params = guiObj.getParams()

    const f = gui.addFolder('Section Animations')
    f.add(params, 'section1').onChange(() => this.scene3D.animateToSection('section1'))
    f.add(params, 'section2').onChange(() => this.scene3D.animateToSection('section2'))
    f.add(params, 'section3').onChange(() => this.scene3D.animateToSection('section3'))
    f.open()

    this.gui = gui
  }
  hideGUI(){
    this.gui.hide()
    this.scene3D.gui.hide()
    this.scene3D.stats.dom.remove()
  }
}