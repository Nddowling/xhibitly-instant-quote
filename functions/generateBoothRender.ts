import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { booth_design_id } = await req.json();
        
        if (!booth_design_id) {
            return Response.json({ error: 'booth_design_id is required' }, { status: 400 });
        }

        const design = await base44.entities.BoothDesign.get(booth_design_id);
        if (!design) {
            return Response.json({ error: 'Design not found' }, { status: 404 });
        }

        const skus = design.product_skus || [];
        if (skus.length === 0) {
            return Response.json({ error: 'No products in the booth design yet' }, { status: 400 });
        }

        // Fetch products to get their visual descriptions
        const products = [];
        for (const sku of skus) {
            const matches = await base44.entities.Product.filter({ sku });
            if (matches.length > 0) {
                products.push(matches[0]);
            }
        }

        const productList = products.map(p => `- ${p.name} (${p.category || 'Display Item'})`).join('\n');
        
        // Build the base prompt with strict constraints
        let prompt = `STRICT REQUIREMENTS - You MUST follow these rules exactly:

1. BOOTH SIZE: This is a ${design.booth_size} trade show booth. The dimensions are FIXED and EXACT.
   ${design.booth_size === '10x10' ? '- 10 feet wide × 10 feet deep' : ''}
   ${design.booth_size === '10x20' ? '- 10 feet wide × 20 feet deep' : ''}
   ${design.booth_size === '20x20' ? '- 20 feet wide × 20 feet deep' : ''}

2. PRODUCTS - The booth contains ONLY these items, nothing more:
${productList}

3. CRITICAL: Do NOT add ANY items that are not in the above list. No extra backwalls, counters, tables, chairs, displays, or decorations.

4. SETTING: Professional convention center hall, neutral gray carpet flooring, bright even lighting from above.

5. VIEW: Wide-angle perspective showing the complete booth layout from a 45-degree angle.

Create a photorealistic 3D architectural visualization of this exact booth configuration.`;

        // Check if there's a previous image to iterate from
        const existingImageUrl = design.design_image_url;
        const existing_image_urls = existingImageUrl ? [existingImageUrl] : [];

        // If we have a previous render, add iterative instructions
        if (existingImageUrl) {
            prompt = `ITERATIVE UPDATE - Modify the existing booth render:

KEEP UNCHANGED:
- Booth size (${design.booth_size})
- Camera angle and perspective
- Lighting and environment
- Branding colors and style
- Floor and background

UPDATE THE PRODUCTS to show ONLY these items:
${productList}

CRITICAL: Remove any products not in the above list. Add any new products from the list that weren't in the previous render. The booth must show EXACTLY the items listed above, no more, no less.

Create the updated photorealistic render maintaining visual consistency with the previous version.`;
        }

        const imageRes = await base44.integrations.Core.GenerateImage({
            prompt: prompt,
            existing_image_urls: existing_image_urls
        });

        if (imageRes && imageRes.url) {
            const updatedDesign = await base44.entities.BoothDesign.update(booth_design_id, {
                design_image_url: imageRes.url
            });
            return Response.json({ success: true, url: imageRes.url, design: updatedDesign });
        } else {
            throw new Error("Failed to generate image from integration.");
        }

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});