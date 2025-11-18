# PPDViewer - Protoplanetary Disk 3D Volume Renderer for CO Emission Volume

`Three.js`-based volume ray tracer for visualizing recovered protoplanetary disk CO density volume. 
Renders the disk in 3D space with orthographic projection, with highlighting for emission per frequency, with a non-physical Gaussian PSF simulation preview, very-non-physical spectral broadening slider, and simple observational parameter controls with inclination and position angle.

## Features

### Core Rendering
- **Orthographic Volume Ray Marching**: Proper orthographic projection with parallel rays for consistent magnification across all viewing angles
- **External Data Loading**: Supports CO density volumes exported from `radjax` (RAW+JSON format) and frequency mapping data (NPY files)
- **Dual View System**: Main 3D volume view + PSF blurred thumbnail (256×256) with Inferno colormap
- **Debug Wireframe**: Optional white wireframe outline to visualize volume boundaries

## Data Requirements

The viewer expects data in the `./data/` directory:

### Frequency Mapping Data
- `freqs.json`: Array of frequency values in Hz
- `center_index.npy`: 3D array of center frequency indices per voxel
- `sigma_channels.npy`: 3D array of thermal broadening widths

### Volume Data (Optional)
- `co_volume_meanT_160x160x160.raw`: Float32 volume data
- `co_volume_meanT_160x160x160.json`: Metadata with shape and bounds

## Installation & Usage

```bash
# Start local server
python3 -m http.server 5173

# Open in browser
open http://localhost:5173/
```

## Controls

### Rendering Mode
- **Plain**: Grayscale volume rendering of just the disk CO density
- **Frequency Slice**: Doppler-shifted frequency slice 3D highlighting 

### Volume Controls
- **Density**: Opacity scaling (1-10x)
- **Step Size**: Ray marching step size (0.25-2.0x)
- **Log Window**: Min/max values for logarithmic mapping

### Frequency Mode
- **Frequency Slider**: Select observation frequency channel
- **Disk Opacity**: Background disk visibility (0.0-1.0)
- **Turbulence**: **NON-PHYSICAL** Minimum sigma broadening threshold (will be updated to physical model later)

### ALMA-view Simulation Controls
- **PSF Blur**: Gaussian kernel size for point spread function
- **Position Angle**: Image-plane rotation angle (PSF view only)

## Technical Details

### Shader Architecture
- **Frequency Weighting**: GPU-computed per-fragment Gaussian/band integration
- **Coordinate Transforms**: Automatic observer frame ↔ disk frame rotation
- **Absorption Model**: Beer-Lambert law with pre-multiplied alpha compositing

### Data Processing Pipeline
1. Load external volume and frequency data
2. Build velocity and broadening textures
3. Upload as 3D textures for GPU sampling
4. Real-time shader-based frequency weighting
5. Post-process PSF simulation with Inferno mapping

## Browser Requirements

- **WebGL2**: Required for 3D texture sampling and float render targets
- **Modern Browser**: Chrome 57+, Firefox 51+, Safari 15+, Edge 79+
- **Hardware**: Dedicated GPU recommended for smooth performance

## Data Format Specifications

### NPY Files
- Standard NumPy binary format with little-endian encoding
- Supported dtypes: `<f4`, `<f8`, `<i4`, `<i8`, `<u1`
- Shape information parsed from header

### Volume Metadata (JSON)
```json
{
  "shape": [nz, ny, nx],
  "bounds": {
    "x": [xmin, xmax],
    "y": [ymin, ymax], 
    "z": [zmin, zmax]
  }
}
```

## Console API

```javascript
// Get current camera state
const pose = window.getPose();

// Apply saved camera state
window.applyPose({
  position: [x, y, z],
  target: [tx, ty, tz],
  quaternion: [qx, qy, qz, qw],
  zoom: 1.0
});

// Access controls
window.ppd.camera  // Three.js camera
window.ppd.controls // OrbitControls instance
```
