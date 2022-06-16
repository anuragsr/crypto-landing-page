import * as $ from 'jquery'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Parallax from 'parallax-js'

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
    // Parallax scene for first section
    new Parallax(document.getElementById('parallax-scene'), {
      relativeInput: true, hoverOnly: true,
      inputElement: document.getElementById('section1')
    })

    // Scrolltrigger timelines
    const markers = true
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#section2",
        markers,
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
    // .from("#section2 > div", {
    //   duration: .5,
    //   opacity: 0,
    //   rotation: -70,
    //   ease: "linear",
    // })

    new gsap.timeline({
      scrollTrigger: {
        trigger: "#section3",
        markers,
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
    // .from("#section3 > div", {
    //   duration: .5,
    //   opacity: 0,
    //   rotation: -70,
    //   ease: "linear",
    // })

    new gsap.timeline({
      scrollTrigger: {
        trigger: "#section4",
        markers,
        start: "top 50%", //when top of herman passes 75% viewport height
        onEnter: () => {
          l("#section4 > div")
        },
      }
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
    var carousel = document.getElementsByClassName('carousel')[0],
      slider = carousel.getElementsByClassName('carousel__slider')[0],
      items = carousel.getElementsByClassName('carousel__slider__item'),
      prevBtn = carousel.getElementsByClassName('carousel__prev')[0],
      nextBtn = carousel.getElementsByClassName('carousel__next')[0];

    var width, height, totalWidth, margin = 20,
      currIndex = 0,
      interval, intervalTime = 4000;

    function initCarousel() {
      resize();
      // move(Math.floor(items.length / 2));
      move(1);
      bindEvents();
      // timer();
    }

    function resize() {
      // width = Math.max(window.innerWidth * .25, 275)
      width = window.innerWidth * .35
      ,  height = window.innerHeight * .35
      ,  totalWidth = width * items.length

      slider.style.width = totalWidth + "px";

      for(var i = 0; i < items.length; i++) {
        let item = items[i];
        item.style.width = (width - (margin * 2)) + "px";
        item.style.height = height + "px";
      }
    }

    function move(index) {

      if(index < 1) index = items.length;
      if(index > items.length) index = 1;
      currIndex = index;

      for(var i = 0; i < items.length; i++) {
        let item = items[i],
          box = item.getElementsByClassName('item__3d-frame')[0];
        if(i == (index - 1)) {
          item.classList.add('carousel__slider__item--active');
          box.style.transform = "perspective(1200px)";
        } else {
          item.classList.remove('carousel__slider__item--active');
          box.style.transform = "perspective(1200px) rotateY(" + (i < (index - 1) ? 40 : -40) + "deg)";
        }
      }

      slider.style.transform = "translate3d(" + ((index * -width) + (width / 2) + window.innerWidth / 2) + "px, 0, 0)";
    }

    function timer() {
      clearInterval(interval);
      interval = setInterval(() => {
        move(++currIndex);
      }, intervalTime);
    }

    function prev() {
      move(--currIndex);
      timer();
    }

    function next() {
      move(++currIndex);
      timer();
    }


    function bindEvents() {
      window.onresize = resize;
      prevBtn.addEventListener('click', () => { prev(); });
      nextBtn.addEventListener('click', () => { next(); });
    }

    initCarousel();
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
    f.add(params, 'section1').onChange(() => this.animateToSection('section1'))
    f.add(params, 'section2').onChange(() => this.animateToSection('section2'))
    f.add(params, 'section3').onChange(() => this.animateToSection('section3'))
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