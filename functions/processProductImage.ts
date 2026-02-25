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

    const body = await req.json();
    const { action } = body;

    // ── ACTION: Analyze a product image and enrich its metadata ──
    if (action === 'analyze_product') {
      const { image_url, product_name } = body;
      if (!image_url) {
        return Response.json({ error: 'image_url required' }, { status: 400 });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this trade show product image. Describe ONLY the product itself in extreme detail for use in AI rendering later:
- Exact shape, proportions, materials, colors
- How it looks when fully assembled and set up
- Any graphics, text, branding areas visible
- The overall dimensions relative to a person

Return JSON: {
  "visual_description": "extremely detailed visual description",
  "product_type": "backwall|counter|banner_stand|table|tent|monitor_stand|lighting|flooring|accessory|kiosk",
  "primary_colors": ["color1", "color2"],
  "has_branding_area": true/false,
  "branding_surfaces": ["front", "sides", etc]
}`
            },
            {
              type: "image_url",
              image_url: { url: image_url }
            }
          ]
        }],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      let analysis = {};
      try {
        analysis = JSON.parse(response.choices[0].message.content);
      } catch (e) {
        console.error("Parse error:", e);
        analysis = { visual_description: product_name || "Trade show display product" };
      }

      return Response.json({
        success: true,
        visual_description: analysis.visual_description,
        product_type: analysis.product_type,
        primary_colors: analysis.primary_colors,
        has_branding_area: analysis.has_branding_area,
        branding_surfaces: analysis.branding_surfaces
      });
    }

    // ── ACTION: Batch enrich all products on a catalog page (descriptions only, no image replacement) ──
    if (action === 'batch_enrich_page') {
      const { page_id } = body;

      const allPages = await base44.asServiceRole.entities.CatalogPage.list('-created_date', 500);
      const page = allPages.find(p => p.id === page_id);
      if (!page) {
        return Response.json({ error: 'Page not found' }, { status: 404 });
      }

      const products = page.products || [];
      const updatedProducts = [];
      let enriched = 0;

      for (const product of products) {
        if (product.image_url && !product.is_enriched) {
          try {
            const analysisResp = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Describe this trade show product in extreme visual detail for AI image generation later. Focus on: exact shape, frame structure, materials, fabric/panel types, colors, proportions, how tall vs wide, branding areas, and what it looks like fully assembled at a trade show. Return JSON: {"visual_description": "detailed description", "product_type": "backwall|counter|banner_stand|table|tent|monitor_stand|lighting|flooring|accessory|kiosk", "primary_colors": ["color1"], "branding_surfaces": ["front"]}`
                  },
                  { type: "image_url", image_url: { url: product.image_url } }
                ]
              }],
              max_tokens: 600,
              response_format: { type: "json_object" }
            });

            let analysis = {};
            try {
              analysis = JSON.parse(analysisResp.choices[0].message.content);
            } catch (e) {
              analysis = { visual_description: product.description || product.name };
            }

            updatedProducts.push({
              ...product,
              visual_description: analysis.visual_description || product.visual_description,
              geometry_type: analysis.product_type || product.geometry_type,
              branding_surfaces: analysis.branding_surfaces || product.branding_surfaces,
              color_options: analysis.primary_colors || product.color_options,
              is_enriched: true
            });
            enriched++;
          } catch (err) {
            console.error("Enrich failed for", product.name, err.message);
            updatedProducts.push(product);
          }
        } else {
          updatedProducts.push(product);
        }
      }

      await base44.asServiceRole.entities.CatalogPage.update(page_id, {
        products: updatedProducts
      });

      return Response.json({ success: true, enriched_count: enriched, products: updatedProducts });
    }

    // ── ACTION: Look up catalog page by number ──
    if (action === 'lookup_page') {
      const { page_number } = body;
      if (!page_number) {
        return Response.json({ error: 'page_number required' }, { status: 400 });
      }

      const results = await base44.asServiceRole.entities.CatalogPage.filter({
        page_number: Number(page_number)
      });

      if (results.length === 0) {
        return Response.json({ success: true, found: false, page: null });
      }

      const page = results[0];
      return Response.json({
        success: true,
        found: true,
        page: {
          id: page.id,
          page_number: page.page_number,
          handbook_name: page.handbook_name,
          section: page.section,
          page_image_url: page.page_image_url,
          page_text: page.page_text,
          products: page.products,
          is_processed: page.is_processed
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error("Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});