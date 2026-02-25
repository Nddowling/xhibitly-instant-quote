import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai@4.52.0';

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && !user.is_sales_rep) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ── ACTION: Import a pre-processed JSON page ──
    if (action === 'import_page') {
      const { page_data, image_url } = body;
      
      // Build the record
      const record = {
        page_number: page_data.page_number,
        handbook_name: page_data.handbook_name || "Exhibitors Handbook 2022",
        page_text: page_data.page_text || "",
        page_image_url: image_url || "",
        products: page_data.products || [],
        section: page_data.section || "",
        is_processed: (page_data.products && page_data.products.length > 0)
      };

      // Check if page already exists
      const existing = await base44.asServiceRole.entities.CatalogPage.filter({
        page_number: page_data.page_number,
        handbook_name: record.handbook_name
      });

      let savedPage;
      if (existing.length > 0) {
        await base44.asServiceRole.entities.CatalogPage.update(existing[0].id, record);
        savedPage = { ...existing[0], ...record };
      } else {
        savedPage = await base44.asServiceRole.entities.CatalogPage.create(record);
      }

      return Response.json({ success: true, page: savedPage });
    }

    // ── ACTION: Extract products from a page image using GPT-4 Vision ──
    if (action === 'extract_products') {
      const { page_id, image_url, page_text } = body;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `You are extracting product listings from a page of the Exhibitors' Handbook trade show product catalog.

PAGE TEXT (OCR): ${page_text || 'No text available'}

Extract ALL distinct products visible on this page. For each product return:
- name: product name exactly as shown
- sku: SKU/model number if visible (empty string if not)
- description: brief description of the product
- category: one of: Portable Displays, Fabric Structures, Modular Exhibits, Outdoor Displays, Light Boxes, Rental Displays, Banners, Signage, Accessories, Furniture, Lighting, Flooring, Counters, Kiosks, Monitor Stands, Tents
- dimensions: dimensions if shown (empty string if not)
- estimated_price: estimated retail price in USD (null if not shown)
- geometry_type: one of: backwall, counter, table, tent, banner_stand, billboard, monitor_stand, lighting, flooring, accessory, popup_bar, kiosk
- booth_sizes: array of compatible sizes from ["10x10", "10x20", "20x20"]
- branding_surfaces: array like ["front", "sides", "top"] where applicable
- color_options: array of available colors if mentioned
- visual_description: extremely detailed description of what the product looks like physically — shape, color, materials, size proportions, any graphics or text visible on it. This will be used to generate AI renderings later.
- crop_region: the bounding box of this product's image on the page as percentage coordinates: {"top": 0-100, "left": 0-100, "width": 0-100, "height": 0-100}. Estimate where the product photo is located on the page. Be as precise as possible.

Return JSON: {"products": [...]}. If you can't identify distinct products, return {"products": []}.`
            },
            {
              type: "image_url",
              image_url: { url: image_url }
            }
          ]
        }],
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      let products = [];
      try {
        const parsed = JSON.parse(response.choices[0].message.content);
        products = parsed.products || parsed.items || (Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Failed to parse GPT response:", e);
        products = [];
      }

      // Now crop individual product images from the page image
      const productsWithImages = [];
      for (const product of products) {
        let productImageUrl = "";
        if (product.crop_region && image_url) {
          try {
            productImageUrl = await cropAndUploadProduct(base44, image_url, product.crop_region, product.name);
          } catch (cropErr) {
            console.error("Crop failed for", product.name, cropErr.message);
          }
        }
        productsWithImages.push({
          ...product,
          image_url: productImageUrl,
          crop_region: undefined // don't store raw coords on the entity
        });
      }

      // Update the CatalogPage with extracted products
      if (page_id) {
        await base44.asServiceRole.entities.CatalogPage.update(page_id, {
          products: productsWithImages,
          is_processed: true
        });
      }

      return Response.json({ success: true, products: productsWithImages, count: productsWithImages.length });
    }

    // ── ACTION: Push products from CatalogPage to ProductVariant ──
    if (action === 'push_to_variants') {
      const { page_id } = body;
      const pages = await base44.asServiceRole.entities.CatalogPage.filter({ id: page_id });
      if (pages.length === 0) {
        return Response.json({ error: 'Page not found' }, { status: 404 });
      }
      const page = pages[0];
      
      // Get or create a default manufacturer for the handbook
      let manufacturers = await base44.asServiceRole.entities.Manufacturer.filter({ name: "Orbus Exhibit & Display Group" });
      let manufacturer;
      if (manufacturers.length === 0) {
        manufacturer = await base44.asServiceRole.entities.Manufacturer.create({
          name: "Orbus Exhibit & Display Group",
          website_url: "https://www.orbus.com",
          is_active: true
        });
      } else {
        manufacturer = manufacturers[0];
      }

      const created = [];
      for (const product of (page.products || [])) {
        const variant = {
          manufacturer_id: manufacturer.id,
          display_name: product.name,
          description: product.description || "",
          manufacturer_sku: product.sku || "",
          base_price: product.estimated_price || 0,
          geometry_type: product.geometry_type || "accessory",
          booth_sizes: product.booth_sizes || ["10x10", "10x20", "20x20"],
          branding_surfaces: product.branding_surfaces || [],
          color_options: product.color_options || [],
          category_name: product.category || "",
          is_active: true,
          customizable: true
        };
        const saved = await base44.asServiceRole.entities.ProductVariant.create(variant);
        created.push(saved);
      }

      return Response.json({ success: true, created_count: created.length });
    }

    // ── ACTION: Search catalog pages (semantic-like via text) ──
    if (action === 'search') {
      const { query, page_number } = body;
      let results = [];

      if (page_number) {
        results = await base44.asServiceRole.entities.CatalogPage.filter({
          page_number: page_number
        });
      } else if (query) {
        // Get all pages and search text + products
        const allPages = await base44.asServiceRole.entities.CatalogPage.list('-page_number', 500);
        const q = query.toLowerCase();
        results = allPages.filter(p => {
          const textMatch = (p.page_text || '').toLowerCase().includes(q);
          const productMatch = (p.products || []).some(prod =>
            (prod.name || '').toLowerCase().includes(q) ||
            (prod.description || '').toLowerCase().includes(q) ||
            (prod.category || '').toLowerCase().includes(q)
          );
          return textMatch || productMatch;
        });
      }

      return Response.json({
        success: true,
        results: results.slice(0, 10).map(p => ({
          id: p.id,
          page_number: p.page_number,
          handbook_name: p.handbook_name,
          section: p.section,
          page_image_url: p.page_image_url,
          products: p.products,
          product_count: (p.products || []).length,
          is_processed: p.is_processed
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error("Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});