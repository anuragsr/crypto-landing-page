import * as THREE from 'three'
import gsap from 'gsap'

const {
  Mesh, InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry,
  ShaderMaterial, AdditiveBlending, DoubleSide, Color, Vector3
} = THREE

const vertexShader = /* glsl */`
  attribute float aSeed;
  uniform float uTime;
  uniform vec3 uMin;
  uniform vec3 uMax;
  varying vec2 vUv;
  varying float vFade;
  varying float vPal;
  varying float vD;
  varying float vLen;
  varying float vW;
  varying float vR;

  float hash(float n){ return fract(sin(n * 127.1) * 43758.5453123); }

  // Curved path: an arch that leaves and re-joins the straight heading (its sag is the largest sideways
  // deviation, at the middle of the shot), plus a gentle S-wiggle. The trail follows the same curve.
  vec3 pathPos(float u, vec3 start, vec3 dir, vec3 bend, float curv, float um, float amp, float ph){
    float uc = clamp(u, 0.0, 2.0 * um); // the arch only exists over the distance actually travelled
    return start + dir * u + bend * (0.5 * curv * ((uc - um) * (uc - um) - um * um) + amp * sin(u * 0.006 + ph));
  }

  void main(){
    float s = aSeed;

    // Every comet runs its own loop: one long shot, then a long random pause. Each new loop re-rolls everything.
    float speed  = mix(380.0, 800.0, hash(s + 1.3));
    float len    = mix(240.0, 520.0, hash(s + 2.7));
    float life   = mix(1.4, 2.4, hash(s + 3.1));
    float period = life + mix(2.5, 7.0, hash(s + 4.9));
    float t      = uTime + hash(s + 5.5) * period;
    float cyc    = floor(t / period);
    float local  = t - cyc * period;

    if (local > life) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // between shots: clipped away
      return;
    }

    float r = s * 13.0 + cyc * 7.31;
    vec3 start = mix(uMin, uMax, vec3(hash(r + 0.1), hash(r + 0.2), hash(r + 0.3)));
    float sx = hash(r + 0.4) < 0.5 ? -1.0 : 1.0;
    vec3 dir = normalize(vec3(sx, mix(-0.05, 0.05, hash(r + 0.5)), mix(-0.4, 0.4, hash(r + 0.6))));
    start.x = -sx * mix(150.0, 900.0, hash(r + 0.7));

    float headR = mix(7.0, 11.0, hash(r + 0.8));   // head radius in world units
    float halfW = headR * 2.6;                      // quad half-width: room for the glow
    float ext   = headR * 2.6;                      // quad extends past the tip for the head glow

    // Which way and how much this shot bends (sideways in depth and height)
    float a = hash(r + 0.11) * 3.14159;
    vec3 bend = vec3(0.0, sin(a) * 0.85, cos(a) * 0.5);
    bend = normalize(bend - dir * dot(bend, dir));
    float um   = speed * life * 0.5;                // half of the distance travelled: where the arch peaks
    float sag  = (hash(r + 0.12) < 0.5 ? -1.0 : 1.0) * mix(70.0, 120.0, hash(r + 0.13));
    float curv = 2.0 * sag / (um * um);
    float amp  = (hash(r + 0.15) < 0.5 ? -1.0 : 1.0) * mix(8.0, 16.0, hash(r + 0.14));
    float ph   = hash(r + 0.16) * 6.2831;

    float d = uv.x * (len + ext);                   // distance from the tail along the streak
    float u = speed * local - len + d;              // the same distance as a position along the path
    vec3 along = pathPos(u, start, dir, bend, curv, um, amp, ph);
    vec3 tang = normalize(pathPos(u + 2.0, start, dir, bend, curv, um, amp, ph) - along);

    // Ribbon that always faces the camera (winding: front face must point at the camera)
    vec3 toCam = normalize(cameraPosition - along);
    vec3 side = normalize(cross(toCam, tang));
    vec3 world = along + side * (uv.y - 0.5) * 2.0 * halfW;

    vUv = uv;
    vD = d;
    vLen = len;
    vW = halfW;
    vR = headR;
    vFade = smoothstep(0.0, 0.12, local) * (1.0 - smoothstep(life - 0.35, life, local));
    vPal = hash(r + 0.9);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`

