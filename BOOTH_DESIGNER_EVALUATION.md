# Booth Designer & Image Generation System Evaluation

## 📊 Overview

The system consists of:
1. **BoothDesigner.jsx** - Interactive booth design UI with AI chat
2. **generateBoothRender.ts** - AI-powered booth visualization generator
3. **generateBrandedProductImage.ts** - Product branding tool
4. **enrichProducts.ts** - Automated product data enhancement
5. **fetchBrandData.ts** - Brand identity retrieval

---

## 🎨 Booth Designer Flow

### User Journey:
```
1. Project Selection → Select existing or create new booth project
2. Setup → Enter booth size (10x10, 10x20, 20x20), design name, brand
3. AI Chat → Conversational design with booth_designer agent
4. Real-time Updates → Products added to booth, images generated
5. Quote Creation → Convert design to order with line items
```

### Key Features:
- **Conversational Design**: Users chat with AI to add products
- **Real-time Sync**: Live updates when products are added to BoothDesign entity
- **Project Persistence**: Save/load booth designs with conversation history
- **Visual Rendering**: Auto-generate photorealistic booth images

---

## 🖼️ Image Generation System

### 1. **Booth Rendering** (`generateBoothRender.ts`)

#### How It Works:
1. Fetches all products from BoothDesign by SKU
2. Collects product reference images
3. Builds detailed AI prompt with:
   - Exact booth dimensions (10x10, 10x20, 20x20)
   - Complete product manifest with quantities
   - Brand identity (name, colors from `brand_identity` or custom `brand_name`)
   - Layout instructions (optional custom placement)
   - Camera angle specifications (3/4 perspective)

4. **Two Modes:**
   - **Initial Render**: Creates booth from scratch using product images
   - **Iterative Mode**: Updates existing render, preserving layout/branding

5. Saves result to `design_image_url` with render history

#### Prompt Strategy:
```typescript
// INITIAL RENDER
"Create a photorealistic 3D architectural visualization of a 10x10 booth.
Contains EXACTLY [N] items: [product list]
- 3/4 perspective view
- Convention center setting
- Brand colors: [color] with brand name "[name]"
- STRICT: Only show listed products, no extras"

// ITERATIVE UPDATE
"Update existing booth render (last reference image).
Maintain camera angle, lighting, branding.
PRODUCT UPDATE: Now contains [updated list]
- Remove unlisted items
- Add new items
- Keep same backdrop/floor/lighting"
```

#### Strengths:
✅ Detailed product manifest prevents hallucinations
✅ Iterative mode preserves visual consistency
✅ Brand customization (name + color)
✅ Layout instructions support
✅ Render history tracking (last 10 versions)

#### Potential Issues:
⚠️ **No validation** that generated image actually contains correct products
⚠️ **Brand identity** relies on `brand_identity` entity or manual `brand_name` - may not always be populated
⚠️ **Camera angle** is requested but not enforced
⚠️ **Large booths** (20x20 with many products) might produce cluttered results
⚠️ **No lighting/material specifications** for products

---

### 2. **Branded Product Images** (`generateBrandedProductImage.ts`)

#### How It Works:
```typescript
Input: {
  brand_name: string,
  product_name: string,
  visual_description: string,
  original_image_url: string (optional)
}

Prompt: "Photorealistic trade show product: [name]
Visual: [description]
BRANDED for [brand_name] with logo, colors, typography
High-quality product render, white or trade show background"

Uses: original_image_url as reference if provided
```

#### Use Case:
Generate product mockups with client branding applied to generic displays.

#### Strengths:
✅ Simple, focused prompt
✅ Supports reference image
✅ White background option

#### Potential Issues:
⚠️ **Generic branding prompt** - no specific logo URL or color codes
⚠️ **No brand asset validation** - assumes AI knows the brand
⚠️ **No quality control** - no verification that logo was applied correctly

---

## 📈 Product Enrichment System

### **enrichProducts.ts** - Auto-populate product data

#### What It Does:
1. Finds up to 10 products missing `handbook_page` or `market_value`
2. Uses LLM with internet search to find:
   - **Handbook page number** (from 2026 Exhibitors Handbook)
   - **Market value** (estimated retail price)
3. Updates products with enriched data

#### Prompt:
```
"Find page number in 2026 Exhibitors Handbook for [product]
Search: '2026 Exhibitors Handbook [name] [SKU] page number'
Also find market value for [name] [SKU]
Return: { market_value: number, handbook_page: string }"
```

