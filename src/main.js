import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Simple NPY loader for .npy files
class NPYLoader {
  async load(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return this.parse(buffer);
  }

  parse(buffer) {
    const view = new DataView(buffer);
    // Check magic string
    const magic = String.fromCharCode(view.getUint8(0)) + String.fromCharCode(view.getUint8(1)) + 
                  String.fromCharCode(view.getUint8(2)) + String.fromCharCode(view.getUint8(3)) + 
                  String.fromCharCode(view.getUint8(4)) + String.fromCharCode(view.getUint8(5));
    if (magic !== '\x93NUMPY') {
      throw new Error('Not a valid NPY file');
    }
    const major = view.getUint8(6);
    const minor = view.getUint8(7);
    
    let headerLen;
    if (major === 1) {
      headerLen = view.getUint16(8, true);
    } else if (major === 2) {
      headerLen = view.getUint32(8, true);
    } else {
      throw new Error('Unsupported NPY version');
    }
    
    const headerOffset = major === 1 ? 10 : 12;
    const headerBytes = new Uint8Array(buffer, headerOffset, headerLen);
    const header = new TextDecoder().decode(headerBytes);
    
    // Parse header dict
    const shapeMatch = header.match(/'shape':\s*\(([^)]+)\)/);
    const dtypeMatch = header.match(/'descr':\s*'([^']+)'/);
    const fortranMatch = header.match(/'fortran_order':\s*(True|False)/);
    
    if (!shapeMatch || !dtypeMatch) {
      throw new Error('Could not parse NPY header');
    }
    
    const shape = shapeMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const dtype = dtypeMatch[1];
    const fortranOrder = fortranMatch && fortranMatch[1] === 'True';
    
    const dataOffset = headerOffset + headerLen;
    
    let data;
    if (dtype === '<f4' || dtype === '<f8') {
      data = dtype === '<f4' 
        ? new Float32Array(buffer, dataOffset)
        : new Float64Array(buffer, dataOffset);
    } else if (dtype === '<i4') {
      data = new Int32Array(buffer, dataOffset);
    } else if (dtype === '<i8') {
      data = new BigInt64Array(buffer, dataOffset);
    } else if (dtype === '<u1') {
      data = new Uint8Array(buffer, dataOffset);
    } else {
      throw new Error(`Unsupported dtype: ${dtype}`);
    }
    
    return { data, shape, dtype, fortranOrder };
  }
}

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

// Frequency slice data
let freqData = {
  freqs: [],
  centerIndex: null,
  sigmaChannels: null,
  shape: null, // [ny, nx, nz]
  loaded: false,
  currentFreqIdx: 57,
};

let freqMaskTex = null;

// Load frequency mapping data
async function loadFrequencyData() {
  try {
    const baseUrl = './data/freqmap_20251105-014527';
    
    // Load freqs.json
    const freqRes = await fetch(`${baseUrl}/freqs.json`);
    if (!freqRes.ok) {
      console.warn('Could not load freqs.json');
      return;
    }
    freqData.freqs = await freqRes.json();
    
    // Load center_index.npy
    const npyLoader = new NPYLoader();
    const centerIdx = await npyLoader.load(`${baseUrl}/center_index.npy`);
    const sigmaChannels = await npyLoader.load(`${baseUrl}/sigma_channels.npy`);
    
    freqData.centerIndex = centerIdx.data;
    freqData.sigmaChannels = sigmaChannels.data;
    freqData.shape = centerIdx.shape; // [ny, nx, nz]
    freqData.loaded = true;
    
    console.info('Loaded frequency data', {
      numFreqs: freqData.freqs.length,
      shape: freqData.shape,
    });
    
    // Build initial mask
    updateFrequencyMask(freqData.currentFreqIdx);
  } catch (e) {
    console.warn('Failed to load frequency data', e);
  }
}

