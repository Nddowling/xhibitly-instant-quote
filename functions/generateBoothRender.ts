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
        for (const [skuOrName, count] of Object.entries(skuCounts)) {
            // First try resolving by exact SKU
            let matches = await base44.entities.Product.filter({ sku: skuOrName });
            
            // If not found, try resolving by exact Name (since the UI might pass names)
            if (matches.length === 0) {
                matches = await base44.entities.Product.filter({ name: skuOrName });
            }

            // Fallback to case-insensitive name match if still not found
            if (matches.length === 0) {
                const allProds = await base44.entities.Product.list();
                const found = allProds.find(p => p.name?.toLowerCase() === skuOrName.toLowerCase() || p.sku?.toLowerCase() === skuOrName.toLowerCase());
                if (found) matches = [found];
            }

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
            '10x10': 'an empty 10x10 foot concrete space',
            '10x20': 'an empty 10x20 foot concrete space',
            '20x20': 'an empty 20x20 foot concrete space',
        };
        const sizeDesc = sizeDescriptions[design.booth_size] || `an empty ${design.booth_size} concrete space`;

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
            ? `The brand is in the "${design.brand_identity.industry}" industry. Their branding should align with this industry.`
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
The floor space is ${scene.booth.w_ft}ft wide (X axis) by ${scene.booth.d_ft}ft deep (Y axis).
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
                : 'Arrange the products naturally within the floor boundary. Larger items (backwalls, fabric structures) at the rear; counters and stands toward the front.';
        } else if (design.layout_instructions) {
            layoutNote += `\n\nADDITIONAL INSTRUCTIONS: "${design.layout_instructions}"`;
        }

        // ── Compose the prompt ─────────────────────────────────────────────
        let prompt;

        if (existingRender) {
            // ITERATIVE MODE — anchor to previous image and only change product set
            prompt = `PHOTOGRAPHIC DOCUMENTATION UPDATE: Update the existing photo (last reference image) to show ONLY the inventory listed below in a completely empty space. This is product inventory verification - accuracy and extreme minimalism are critical. DO NOT generate a bustling trade show.

ENVIRONMENT: ${sizeDesc} - completely empty except for listed items. No background scenery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE INVENTORY (${productCount} items total):
${productManifest}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REFERENCE IMAGES: Product photos shown first, existing booth photo shown last.

MANDATORY RULES - NO EXCEPTIONS:
✓ Show ONLY the ${productCount} items listed above - nothing else
✓ ${layoutNote}
✓ Keep exact camera angle, perspective, floor, and lighting from existing render
✓ Apply branding ONLY to products that exist in the inventory above
${brandingNote ? `✓ Branding: ${brandingNote.replace('Every fabric surface, backwall, banner, and display panel', 'Only the fabric surfaces and display panels in the inventory')}` : ''}

✗ REMOVE any items from previous render NOT in current inventory
✗ NO chairs, tables, plants, people, extra signage, or unlisted decor
✗ NO additional counters, stands, or display elements beyond what's listed
✗ NO carpet/flooring unless explicitly listed in inventory
✗ Empty space must remain empty - do not fill gaps

This is inventory documentation: ${productNameList} only.`;

        } else {
            // FIRST RENDER — build from scratch using product reference images
            prompt = `PHOTOGRAPHIC DOCUMENTATION TASK: Create a photorealistic architectural photo of an isolated display set in a completely empty room. This is inventory verification - accuracy and minimalism are critical. DO NOT generate a bustling trade show.

ENVIRONMENT: ${sizeDesc}.
FLOOR: Plain concrete floor (unless flooring listed in inventory).
LIGHTING: Bright, even studio lighting.
BACKGROUND: Pure white or plain light grey concrete wall. NO other booths, NO people, NO scenery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE BOOTH INVENTORY (${productCount} items):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${productManifest}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF INVENTORY - NOTHING ELSE EXISTS IN THIS BOOTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SPATIAL PLACEMENT (EXACT COORDINATES REQUIRED):
${layoutNote}

BRANDING APPLICATION:
${brandingNote ? `${brandingNote.replace('Every fabric surface, backwall, banner, and display panel MUST', 'Apply the brand to fabric surfaces and display panels that exist in the inventory. They must')}` : 'No branding required.'}
${companyNote ? `${companyNote}` : ''}
IMPORTANT: Apply branding ONLY to products that exist in the inventory above. Do NOT create extra branded surfaces, backwalls, or display panels that are not listed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL CONSTRAINTS (100% ACCURACY REQUIRED):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ SHOW EXACTLY: ${productNameList}
✓ TOTAL COUNT: ${productCount} items (count them)
✓ EXACT POSITIONS: Follow coordinate system precisely
✓ EMPTY SPACE: Areas without products must be visibly empty
✓ REFERENCE IMAGES: Use provided photos to match product appearance exactly

✗ FORBIDDEN - DO NOT ADD:
  - NO people, staff, or visitors
  - NO chairs or seating (unless listed above)
  - NO plants, flowers, or greenery
  - NO extra tables or counters beyond inventory
  - NO additional banners or signage beyond inventory
  - NO carpet, rugs, or floor graphics (unless listed)
  - NO extra lighting equipment or spotlights
  - NO promotional materials, brochures, or giveaways
  - NO drinks, food, or refreshments
  - NO tablets, screens, or monitors (unless listed)
  - NO decorative elements or props
  - NO extra display stands or pedestals
  - NO background exhibitors, NO exhibition halls, NO trade show environment
  - NO extra backwalls or fabric walls (unless listed)
  - NO architecture like hanging signs, giant rings, or pavilions unless explicitly listed
  - NO structural framing or truss systems unless listed

✗ DO NOT "fill empty space" - sparse spaces are acceptable and expected
✗ DO NOT "improve the layout" - use exact coordinates provided
✗ DO NOT add items "to make it look better" or "balance the composition"
✗ DO NOT create additional branded surfaces not in inventory
✗ DO NOT generate a complex trade show environment

FRAMING: Straight-on architectural photo from the front, showing the full ${design.booth_size} space against a blank studio or plain concrete background. Clean, professional documentation style.

CRITICAL: This is a precise inventory verification photograph showing ONLY: ${productNameList}. It MUST NOT look like a busy trade show.`;
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