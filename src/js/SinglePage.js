import $ from 'jquery'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollSmoother } from 'gsap/ScrollSmoother'

import ThreeScene from '@/js/ThreeScene'
import Carousel from '@/js/Carousel'
import GUI from '@/js/utils/gui'
import { l, cl, t, te } from '@/js/utils/helpers'

export default class SinglePage {
  constructor(opts) {
    this.opts = opts
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
    this.init()
  }
  init(){
    this.init2D()
    this.init3D()
    this.initGUI()
    this.hideGUI()
  }
  init2D(){
    // Smooth scroll — must be created before any ScrollTrigger so they sync to it
    this.smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.5,
      ignoreMobileResize: true,
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
    const markers = true // DEV: true for debug, set back to false when done refining
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#chart-gap",
        markers,
        // Fires when the gap's top edge is 25% down the viewport, i.e. the hero is 75% scrolled out.
        // "top 50%" was the original (earlier); "top top" waits for the hero to be completely out of view (too late).
        start: "top 25%",
        onEnter: () => {
          this.scene3D.animateToSection('section2')
        },
        onLeaveBack: () => {
          this.scene3D.animateToSection('section1')
        }
      }
    })

    // Exit of the live pulse section: the chart and note go and the dots become a slowly rotating sphere.
    // Fires when the second gap's top edge is 30% down the viewport, i.e. the live pulse section is almost out of view.
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#chart-gap-2",
        markers,
        start: "top 30%",
        onEnter: () => {
          this.scene3D.animateToSection('sphere')
        },
        onLeaveBack: () => {
          this.scene3D.animateToSection('chart')
        }
      }
    })

    // DEV: skipped while #section5 is hidden (see index.html #dev-hidden-sections)
    // to avoid it firing immediately against a collapsed, zero-height trigger.
    if (document.querySelector('#section5')?.offsetParent) {
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
  }
  init3D(){
    // THREE.js scene
    const ctn = this.opts.threeDctn
    t('[Scene init]')
    const scene = new ThreeScene({ ctn })
    scene.init()
    te('[Scene init]')

    scene.smoother = this.smoother // the hero icons follow the smoothed scroll
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
    // Keep the FPS panel (stats.js, shows FPS by default; click it to cycle ms / MB), bottom left
    Object.assign(this.scene3D.stats.dom.style, { top: 'auto', bottom: '0', left: '0' })
  }
}