const fragmentShader = /* glsl */`
  uniform float uOpacity;
  uniform vec3 uPal0;
  uniform vec3 uPal1;
  uniform vec3 uPal2;
  uniform vec3 uPal3;
  varying vec2 vUv;
  varying float vFade;
  varying float vPal;
  varying float vD;
  varying float vLen;
  varying float vW;
  varying float vR;

  void main(){
    float q = (vUv.y - 0.5) * 2.0 * vW;            // world offset across the streak
    float t = clamp(vD / vLen, 0.0, 1.0);          // 0 at the tail, 1 at the head

    // Trail: a thin fading tail that widens toward the head
    float trailHalf = vR * mix(0.08, 0.7, pow(t, 1.3));
    float across = 1.0 - smoothstep(0.0, 1.0, abs(q) / trailHalf);
    float trail = pow(t, 1.8) * across * (1.0 - smoothstep(vLen, vLen + vR * 0.6, vD));

    // Head: round glow with a white-hot core
    float hd = length(vec2(vD - vLen, q));
    float glow = exp(-pow(hd / (vR * 0.9), 2.0));
    float core = exp(-pow(hd / (vR * 0.38), 2.0));

    vec3 col = vPal < 0.35 ? uPal0 : vPal < 0.65 ? uPal1 : vPal < 0.9 ? uPal2 : uPal3;
    vec3 rgb = mix(col, vec3(1.0), core * 0.85);

    float a = (trail * 1.1 + glow * 0.9 + core) * vFade * uOpacity;
    gl_FragColor = vec4(rgb, a);
  }
`

// A few comets shooting through the volume between the ceiling and floor planes.
export default class Streaks {
  constructor({ enabled = true, count = 5, min = [-800, -80, -550], max = [800, 80, 300] } = {}) {
    // Many segments along the length: the shader places each vertex on the curved path, so the ribbon bends with it
    const base = new PlaneGeometry(1, 1, 64, 1)
    const geo = new InstancedBufferGeometry()
    geo.setIndex(base.index)
    geo.setAttribute('position', base.attributes.position)
    geo.setAttribute('uv', base.attributes.uv)
    geo.instanceCount = count
    geo.setAttribute('aSeed', new InstancedBufferAttribute(Float32Array.from({ length: count }, () => Math.random() * 1000), 1))

    this.enabled = enabled
    this.state = { opacity: 1 }
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uMin: { value: new Vector3().fromArray(min) },
        uMax: { value: new Vector3().fromArray(max) },
        // current palette: violet, blue, cyan, and a rare yellow accent
        uPal0: { value: new Color('#8E54E9') },
        uPal1: { value: new Color('#4776E6') },
        uPal2: { value: new Color('#7cdff2') },
        uPal3: { value: new Color('#ffe45c') },
      },
    })
    this.mesh = new Mesh(geo, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
    this.mesh.visible = enabled
  }
  animateIn() {
    if (!this.enabled) return
    gsap.to(this.state, { opacity: 1, duration: 1.2, delay: 0.3, ease: 'power1.out', overwrite: true })
  }
  animateOut() {
    if (!this.enabled) return
    gsap.to(this.state, { opacity: 0, duration: 0.7, ease: 'power1.in', overwrite: true })
  }
  update(dt) {
    if (!this.enabled) return
    this.mesh.visible = this.state.opacity > 0.001
    if (!this.mesh.visible) return
    this.material.uniforms.uTime.value += dt
    this.material.uniforms.uOpacity.value = this.state.opacity
  }
}
