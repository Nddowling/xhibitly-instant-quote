import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { booth_design_id, additional_instructions } = await req.json();

        if (!booth_design_id) {
             return Response.json({ error: 'booth_design_id is required' }, { status: 400 });
        }

        const design = await base44.asServiceRole.entities.BoothDesign.get(booth_design_id);
        if (!design) {
            return Response.json({ error: 'Booth design not found' }, { status: 404 });
        }

        const brandName = design.brand_name || design.brand_identity?.company_name || design.brand_url || 'a generic brand';
        const boothSize = design.booth_size || '10x10';
        
        // Fetch product details to include in the prompt
        let productDescriptions = [];
        if (design.product_skus && design.product_skus.length > 0) {
            for (const sku of design.product_skus) {
                const products = await base44.asServiceRole.entities.Product.filter({ sku });
                if (products.length > 0) {
                    productDescriptions.push(products[0].name);
                } else {
                    productDescriptions.push(sku);
                }
            }
        }

        const productsText = productDescriptions.length > 0 
            ? `It includes the following products: ${productDescriptions.join(', ')}.` 
            : 'It is a custom trade show booth.';

        const prompt = `Create a photorealistic 3D render of a ${boothSize} trade show booth for the brand "${brandName}".
        
${productsText}
${design.layout_instructions ? `Layout instructions: ${design.layout_instructions}` : ''}
${additional_instructions ? `Additional style instructions: ${additional_instructions}` : ''}

BRANDING REQUIREMENTS:
✓ Apply "${brandName}" branding prominently on the booth walls, counters, and displays.
✓ Use the brand's official colors and typography if known.
✓ The booth should look highly professional, well-lit, and ready for a trade show floor.

PHOTOGRAPHY SPECIFICATIONS:
✓ Wide-angle view showing the entire booth.
✓ Professional trade show lighting.
✓ Neutral trade show floor environment.
✓ High-resolution architectural render quality.`;

        const result = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt: prompt
        });

        // Save the generated image to the design
        await base44.asServiceRole.entities.BoothDesign.update(booth_design_id, {
            design_image_url: result.url
        });

        return Response.json({ success: true, image_url: result.url });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});