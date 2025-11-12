import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Inferno colormap (256 colors)
const infernoColormap = [
  [0,0,4],[1,0,5],[1,1,6],[1,1,8],[2,1,10],[2,2,12],[2,2,14],[3,2,16],[4,3,18],[4,3,20],[5,4,23],[6,4,25],[7,5,27],[8,5,29],[9,6,31],[10,7,34],[11,7,36],[12,8,38],[13,8,41],[14,9,43],[16,9,45],[17,10,48],[18,10,50],[20,11,52],[21,11,55],[22,11,57],[24,12,60],[25,12,62],[27,12,65],[28,12,67],[30,12,69],[31,12,72],[33,12,74],[35,12,76],[36,12,79],[38,12,81],[40,11,83],[41,11,85],[43,11,87],[45,11,89],[47,10,91],[49,10,92],[50,10,94],[52,10,95],[54,9,97],[56,9,98],[57,9,99],[59,9,100],[61,9,101],[62,9,102],[64,10,103],[66,10,104],[68,10,104],[69,10,105],[71,11,106],[73,11,106],[74,12,107],[76,12,107],[77,13,108],[79,13,108],[81,14,108],[82,14,109],[84,15,109],[85,15,109],[87,16,110],[89,16,110],[90,17,110],[92,18,110],[93,18,110],[95,19,110],[97,19,110],[98,20,110],[100,21,110],[101,21,110],[103,22,110],[105,22,110],[106,23,110],[108,24,110],[109,24,110],[111,25,110],[113,25,110],[114,26,110],[116,26,110],[117,27,110],[119,28,109],[120,28,109],[122,29,109],[124,29,109],[125,30,109],[127,30,108],[128,31,108],[130,32,108],[132,32,107],[133,33,107],[135,33,107],[136,34,106],[138,34,106],[140,35,105],[141,35,105],[143,36,105],[144,37,104],[146,37,104],[147,38,103],[149,38,103],[151,39,102],[152,39,102],[154,40,101],[155,41,100],[157,41,100],[159,42,99],[160,42,99],[162,43,98],[163,44,97],[165,44,96],[166,45,96],[168,46,95],[169,46,94],[171,47,94],[173,48,93],[174,48,92],[176,49,91],[177,50,90],[179,50,90],[180,51,89],[182,52,88],[183,53,87],[185,53,86],[186,54,85],[188,55,84],[189,56,83],[191,57,82],[192,58,81],[193,58,80],[195,59,79],[196,60,78],[198,61,77],[199,62,76],[200,63,75],[202,64,74],[203,65,73],[204,66,72],[206,67,71],[207,68,70],[208,69,69],[210,70,68],[211,71,67],[212,72,66],[213,74,65],[215,75,63],[216,76,62],[217,77,61],[218,78,60],[219,80,59],[221,81,58],[222,82,56],[223,83,55],[224,85,54],[225,86,53],[226,87,52],[227,89,51],[228,90,49],[229,92,48],[230,93,47],[231,94,46],[232,96,45],[233,97,43],[234,99,42],[235,100,41],[235,102,40],[236,103,38],[237,105,37],[238,106,36],[239,108,35],[239,110,33],[240,111,32],[241,113,31],[241,115,29],[242,116,28],[243,118,27],[243,120,25],[244,121,24],[245,123,23],[245,125,21],[246,126,20],[246,128,19],[247,130,18],[247,132,16],[248,133,15],[248,135,14],[248,137,12],[249,139,11],[249,140,10],[249,142,9],[250,144,8],[250,146,7],[250,148,7],[251,150,6],[251,151,6],[251,153,6],[251,155,6],[251,157,7],[252,159,7],[252,161,8],[252,163,9],[252,165,10],[252,166,12],[252,168,13],[252,170,15],[252,172,17],[252,174,18],[252,176,20],[252,177,22],[252,179,24],[252,181,26],[252,183,28],[252,185,30],[251,187,33],[251,189,35],[251,191,37],[250,193,39],[250,195,42],[250,197,44],[249,199,47],[249,201,49],[248,203,52],[248,205,55],[247,207,58],[247,209,61],[246,211,64],[245,213,67],[245,215,70],[244,217,73],[243,219,76],[243,221,80],[242,223,83],[241,225,86],[241,227,90],[240,229,93],[239,231,97],[238,233,100],[237,235,104],[236,237,108],[236,239,111],[235,241,115],[234,243,119],[233,245,123],[232,247,127],[231,249,131],[230,251,135],[229,253,139],[228,255,143]
];

// Convert inferno index (0-1) to RGB with linear interpolation
function infernoColor(t) {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));
  
  // Map t to the colormap range
  const scaledT = t * (infernoColormap.length - 1);
  const idx0 = Math.floor(scaledT);
  const idx1 = Math.min(idx0 + 1, infernoColormap.length - 1);
  const frac = scaledT - idx0; // Fractional part for interpolation
  
  const color0 = infernoColormap[idx0];
  const color1 = infernoColormap[idx1];
  
  if (!color0 || !color1 || !Array.isArray(color0) || !Array.isArray(color1)) {
    console.error('Invalid color at indices', idx0, idx1, 't=', t, 'array length=', infernoColormap.length);
    return [0, 0, 0];
  }
  
  // Linear interpolation between color0 and color1
  const r = color0[0] + (color1[0] - color0[0]) * frac;
  const g = color0[1] + (color1[1] - color0[1]) * frac;
  const b = color0[2] + (color1[2] - color0[2]) * frac;
  
  return [Math.round(r), Math.round(g), Math.round(b)];
}

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
const view1 = document.getElementById('view1');
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
view1.appendChild(renderer.domElement);

