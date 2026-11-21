// Renderizador retrô: cena em baixa resolução + pós-processamento analógico.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

// Uniform compartilhado do "vertex snapping" (tremor de vértices estilo PS1)
export const SNAP = { value: new THREE.Vector2(160, 120) };

export function psx(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = SNAP;
    shader.vertexShader = 'uniform vec2 uSnap;\nvarying float vWY;\nvarying float vVert;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 wp4 = modelMatrix * vec4(transformed, 1.0);
      vWY = wp4.y;
      vVert = abs(normalize(mat3(modelMatrix) * normal).y) < 0.5 ? 1.0 : 0.0;
      if (gl_Position.w > 0.0) {
        vec4 sp = gl_Position;
        sp.xy = floor((sp.xy / sp.w) * uSnap + 0.5) / uSnap * sp.w;
        gl_Position = sp;
      }`
    );
    // oclusão ambiente falsa: superfícies verticais escurecem perto do chão e do teto
    shader.fragmentShader = 'varying float vWY;\nvarying float vVert;\n' + shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `float aoF = mix(0.5, 1.0, smoothstep(0.0, 0.45, vWY)) * mix(0.7, 1.0, smoothstep(2.6, 2.2, vWY));
      gl_FragColor.rgb *= mix(1.0, aoF, vVert);
      #include <fog_fragment>`
    );
  };
  material.customProgramCacheKey = () => 'psx2';
  return material;
}

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uExposure, uTime, uGrain, uVignette, uAberr, uDesat, uWarp, uFade, uFlash, uVhs, uContrast, uBright, uDither, uRedPulse;
uniform vec3 uTint;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float bayer(vec2 p){
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k=0;k<16;k++){ if(k==i) return m[k]/16.0 - 0.5; } return 0.0;
}
void main(){
  vec2 uv = vUv;
  // tracking VHS (só em momentos específicos)
  float band = step(0.995 - uVhs * 0.02, fract(uv.y * 1.0 - uTime * 0.21));
  uv.x += band * 0.012 * uVhs;
  uv.x += (hash(vec2(floor(uv.y * uRes.y), floor(uTime * 24.0))) - 0.5) * 0.003 * uVhs;
  // aberração cromática (sutil, cresce só com a sanidade baixa)
  vec2 dir = (uv - 0.5) * uAberr * 0.006;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + dir).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - dir).b;
  // exposição + tonemapping filmico (evita estouro das lâmpadas)
  col *= uExposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = clamp(col, 0.0, 1.0);
  // contraste / brilho
  col = (col - 0.5) * uContrast + 0.5 + uBright;
  // dessaturação e tinta
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), uDesat);
  col *= uTint;
  col = mix(col, vec3(l * 1.2, l * 0.15, l * 0.12), uRedPulse);
  // grão
  float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
  col += g * uGrain;
  // vinheta
  float d = distance(vUv, vec2(0.5));
  col *= 1.0 - smoothstep(0.4, 0.9, d) * uVignette;
  // scanlines muito sutis
  col *= 0.975 + 0.025 * sin(vUv.y * uRes.y * 3.14159);
  // dithering leve + quantização
  vec2 px = floor(vUv * uRes);
  col += bayer(px) * uDither / 64.0;
  col = floor(col * 63.0 + 0.5) / 63.0;
  col = mix(col, vec3(1.0), uFlash);
  col *= 1.0 - uFade;
  gl_FragColor = vec4(col, 1.0);
}`;

export class RetroRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.scale = 1;
    this.baseHeight = 270; // resolução interna vertical
    // render target HDR (meia precisão) quando a GPU suporta; senão 8 bits
    const gl = this.renderer.getContext();
    const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
      type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    });
    this.hdr = hdr;
    this.jitter = false;
    this.post = new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tDiffuse: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 }, uGrain: { value: 0.06 }, uVignette: { value: 0.6 }, uAberr: { value: 0.1 },
        uDesat: { value: 0.1 }, uWarp: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 },
        uVhs: { value: 0 }, uContrast: { value: 1.08 }, uBright: { value: 0 }, uDither: { value: 0.6 },
        uTint: { value: new THREE.Vector3(1.05, 0.98, 0.9) }, uRedPulse: { value: 0 }, uExposure: { value: 1.1 },
      },
    });
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.u = this.post.uniforms;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  setScale(s) { this.scale = s; this.resize(); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const ih = Math.round(this.baseHeight * this.scale);
    const iw = Math.round(ih * (w / h));
    this.rt.setSize(iw, ih);
    this.u.uRes.value.set(iw, ih);
    this.setVertexJitter(this.jitter);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }
  setVertexJitter(on) {
    this.jitter = on;
    const r = this.u.uRes.value;
    if (on) SNAP.value.set(r.x * 0.5, r.y * 0.5); else SNAP.value.set(8192, 8192);
  }
  render(scene, camera, time) {
    this.camera = camera;
    const w = window.innerWidth, h = window.innerHeight;
    if (w > 0 && h > 0) {
      if (this.canvas.width !== w || this.canvas.height !== h) this.resize();
      const a = w / h;
      if (!(Math.abs(camera.aspect - a) < 1e-4)) { camera.aspect = a; camera.updateProjectionMatrix(); }
    }
    this.u.uTime.value = time;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
