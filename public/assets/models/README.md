# 3D Models for Booth Walkthrough

This directory contains 3D models (GLB/GLTF format) used in the booth walkthrough feature.

## Current Status: POC Placeholder Models

Currently using placeholder models for proof of concept. These will be replaced with actual Orbus product models.

## Sourcing Production Models

When ready for production, obtain actual Orbus booth models in GLB format from:

### Option 1: Orbus Marketing Team
Contact Orbus marketing/product team for:
- Formulate booth models
- Product display models
- Branded signage models

### Option 2: Create from CAD Files
If Orbus has CAD files (.step, .stl, .obj):
1. Use Blender (free) to convert to GLB
2. Optimize mesh for web (reduce poly count)
3. Apply brand textures/materials
4. Export as GLB with compression

### Option 3: Professional 3D Modeling
Commission professional 3D artists to create models based on:
- Product photos
- Booth blueprints
- Brand guidelines

## Free Placeholder Sources (Current POC)

For testing and POC development:

1. **Sketchfab** (CC license models)
   - https://sketchfab.com/search?q=exhibition+booth&type=models
   - Look for "Download 3D Model" button
   - Select GLB format

2. **Khronos glTF Samples**
   - https://github.com/KhronosGroup/glTF-Sample-Assets
   - Standards-compliant test models
   - Good for testing viewer functionality

3. **CGTrader Free Models**
   - https://www.cgtrader.com/free-3d-models/exhibition
   - Some free GLB models available
   - Check license before use

4. **TurboSquid Free Section**
   - https://www.turbosquid.com/Search/3D-Models/free/gltf
   - Limited free models
   - Check export format compatibility

## Model Requirements

### Technical Specs
- Format: GLB (binary GLTF) preferred
- Max file size: 10MB per model
- Polygon count: < 100k triangles
- Textures: Embedded in GLB, max 2048x2048
- Materials: PBR (Physically Based Rendering)

### Branding Integration
Models should support:
- Dynamic color changes (via material properties)
- Texture replacement (for logos/graphics)
- Modular components (for customization)

## Model Organization

```
models/
├── booths/
│   ├── booth-budget.glb (10x10 basic booth)
│   ├── booth-hybrid.glb (10x20 mid-tier)
│   └── booth-custom.glb (20x20 premium)
├── furniture/
│   ├── display-table.glb
│   ├── info-desk.glb
│   └── seating.glb
└── displays/
    ├── banner-stand.glb
    ├── monitor-stand.glb
    └── product-pedestal.glb
```

## Testing New Models

1. Place GLB file in appropriate subdirectory
2. Update `models-manifest.json`
3. Test in 3D viewer component
4. Verify brand color application works
5. Check file size and load time

## Brand Color Application

The 3D viewer automatically applies brand colors to specific materials:
- Primary color: Main booth panels/walls
- Secondary color: Accent elements
- Logo textures: Can be swapped dynamically

To make a model support this:
1. Name materials descriptively (e.g., "wall_panel", "accent_bar")
2. Use standard PBR materials
3. Keep base colors neutral for easy tinting

## Performance Optimization

Before adding models to production:
1. Use glTF-Transform CLI to optimize
   ```bash
   npx gltf-transform optimize input.glb output.glb
   ```
2. Test on mobile devices
3. Monitor load times in browser DevTools
4. Consider texture compression (KTX2, Basis Universal)

## Future Enhancements

- **Interactive hotspots**: Click to learn about products
- **Material configurator**: Real-time material swapping
- **Animation**: Booth assembly sequences
- **AR support**: View booth in real space (USDZ for iOS)