// Create canvas for second view manually (256x256 thumbnail)
const canvas2 = document.createElement('canvas');
canvas2.style.width = '100%';
canvas2.style.height = '100%';
canvas2.width = 256;
canvas2.height = 256;
const view2 = document.getElementById('view2');
view2.appendChild(canvas2);

// Get 2D context for simple image copy
const ctx2d = canvas2.getContext('2d');

// Render targets for post-processing
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio(), {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType,
  stencilBuffer: false,
  depthBuffer: true,
});

// Render target for blur output (smaller, 256x256) - use float for precision
const blurTarget = new THREE.WebGLRenderTarget(256, 256, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
  stencilBuffer: false,
  depthBuffer: false,
});

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0e13');

// Orthographic camera
let aspect = window.innerWidth / window.innerHeight;
let orthoZoom = 1.5; // Controls the "FOV" (zoom level)
const camera = new THREE.OrthographicCamera(
  -orthoZoom * aspect, orthoZoom * aspect,
  orthoZoom, -orthoZoom,
  0.1, 100
);
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
  aspect = window.innerWidth / window.innerHeight;
  camera.left = -orthoZoom * aspect;
  camera.right = orthoZoom * aspect;
  camera.top = orthoZoom;
  camera.bottom = -orthoZoom;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  renderTarget.setSize(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
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
  sigmaInChannels: true,
};

let freqMaskTex = null;
let velocityTex = null;
let centerIndexTex = null;
let sigmaTex = null;

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
    // Stats for debugging visibility of broadening
    let minCi = Infinity, maxCi = -Infinity;
    let minSigma = Infinity, maxSigma = -Infinity, sumSigma = 0;
    const centerArr = freqData.centerIndex;
    const sigmaArr = freqData.sigmaChannels;
    for (let i=0;i<centerArr.length;i++) {
      const ci = centerArr[i];
      const sg = sigmaArr[i];
      if (ci < minCi) minCi = ci; if (ci > maxCi) maxCi = ci;
      if (sg < minSigma) minSigma = sg; if (sg > maxSigma) maxSigma = sg;
      sumSigma += sg;
    }
    const meanSigma = sumSigma / sigmaArr.length;
    console.info('Loaded frequency data', {
      numFreqs: freqData.freqs.length,
      shape: freqData.shape,
      centerIndexRange: [minCi, maxCi],
      sigmaRange: [minSigma, maxSigma],
      meanSigma,
    });
    
    // Build velocity texture from center frequencies
    buildVelocityTexture();
  // Upload centerIndex & sigma as 3D textures for GPU weighting
    // If sigma appears to be in Hz, convert to channels using average spacing
    if (sigmaChannels.shape) {
      // no-op, custom npy loader returns typed arrays without shape
    }
    // Heuristic: if median(sigma) > 10, assume in Hz and convert
    const sigmaCopy = Array.from(freqData.sigmaChannels.slice(0, Math.min(100000, freqData.sigmaChannels.length))).sort((a,b)=>a-b);
    const medianSigma = sigmaCopy[Math.floor(sigmaCopy.length/2)] || 0;
    let spacingCh = 1.0;
    if (Array.isArray(freqData.freqs) && freqData.freqs.length >= 2) {
      // average channel spacing in Hz
      let sum = 0;
      for (let i=1;i<freqData.freqs.length;i++) sum += Math.abs(freqData.freqs[i]-freqData.freqs[i-1]);
      const avgHz = sum / (freqData.freqs.length-1);
      spacingCh = avgHz;
    }
    if (medianSigma > 10 && spacingCh > 0) {
      // convert Hz to channels
      const arr = freqData.sigmaChannels;
      for (let i=0;i<arr.length;i++) arr[i] = arr[i] / spacingCh;
      freqData.sigmaInChannels = true;
      console.info('Converted sigma to channel units using spacingHz', spacingCh);
    }
    uploadCenterSigmaTextures();
  // Initial mask still built for now (will be ignored once shader path active)
  updateFrequencyMask(freqData.currentFreqIdx);
  } catch (e) {
    console.warn('Failed to load frequency data', e);
  }
}

// Build a velocity texture based on each voxel's center frequency
function buildVelocityTexture() {
  if (!freqData.loaded) return;
  
  const [ny, nx, nz] = freqData.shape;
  const centerIdx = freqData.centerIndex;
  
  // Create Float32 texture with velocity shift
  const out = new Float32Array(nx * ny * nz);
  
  // Find middle frequency index for reference (zero velocity)
  const midFreqIdx = Math.floor(freqData.freqs.length / 2);
  
  // Helper to access source arrays (stored as [ny, nx, nz])
  const srcIdx = (y, x, z) => (y * nx + x) * nz + z;
  // Helper for Three.js layout (x, y, z) -> linear
  const dstIdx = (x, y, z) => x + y * nx + z * nx * ny;
  
  let minVel = Infinity, maxVel = -Infinity;
  
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      for (let z = 0; z < nz; z++) {
        const si = srcIdx(y, x, z);
        const ci = centerIdx[si];
        
        // Compute velocity shift: negative = blue-shifted, positive = red-shifted
        // Normalize to approximately [-1, 1] range
        const velocityShift = (ci - midFreqIdx) / (freqData.freqs.length / 2);
        
        out[dstIdx(x, y, z)] = velocityShift;
        minVel = Math.min(minVel, velocityShift);
        maxVel = Math.max(maxVel, velocityShift);
      }
    }
  }
  
  console.info('Velocity texture built', { 
    shape: [nx, ny, nz],
    velocityRange: [minVel, maxVel],
    midFreqIdx 
  });
  
  const tex = new THREE.Data3DTexture(out, nx, ny, nz);
  tex.format = THREE.RedFormat;
  tex.type = THREE.FloatType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  
  velocityTex = tex;
  if (uniforms.uVelocityTex) {
    uniforms.uVelocityTex.value = velocityTex;
  }
  
  console.info('Velocity texture assigned to uniform');
}

