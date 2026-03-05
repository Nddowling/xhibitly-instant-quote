# 3D Booth Editor - Base44 + Supabase + React Three Fiber

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Orbus Catalog (theexhibitorshandbook.com)                  │
│  - 364 products scraped                                      │
│  - 5,539 downloadable files matched                          │
└───────────────┬──────────────────────────────────────────────┘
                │ Downloaded & uploaded
                ↓
┌──────────────────────────────────────────────────────────────┐
│  Supabase Storage (Your CDN)                                 │
│  Bucket: orbus-assets                                        │
│  - Product images (PNG/JPG)                                  │
│  - 3D models (GLB)                                           │
│  - Templates (PDF/AI)                                        │
│  - CAD files (DWG/DXF)                                       │
│  Structure: /products/{SKU}/{category}/{filename}            │
└───────────────┬──────────────────────────────────────────────┘
                │ Public URLs
                ↓
┌──────────────────────────────────────────────────────────────┐
│  Base44 Product Entities                                     │
│  - id, sku, name, category                                   │
│  - footprint_w_ft, footprint_d_ft, height_ft                 │
│  - primary_image_url (Supabase)                              │
│  - model_3d_url (Supabase GLB)                               │
│  - graphic_templates[] (Supabase PDFs)                       │
│  - cad_files[] (Supabase DWG/DXF)                            │
└───────────────┬──────────────────────────────────────────────┘
                │ useEntity('Product')
                ↓
┌──────────────────────────────────────────────────────────────┐
│  BoothEditorPage.jsx (React Component)                       │
│  - Fetches products from Base44                              │
│  - Filters by category                                       │
│  - Manages booth size selection                              │
└───────────────┬──────────────────────────────────────────────┘
                │ props: availableProducts[]
                ↓
┌──────────────────────────────────────────────────────────────┐
│  BoothEditor3D_R3F.jsx (React Three Fiber)                   │
│  - Canvas with PerspectiveCamera                             │
│  - OrbitControls for camera manipulation                     │
│  - Lighting (ambient + directional)                          │
│  - BoothFloor component (grid + boundaries)                  │
│  - ProductMesh components (one per product)                  │
│    - useTexture() loads image from Supabase URL              │
│    - Creates box geometry with product dimensions            │
│    - Applies texture to front face                           │
│  - Product library sidebar                                   │
│  - AI suggestions panel                                      │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Product Data Flow

```javascript
// Base44 Product entity structure
{
  id: "abc123",
  sku: "IMG-800-S",
  name: "Imagine 800 Retractable Banner Stand",
  category: "banners",

  // Dimensions (feet)
  footprint_w_ft: 2.66,
  footprint_d_ft: 1.0,
  height_ft: 6.66,

  // Supabase URLs
  primary_image_url: "https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets/products/IMG-800-S/image/imagine-800-front.png",

  model_3d_url: "https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets/products/IMG-800-S/model_3d/imagine-800.glb",

  graphic_templates: [
    "https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets/products/IMG-800-S/template/GT_Imagine.pdf"
  ],

  cad_files: [
    "https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets/products/IMG-800-S/cad/imagine-800.dwg"
  ]
}
```

### 2. React Three Fiber Components

#### ProductMesh Component
```javascript
function ProductMesh({ product, position }) {
  // Load texture from Supabase
  const texture = useTexture(product.primary_image_url);

  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[
        product.footprint_w_ft,
        product.height_ft,
        product.footprint_d_ft
      ]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}
```

#### Scene Setup
```javascript
<Canvas shadows>
  <PerspectiveCamera makeDefault position={[12, 15, 15]} />
  <OrbitControls />

  {/* Lighting */}
  <ambientLight intensity={0.6} />
  <directionalLight position={[10, 20, 10]} castShadow />

  {/* Floor & Grid */}
  <BoothFloor width={10} depth={10} />

  {/* Products with texture loading */}
  <Suspense fallback={null}>
    {products.map(p => (
      <ProductMesh key={p.id} product={p} />
    ))}
  </Suspense>
</Canvas>
```

## Setup Instructions

### 1. Assets Pipeline (Already Complete ✅)

