import $ from 'jquery'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollSmoother } from 'gsap/ScrollSmoother'

import ThreeScene from '@/js/ThreeScene'
import Carousel from '@/js/Carousel'
import Backdrop from '@/js/Backdrop'
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
    this.initTriggers() // after the scene exists: a trigger already past on load (restored scroll) fires its callback at once
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

    // Circuit pattern on the page edges, behind the 3D (see Backdrop.js)
    this.backdrop = new Backdrop({ el: document.querySelector('#backdrop'), smoother: this.smoother })

    // Ticker
    const tickerWrapper = $(".ticker-wrapper")
      , list = tickerWrapper.find("ul.list")
      , clonedList = list.clone()
      , duration = 50

    // The list's own width as laid out, padding included (it is an inline-block on one line). Summing just the items
    // left out the list's side padding, so with border-box sizing the items overflowed and ran into the repeat.
    const listWidth = Math.ceil(list[0].getBoundingClientRect().width)
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

    // Menu: glide to the section rather than jump. Content sits at the bottom of each section, so the section's bottom
    // is brought to the bottom of the screen (the hero, at the top, goes to the very top).
    // The 3D goes straight to that section's scene (ThreeScene.jumpTo) while the scroll triggers on the way are ignored.
    const sceneFor = { section1: 'section1', section2: 'section2', section3: 'sphere', section4: 'helix', section5: 'anubis', section6: 'neural', section7: 'coin' }
    document.querySelectorAll('nav a[href^="#section"]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault()
      const target = document.querySelector(a.getAttribute('href'))
      if (!target) return
      const hero = target.id === 'section1'
        , y = hero ? 0 : this.smoother.offset(target, 'bottom bottom')

      this.jumping = true
      this.scene3D.jumpTo(sceneFor[target.id])
      this.backdrop.toggle(!hero)
      this.smoother.scrollTo(y, true)

      // the triggers take over again once the glide has (nearly) arrived, or after a few seconds at most
      const started = performance.now()
        , arrived = () => {
          if (Math.abs(this.smoother.scrollTop() - y) > 2 && performance.now() - started < 4000) return
          this.jumping = false
          gsap.ticker.remove(arrived)
        }
      gsap.ticker.remove(this.jumpWatch || (() => {}))
      this.jumpWatch = arrived
      gsap.ticker.add(arrived)
    }))

    // Testimonial carousel
    new Carousel('.carousel').init()

  }
  initTriggers(){
    // during a menu jump the 3D goes straight to the destination (see init2D), so the triggers on the way do nothing
    const go = scene => { if (!this.jumping) this.scene3D.animateToSection(scene) }

    // Scroll trigger timelines
    const markers = false // set to true to show the ScrollTrigger start/end markers while refining
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#gap-2",
        markers,
        // Fires when the gap's top edge is 25% down the viewport, i.e. the hero is 75% scrolled out.
        // "top 50%" was the original (earlier); "top top" waits for the hero to be completely out of view (too late).
        start: "top 25%",
        onEnter: () => {
          go('section2')
          if (!this.jumping) this.backdrop.toggle(true) // circuits come in with the chart, not on the hero
        },
        onLeaveBack: () => {
          go('section1')
          if (!this.jumping) this.backdrop.toggle(false)
        }
      }
    })

    // Exit of the live pulse section: the chart and note go and the dots become a slowly rotating sphere.
    // Fires when the second gap's top edge is 30% down the viewport, i.e. the live pulse section is almost out of view.
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#gap-3",
        markers,
        start: "top 30%",
        onEnter: () => {
          go('sphere')
        },
        onLeaveBack: () => {
          go('chart')
        }
      }
    })

    // After the globe: the dots build the blockchain helix in the empty gap before section 3
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#gap-4",
        markers,
        start: "top 30%-=250", // 250px of scroll later than when the gap's top is 30% down the screen
        onEnter: () => {
          go('helix')
        },
        onLeaveBack: () => {
          go('sphere')
        }
      }
    })

    // Below section 3: the dots gather into the Anubis bust, then the real model appears
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#gap-5",
        markers,
        start: "top 30%",
        onEnter: () => {
          go('anubis')
        },
        onLeaveBack: () => {
          go('helix')
        }
      }
    })

    // Below section 4: the bust's dots stream into a neural network
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#gap-6",
        markers,
        start: "top 30%",
        onEnter: () => {
          go('neural')
        },
        onLeaveBack: () => {
          go('anubis')
        }
      }
    })

    // Below section 5: the dots swirl down into the ANUMYS coin
    new gsap.timeline({
      scrollTrigger: {
        trigger: "#gap-7",
        markers,
        start: "top 30%",
        onEnter: () => {
          go('coin')
        },
        onLeaveBack: () => {
          go('neural')
        }
      }
    })

    this.initScrollDots()

    // Old section-3 3D animation (back grid / camera move), tied to #section5. Off for now: #section5 is back on the page,
    // but this scene would fight the globe and helix. Set to true to bring it back.
    const legacySection3 = false
    if (legacySection3 && document.querySelector('#section5')?.offsetParent) {
      new gsap.timeline({
        scrollTrigger: {
          trigger: "#section5",
          markers,
          start: "top 50%",
          onEnter: () => {
            go('section3')
          },
          onLeaveBack: () => {
            this.scene3D.tls.section3.tl.reverse()
            go('section2')
          }
        }
      })
    }
  }
  // Timeline on the left: a dot per [data-dot] section, evenly spaced on a line that fills with the scroll.
  // Between two dots the line moves in step with the scroll from one section to the next, so it reaches each dot as its section is reached.
  initScrollDots(){
    const box = document.querySelector('#scroll-dots')
      , secs = [...document.querySelectorAll('[data-dot]')].filter(el => el.offsetParent)
      , n = secs.length
      , ramp = 0.25 // a dot brightens over the last quarter of the line segment leading to it
      , dots = []
      , fill = document.createElement('div')
    if (n < 2) return

    box.innerHTML = '<div class="sd-line"></div>'
    fill.className = 'sd-fill'
    box.appendChild(fill)
    box.style.setProperty('--gaps', n - 1) // the line grows with the number of dots, see #scroll-dots
    secs.forEach((el, i) => {
      const d = document.createElement('i')
      d.style.setProperty('--y', (i / (n - 1)).toFixed(4))
      box.appendChild(d)
      dots.push(d)
    })

    let marks = [] // scroll offset at which each section is reached: half way up the viewport
    const measure = () => {
      const max = ScrollTrigger.maxScroll(window)
      marks = secs.map((el, i) => i ? Math.min(max, el.getBoundingClientRect().top + this.smoother.scrollTop() - window.innerHeight * 0.5) : 0)
    }

    // scroll offset -> position along the line in dots (0 = first, n - 1 = last)
    const along = y => {
      let i = 0
      while (i < n - 1 && y >= marks[i + 1]) i++
      if (i === n - 1) return i
      return i + gsap.utils.clamp(0, 1, (y - marks[i]) / Math.max(1, marks[i + 1] - marks[i]))
    }

    const paint = () => {
      const u = along(this.smoother.scrollTop())
      fill.style.setProperty('--p', (u / (n - 1)).toFixed(4))
      dots.forEach((d, i) => d.style.setProperty('--f', gsap.utils.clamp(0, 1, 1 + (u - i) / ramp).toFixed(3)))
    }

    // follows the smoothed scroll directly, so the line moves with the page (ScrollSmoother already eases it)
    ScrollTrigger.create({
      trigger: '#smooth-content',
      start: 'top top',
      end: 'bottom bottom',
      onRefresh: () => { measure(); paint() },
      onUpdate: paint
    })
    measure()
    paint()
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