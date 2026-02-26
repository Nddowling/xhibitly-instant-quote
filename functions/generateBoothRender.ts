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

        const productDescriptions = products.map(p => p.name).join(', ');
        
        const prompt = `A highly detailed, photorealistic 3D architectural render of a ${design.booth_size || '10x20'} trade show booth. 
CRITICAL INSTRUCTION: The booth MUST ONLY feature the following exhibition elements: ${productDescriptions}. 
DO NOT include any other structures, backwalls, counters, tables, or furniture that are not explicitly listed. The space should be empty except for these specific items.
The setting is a brightly lit, professional convention center hall with a clean, neutral floor. Modern design, clean lines, professional exhibition lighting. 
The perspective is a wide-angle isometric or perspective view showing the entire booth setup. Highly detailed, 8k resolution, architectural visualization.`;

        const imageRes = await base44.integrations.Core.GenerateImage({
            prompt: prompt
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