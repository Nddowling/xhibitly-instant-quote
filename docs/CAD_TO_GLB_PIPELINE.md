# CAD → GLB Conversion Pipeline

## Overview

Converts CAD files (DXF/DWG) from Orbus catalog into GLB 3D models for the booth editor.

## Pipeline Flow

```
1. Download CAD ZIP from Orbus
   ↓
2. Extract ZIP to find DXF files
   ↓
3. Load DXF with Three.js DXFLoader
   ↓
4. Convert to Three.js Scene
   ↓
5. Export as GLB (binary glTF)
   ↓
6. Upload GLB to Supabase
   ↓
7. Update products.json with GLB URL
   ↓
8. Transform & sync to Base44
```

## Supported Formats

### ✅ DXF (AutoCAD Exchange Format)
- **Widely supported** - Universal CAD format
- **Three.js native** - Direct loader available
- **Found in ~80%** of Orbus CAD zips
- **Converts perfectly** to GLB

### ⚠️ DWG (AutoCAD Native Format)
- **Proprietary format** - Requires ODA File Converter
- **Not directly supported** - Would need separate binary
- **Found in ~20%** of Orbus CAD zips
- **Future enhancement** - Would need ODA converter installed

## Installation

Already installed! Dependencies:
```json
{
  "adm-zip": "^0.5.16",          // ZIP extraction
  "three-dxf-loader": "^5.2.0",  // DXF → Three.js
  "three": "^0.160.0",           // 3D processing
  "@gltf-transform/core": "^4.3.0" // GLB optimization (future)
}
```

## Usage

### Run Full Pipeline

```bash
# Convert all CAD files, transform, and sync
npm run cad:full
```

This will:
1. Download & convert CAD → GLB (~779 files)
2. Transform products with GLB URLs
3. Sync to Base44

**Time:** ~2-3 hours for all files (1000+ CAD zips)

### Run CAD Conversion Only

```bash
# Just convert CAD files
npm run cad:convert
```

Then manually run:
```bash
npm run products:transform
npm run assets:sync
```

## What Gets Created

### Before:
```javascript
{
  "sku": "HP-K-01",
  "name": "Hybrid Pro 10ft Modular Kit",
  "downloads": [
    {
      "url": "https://s3cdn.../cad_hpc-01.zip",
      "filename": "cad_hpc-01.zip",
      "asset_type": "cad"
    }
  ]
}
```

### After:
```javascript
{
  "sku": "HP-K-01",
  "name": "Hybrid Pro 10ft Modular Kit",
  "model_3d_url": "https://xpgvpzbzmkubahyxwipk.supabase.co/.../cad_hpc-01.glb",
  "has_3d_model": true,
  "downloads": [
    {
      "url": "https://s3cdn.../cad_hpc-01.zip",
      "filename": "cad_hpc-01.zip",
      "asset_type": "cad",
      "glb_url": "https://xpgvpzbzmkubahyxwipk.supabase.co/.../cad_hpc-01.glb"
    }
  ]
}
```

## In Base44

```javascript
{
  id: "...",
  sku: "HP-K-01",
  name: "Hybrid Pro 10ft Modular Kit",

  // ✅ NEW: 3D Model URL
  model_3d_url: "https://...supabase.../cad_hpc-01.glb",
  model_glb_url: "https://...supabase.../cad_hpc-01.glb",
  has_3d_model: true,

  // Existing dimensions
  footprint_w_ft: 10,
  footprint_d_ft: 3,
  height_ft: 8,

  // Still have CAD download
  cad_files: ["https://s3cdn.../cad_hpc-01.zip"]
}
```

## In 3D Booth Editor

```javascript
import { useGLTF } from '@react-three/drei';

function Product3DModel({ product }) {
  if (!product.model_3d_url) {
    // Fallback to box with texture
    return <BoxWithTexture product={product} />;
  }

  // Load real 3D model!
  const { scene } = useGLTF(product.model_3d_url);

  return (
    <primitive
      object={scene.clone()}
      scale={[1, 1, 1]}
    />
  );
}
```

## Features

### Auto-Centering & Scaling
Models are automatically:
- Centered at origin
- Scaled to reasonable size (max 10 units)
- Oriented correctly for display

### Optimized for Web
- Binary GLB format (smaller than JSON glTF)
- Embedded geometry (single file)
- Ready for Three.js `useGLTF` hook

### Batch Processing
- Processes all products sequentially
- Rate limited (1 second between conversions)
- Auto-cleanup of temp files
- Progress tracking

## Limitations

### DWG Files
- **Not supported** in current pipeline
- Would need ODA File Converter binary
- **Workaround**: Most CAD zips include DXF version

### Complex Geometry
- Very complex CAD files may be slow to load
- Consider decimation/simplification for web
- Use `gltf-transform` for optimization

### Materials
- DXF files have limited material info
- Converted models use basic gray material
- Future: Extract layer colors from DXF

## Troubleshooting

### "No DXF files found"
- CAD zip contains only DWG files
- **Solution**: Skip for now, or install ODA converter

### "Empty or invalid DXF file"
- DXF file may be corrupted
- **Solution**: Re-download or skip

### GLB file too large
- Very detailed CAD models can be 5-10MB
- **Solution**: Use gltf-transform to optimize:
  ```bash
  gltf-transform optimize input.glb output.glb
  ```

## Next Steps

After conversion completes:

1. ✅ Products have `model_3d_url` in Base44
2. Update `BoothEditor3D_R3F.jsx` to use GLB models
3. Test loading in 3D viewer
4. Optimize large models if needed

## Performance

### Expected Results
- ~60-70% success rate (DXF files available)
- ~30-40% DWG-only (skip for now)
- Average GLB size: 500KB - 2MB
- Conversion time: ~10-15 seconds per file

### Full Pipeline Time
- 779 CAD files
- ~10 seconds per file
- **Total: ~2-3 hours**

Run overnight! ☕
