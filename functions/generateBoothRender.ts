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

        // ── Fetch full product records ──────────────────────────────────────
        const skuCounts = skus.reduce((acc, sku) => {
            acc[sku] = (acc[sku] || 0) + 1;
            return acc;
        }, {});

        const products = [];
        for (const [sku, count] of Object.entries(skuCounts)) {
            const matches = await base44.entities.Product.filter({ sku });
            if (matches.length > 0) {
                products.push({ ...matches[0], quantity: count });
            }
        }

        if (products.length === 0) {
            return Response.json({ error: 'Could not resolve any products from SKUs' }, { status: 400 });
        }

        // ── Collect reference images ────────────────────────────────────────
        const uniqueImageUrls = new Set();

        for (const p of products) {
            if (p.image_url) {
                uniqueImageUrls.add(p.image_url);
            }
        }
        
        const referenceImageUrls = Array.from(uniqueImageUrls);

        const existingRender = design.design_image_url || null;
        if (existingRender) {
            referenceImageUrls.push(existingRender);
        }

        // ── Build booth size description ────────────────────────────────────
        const sizeDescriptions = {
            '10x10': 'a 10-foot wide by 10-foot deep square trade show booth (100 square feet)',
            '10x20': 'a 10-foot wide by 20-foot deep rectangular trade show booth (200 square feet)',
            '20x20': 'a 20-foot wide by 20-foot deep square island trade show booth (400 square feet)',
        };
        const sizeDesc = sizeDescriptions[design.booth_size] || `a ${design.booth_size} trade show booth`;

        // ── Build explicit product manifest ────────────────────────────────
        const productManifest = products.map((p, i) => {
            const parts = [`${i + 1}. ${p.quantity}x ${p.name}`];
            if (p.category) parts.push(`(${p.category})`);
            if (p.description) parts.push(`— ${p.description.slice(0, 120)}`);
            return parts.join(' ');
        }).join('\n');

        const productNameList = products.map(p => `${p.quantity}x ${p.name}`).join(', ');
        const productCount = products.reduce((sum, p) => sum + p.quantity, 0);

        // ── Build branding context ─────────────────────────────────────────
        const brandColor = design.brand_identity?.primary_color;
        
        // Use custom brand_name from the design if it exists, otherwise fall back to industry context
        const brandName = design.brand_name || design.brand_identity?.company_name || design.brand_identity?.name || '';
        
        let brandingNote = 'Branding: Use neutral professional branding unless color is visible in reference images.';
        if (brandColor && brandName) {
            brandingNote = `Branding: All displays, banners, and backwalls MUST prominently feature the brand name "${brandName}" and use the brand color ${brandColor}.`;
        } else if (brandName) {
            brandingNote = `Branding: All displays, banners, and backwalls MUST prominently feature the brand name "${brandName}".`;
        } else if (brandColor) {
            brandingNote = `Branding: Use the client's brand colors (Primary: ${brandColor}) on all graphics and fabric panels.`;
        }

        const companyNote = design.brand_identity?.industry && !brandName
            ? `The exhibiting company is in the "${design.brand_identity.industry}" industry. Their branding should align with this industry.`
            : '';

        const layoutNote = design.layout_instructions
            ? `LAYOUT INSTRUCTIONS: The user has requested the following placement: "${design.layout_instructions}". You MUST follow these positioning rules strictly.`
            : 'Arrange the products naturally within the booth boundary. Larger items (backwalls, fabric structures) at the rear; counters and stands toward the front.';

        // ── Compose the prompt ─────────────────────────────────────────────
        let prompt;

        if (existingRender) {
            // ITERATIVE MODE — anchor to previous image and only change product set
            prompt = `You are updating an existing trade show booth render. Use the LAST reference image as the spatial anchor (existing booth layout). Maintain its exact camera angle, perspective, booth size, floor, lighting, and branding.

BOOTH: ${sizeDesc}.

PRODUCT UPDATE — The booth must now contain EXACTLY these ${productCount} item(s) and nothing else:
${productManifest}

REFERENCE IMAGES: The earlier images show the individual products. The last image is the previous booth render to update.

RULES:
- Remove any products from the previous render that are NOT in the list above.
- Add any new products from the list that were not in the previous render.
- ${layoutNote}
- Do NOT invent, add, or imply any unlisted furniture, displays, counters, chairs, stands, or decor.
- Keep the same backdrop, floor, lighting, camera angle, and brand graphics as the previous render.
- ${brandingNote}
- ${companyNote}
- Result must be a photorealistic architectural visualization showing only: ${productNameList}.`;

        } else {
            // FIRST RENDER — build from scratch using product reference images
            prompt = `Create a photorealistic 3D architectural visualization of ${sizeDesc} for a professional trade show.

The booth contains EXACTLY these ${productCount} item(s). Reference images of each product are provided:
${productManifest}

VISUAL REQUIREMENTS:
- Render from a 3/4 perspective (approx 45-degree angle) showing the full booth footprint.
- Convention center setting: polished concrete or neutral gray carpet floor, high ceiling, bright even overhead lighting.
- ${layoutNote}
- ${brandingNote}
- ${companyNote}

STRICT CONSTRAINTS:
- The booth contains ONLY the ${productCount} listed items: ${productNameList}.
- Do NOT add chairs, tables, potted plants, carpet (unless listed), hanging signs, monitors, or any other unlisted element.
- Do NOT extrapolate additional display units "to fill space." Show only what is listed.
- The booth boundary must be exactly ${design.booth_size} — do not make it larger or smaller.

Produce a clean, high-resolution photorealistic render suitable for a sales proposal.`;
        }

        // ── Call image generation ──────────────────────────────────────────
        const imageRes = await base44.integrations.Core.GenerateImage({
            prompt,
            existing_image_urls: referenceImageUrls,
        });

        if (!imageRes || !imageRes.url) {
            throw new Error('Image generation returned no URL');
        }

        // ── Save result back to the design ────────────────────────────────
        const renderHistory = Array.isArray(design.render_history)
            ? design.render_history
            : [];

        if (existingRender) {
            renderHistory.push({
                url: existingRender,
                generated_at: design.render_generated_at || new Date().toISOString(),
                product_skus: skus,
            });
        }

        const updatedDesign = await base44.entities.BoothDesign.update(booth_design_id, {
            design_image_url: imageRes.url,
            render_generated_at: new Date().toISOString(),
            render_history: renderHistory.slice(-10), // keep last 10 renders
        });

        return Response.json({
            success: true,
            url: imageRes.url,
            design: updatedDesign,
            products_rendered: products.map(p => ({ sku: p.sku, name: p.name })),
            reference_images_used: referenceImageUrls.length,
            mode: existingRender ? 'iterative' : 'initial',
        });

    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});