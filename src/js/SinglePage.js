import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import ThreeScene from '@/js/ThreeScene'
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
  }
  init2D(){
    gsap.timeline({
      scrollTrigger: {
        trigger: "#section2",
        markers: true,
        start: "top 50%", //when top of herman passes 75% viewport height
        onEnter: () => {
          // l("#section2 > div")
          this.animateToSection('section2')
        },
        onLeaveBack: () => {
          // l("#section2 > div")
          this.animateToSection('section1')
        }
        // end:"bottom 25%", //when bottom of herman passes 25% viewport height
        //events: onEnter onLeave onEnterBack onLeaveBack
        // toggleActions:"restart complete reverse reset"
        //options: play, pause, resume, reset, restart, complete, reverse,none
      }
    })
    // .add(function(){
    //   l("#section2 > div")
    // })
    .from("#section2 > div", {
      duration: .5,
      opacity: 0,
      rotation: -70,
      ease: "linear",
    })

    gsap.timeline({
      scrollTrigger: {
        trigger: "#section3",
        markers: true,
        start: "top 50%", //when top of herman passes 75% viewport height
        onEnter: () => {
          l("#section3 > div")
        },
        // onLeave: () => {
        //   l("#section3 > div")
        // }
        // end:"bottom 25%", //when bottom of herman passes 25% viewport height
        //events: onEnter onLeave onEnterBack onLeaveBack
        // toggleActions:"restart complete reverse reset"
        //options: play, pause, resume, reset, restart, complete, reverse,none
      }
    })
    // .add(function(){
    //   l("#section3 > div")
    // })
    .from("#section3 > div", {
      duration: .5,
      opacity: 0,
      rotation: -70,
      ease: "linear",
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
    const guiObj = new GUI({
      section1: () => {},
      section2: () => {},
    })
    , gui = guiObj.gui
    , params = guiObj.getParams()

    const f = gui.addFolder('Sections')
    f.add(params, 'section1').onChange(() => this.animateToSection('section1'))
    f.add(params, 'section2').onChange(() => this.animateToSection('section2'))
    f.open()
  }
  animateToSection(section){
    this.scene3D.animateToSection(section)
    switch(section){
      case 'section1':
        l('section1 anim')
        break;

      case 'section2':
        l('section2 anim')
        break;

      default:
        break;
    }
  }
}