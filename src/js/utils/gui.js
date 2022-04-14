import * as dat from 'dat.gui'
import { l, cl } from './helpers'

export default class GUI{
  constructor(){
    this.gui = new dat.GUI()
  }
  getParams(currMesh){
    return {
      helpers: false,
      fog: false,
      stats: true,
      animateWave: false,
      getState: function () { l(this) },
      currMesh: currMesh?currMesh.name:"",
    }
  }
}