// Build a 3D mask texture for the selected frequency
function buildFrequencyMask(fSel, kSigma = 2.0) {
  if (!freqData.loaded) return null;
  
  const [ny, nx, nz] = freqData.shape;
  const centerIdx = freqData.centerIndex;
  const sigmaChannels = freqData.sigmaChannels;
  const eps = 1e-6;
  
  // Create Float32 texture with continuous weight
  const out = new Float32Array(nx * ny * nz);
  
  // Helper to access source arrays (stored as [ny, nx, nz])
  const srcIdx = (y, x, z) => (y * nx + x) * nz + z;
  // Helper for Three.js layout (x, y, z) -> linear
  const dstIdx = (x, y, z) => x + y * nx + z * nx * ny;
  
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      for (let z = 0; z < nz; z++) {
        const si = srcIdx(y, x, z);
        const ci = centerIdx[si];
        const sg = Math.max(sigmaChannels[si], eps);
        
        const dch = fSel - ci;
        // Gaussian weight
        const weight = Math.exp(-0.5 * (dch / sg) ** 2);
        
        // Binary mask option (uncomment for binary):
        // const visible = Math.abs(dch) <= kSigma * sg ? 1.0 : 0.0;
        
        out[dstIdx(x, y, z)] = weight;
      }
    }
  }
  
  const tex = new THREE.Data3DTexture(out, nx, ny, nz);
  tex.format = THREE.RedFormat;
  tex.type = THREE.FloatType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  
  return tex;
}

function updateFrequencyMask(freqIdx) {
  if (!freqData.loaded) return;
  
  freqData.currentFreqIdx = freqIdx;
  freqMaskTex = buildFrequencyMask(freqIdx, 2.0);
  
  if (freqMaskTex && uniforms.uFreqMask) {
    uniforms.uFreqMask.value = freqMaskTex;
  }
  
  // Update UI display
  const freqValueElem = document.getElementById('freqValue');
  if (freqValueElem && freqData.freqs[freqIdx]) {
    const freqGHz = (freqData.freqs[freqIdx] / 1e9).toFixed(6);
    freqValueElem.textContent = `${freqGHz} GHz`;
  }
}

// Ray-marched volume material
const uniforms = {
  uDensityVol: { value: densityTex },
  uColorVol: { value: colorTex },
  uFreqMask: { value: null },
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

// Start loading external density and frequency data after uniforms exist
loadExternalDensity();
loadFrequencyData();

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
  uniform sampler3D uFreqMask;
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
      
      // Color selection based on mode
      vec3 colLin;
      if (uMode == 1) {
        // Frequency slice mode: blue for voxels contributing to selected frequency
        float freqWeight = texture(uFreqMask, uvw).r;
        // Mix grayscale base with blue highlight based on frequency weight
        vec3 baseColor = vec3(s * 0.3); // dim grayscale
        vec3 freqColor = vec3(0.2, 0.5, 1.0) * s; // blue tint
        colLin = mix(baseColor, freqColor, freqWeight);
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
const freqSlider = document.getElementById('freqSlider');
const freqLabel = document.getElementById('freqLabel');
const freqValue = document.getElementById('freqValue');

function updateMode() {
  renderMode = modeSelect.value === 'freq' ? 1 : 0;
  uniforms.uMode.value = renderMode;
  
  // Show/hide frequency slider based on mode
  if (renderMode === 1) {
    freqSlider.style.display = 'inline-block';
    freqLabel.style.display = 'inline-block';
    freqValue.style.display = 'inline-block';
  } else {
    freqSlider.style.display = 'none';
    freqLabel.style.display = 'none';
    freqValue.style.display = 'none';
  }
}
modeSelect.addEventListener('change', updateMode);
updateMode();

// UI: frequency slider
function updateFrequency() {
  const freqIdx = parseInt(freqSlider.value);
  updateFrequencyMask(freqIdx);
}
freqSlider.addEventListener('input', updateFrequency);
// Initialize frequency display
if (freqData.loaded) {
  updateFrequency();
}

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