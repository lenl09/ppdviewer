# Three.js Volume Renderer (Sphere)

Simple volume ray marcher in Three.js that renders a 128×128×128 volume centered at the origin, with a sphere of radius 32 voxels. Includes two transfer functions (grayscale, hot) and two rendering modes (Direct Volume Rendering and Iso-surface).

## What it does
- Builds a 128³ Uint8 volume with a soft-edged sphere at the center
- Ray-marches a 3D texture inside a unit cube around the origin
- Applies a 1D transfer function texture (grayscale or hot)
- Fixed camera looking at the center
- Toggle between Direct Volume Rendering (DVR) and Iso-surface with a threshold slider

## Run locally
Use any static file server. On macOS with Python installed you can run:

```bash
# Option A: Python 3
python3 -m http.server 5173

# Option B: Node (if you prefer)
# npx serve -l 5173
```

Then open:

```
http://localhost:5173/
```

## Controls
- Transfer function: choose between Grayscale and Hot.
- Mode: choose between Direct Volume and Iso-surface.
- Iso threshold: active in Iso mode; sets the isovalue (0..1).

## Notes
- Requires a browser with WebGL2 and 3D texture support (sampler3D). Chrome, Edge, and Firefox support this.
- Step size is set to `0.75 / 128` for speed; reduce `uStep` for higher quality.
- The render uses front-to-back pre-multiplied alpha compositing with early-out.
 - Iso-surface mode shades the first threshold crossing using a simple headlight Lambert model; normals from central differences on the volume.
