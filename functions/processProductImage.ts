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

    // ── ACTION: Remove background from a product image using OpenAI ──
    if (action === 'remove_background') {
      const { image_url, product_name } = body;
      if (!image_url) {
        return Response.json({ error: 'image_url required' }, { status: 400 });
      }

      // Use OpenAI to generate a clean version of the product on transparent/clean background
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this trade show product image. Describe ONLY the product itself in extreme detail:
- Exact shape, proportions, materials, colors
- How it looks when fully assembled and set up
- Any graphics, text, branding areas visible
- The overall dimensions relative to a person

Return JSON: {
  "clean_description": "extremely detailed visual description for AI image generation",
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
        analysis = { clean_description: "Trade show display product" };
      }

      // Now generate a clean product image with transparent/white studio background
      const prompt = `Professional product photography of a trade show display product on a pure white studio background. The product is: ${analysis.clean_description || product_name}. Shot from a 3/4 angle, studio lighting, clean isolated product shot suitable for a catalog. No people, no booth, no trade show environment - just the product isolated on white.`;

      const imageResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: prompt,
        existing_image_urls: [image_url]
      });

      return Response.json({
        success: true,
        clean_image_url: imageResponse.url,
        visual_description: analysis.clean_description,
        product_type: analysis.product_type,
        primary_colors: analysis.primary_colors,
        has_branding_area: analysis.has_branding_area,
        branding_surfaces: analysis.branding_surfaces
      });
    }

    // ── ACTION: Batch process all products on a catalog page ──
    if (action === 'batch_clean_page') {
      const { page_id } = body;

      const allPages = await base44.asServiceRole.entities.CatalogPage.list('-created_date', 500);
      const page = allPages.find(p => p.id === page_id);
      if (!page) {
        return Response.json({ error: 'Page not found' }, { status: 404 });
      }

      const products = page.products || [];
      const updatedProducts = [];
      let cleaned = 0;

      for (const product of products) {
        if (product.image_url && !product.clean_image_url) {
          try {
            // Analyze the product image
            const analysisResp = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Describe this trade show product in extreme detail for AI image generation. Focus on: shape, materials, colors, proportions, branding areas. Return JSON: {"clean_description": "detailed description", "product_type": "type"}`
                  },
                  { type: "image_url", image_url: { url: product.image_url } }
                ]
              }],
              max_tokens: 500,
              response_format: { type: "json_object" }
            });

            let analysis = {};
            try {
              analysis = JSON.parse(analysisResp.choices[0].message.content);
            } catch (e) {
              analysis = { clean_description: product.name };
            }

            const prompt = `Professional product photography of a trade show display product on a pure white studio background. The product is: ${analysis.clean_description}. Shot from a 3/4 angle, studio lighting, clean isolated product shot. No people, no booth - just the product.`;

            const imageResponse = await base44.asServiceRole.integrations.Core.GenerateImage({
              prompt: prompt,
              existing_image_urls: [product.image_url]
            });

            updatedProducts.push({
              ...product,
              clean_image_url: imageResponse.url,
              visual_description: analysis.clean_description || product.visual_description
            });
            cleaned++;
          } catch (err) {
            console.error("Clean failed for", product.name, err.message);
            updatedProducts.push(product);
          }
        } else {
          updatedProducts.push(product);
        }
      }

      // Save updated products back to the page
      await base44.asServiceRole.entities.CatalogPage.update(page_id, {
        products: updatedProducts
      });

      return Response.json({ success: true, cleaned_count: cleaned, products: updatedProducts });
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