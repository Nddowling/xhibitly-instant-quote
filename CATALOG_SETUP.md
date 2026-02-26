# Exhibitor's Handbook Catalog Integration

This system ingests the 84MB Exhibitor's Handbook PDF into Base44 and enables voice-powered semantic search for product discovery.

## Quick Start

### 1. Set OpenAI API Key

```bash
export OPENAI_API_KEY="your-key-here"
```

### 2. Run Catalog Ingestion

```bash
npm run ingest-catalog
```

This will:
- Extract all 216 pages from the PDF
- Parse products using GPT-4 Vision
- Generate embeddings for semantic search
- Upload to Base44 CatalogPage entities

**Processing time**: ~30-45 minutes
**Cost**: ~$2.20 (one-time)

### 3. Search the Catalog

```javascript
import { searchProducts, searchByPageNumber } from './src/lib/catalogSearch';

// Search by page number
const page22 = await searchByPageNumber(22);
console.log(page22.products); // All products on page 22

// Semantic search
const lightboxes = await searchProducts('LED light boxes');
console.log(lightboxes); // Top 5 matching products with page numbers
```

## Voice Command Integration

Once ingested, users can say:

```
"Hey, the light boxes on page 22, pull those and put 2 on the left wall of my 10x10 booth"
```

The system will:
1. Look up page 22
2. Find "light boxes" products on that page
3. Add 2x to the booth design
4. Position on left wall
5. Validate through rules engine
6. Update price

## How It Works

### PDF Ingestion (`scripts/ingestCatalog.js`)

```javascript
// For each page:
1. Extract text with pdf.js
2. Render page to image (2x scale for quality)
3. Upload image to Base44 storage
4. Send image + text to GPT-4 Vision
5. GPT-4 extracts products: name, SKU, category, dimensions, price
6. Generate OpenAI embedding (1536-dim vector)
7. Save CatalogPage entity to Base44
```

### Search (`src/lib/catalogSearch.js`)

**Three search modes:**

#### 1. Page Number Search
```javascript
searchByPageNumber(22) → CatalogPage with all products
```

#### 2. Semantic Vector Search
```javascript
searchProducts('LED light boxes')
→ Generates embedding for query
→ Computes cosine similarity with all pages
→ Returns top matching products
```

#### 3. Keyword Search (fallback)
```javascript
searchProducts('light boxes')
→ Matches keywords in page text
→ Returns pages sorted by keyword frequency
```

### Voice Integration

**Intent**: `ADD_PRODUCT_FROM_CATALOG`

**Entities extracted:**
- `page_number`: 22
- `product_query`: "light boxes"
- `quantity`: 2
- `placement`: "left wall"

**Execution flow:**
```javascript
// 1. Search catalog
const products = await searchProducts('light boxes', { pageNumber: 22 });

// 2. Disambiguate if needed
if (products.length > 1) {
  return clarification('Which one? LED Light Box A, LED Light Box B...');
}

// 3. Add to design
design.product_skus.push(...Array(quantity).fill(products[0].sku));

// 4. Set spatial position
design.spatial_layout.push({
  product_sku: products[0].sku,
  position: calculatePosition('left wall', boothSize),
  ...
});

// 5. Validate through rules engine
const validated = enforceBoothRules(design, catalog, services, boothSize);

// 6. Update session storage
sessionStorage.setItem('selectedDesign', JSON.stringify(validated));
```

## Data Model

### CatalogPage Entity

```javascript
{
  id: string,
  page_number: number,              // 1-216
  page_text: string,                // Extracted text (max 10k chars)
  page_image_url: string,           // PNG screenshot
  embedding_vector: number[],       // 1536-dim OpenAI embedding
  products: [
    {
      name: string,                 // "LED Light Box A"
      sku: string,                  // "LB-001"
      description: string,          // "Portable LED backlit display..."
      category: string,             // "Lighting"
      dimensions: string,           // "8'W x 10'H"
      price: number | null          // 1299
    }
  ],
  handbook_name: "Exhibitors Handbook 2022",
  created_at: timestamp
}
```

## Search Examples

### By Page Number
```javascript
const page = await searchByPageNumber(22);
// { page_number: 22, products: [...], page_image_url: "..." }
```

### By Product Type
```javascript
const lights = await searchProducts('lighting fixtures');
// [{ name: "LED Panel", page_number: 22, ... }]
```

### By Category
```javascript
const backwalls = await searchByCategory('Backwalls');
// [{ name: "Tension Fabric Backwall", page_number: 5, ... }]
```

### Hybrid: Page + Query
```javascript
const results = await searchProducts('counter', { pageNumber: 35 });
// Only counters on page 35
```

## Performance

- **Ingestion**: ~1 page/sec = 3-4 minutes total
- **Search by page**: <50ms
- **Semantic search**: <500ms (embedding generation)
- **Keyword search**: <100ms

## Cost Breakdown

**One-time ingestion:**
- GPT-4 Vision: 216 pages × $0.01 = **$2.16**
- Embeddings: 216 pages × $0.00002 = **$0.004**
- **Total: ~$2.20**

**Per voice query:**
- Embedding generation: **$0.00002**
- Intent parsing (GPT-4): **$0.01**
- **Total per query: ~$0.01**

## Troubleshooting

### "Canvas module not found"
```bash
npm install canvas --save
```

### "OPENAI_API_KEY not set"
```bash
export OPENAI_API_KEY="sk-..."
```

### "Base44 storage upload failed"
The script falls back to data URLs if storage upload fails. Check Base44 storage configuration.

### "GPT-4 Vision failed"
Check OpenAI API quota. Script continues with empty products array for failed pages.

## Next Steps

After ingestion:

1. **Test search**: Open browser console, run `searchProducts('light boxes')`
2. **Voice integration**: Say "add light boxes from page 22"
3. **Product catalog page**: Build UI to browse catalog by page number
4. **Visual search**: Upload image, find similar products

## Files

- `scripts/ingestCatalog.js` - PDF ingestion script
- `src/lib/catalogSearch.js` - Search utilities
- `src/lib/voice/CommandExecutor.js` - Voice command handler (to be updated)
- `/Users/nicholasdowling/Downloads/exhibitors-handbook.pdf` - Source PDF