```bash
# 1. Scrape downloadable resources (done)
npm run scrape:resources

# 2. Match files to products (done)
npm run scrape:match

# 3. Download all assets & upload to Supabase (in progress)
npm run assets:download

# 4. Sync Supabase URLs to Base44 Product entities (next step)
npm run assets:sync
```

### 2. Start Using the 3D Editor

Add route to your app:

```javascript
// src/App.jsx or router config
import BoothEditorPage from './pages/BoothEditorPage';

// Add route
<Route path="/booth-editor" element={<BoothEditorPage />} />
```

### 3. Navigate to Editor

```
http://localhost:5173/booth-editor
```

## Features

### ✅ Working Now
- [x] Fetch products from Base44
- [x] Display in product library sidebar
- [x] Click to add to 3D scene
- [x] Products render with correct dimensions
- [x] Textures load from Supabase URLs
- [x] OrbitControls camera manipulation
- [x] Click products to remove
- [x] Booth size selector
- [x] Category filter

### 🚧 Next Steps
- [ ] Drag-and-drop product placement
- [ ] Rotate products
- [ ] Load 3D models (GLB files)
- [ ] AI suggestions integration
- [ ] Save booth designs to Base44
- [ ] Export to PDF/PNG
- [ ] VR walkthrough mode

## Technical Details

### React Three Fiber Benefits

1. **Declarative 3D**: JSX for 3D objects instead of imperative Three.js API
2. **React Hooks**: Use React state, effects, and context
3. **Automatic Cleanup**: No manual dispose() calls
4. **Better Performance**: Efficient reconciliation
5. **Built-in Helpers**: useTexture, useGLTF, etc.

### Texture Loading

```javascript
// Old way (vanilla Three.js)
const loader = new THREE.TextureLoader();
loader.load(url, (texture) => {
  material.map = texture;
});

// New way (React Three Fiber)
const texture = useTexture(url); // Automatic loading + caching
```

### 3D Model Loading (GLB)

```javascript
import { useGLTF } from '@react-three/drei';

function Product3DModel({ modelUrl }) {
  const { scene } = useGLTF(modelUrl);
  return <primitive object={scene} />;
}
```

## Performance Optimization

### 1. Texture Caching
- `useTexture` automatically caches textures
- Multiple products with same image share texture

### 2. Suspense Boundaries
- Lazy load textures without blocking UI
- Show loading states gracefully

### 3. Instancing (Future)
- For many identical products, use `InstancedMesh`
- Reduces draw calls significantly

## Data Ownership

### You Own Everything! 🎯

```
Orbus Website
    ↓ (one-time scrape)
Supabase Storage (YOUR CDN)
    ↓ (permanent URLs)
Base44 Entities (YOUR DATABASE)
    ↓ (useEntity hook)
React App (YOUR CODE)
```

**No external dependencies!**
- ✅ All product images hosted on Supabase
- ✅ All 3D models on Supabase
- ✅ All templates/CAD files on Supabase
- ✅ Fast CDN delivery
- ✅ Full control

## AI Integration ("Remote Control")

The AI layer will:
1. Accept natural language queries ("Add a counter at the back")
2. Call Claude API to parse intent
3. Find matching products from Base44
4. Calculate optimal positions
5. Return suggestions to 3D editor
6. User clicks "Apply" to add to scene

```javascript
// AI Suggestion format
{
  description: "Add an 8ft banner stand at the back center",
  product: { /* Base44 Product entity */ },
  position: { x: 0, z: -4.5 },
  rotation: 0,
  reasoning: "Provides backdrop for booth, maximizes visibility"
}
```

## Troubleshooting

### Images not loading?
- Check Supabase bucket is public
- Verify `primary_image_url` in Base44 entities
- Check browser console for CORS errors

### 3D scene blank?
- Products need `footprint_w_ft`, `footprint_d_ft`, `height_ft`
- Check camera position
- Ensure lighting is added

### Slow performance?
- Reduce number of visible products
- Use lower-res textures for thumbnails
- Implement LOD (Level of Detail)

## Next: Asset Sync

Once `npm run assets:download` completes, run:

```bash
npm run assets:sync
```

This will update all Base44 Product entities with Supabase URLs! 🚀