function uploadCenterSigmaTextures() {
  if (!freqData.loaded) return;
  const [ny, nx, nz] = freqData.shape;
  const centerIdx = freqData.centerIndex;
  const sigmaChannels = freqData.sigmaChannels;
  const srcIdx = (y,x,z)=> (y * nx + x) * nz + z;
  const dstIdx = (x,y,z)=> x + y * nx + z * nx * ny;
  const ciOut = new Float32Array(nx*ny*nz);
  const sgOut = new Float32Array(nx*ny*nz);
  for (let y=0;y<ny;y++) {
    for (let x=0;x<nx;x++) {
      for (let z=0; z<nz; z++) {
        const s = srcIdx(y,x,z);
        const d = dstIdx(x,y,z);
        ciOut[d] = centerIdx[s];
        sgOut[d] = Math.max(sigmaChannels[s], 1e-6);
      }
    }
  }
  centerIndexTex = new THREE.Data3DTexture(ciOut, nx, ny, nz);
  centerIndexTex.format = THREE.RedFormat;
  centerIndexTex.type = THREE.FloatType;
  centerIndexTex.minFilter = THREE.LinearFilter;
  centerIndexTex.magFilter = THREE.LinearFilter;
  centerIndexTex.wrapS = centerIndexTex.wrapT = centerIndexTex.wrapR = THREE.ClampToEdgeWrapping;
  centerIndexTex.needsUpdate = true;
  sigmaTex = new THREE.Data3DTexture(sgOut, nx, ny, nz);
  sigmaTex.format = THREE.RedFormat;
  sigmaTex.type = THREE.FloatType;
  sigmaTex.minFilter = THREE.LinearFilter;
  sigmaTex.magFilter = THREE.LinearFilter;
  sigmaTex.wrapS = sigmaTex.wrapT = sigmaTex.wrapR = THREE.ClampToEdgeWrapping;
  sigmaTex.needsUpdate = true;
  uniforms.uCenterIndexTex.value = centerIndexTex;
  uniforms.uSigmaTex.value = sigmaTex;
  console.info('Uploaded centerIndex & sigma textures');
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
  
  const invSqrt2 = 0.7071067811865476; // 1/sqrt(2)
  const useBandGlobal = uniforms.uUseBand.value === 1;
  const broadScale = uniforms.uBroadeningScale.value;
  function erfApprox(a){
    const s = Math.sign(a);
    a = Math.abs(a);
    const t = 1.0 + 0.147 * a * a;
    const y = 1.0 - Math.exp(-a*a * (4.0/Math.PI + 0.147 * a*a) / t);
    return s * Math.sqrt(y);
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      for (let z = 0; z < nz; z++) {
        const si = srcIdx(y, x, z);
        const ci = centerIdx[si];
        let sg = Math.max(sigmaChannels[si], eps) * broadScale;
        const dch = fSel - ci;
        const weightGauss = Math.exp(-0.5 * (dch / sg) ** 2);
        const a1 = (dch + 0.5) * invSqrt2 / sg;
        const a0 = (dch - 0.5) * invSqrt2 / sg;
        const wBand = 0.5 * (erfApprox(a1) - erfApprox(a0));
        const ocA1 = 0.5 * invSqrt2 / sg;
        const ocA0 = -0.5 * invSqrt2 / sg;
        const wMax = 0.5 * (erfApprox(ocA1) - erfApprox(ocA0));
        let wNorm = wBand / Math.max(wMax, 1e-6);
        if (wNorm < 0) wNorm = 0; else if (wNorm > 1) wNorm = 1;
        out[dstIdx(x, y, z)] = useBandGlobal ? wNorm : weightGauss;
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
  uVelocityTex: { value: null },
  uStep: { value: 1.0 / SIZE * 0.9 },
  uInvModelMatrix: { value: new THREE.Matrix4() },
  uCameraPos: { value: new THREE.Vector3() },
  uRenderBBox: { value: new THREE.Vector3(0.5, 0.5, 0.5) }, // half-extent
  uDensity: { value: 1.0 },
  uLogMin: { value: 3.0 },
  uLogMax: { value: 10.0 },
  uTexelStep: { value: new THREE.Vector3(1.0 / SIZE, 1.0 / SIZE, 1.0 / SIZE) },
  uMode: { value: 0 },
  uBgBrightness: { value: 0.15 },
  uBroadeningScale: { value: 1.0 }, // scales sigmaChannels
  uUseBand: { value: 1 }, // 1 = band-integrated weighting, 0 = pure Gaussian
  uCenterIndexTex: { value: null },
  uSigmaTex: { value: null },
  uFSel: { value: 57 }, // selected frequency channel index
  uWeightGamma: { value: 1.0 },
  uShowWeight: { value: 0 },
  uMinSigmaCh: { value: 0.25 },
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
  uniform sampler3D uVelocityTex;
  uniform sampler3D uCenterIndexTex;
  uniform sampler3D uSigmaTex;
  uniform float uBroadeningScale;
  uniform int uUseBand;
  uniform int uFSel;
  uniform float uStep;
  uniform mat4 uInvModelMatrix;
  uniform vec3 uCameraPos;
  uniform vec3 uRenderBBox; // half extent of cube in local space
  uniform float uDensity;
  uniform float uLogMin;
  uniform float uLogMax;
  uniform vec3 uTexelStep; // for potential gradient needs
  uniform int uMode; // 0=Plain, 1=Frequency slice
  uniform float uBgBrightness; // brightness of background disk in freq mode
  uniform float uWeightGamma;
  uniform int uShowWeight;
  uniform float uMinSigmaCh;

  // Approximate error function for band integration
  float erfApprox(float x){
    float s = sign(x);
    x = abs(x);
    float t = 1.0 + 0.147 * x * x;
    float y = 1.0 - exp(-x*x * (4.0/3.14159265 + 0.147 * x*x) / t);
    return s * sqrt(y);
  }

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
    // Weight debug mode: show freqWeight for mid-point only, ignore density & absorption
    if (uShowWeight == 1) {
      float tm = (t0 + t1) * 0.5;
      vec3 p = ro + rd * tm;
      vec3 uvw = p / (2.0 * uRenderBBox) + 0.5;
      float centerIdx = texture(uCenterIndexTex, uvw).r;
      float baseSigma = texture(uSigmaTex, uvw).r;
      float sigmaChRaw = baseSigma * uBroadeningScale;
      float sigmaCh = max(sigmaChRaw, uMinSigmaCh);
      float dch = float(uFSel) - centerIdx;
      float freqWeightGauss = exp(-0.5 * (dch*dch)/(sigmaCh*sigmaCh));
      float invSqrt2 = 0.70710678;
      float a1 = (dch + 0.5) * invSqrt2 / sigmaCh;
      float a0 = (dch - 0.5) * invSqrt2 / sigmaCh;
      float wBand = 0.5 * (erfApprox(a1) - erfApprox(a0));
      float ocA1 = 0.5 * invSqrt2 / sigmaCh;
      float ocA0 = -0.5 * invSqrt2 / sigmaCh;
      float wMax = 0.5 * (erfApprox(ocA1) - erfApprox(ocA0));
      float wNorm = wBand / max(wMax, 1e-6);
      wNorm = clamp(wNorm, 0.0, 1.0);
      float freqWeight = (uUseBand == 1) ? wNorm : freqWeightGauss;
      freqWeight = pow(clamp(freqWeight,0.0,1.0), uWeightGamma);
      // Debug: R = gaussian (no gamma), G = band (no gamma), B = broadened sigma normalized
      float gaussNoGamma = exp(-0.5 * (dch*dch)/(max(baseSigma,1e-6)*max(baseSigma,1e-6)));
      float bandNoGamma; {
        float a1b = (dch + 0.5) * invSqrt2 / max(baseSigma,1e-6);
        float a0b = (dch - 0.5) * invSqrt2 / max(baseSigma,1e-6);
        float wb = 0.5 * (erfApprox(a1b) - erfApprox(a0b));
        float ocA1b = 0.5 * invSqrt2 / max(baseSigma,1e-6);
        float ocA0b = -0.5 * invSqrt2 / max(baseSigma,1e-6);
        float wMaxb = 0.5 * (erfApprox(ocA1b) - erfApprox(ocA0b));
        bandNoGamma = clamp(wb / max(wMaxb,1e-6), 0.0, 1.0);
      }
      float sigmaVis = (sigmaChRaw - uMinSigmaCh) / (uMinSigmaCh + 5.0); // rough normalization
      gl_FragColor = vec4(gaussNoGamma, bandNoGamma, clamp(sigmaVis,0.0,1.0), 1.0);
      return;
    }

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
      float opacityScale = 1.0; // Scale for opacity/absorption
      
      if (uMode == 1) {
        // Frequency slice mode: dynamic thermal broadening weight
        float centerIdx = texture(uCenterIndexTex, uvw).r;
  float baseSigma = texture(uSigmaTex, uvw).r;
  float sigmaChRaw = baseSigma * uBroadeningScale;
  float sigmaCh = max(sigmaChRaw, uMinSigmaCh);
  float dch = float(uFSel) - centerIdx;
        float freqWeightGauss = exp(-0.5 * (dch*dch)/(sigmaCh*sigmaCh));
  // Band-integrated weight using approximate erf
  float invSqrt2 = 0.70710678;
  float a1 = (dch + 0.5) * invSqrt2 / sigmaCh;
  float a0 = (dch - 0.5) * invSqrt2 / sigmaCh;
        float wBand = 0.5 * (erfApprox(a1) - erfApprox(a0));
        float ocA1 = 0.5 * invSqrt2 / sigmaCh;
        float ocA0 = -0.5 * invSqrt2 / sigmaCh;
        float wMax = 0.5 * (erfApprox(ocA1) - erfApprox(ocA0));
        float wNorm = wBand / max(wMax, 1e-6);
        wNorm = clamp(wNorm, 0.0, 1.0);
  float freqWeight = (uUseBand == 1) ? wNorm : freqWeightGauss;
  // Apply gamma shaping for visibility
  freqWeight = pow(clamp(freqWeight, 0.0, 1.0), uWeightGamma);
        
        // Get velocity shift from velocity texture
        // -1 = blue-shifted (approaching), +1 = red-shifted (receding)
        float velocityParam = texture(uVelocityTex, uvw).r;
        
        // Clamp velocity to reasonable range
        velocityParam = clamp(velocityParam, -1.0, 1.0);
        
        // Blue-white-red colormap
        vec3 dopplerColor;
        if (velocityParam < -0.05) {
          // Blue-shifted: interpolate blue to white
          float t = (velocityParam + 1.0) / 0.95; // remap [-1, -0.05] to [0, 1]
          dopplerColor = mix(vec3(0.2, 0.4, 1.0), vec3(1.0, 1.0, 1.0), t);
        } else if (velocityParam > 0.05) {
          // Red-shifted: interpolate white to red
          float t = (velocityParam - 0.05) / 0.95; // remap [0.05, 1] to [0, 1]
          dopplerColor = mix(vec3(1.0, 1.0, 1.0), vec3(1.0, 0.3, 0.2), t);
        } else {
          // Near zero velocity: white
          dopplerColor = vec3(1.0, 1.0, 1.0);
        }
        
        // Mix grayscale base with doppler color based on frequency weight
        vec3 baseColor = vec3(s * uBgBrightness);
        float highlightFactor = freqWeight; // already gamma-shaped
        if (uShowWeight == 1) {
          // Visualize weight directly with inferno-like ramp (simple)
          colLin = vec3(highlightFactor);
        } else {
          colLin = mix(baseColor, dopplerColor * s * 1.5, highlightFactor);
        }
        
        // Reduce opacity of background disk (low freqWeight) based on uBgBrightness
        // High freqWeight = full opacity, low freqWeight = reduced by uBgBrightness
  opacityScale = mix(uBgBrightness, 1.0, highlightFactor);
      } else {
        // Plain grayscale
        colLin = vec3(s);
      }
      
      // Opacity from mapped density directly, scaled by density slider and opacityScale
      float sigma_a = max(s, 0.0) * uDensity * opacityScale;
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

// Gaussian blur shader for PSF simulation (separable - horizontal pass)
const blurVertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const blurFragmentShader = /* glsl */`
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uBlurSize;
  varying vec2 vUv;
  
  // Compute intensity as magnitude of color vector
  float getIntensity(vec3 rgb) {
    return length(rgb);
  }
  
  void main() {
    // Sample from center square region to maintain aspect ratio
    vec2 texSize = vec2(textureSize(tDiffuse, 0));
    float minDim = min(texSize.x, texSize.y);
    vec2 scale = minDim / texSize;
    vec2 offset = (vec2(1.0) - scale) * 0.5;
    vec2 centeredUv = vUv * scale + offset;
    
    if (uBlurSize < 0.1) {
      // No blur, just convert to intensity
      vec4 texel = texture2D(tDiffuse, centeredUv);
      float intensity = getIntensity(texel.rgb);
      gl_FragColor = vec4(intensity, intensity, intensity, 1.0);
      return;
    }
    
    float sum = 0.0;
    float weightSum = 0.0;
    
    float sigma = uBlurSize;
    float sigma2 = 2.0 * sigma * sigma;
    int kernelSize = int(min(ceil(sigma * 3.0), 15.0)); // Limit kernel size for performance
    
    // 2D Gaussian convolution
    for (int x = -15; x <= 15; x++) {
      for (int y = -15; y <= 15; y++) {
        if (abs(x) > kernelSize || abs(y) > kernelSize) continue;
        
        vec2 sampleOffset = vec2(float(x), float(y)) / uResolution;
        vec2 sampleUv = centeredUv + sampleOffset * scale;
        
        // Gaussian weight based on 2D distance
        float dist2 = float(x * x + y * y);
        float weight = exp(-dist2 / sigma2);
        
        vec4 sampleTexel = texture2D(tDiffuse, sampleUv);
        float sampleIntensity = getIntensity(sampleTexel.rgb);
        
        sum += sampleIntensity * weight;
        weightSum += weight;
      }
    }
    
    // Normalize by total weight
    float result = sum / max(weightSum, 0.001);
    gl_FragColor = vec4(result, result, result, 1.0);
  }
`;

const blurUniforms = {
  tDiffuse: { value: null },
  uResolution: { value: new THREE.Vector2(256, 256) },
  uBlurSize: { value: 2.0 },
};

const blurMaterial = new THREE.ShaderMaterial({
  uniforms: blurUniforms,
  vertexShader: blurVertexShader,
  fragmentShader: blurFragmentShader,
  depthTest: false,
  depthWrite: false,
});

// Full-screen quad for blur pass
const blurScene = new THREE.Scene();
const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial);
blurScene.add(blurQuad);

console.log('Gaussian blur setup complete', { 
  renderTargetSize: [renderTarget.width, renderTarget.height],
  blurTargetSize: [blurTarget.width, blurTarget.height],
  canvas2Size: [canvas2.width, canvas2.height]
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

// Compute observation-based camera quaternion from inclination (deg), phi (deg), pos angle (deg)
function computeObservationPose(inclDeg, phiDeg, posangDeg) {
  const i = inclDeg * Math.PI / 180;
  const p = phiDeg * Math.PI / 180;
  const pa = (Math.PI + posangDeg * Math.PI) / 180;
  // LOS toward observer
  const obs = new THREE.Vector3(
    Math.sin(i) * Math.sin(p),
    -Math.sin(i) * Math.cos(p),
    Math.cos(i)
  );
  const zCam = obs.clone().multiplyScalar(-1).normalize();
  // Unrolled basis
  let upRef = new THREE.Vector3(0,0,1);
  if (Math.abs(upRef.dot(zCam)) > 0.99) upRef = new THREE.Vector3(0,1,0);
  const x0 = new THREE.Vector3().crossVectors(upRef, zCam).normalize();
  const y0 = new THREE.Vector3().crossVectors(zCam, x0).normalize();
  // Roll by -posang about zCam
  const c = Math.cos(-pa), s = Math.sin(-pa);
  const xCam = x0.clone().multiplyScalar(c).add(y0.clone().multiplyScalar(s));
  const yCam = y0.clone().multiplyScalar(c).sub(x0.clone().multiplyScalar(s));
  // Basis matrix columns = x,y,z
  const m = new THREE.Matrix4().makeBasis(xCam, yCam, zCam);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return q;
}

// Default observation parameters
const OBS_DEFAULT = { incl: 47.5, phi: 0.0, posang: 312.0 };
let obsDefaultPose = null;

function applyObservationPose() {
  if (!obsDefaultPose) return;
  camera.quaternion.copy(obsDefaultPose);
  camera.updateProjectionMatrix();
  // Keep target at origin (disk centered) and set a consistent distance
  controls.target.set(0,0,0);
  // Preserve current distance from target along new forward
  const dist = camera.position.distanceTo(controls.target);
  const forward = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  camera.position.copy(controls.target.clone().sub(forward.multiplyScalar(dist)));
  controls.update();
}

function computeAndSetObservationDefault() {
  obsDefaultPose = computeObservationPose(OBS_DEFAULT.incl, OBS_DEFAULT.phi, OBS_DEFAULT.posang);
  applyObservationPose();
}

// UI: rendering mode
const modeSelect = document.getElementById('mode');
const freqSlider = document.getElementById('freqSlider');
const freqLabel = document.getElementById('freqLabel');
const freqValue = document.getElementById('freqValue');
const bgBrightnessSlider = document.getElementById('bgBrightness');
const bgBrightnessLabel = document.getElementById('bgBrightnessLabel');
const bgBrightnessValue = document.getElementById('bgBrightnessValue');
const broadeningSlider = document.getElementById('broadeningScale');
const broadeningLabel = document.getElementById('broadeningLabel');
const bandIntegrateCheckbox = document.getElementById('bandIntegrate');
const bandIntegrateLabel = document.getElementById('bandIntegrateLabel');
const weightGammaSlider = document.getElementById('weightGamma');
const weightGammaLabel = document.getElementById('weightGammaLabel');
const weightGammaValue = document.getElementById('weightGammaValue');
const showWeightCheckbox = document.getElementById('showWeight');
const showWeightLabel = document.getElementById('showWeightLabel');
const minSigmaChSlider = document.getElementById('minSigmaCh');
const minSigmaChLabel = document.getElementById('minSigmaChLabel');
const minSigmaChValue = document.getElementById('minSigmaChValue');
const broadeningValue = document.getElementById('broadeningValue');
const densityValue = document.getElementById('densityValue');
const blurSizeValue = document.getElementById('blurSizeValue');
const obsCamBtn = document.getElementById('obsCamBtn');
// PSF view rotation (image-plane) controls
const posangPSFSlider = document.getElementById('posangPSF');
const posangPSFValue = document.getElementById('posangPSFValue');

function updateMode() {
  renderMode = modeSelect.value === 'freq' ? 1 : 0;
  uniforms.uMode.value = renderMode;
  
  // Show/hide frequency slider based on mode
  if (renderMode === 1) {
    freqSlider.style.display = 'inline-block';
    freqLabel.style.display = 'inline-block';
    freqValue.style.display = 'inline-block';
  bgBrightnessSlider.style.display = 'inline-block';
  bgBrightnessLabel.style.display = 'inline-block';
  if (bgBrightnessValue) bgBrightnessValue.style.display = 'inline-block';
  // Temporarily hidden controls
  broadeningSlider.style.display = 'none';
  broadeningLabel.style.display = 'none';
  bandIntegrateCheckbox.style.display = 'none';
  bandIntegrateLabel.style.display = 'none';
  weightGammaSlider.style.display = 'none';
  weightGammaLabel.style.display = 'none';
  if (weightGammaValue) weightGammaValue.style.display = 'none';
  showWeightCheckbox.style.display = 'none';
  showWeightLabel.style.display = 'none';
  minSigmaChSlider.style.display = 'inline-block';
  minSigmaChLabel.style.display = 'inline-block';
  if (minSigmaChValue) minSigmaChValue.style.display = 'inline-block';
  if (broadeningValue) broadeningValue.style.display = 'inline-block';
  } else {
    freqSlider.style.display = 'none';
    freqLabel.style.display = 'none';
    freqValue.style.display = 'none';
  bgBrightnessSlider.style.display = 'none';
  bgBrightnessLabel.style.display = 'none';
  if (bgBrightnessValue) bgBrightnessValue.style.display = 'none';
  broadeningSlider.style.display = 'none';
  broadeningLabel.style.display = 'none';
  bandIntegrateCheckbox.style.display = 'none';
  bandIntegrateLabel.style.display = 'none';
  weightGammaSlider.style.display = 'none';
  weightGammaLabel.style.display = 'none';
  if (weightGammaValue) weightGammaValue.style.display = 'none';
  showWeightCheckbox.style.display = 'none';
  showWeightLabel.style.display = 'none';
  minSigmaChSlider.style.display = 'none';
  minSigmaChLabel.style.display = 'none';
  if (minSigmaChValue) minSigmaChValue.style.display = 'none';
  if (broadeningValue) broadeningValue.style.display = 'none';
  }
}
modeSelect.addEventListener('change', updateMode);
updateMode();
// Compute and apply observation default at startup
computeAndSetObservationDefault();
function updatePosangPSF() {
  if (!posangPSFSlider) return;
  const angDeg = parseFloat(posangPSFSlider.value);
  if (posangPSFValue) posangPSFValue.textContent = `${Math.round(angDeg)}°`;
  // Store angle for rotation during PSF draw
  window._psfRotationRad = angDeg * Math.PI / 180;
}
posangPSFSlider && posangPSFSlider.addEventListener('input', updatePosangPSF);
updatePosangPSF();

// UI: frequency slider
function updateFrequency() {
  const freqIdx = parseInt(freqSlider.value);
  freqData.currentFreqIdx = freqIdx;
  uniforms.uFSel.value = freqIdx;
  // Update UI display
  const freqValueElem = document.getElementById('freqValue');
  if (freqValueElem && Array.isArray(freqData.freqs) && freqData.freqs[freqIdx] != null) {
    const freqGHz = (freqData.freqs[freqIdx] / 1e9).toFixed(6);
    freqValueElem.textContent = `${freqGHz} GHz`;
  }
  // Optional: keep legacy mask computation for comparison (commented out to avoid CPU cost)
  // updateFrequencyMask(freqIdx);
}
freqSlider.addEventListener('input', updateFrequency);
// Initialize frequency display
if (freqData.loaded) {
  updateFrequency();
}

// Update freq slider bounds once data is loaded
(async function waitFreqData(){
  // Poll briefly for data load (simple approach)
  for (let i=0;i<50;i++) {
    if (freqData.loaded && Array.isArray(freqData.freqs) && freqData.freqs.length) {
      freqSlider.max = String(freqData.freqs.length - 1);
      updateFrequency();
      break;
    }
    await new Promise(r=>setTimeout(r, 100));
  }
})();

// UI: density and step
const densitySlider = document.getElementById('density');
const stepSlider = document.getElementById('step');
const logMinInput = document.getElementById('logMin');
const logMaxInput = document.getElementById('logMax');
function updateDensity() {
  uniforms.uDensity.value = parseFloat(densitySlider.value);
  if (densityValue) densityValue.textContent = `${Math.round(uniforms.uDensity.value)}`;
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

// UI: background brightness (frequency mode)
function updateBgBrightness() {
  uniforms.uBgBrightness.value = parseFloat(bgBrightnessSlider.value);
  if (bgBrightnessValue) bgBrightnessValue.textContent = `${uniforms.uBgBrightness.value.toFixed(2)}`;
}
bgBrightnessSlider.addEventListener('input', updateBgBrightness);
// Set default Disk opacity to 1.0
bgBrightnessSlider.value = '1.0';
updateBgBrightness();

// UI: broadening scale and band integration
function updateBroadening() {
  const val = parseFloat(broadeningSlider.value);
  uniforms.uBroadeningScale.value = isFinite(val) ? val : 1.0;
  if (broadeningValue) broadeningValue.textContent = `${uniforms.uBroadeningScale.value.toFixed(2)}x`;
  if (freqData.loaded && freqData.sigmaChannels) {
    const arr = freqData.sigmaChannels;
    let minS = Infinity, maxS = -Infinity, sumS = 0, n=0;
    const step = Math.max(1, Math.floor(arr.length / 40000));
    for (let i=0;i<arr.length;i+=step) {
      const eff = Math.max(arr[i] * uniforms.uBroadeningScale.value, uniforms.uMinSigmaCh.value);
      if (eff < minS) minS = eff; if (eff > maxS) maxS = eff; sumS += eff; n++;
    }
    if (n>0) console.info('Broadening update: effective sigma(ch)', { scale: uniforms.uBroadeningScale.value, min: minS, max: maxS, mean: sumS/n });
  }
  // Dynamic shader weighting uses updated uniform; no rebuild needed
}
broadeningSlider && broadeningSlider.addEventListener('input', updateBroadening);
updateBroadening();

function updateBandIntegrate() {
  uniforms.uUseBand.value = bandIntegrateCheckbox.checked ? 1 : 0;
  // Shader path handles toggle without CPU rebuild
}
bandIntegrateCheckbox && bandIntegrateCheckbox.addEventListener('change', updateBandIntegrate);
updateBandIntegrate();

// UI: weight gamma and showWeight
// Gamma fixed at 1.0 per request
uniforms.uWeightGamma.value = 1.0;
if (weightGammaValue) weightGammaValue.textContent = '1.00';

function updateShowWeight(){
  uniforms.uShowWeight.value = showWeightCheckbox.checked ? 1 : 0;
}
showWeightCheckbox && showWeightCheckbox.addEventListener('change', updateShowWeight);
updateShowWeight();

function updateMinSigma(){
  const v = parseFloat(minSigmaChSlider.value);
  uniforms.uMinSigmaCh.value = isFinite(v) ? v : 0.0;
  if (minSigmaChValue) minSigmaChValue.textContent = `${uniforms.uMinSigmaCh.value.toFixed(2)}`;
}
minSigmaChSlider && minSigmaChSlider.addEventListener('input', updateMinSigma);
// Set default Turbulence to 0.0
minSigmaChSlider.value = '0.0';
updateMinSigma();

// UI: blur size
const blurSizeSlider = document.getElementById('blurSize');
function updateBlurSize() {
  const blurSize = parseFloat(blurSizeSlider.value);
  blurUniforms.uBlurSize.value = blurSize;
  if (blurSizeValue) blurSizeValue.textContent = `${Math.round(blurSize)}`;
}
blurSizeSlider.addEventListener('input', updateBlurSize);
updateBlurSize();

// Button: Match observation camera
obsCamBtn && obsCamBtn.addEventListener('click', applyObservationPose);

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

  // Render original view to screen (left panel)
  renderer.render(scene, camera);
  
  // Render to texture for blur
  renderer.setRenderTarget(renderTarget);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  
  // Apply Gaussian blur - single pass from renderTarget to blurTarget
  blurUniforms.tDiffuse.value = renderTarget.texture;
  blurUniforms.uResolution.value.set(blurTarget.width, blurTarget.height);
  renderer.setRenderTarget(blurTarget);
  renderer.clear();
  renderer.render(blurScene, blurCamera);
  
  renderer.setRenderTarget(null);
  
  // Read pixels from final blur target (float format, values in [0,1+])
  const pixels = new Float32Array(blurTarget.width * blurTarget.height * 4);
  renderer.readRenderTargetPixels(blurTarget, 0, 0, blurTarget.width, blurTarget.height, pixels);
  
  // Extract intensities (grayscale, stored in R channel, values in [0,1+])
  const intensities = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const intensity = pixels[i]; // Float value, already grayscale
    intensities.push(intensity);
  }
  intensities.sort((a, b) => a - b);
  
  // Use a lower percentile as threshold to remove more of the base disk
  const threshold = intensities[Math.floor(intensities.length * 0.3)];
  
  // Find min and max intensity for normalization (only above threshold)
  let minIntensity = Infinity;
  let maxIntensity = -Infinity;
  for (let i = 0; i < pixels.length; i += 4) {
    const intensity = pixels[i];
    if (intensity > threshold) {
      if (intensity < minIntensity) minIntensity = intensity;
      if (intensity > maxIntensity) maxIntensity = intensity;
    }
  }
  
  // Create output pixel array for 8-bit display
  const outputPixels = new Uint8ClampedArray(blurTarget.width * blurTarget.height * 4);
  
  // Normalize intensities and apply Inferno colormap
  const range = maxIntensity - minIntensity;
  if (range > 0 && isFinite(minIntensity) && isFinite(maxIntensity)) {
    for (let i = 0; i < pixels.length; i += 4) {
      const intensity = pixels[i];
      const outIdx = i;
      
      if (intensity <= threshold) {
        // Below threshold: set to black (hide base disk)
        outputPixels[outIdx] = 0;
        outputPixels[outIdx + 1] = 0;
        outputPixels[outIdx + 2] = 0;
        outputPixels[outIdx + 3] = 255;
      } else {
        // Above threshold: normalize to [0,1] and apply Inferno colormap
        const normalized = (intensity - minIntensity) / range;
        const color = infernoColor(normalized);
        if (!color || color.length < 3) {
          console.error('Invalid color returned', normalized, color);
          outputPixels[outIdx] = 255;
          outputPixels[outIdx + 1] = 0;
          outputPixels[outIdx + 2] = 0;
          outputPixels[outIdx + 3] = 255;
        } else {
          outputPixels[outIdx] = color[0];
          outputPixels[outIdx + 1] = color[1];
          outputPixels[outIdx + 2] = color[2];
          outputPixels[outIdx + 3] = 255;
        }
      }
    }
  }
  
  // Create ImageData and draw to 2D canvas
  const imageData = ctx2d.createImageData(blurTarget.width, blurTarget.height);
  imageData.data.set(outputPixels);
  
  // Create temporary canvas to flip vertically
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = blurTarget.width;
  tempCanvas.height = blurTarget.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(imageData, 0, 0);
  
  // Flip vertically (WebGL has origin at bottom-left, canvas at top-left)
  ctx2d.save();
  // Clear
  ctx2d.clearRect(0,0,canvas2.width,canvas2.height);
  // Translate to center, apply rotation, then draw centered
  ctx2d.translate(canvas2.width/2, canvas2.height/2);
  const rot = window._psfRotationRad || 0;
  ctx2d.rotate(rot);
  // Flip vertical to correct origin, then rotate
  ctx2d.scale(1, -1);
  ctx2d.drawImage(tempCanvas, -canvas2.width/2, -canvas2.height/2, canvas2.width, canvas2.height);
  ctx2d.restore();
}
render();

// Expose helpers for console use
window.ppd = { camera, controls };
window.getPose = () => ({
  position: window.ppd.camera.position.toArray(),
  target: window.ppd.controls.target.toArray(),
  quaternion: window.ppd.camera.quaternion.toArray(),
  zoom: window.ppd.camera.zoom
});
window.applyPose = (p) => {
  const cam = window.ppd.camera, ctl = window.ppd.controls;
  cam.position.fromArray(p.position);
  cam.quaternion.fromArray(p.quaternion);
  cam.zoom = p.zoom;
  cam.updateProjectionMatrix();
  ctl.target.fromArray(p.target);
  ctl.update();
};