#### Integration Opportunity:
🔗 **Your catalog mapping system** could replace this!
Instead of LLM search, use your `product_catalog_page_mapping.json`:
```javascript
const mapping = loadMapping();
const pageData = mapping.find(p => p.product_sku === sku);
if (pageData) {
  product.handbook_page = pageData.primary_page;
}
```

#### Strengths:
✅ Automated batch processing
✅ Internet-connected LLM search
✅ JSON schema validation

#### Issues:
⚠️ **Unreliable**: LLM might not find correct pages
⚠️ **Slow**: 10 products at a time with internet searches
⚠️ **No verification**: Results aren't validated
⚠️ **Redundant**: You already have catalog page mappings!

---

## 🔧 Recommendations

### 1. **Improve Booth Rendering**

**Add validation layer:**
```typescript
// After image generation
const validation = await base44.integrations.Core.InvokeLLM({
  prompt: `Analyze this booth image. List all visible products.
  Expected: ${productNameList}
  Does the image contain ONLY these items? Any missing or extra?`,
  image_urls: [imageRes.url],
  response_json_schema: {
    type: "object",
    properties: {
      contains_all_expected: { type: "boolean" },
      missing_products: { type: "array", items: { type: "string" }},
      extra_products: { type: "array", items: { type: "string" }}
    }
  }
});
```

**Add brand asset support:**
```typescript
// Fetch actual brand assets
if (brandName) {
  const brandData = await base44.functions.fetchBrandData({ brand_name: brandName });
  if (brandData.logo_url) {
    referenceImageUrls.push(brandData.logo_url);
    brandingNote += ` Use the provided logo image for all branding graphics.`;
  }
}
```

### 2. **Replace enrichProducts with Your Catalog Data**

Create `enrichProductsFromCatalog.ts`:
```typescript
import mappingData from './orbus_catalog/product_catalog_page_mapping.json';

// For each product
const pageMapping = mappingData.product_page_mapping.find(
  m => m.product_sku === product.sku
);

if (pageMapping) {
  await base44.entities.Product.update(product.id, {
    handbook_page: pageMapping.primary_page.toString(),
    catalog_pages: pageMapping.pages // All pages this product appears on
  });
}
```

### 3. **Add Image Quality Metrics**

Track generation success:
```typescript
{
  render_attempts: number,
  last_validation_score: number, // 0-100
  user_approved: boolean,
  regeneration_reasons: string[]
}
```

### 4. **Booth Size Constraints**

Add product count limits:
```typescript
const limits = {
  '10x10': { max_products: 8, max_backwall_width: 10 },
  '10x20': { max_products: 15, max_backwall_width: 20 },
  '20x20': { max_products: 25, max_backwall_width: 20 }
};

if (products.length > limits[boothSize].max_products) {
  return { error: `${boothSize} booth can only fit ${limits[boothSize].max_products} products` };
}
```

### 5. **Render Preview Mode**

Add quick preview option:
```typescript
// Low-res quick preview (faster, cheaper)
const preview = await base44.integrations.Core.GenerateImage({
  prompt,
  existing_image_urls: referenceImageUrls,
  quality: 'draft', // Faster generation
  size: '512x512'
});

// User approves → generate full quality
if (userApproves) {
  const final = await generateFullQuality(preview.seed);
}
```

---

## 📋 Testing Checklist

- [ ] Test 10x10 booth with 3-5 products
- [ ] Test 10x20 booth with 8-12 products
- [ ] Test 20x20 booth with 15+ products
- [ ] Test iterative updates (add/remove products)
- [ ] Test with brand_name vs brand_identity
- [ ] Test layout_instructions feature
- [ ] Test render history rollback
- [ ] Verify product images are used as references
- [ ] Check branded product image generation
- [ ] Test quote creation from design
- [ ] Validate catalog page enrichment vs LLM enrichment

---

## 💡 Integration with Your Catalog System

**Your scraped catalog can enhance this system:**

1. **Product recommendations**: Use catalog categories to suggest complementary products
2. **Page references**: Show "See page X" links in chat when products are mentioned
3. **Accurate enrichment**: Replace LLM search with your catalog mappings
4. **Product templates**: Use actual template PDFs for technical specs
5. **Pricing data**: If you scraped prices, validate against market_value

---

## 🎯 Summary

**Strengths:**
- Comprehensive booth visualization system
- Conversational design interface
- Brand customization support
- Iterative rendering workflow

**Areas for Improvement:**
- Image validation/quality control
- Brand asset integration
- Use your catalog data instead of LLM enrichment
- Booth size constraints
- Preview/approval workflow

**Priority Actions:**
1. ✅ Replace `enrichProducts` with your catalog mappings
2. ✅ Add image validation layer
3. ✅ Implement booth size constraints
4. ✅ Test with real client brands and products
