# Base44 Product Entity Schema

## Required Entity Configuration in Base44

You need to ensure the **Product** entity in Base44 has these fields:

### Core Fields
```typescript
{
  // Identity
  sku: string (unique, required)
  name: string (required)
  category: string
  subcategory: string

  // Content
  description: text
  image_url: string (url)
  product_url: string (url)

  // Pricing
  base_price: number (decimal)
  market_value: number (decimal)

  // Catalog References
  handbook_page: string
  catalog_pages: array<number>

  // Downloads
  template_urls: array<string>
  instruction_urls: array<string>

  // Product Details
  sizes: array<string>
  colors: array<string>
  features: array<string>
  raw_attributes: json

  // Source Tracking
  source: string
  imported_at: datetime
}
```

## How to Add These Fields in Base44

### Option 1: Via Base44 Admin UI
1. Go to Base44 Admin → Entities → Product
2. Click "Add Field" for each missing field
3. Set field types as shown above
4. Save entity schema

### Option 2: Via Base44 Schema Definition (if you have access)
```typescript
// In your Base44 project schema
entities: {
  Product: {
    fields: {
      // ... existing fields ...

      // Add these new fields:
      template_urls: { type: 'array', items: { type: 'string' } },
      instruction_urls: { type: 'array', items: { type: 'string' } },
      handbook_page: { type: 'string' },
      catalog_pages: { type: 'array', items: { type: 'number' } },
      source: { type: 'string' },
      imported_at: { type: 'datetime' },
      raw_attributes: { type: 'json' },
      sizes: { type: 'array', items: { type: 'string' } },
      colors: { type: 'array', items: { type: 'string' } },
      features: { type: 'array', items: { type: 'string' } }
    }
  }
}
```

## Field Descriptions

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `sku` | string | Unique product identifier | `"BLD-LT-800"` |
| `name` | string | Product display name | `"Blade Lite 800 Retractable Banner Stand"` |
| `category` | string | Primary category | `"Retractable"` |
| `subcategory` | string | Secondary category path | `"Banner Stands > Retractable"` |
| `description` | text | Product description | `"Professional retractable banner stand..."` |
| `image_url` | url | Main product image | `"https://s3cdn.theexhibitorshandbook.com/..."` |
| `product_url` | url | Original product page | `"https://www.theexhibitorshandbook.com/..."` |
| `base_price` | decimal | Your cost/base price | `299.99` |
| `market_value` | decimal | Retail market value | `499.99` |
| `handbook_page` | string | Primary catalog page | `"9"` |
| `catalog_pages` | array | All pages product appears on | `[9, 12, 58]` |
| `template_urls` | array | Graphic template downloads | `["https://.../GT_BladeLite800.pdf"]` |
| `instruction_urls` | array | Setup instruction PDFs | `["https://.../IS_BladeLite.pdf"]` |
| `sizes` | array | Available sizes | `["33\" x 80\"", "33\" x 90\""]` |
| `colors` | array | Available colors | `["Silver", "Black"]` |
| `features` | array | Product features | `["Adjustable Height", "Lightweight"]` |
| `raw_attributes` | json | Additional metadata | `{"weight": "12 lbs", ...}` |
| `source` | string | Import source identifier | `"orbus_catalog_scrape"` |
| `imported_at` | datetime | Import timestamp | `"2026-02-25T18:30:00Z"` |

## Indexes (Recommended)

For better query performance, add indexes on:
- `sku` (unique index)
- `category`
- `source`
- `handbook_page`

## Relationships

The Product entity should relate to:
- **LineItem** - Products in orders
- **BoothDesign** - Products in booth designs (via `product_skus` array)

## Required Before Import

✅ Ensure these fields exist in your Product entity:
- [ ] `template_urls` (array<string>)
- [ ] `instruction_urls` (array<string>)
- [ ] `handbook_page` (string)
- [ ] `catalog_pages` (array<number>)
- [ ] `source` (string)
- [ ] `imported_at` (datetime)
- [ ] `raw_attributes` (json)
- [ ] `sizes` (array<string>)
- [ ] `colors` (array<string>)
- [ ] `features` (array<string>)

If any fields are missing, the import function will fail for those fields.

## After Import

You can enrich products with:
1. **Market values** - Run `enrichProducts` function (or use your own pricing data)
2. **Brand compatibility** - Tag which products work with which brands
3. **3D models** - Add 3D model URLs if available
4. **Variants** - Create product variants for different sizes/colors

## Testing Import

Test with preview mode first:
```bash
# In Base44 Admin or via API
POST /functions/importOrbusProducts
{
  "mode": "preview",
  "skip_existing": true
}

# Returns preview without actually importing
```

Then import for real:
```bash
POST /functions/importOrbusProducts
{
  "mode": "import",
  "skip_existing": true,
  "batch_size": 50
}
```
