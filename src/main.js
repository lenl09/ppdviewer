import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Basic scene setup
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0e13');

// Fixed camera looking at origin
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.5, 1.25, 1.8);
camera.lookAt(0, 0, 0);

// Orbit controls for interactive camera orbiting
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 6;

// Resize handling
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create 128^3 density volume with a centered sphere radius 32 voxels
const SIZE = 128;
const RADIUS = 32;
function createDensityVolume(size, radius) {
  const data = new Uint8Array(size * size * size);
  const c = (size - 1) / 2; // center in voxel space
  let ptr = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++, ptr++) {
        const dx = x - c;
        const dy = y - c;
        const dz = z - c;
        const d2 = dx*dx + dy*dy + dz*dz;
        const inside = d2 <= radius*radius;
        // Create a soft boundary using distance field (map to 0..255)
        const dist = Math.sqrt(d2) - radius; // negative inside
        let v = inside ? 255 : 0;
        // Add a smooth falloff for nice gradients (optional)
        const feather = 2.0; // voxels
        if (dist > -feather && dist < 0) {
          const t = 1.0 + dist / feather; // 0..1 near surface inside
          v = Math.max(v, Math.floor(255 * t));
        }
        data[ptr] = v;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

// Create 128^3 color volume: red->blue gradient along X
function createColorVolume(size) {
  const data = new Uint8Array(size * size * size * 4);
  let ptr = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = x / (size - 1);
        const r = Math.round(255 * (1.0 - t));
        const g = 0;
        const b = Math.round(255 * t);
  data[ptr++] = r;
  data[ptr++] = g;
  data[ptr++] = b;
  data[ptr++] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

let densityTex = createDensityVolume(SIZE, RADIUS);
const colorTex = createColorVolume(SIZE);
let densityDims = { nx: SIZE, ny: SIZE, nz: SIZE };
let bounds = { xmin: -0.5, xmax: 0.5, ymin: -0.5, ymax: 0.5, zmin: -0.5, zmax: 0.5 };
let needsScaleUpdate = true;
// Try to load CO density volume from data folder (RAW + JSON)
async function loadExternalDensity() {
  try {
    const jres = await fetch('./data/co_volume_meanT_160x160x160.json');
    if (!jres.ok) return;
    const meta = await jres.json();
    const [Nz, Ny, Nx] = meta.shape;
    const { x: [xmin, xmax], y: [ymin, ymax], z: [zmin, zmax] } = meta.bounds;
    const rres = await fetch('./data/co_volume_meanT_160x160x160.raw');
    if (!rres.ok) return;
    const buf = await rres.arrayBuffer();
    const data = new Float32Array(buf);
    if (data.length !== Nx * Ny * Nz) {
      console.warn('RAW size mismatch, using fallback sphere');
      return;
    }
    const tex = new THREE.Data3DTexture(data, Nx, Ny, Nz);
    tex.format = THREE.RedFormat;
    tex.type = THREE.FloatType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    densityTex = tex;
    densityDims = { nx: Nx, ny: Ny, nz: Nz };
    bounds = { xmin, xmax, ymin, ymax, zmin, zmax };
    uniforms.uDensityVol.value = densityTex;
    uniforms.uTexelStep.value.set(1.0 / Nx, 1.0 / Ny, 1.0 / Nz);
    console.info('Loaded external density volume', densityDims, bounds);
  // Defer applying non-uniform scale to cube until render loop sees this flag
  needsScaleUpdate = true;
  } catch (e) {
    console.warn('Failed to load external density volume, using fallback', e);
  }
}

// Rendering mode: 0 = Plain, 1 = Frequency slice (placeholder)
let renderMode = 0;

// Ray-marched volume material
const uniforms = {
  uDensityVol: { value: densityTex },
  uColorVol: { value: colorTex },
  uStep: { value: 1.0 / SIZE * 0.9 },
  uInvModelMatrix: { value: new THREE.Matrix4() },
  uCameraPos: { value: new THREE.Vector3() },
  uRenderBBox: { value: new THREE.Vector3(0.5, 0.5, 0.5) }, // half-extent
  uDensity: { value: 1.0 },
  uLogMin: { value: 3.0 },
  uLogMax: { value: 10.0 },
  uTexelStep: { value: new THREE.Vector3(1.0 / SIZE, 1.0 / SIZE, 1.0 / SIZE) },
  uMode: { value: 0 },
};

// Start loading external density after uniforms exist
loadExternalDensity();

const vertexShader = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  precision highp sampler3D;

  varying vec3 vWorldPos;
  uniform sampler3D uDensityVol;
  uniform sampler3D uColorVol;
  uniform float uStep;
  uniform mat4 uInvModelMatrix;
  uniform vec3 uCameraPos;
  uniform vec3 uRenderBBox; // half extent of cube in local space
  uniform float uDensity;
  uniform float uLogMin;
  uniform float uLogMax;
  uniform vec3 uTexelStep; // for potential gradient needs
  uniform int uMode; // 0=Plain, 1=Frequency slice

  // Ray-box intersection with axis-aligned box [-h,h]
  bool intersectBox(vec3 ro, vec3 rd, vec3 h, out float tmin, out float tmax) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (-h - ro) * inv;
    vec3 t1 = ( h - ro) * inv;
    vec3 tsmaller = min(t0, t1);
    vec3 tbigger  = max(t0, t1);
    tmin = max(max(tsmaller.x, tsmaller.y), tsmaller.z);
    tmax = min(min(tbigger.x, tbigger.y), tbigger.z);
    return tmax > max(tmin, 0.0);
  }

  // Approximate sRGB -> Linear conversion (sufficient for TF)
  vec3 srgbToLinear(vec3 c) {
    // Piecewise approximation close to sRGB standard
    bvec3 cutoff = lessThanEqual(c, vec3(0.04045));
    vec3 low  = c / 12.92;
    vec3 high = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(high, low, cutoff);
  }

  void main() {
    // World to local (volume) space
    vec3 ro = (uInvModelMatrix * vec4(uCameraPos, 1.0)).xyz;
    vec3 rd = normalize((uInvModelMatrix * vec4(normalize(vWorldPos - uCameraPos), 0.0)).xyz);

    float t0, t1;
    if (!intersectBox(ro, rd, uRenderBBox, t0, t1)) discard;

    t0 = max(t0, 0.0);
    float t = t0;
    const int MAX_STEPS = 768;
    // Direct Volume Rendering (DVR) with Beer-Lambert absorption
    vec3 acc = vec3(0.0);
    float T = 1.0; // accumulated transmittance
    for (int i = 0; i < MAX_STEPS; i++) {
      if (t > t1 || T < 0.01) break;
      vec3 p = ro + rd * t;
      vec3 uvw = p / (2.0 * uRenderBBox) + 0.5;
      // Density from external volume (float32)
      float s_raw = texture(uDensityVol, uvw).r;
      // Log mapping to [0,1] using window [uLogMin, uLogMax]
      float s = 0.0;
      if (s_raw > 0.0) {
        float lv = log2(s_raw) / log2(10.0); // log10(s_raw)
        s = clamp((lv - uLogMin) / max(uLogMax - uLogMin, 1e-5), 0.0, 1.0);
      }
      // Color selection
      vec3 colLin;
      if (uMode == 1) {
        // Frequency slice mode (placeholder): grayscale for now
        colLin = vec3(s);
        // In future: sample uColorVol for special frequencies
      } else {
        // Plain grayscale
        colLin = vec3(s);
      }
      // Opacity from mapped density directly, scaled by density slider
      float sigma_a = max(s, 0.0) * uDensity;
      float stepLen = uStep; // local parameterization approximates length
      float a = 1.0 - exp(-sigma_a * stepLen);
      // Pre-multiplied compositing with transmittance
      acc += T * a * colLin;
      T *= (1.0 - a);
      t += uStep;
    }
  float outA = 1.0 - T;
  gl_FragColor = vec4(acc, outA);
  }
`;

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
  premultipliedAlpha: true,
  depthTest: false,
});

// Unit cube geometry centered at origin; scale to half-extent 0.5 so local box is [-0.5,0.5]
const cube = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), material);
scene.add(cube);

function applyBoundsScale() {
  const Lx = Math.abs(bounds.xmax - bounds.xmin);
  const Ly = Math.abs(bounds.ymax - bounds.ymin);
  const Lz = Math.abs(bounds.zmax - bounds.zmin);
  const maxL = Math.max(Lx, Ly, Lz, 1e-6);
  // Normalize so the longest side is 1.0; preserve aspect ratios
  const sx = Lx / maxL;
  const sy = Ly / maxL;
  const sz = Lz / maxL;
  cube.scale.set(sx, sy, sz);
}

// Lights for better background perception (not affecting shader)
{
  const hemi = new THREE.HemisphereLight(0x666699, 0x000000, 0.2);
  scene.add(hemi);
}

// UI: rendering mode
const modeSelect = document.getElementById('mode');
function updateMode() {
  renderMode = modeSelect.value === 'freq' ? 1 : 0;
  uniforms.uMode.value = renderMode;
}
modeSelect.addEventListener('change', updateMode);
updateMode();

// UI: density and step
const densitySlider = document.getElementById('density');
const stepSlider = document.getElementById('step');
const logMinInput = document.getElementById('logMin');
const logMaxInput = document.getElementById('logMax');
function updateDensity() {
  uniforms.uDensity.value = parseFloat(densitySlider.value);
}
densitySlider.addEventListener('input', updateDensity);
updateDensity();

function updateStep() {
  const scale = parseFloat(stepSlider.value); // 0.25..2.0
  const nx = densityDims.nx || SIZE;
  uniforms.uStep.value = (1.0 / nx) * scale;
}
stepSlider.addEventListener('input', updateStep);
updateStep();

function updateLogWindow() {
  uniforms.uLogMin.value = parseFloat(logMinInput.value);
  uniforms.uLogMax.value = parseFloat(logMaxInput.value);
}
logMinInput.addEventListener('change', updateLogWindow);
logMaxInput.addEventListener('change', updateLogWindow);
updateLogWindow();

function render() {
  requestAnimationFrame(render);
  // Update per-frame uniforms
  cube.updateMatrixWorld();
  uniforms.uInvModelMatrix.value.copy(cube.matrixWorld).invert();
  uniforms.uCameraPos.value.copy(camera.position);

  // Update camera controls (smooth damping)
  controls.update();

  // Apply pending non-uniform scaling once bounds are available
  if (needsScaleUpdate) {
    applyBoundsScale();
    needsScaleUpdate = false;
  }

  renderer.render(scene, camera);
}
render();
