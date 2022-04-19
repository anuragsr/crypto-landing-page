import * as dat from 'dat.gui'
import { l, cl } from './helpers'

export default class GUI{
  constructor(){
    this.gui = new dat.GUI()
  }
  getParams(){
    return {
      helpers: false,
      fog: false,
      stats: true,
      animateVertices: false,
      normalizeVertices: function(){},
      getState: function () { l(this) },
      resetPlanes: function(){},
      animatePlanes: function(){},
      resetCamera: function(){},
    }
  }
}