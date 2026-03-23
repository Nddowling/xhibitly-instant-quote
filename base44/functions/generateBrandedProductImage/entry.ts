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

        // ── Build strict product photography prompt ────────────────────────
        const productDescription = visual_description || 'Standard trade show display';

        const prompt = `PRODUCT PHOTOGRAPHY DOCUMENTATION: Create a professional product photograph of a single trade show display product. This is catalog documentation requiring exact accuracy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT SPECIFICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Product Name: ${product_name || 'Trade show display'}
Product Type: ${productDescription}
Brand: ${brand_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BRANDING REQUIREMENTS (CRITICAL):
✓ Apply "${brand_name}" branding prominently on all fabric surfaces, graphics panels, and display areas
✓ Use ${brand_name}'s official logo, brand colors, and typography
✓ Branding must look professionally printed/applied to the product
✓ Brand elements should be clearly visible and legible

PHOTOGRAPHY SPECIFICATIONS:
✓ Single product only - exactly as described above
✓ Professional product photography lighting (bright, even, shadow-free)
✓ Clean white studio background OR neutral trade show floor
✓ Straight-on or 3/4 angle view showing the product clearly
✓ High-resolution commercial product photo quality
✓ Product should be fully visible and in focus

✗ FORBIDDEN - DO NOT INCLUDE:
  - NO people, models, staff, or hands
  - NO other products or display items
  - NO furniture, chairs, tables, or props
  - NO plants, decorations, or environmental elements
  - NO extra signage or banners beyond the product itself
  - NO promotional materials, brochures, or accessories
  - NO trade show booths or neighboring displays in background
  - NO cluttered or busy backgrounds
  - NO generic stock photo elements

CRITICAL: This is a single product photograph for ${brand_name}. Show ONLY the ${product_name || 'display product'} with ${brand_name} branding applied. Nothing else.`;

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