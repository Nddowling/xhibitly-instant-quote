import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { booth_design_id, force_new } = await req.json();
        
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

        let existingRender = design.design_image_url || null;
        if (force_new) {
            existingRender = null;
        }
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

        // ── Ensure Brand Data ──────────────────────────────────────────────
        if (!design.brand_identity && design.brand_name) {
            try {
                // Try to treat brand_name as domain, append .com if needed for better success chance
                // Clean the brand name first (trim whitespace)
                const cleanBrandName = design.brand_name.trim();
                
                // Try to treat brand_name as domain, append .com if needed for better success chance
                const domainCandidate = cleanBrandName.includes('.') ? cleanBrandName : `${cleanBrandName.replace(/\s+/g, '')}.com`;
                
                const brandRes = await base44.functions.invoke('fetchBrandData', { 
                    website_url: domainCandidate 
                });
                
                if (brandRes.data && brandRes.data.brand) {
                    design.brand_identity = brandRes.data.brand;
                    
                    // Save back to design so we don't fetch again
                    await base44.entities.BoothDesign.update(design.id, {
                        brand_identity: design.brand_identity
                    });
                }
            } catch (e) {
                console.warn('Failed to auto-fetch brand data:', e);
                // Continue without brand identity
            }
        }

        // ── Build branding context ─────────────────────────────────────────
        const brandColor = design.brand_identity?.primary_color;
        
        // Use custom brand_name from the design if it exists, otherwise fall back to identity
        const brandName = design.brand_name || design.brand_identity?.company_name || design.brand_identity?.name || '';
        const brandLogo = design.brand_identity?.logo_url;
        
        let brandingNote = '';
        if (brandName && brandColor && brandLogo) {
            brandingNote = `CRITICAL BRANDING: Every fabric surface, backwall, banner, and display panel MUST show the brand name "${brandName}" in large, bold text using brand color ${brandColor}. Apply the logo (see reference images) prominently on the main backwall. All graphics must be cohesive and clearly branded with "${brandName}".`;
        } else if (brandName && brandColor) {
            brandingNote = `CRITICAL BRANDING: Every fabric surface, backwall, banner, and display panel MUST show the brand name "${brandName}" in large, bold text using brand color ${brandColor}.`;
        } else if (brandName) {
            brandingNote = `CRITICAL BRANDING: Every fabric surface, backwall, banner, and display panel MUST prominently feature the brand name "${brandName}" in large, bold text.`;
        } else {
            brandingNote = 'Use neutral professional branding on displays.';
        }
        
        if (brandLogo) {
            referenceImageUrls.unshift(brandLogo);
        }

        const companyNote = design.brand_identity?.industry && !brandName
            ? `The exhibiting company is in the "${design.brand_identity.industry}" industry. Their branding should align with this industry.`
            : '';

        let layoutNote = '';
        if (design.scene_json) {
            try {
                const scene = JSON.parse(design.scene_json);
                if (scene && scene.items && scene.items.length > 0) {
                    const itemDescriptions = scene.items.map(item => {
                        return `- ${item.name || item.sku} at X=${Math.round(item.x * 10) / 10}ft, Y=${Math.round(item.y * 10) / 10}ft, rotated ${item.rot || 0}°`;
                    }).join('\n');
                    layoutNote = `CRITICAL SPATIAL LAYOUT (STRICT ADHERENCE REQUIRED):
The booth is ${scene.booth.w_ft}ft wide (X axis) by ${scene.booth.d_ft}ft deep (Y axis).
Coordinate System: (0,0) is the front-left corner. X increases to the right. Y increases to the back.
You MUST place the items EXACTLY at these coordinates:
${itemDescriptions}

RULES FOR PLACEMENT:
1. Objects must be placed PRECISELY at the specified X,Y coordinates.
2. Orientation must match the specified rotation angle.
3. Do NOT rearrange items for aesthetics. The layout is fixed.
4. Empty space in the layout MUST remain empty in the render.`;
                }
            } catch (e) {
                console.warn('Could not parse scene_json', e);
            }
        }

        if (!layoutNote) {
            layoutNote = design.layout_instructions
                ? `LAYOUT INSTRUCTIONS: The user has requested the following placement: "${design.layout_instructions}". You MUST follow these positioning rules strictly.`
                : 'Arrange the products naturally within the booth boundary. Larger items (backwalls, fabric structures) at the rear; counters and stands toward the front.';
        } else if (design.layout_instructions) {
            layoutNote += `\n\nADDITIONAL INSTRUCTIONS: "${design.layout_instructions}"`;
        }

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
            prompt = `Create a strict, photorealistic 3D architectural visualization of a trade show booth based EXACTLY on the provided 2D layout and product list.

BOOTH DIMENSIONS: ${sizeDesc}.

PRODUCT MANIFEST (Exact Inventory):
${productManifest}

LAYOUT & POSITIONING (Non-Negotiable):
${layoutNote}

BRANDING & ATMOSPHERE:
- ${brandingNote}
- ${companyNote}
- Environment: Convention center, high ceilings, concrete floor (unless flooring is listed), bright even lighting.

CRITICAL CONSTRAINTS - READ CAREFULLY:
1. **NO HALLUCINATIONS**: Do NOT add ANY furniture, people, plants, lights, carpet, or decorations that are not explicitly listed in the Product Manifest.
2. **STRICT POSITIONING**: Items must be located exactly as described in the Layout section. Do not move them "to make it look better".
3. **EXACT COUNT**: If the manifest says "1x Counter", draw exactly one. If it says "2x", draw two.
4. **BRANDING**: The brand "${brandName}" must be visible on the products as specified.

The goal is an accurate visualization of the user's specific design, not a creative interpretation.`;
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