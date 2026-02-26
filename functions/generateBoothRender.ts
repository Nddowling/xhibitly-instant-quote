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
        let prompt = `Create a photorealistic 3D architectural visualization of a sparse, minimalist exhibition space.
The space is a completely EMPTY ${design.booth_size} floor area with plain gray carpet and NO default walls, EXCEPT for the exact items listed below.

CRITICAL INSTRUCTION: You must ONLY draw the items in this list. DO NOT draw any counters, TV screens, extra walls, desks, pedestals, or generic trade show booth elements. If an item is not in this list, DO NOT draw it. The space should look empty except for these specific items.

ITEMS TO INCLUDE:
${productList}

Setting: Bright convention center hall lighting.
Camera: Wide-angle perspective from a 45-degree angle showing the floor space.`;

        // Check if there's a previous image to iterate from
        const existingImageUrl = design.design_image_url;
        const existing_image_urls = existingImageUrl ? [existingImageUrl] : [];

        // If we have a previous render, add iterative instructions
        if (existingImageUrl) {
            prompt = `This is an image-to-image edit. Update the existing image to perfectly match this exact list of items.

CURRENT ITEMS TO SHOW:
${productList}

CRITICAL INSTRUCTIONS: 
1. If any item (like a counter, TV, extra wall, or pedestal) in the existing image is NOT in the list above, you MUST REMOVE IT.
2. If an item in the list is missing from the image, ADD IT.
3. Keep the exact same camera angle, lighting, and room background.
4. DO NOT add any extra furniture, structures, or decorations that aren't in the list. The space must only contain the listed items.`;
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