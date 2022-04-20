import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import ThreeScene from '@/js/ThreeScene'
import GUI from '@/js/utils/gui'
import { l, cl, t, te } from '@/js/utils/helpers'

export default class SinglePage {
  constructor(opts) {
    this.opts = opts
    this.init()
    this.initGUI()
    gsap.registerPlugin(ScrollTrigger)
  }
  init(){
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
      section0: () => {},
      section1: () => {},
    })
    , gui = guiObj.gui
    , params = guiObj.getParams()

    const f = gui.addFolder('Sections')
    f.add(params, 'section0').onChange(() => this.animateToSection('section0'))
    f.add(params, 'section1').onChange(() => this.animateToSection('section1'))
    f.open()
  }
  animateToSection(section){
    this.scene3D.animateToSection(section)
    switch(section){
      case 'section0':
        l('section0 anim')
        break;

      case 'section1':
        l('section1 anim')
        break;

      default:
        break;
    }
  }
}