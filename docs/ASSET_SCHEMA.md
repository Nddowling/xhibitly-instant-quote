# Asset Management Schema

## Supabase Storage Structure

```
orbus-assets/
├── products/
│   ├── {SKU}/
│   │   ├── image/
│   │   │   ├── product-front.png
│   │   │   ├── product-side.png
│   │   │   └── product-top.png
│   │   ├── template/
│   │   │   ├── graphic-template.pdf
│   │   │   ├── design-specs.ai
│   │   │   └── print-template.eps
│   │   ├── cad/
│   │   │   ├── booth-layout.dwg
│   │   │   ├── dimensions.dxf
│   │   │   └── sketchup-model.skp
│   │   ├── model_3d/
│   │   │   ├── product.glb
│   │   │   ├── product.obj
│   │   │   └── textures/
│   │   └── document/
│   │       ├── setup-instructions.pdf
│   │       └── specifications.pdf
```

## Base44 Entity: ProductAsset

Track all assets for each product:

```typescript
entity ProductAsset {
  // Core identification
  id: uuid (auto)
  product_id: uuid (FK → Product)
  product_sku: text

  // Asset details
  filename: text
  original_url: text
  supabase_url: text (public URL)
  storage_path: text

  // Categorization
  asset_type: text  // 'image', 'template', 'cad', 'model_3d', 'document', 'video'
  category: text    // 'product_image', 'graphic_template', 'cad_file', etc.
  file_extension: text
  mime_type: text

  // Metadata
  file_size_bytes: number
  width_px: number (for images)
  height_px: number (for images)
  duration_sec: number (for videos)

  // Usage tracking
  is_primary: boolean  // Primary product image
  display_order: number
  is_active: boolean
  download_count: number
  last_accessed: timestamp

  // Timestamps
  uploaded_at: timestamp
  created_at: timestamp
  updated_at: timestamp
}
```

## Updated Product Entity

Add Supabase asset references:

```typescript
entity Product {
  // ... existing fields ...

  // Asset references (Supabase URLs)
  primary_image_url: text       // Main product image
  images: array<text>           // All product images
  graphic_templates: array<text> // PDF/AI templates
  cad_files: array<text>        // DWG/DXF files
  model_3d_url: text            // GLB/OBJ model
  instruction_pdf_url: text     // Setup instructions
  spec_sheet_url: text          // Technical specs

  // Legacy fields (keep for migration)
  image_url: text               // External URL (deprecated)
  image_cached_url: text        // Local path (deprecated)

  // Asset counts
  total_assets: number
  has_3d_model: boolean
  has_cad_files: boolean
  has_templates: boolean
}
```

## Asset Usage in 3D Editor

```javascript
// Load product with all assets
const product = await base44.entities.Product.get(productId);

// Use Supabase URLs directly
<Model
  src={product.model_3d_url}  // https://xxx.supabase.co/.../product.glb
  fallback={product.primary_image_url}
/>

// Download template
<a href={product.graphic_templates[0]} download>
  Download Template
</a>

// View CAD file
<CADViewer src={product.cad_files[0]} />
```

## Migration Strategy

1. **Phase 1: Download & Upload** (scripts/downloadAllOrbusAssets.js)
   - Download all files from Orbus
   - Upload to Supabase Storage
   - Get public URLs

2. **Phase 2: Database Sync** (scripts/syncAssetsToBase44.js)
   - Create ProductAsset records
   - Update Product records with Supabase URLs
   - Set primary images

3. **Phase 3: Application Updates**
   - Update components to use Supabase URLs
   - Add asset browser
   - Enable template downloads

4. **Phase 4: Cleanup**
   - Deprecate external URLs
   - Remove local file references
   - Delete local cache

## Benefits

✅ **Own the assets** - No dependency on external sites
✅ **Fast loading** - Supabase CDN
✅ **Organized** - Clear folder structure
✅ **Scalable** - Easy to add more assets
✅ **Trackable** - Usage analytics
✅ **Reliable** - No broken links
✅ **Professional** - Real product files, not placeholders
