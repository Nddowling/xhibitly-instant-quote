# Orbus Catalog - Ready for Import

## 📊 Summary

**Status:** ✅ Ready for Base44 import

| Metric | Value |
|--------|-------|
| **Total Products** | 345 |
| **Products with SKU** | 345 (100%) |
| **Products with Images** | 345 (100%) |
| **Products with Dimensions** | 311 (90%) |
| **Source** | theexhibitorshandbook.com |
| **Last Updated** | March 3, 2026 |

## 📁 Files

### Main Files
- `products.json` - Raw scraped data (364 products, 3.3MB)
- `products_transformed.json` - **Transformed & ready for import** (345 products, 1.2MB)
- `TRANSFORMATION_REPORT.md` - Detailed transformation report

### Assets (Downloaded Locally)
- `images/` - 45 product images
- `templates/` - 45 graphic templates
- `other/` - 44 other resources (PDFs, instructions)

## 🚀 How to Import to Base44

### Step 1: Review the Data
```bash
# View sample products
jq '.products[0:5]' orbus_catalog/products_transformed.json

# Check statistics
jq '.metadata' orbus_catalog/products_transformed.json
```

### Step 2: Run Import Script
```bash
# Make sure you have .env.local configured with Base44 credentials
node scripts/importOrbusToBase44.js
```

The script will:
- ✅ Check for existing products (skip duplicates)
- ✅ Import all 345 products to Base44
- ✅ Show progress and statistics
- ✅ Track successes, errors, and skipped items

## 📋 Schema Mapping

The transformed data matches your Product entity schema:

| Schema Field | Status | Notes |
|--------------|--------|-------|
| `sku` | ✅ 100% | All products have SKUs |
| `name` | ✅ 100% | Product names |
| `description` | ✅ 100% | Product descriptions |
| `category` | ✅ 100% | e.g., "Retractable", "Fabric Light Boxes" |
| `subcategory` | ✅ 100% | Subcategory within main category |
| `product_line` | ✅ 100% | Product line names |
| `booth_sizes` | ✅ Extracted | Compatible booth sizes |
| `price_tier` | ✅ Derived | Modular/Hybrid/Custom |
| `pricing_category` | ✅ Derived | backwall, counter, banner, etc. |
| `footprint_w_ft` | ✅ 90% | Width in feet |
| `footprint_d_ft` | ✅ 90% | Depth in feet |
| `height_ft` | ✅ 90% | Height in feet |
| `dimensions` | ✅ 100% | Raw dimension string |
| `image_url` | ✅ 100% | External image URL |
| `image_cached_url` | ✅ 100% | Local cached path |
| `template_urls` | ✅ 100% | Graphic template links |
| `instruction_urls` | ✅ 100% | Setup instruction links |
| `design_style` | ✅ Derived | modern, fabric, backlit, etc. |
| `render_kind` | ✅ Derived | box, billboard, glb |
| `is_active` | ✅ Default | All set to true |
| `customizable` | ✅ Default | All set to true |
| `source` | ✅ 100% | theexhibitorshandbook.com |
| `original_url` | ✅ 100% | Source product page |
| `imported_at` | ✅ Auto | ISO timestamp |
| `raw_attributes` | ✅ 100% | Original scraped attributes |
| **Pricing fields** | ⚠️ NULL | Need external pricing data |

## 💰 Pricing Data (TODO)

The following fields are set to `null` and need pricing data:
- `base_price`
- `rental_price`
- `market_value`
- `dealer_cost`
- `dealer_margin_percent`
- `retail_price`

You can add pricing later with a separate update script.

## 📦 Sample Products

### Banner Stand Example
```json
{
  "sku": "BLD-LT-1200",
  "name": "Blade Lite 1200 Retractable Banner Stand",
  "footprint_w_ft": 4.08,
  "footprint_d_ft": 0.72,
  "height_ft": 7.17,
  "image_url": "https://www.theexhibitorshandbook.com/media/catalog/product/...",
  "image_cached_url": "/images/retractable/blade_lite_1200...",
  "render_kind": "billboard",
  "category": "Retractable",
  "price_tier": "Modular"
}
```

### Light Box Example
```json
{
  "sku": "VF-ESS-LB-S-01",
  "name": "Vector Frame Essential Light Box 0808",
  "footprint_w_ft": 8.0,
  "footprint_d_ft": 1.31,
  "height_ft": 8.06,
  "image_url": "https://www.theexhibitorshandbook.com/media/catalog/product/...",
  "image_cached_url": "/images/fabric_light_boxes/vector_frame...",
  "render_kind": "box",
  "category": "Fabric Light Boxes",
  "price_tier": "Modular"
}
```

## 🎨 Rendering in 3D

The transformed products include `render_kind` to help your 3D booth renderer:

- **`billboard`** - Flat standing display (e.g., banner stands)
- **`box`** - 3D box with dimensions (e.g., counters, kiosks, light boxes)
- **`glb`** - Use 3D model if `model_glb_url` is provided

Use `footprint_w_ft`, `footprint_d_ft`, and `height_ft` to position products in the booth layout.

## 🐛 Known Issues

### 34 Products Missing Dimensions
Products like table throws, accessory kits, and variable-size items don't have parsed dimensions. These can be:
1. Assigned default dimensions (e.g., 1x1 footprint for accessories)
2. Created as multiple SKU variants for different sizes
3. Marked as accessories that don't take up booth space

### Quote Parsing
The transformation script handles both straight quotes (`"`) and curly quotes (`"`) using Unicode normalization.

## 📞 Next Steps

1. ✅ **Data is ready** - Transformed to schema
2. ⏭️ **Import to Base44** - Run `node scripts/importOrbusToBase44.js`
3. ⏭️ **Test 3D rendering** - Use footprint dimensions in BoothSnapshotRenderer
4. ⏭️ **Add pricing data** - Import from dealer price sheets
5. ⏭️ **Handle edge cases** - Fill in missing dimensions for 34 products

## 🔧 Scripts Available

- `scripts/transformOrbusToSchema.js` - Transform raw data to schema ✅ Done
- `scripts/importOrbusToBase44.js` - Import to Base44 (updated) ⏭️ Ready to run
- `scripts/ingestCatalog.js` - PDF ingestion (deprecated, web scraping used instead)

---

**Ready to import?** Run:
```bash
node scripts/importOrbusToBase44.js
```
