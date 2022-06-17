export default class Carousel {
  constructor(opts) {
    const carousel = opts.container
    this.slider  = carousel.querySelector('.carousel__slider')
    this.items   = carousel.getElementsByClassName('carousel__slider__item')
    this.prevBtn = carousel.querySelector('.carousel__prev')
    this.nextBtn = carousel.querySelector('.carousel__next')

    this.margin = 20
    this.currIndex = 0
    this.interval = null
    this.intervalTime = 8000
  }
  init(){
    this.resize()
    this.move(1)
    this.bindEvents()
    this.timer()
  }
  resize() {
    const { items } = this

    this.width = window.innerWidth * .35
    this.height = window.innerHeight * .35
    this.totalWidth = this.width * items.length

    this.slider.style.width = this.totalWidth + "px"

    for(var i = 0; i < items.length; i++) {
      let item = items[i]
      item.style.width = (this.width - (this.margin * 2)) + "px"
      item.style.height = this.height + "px"
    }
  }
  move(index) {
    const { items, width, slider } = this

    if(index < 1) index = items.length
    if(index > items.length) index = 1
    this.currIndex = index

    for(var i = 0; i < items.length; i++) {
      let item = items[i]
        , box = item.getElementsByClassName('item__3d-frame')[0]

      if(i == (index - 1)) {
        item.classList.add('carousel__slider__item--active')
        box.style.transform = "perspective(1200px)"
      } else {
        item.classList.remove('carousel__slider__item--active')
        box.style.transform = "perspective(1200px) rotateY(" + (i < (index - 1) ? 40 : -40) + "deg)"
      }
    }

    slider.style.transform = "translate3d(" + ((index * -width) + (width / 2) + window.innerWidth / 2) + "px, 0, 0)"
  }
  timer() {
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      this.move(++this.currIndex)
    }, this.intervalTime)
  }
  prev() {
    this.move(--this.currIndex)
    this.timer()
  }
  next() {
    this.move(++this.currIndex)
    this.timer()
  }
  bindEvents() {
    window.onresize = this.resize;
    this.prevBtn.addEventListener('click', () => { this.prev() })
    this.nextBtn.addEventListener('click', () => { this.next() })
  }
}