import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        console.log("Generating branded image...");
        const { brand_name, product_name, visual_description, original_image_url } = await req.json();

        if (!brand_name) {
             return Response.json({ error: 'brand_name is required' }, { status: 400 });
        }

        const prompt = `A professional, photorealistic trade show booth product: ${product_name || 'Trade show display'}. 
Visual description: ${visual_description || 'Standard trade show display'}. 
Crucially, this product is heavily branded for ${brand_name}, featuring ${brand_name}'s official logo, brand colors, and typography prominently displayed on the branding surfaces of the product. The image should look like a high-quality product render or photograph taken at a trade show. White background or realistic trade show floor background.`;

        const existing_image_urls = original_image_url ? [original_image_url] : [];

        const result = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt: prompt,
            existing_image_urls: existing_image_urls.length > 0 ? existing_image_urls : undefined
        });

        return Response.json({ success: true, image_url: result.url });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});