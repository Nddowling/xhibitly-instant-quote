import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const { json_url } = await req.json();
        if (!json_url) {
            return Response.json({ error: 'json_url is required' }, { status: 400 });
        }
        
        const response = await fetch(json_url);
        const data = await response.json();
        
        const productsList = data.products || data;
        
        if (!Array.isArray(productsList)) {
            return Response.json({ error: 'Invalid JSON structure' }, { status: 400 });
        }
        
        const results = {
            success: 0,
            errors: []
        };

        function parsePrice(value) {
            if (value === null || value === undefined || value === '') return null;
            if (typeof value === 'number') return value;
            const cleaned = String(value).replace(/[^0-9.]/g, '');
            const parsed = parseFloat(cleaned);
            if (isNaN(parsed)) return null;
            if (parsed > 50000 || parsed < 10) {
                console.log(`[Sanity Check] Parsed price out of normal bounds: original "${value}" -> parsed ${parsed}`);
            }
            return parsed;
        }
        
        const productsToInsert = [];
        const variantsToInsert = [];
        
        for (const item of productsList) {
            // Clean SKU
            let sku = item.sku || "";
            sku = sku.replace(/In stock/ig, '').replace(/SKU/ig, '').replace(/\^/g, '').trim();
            
            // Handle Image URL
            let finalImageUrl = "";
            if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                let img = item.images[0];
                finalImageUrl = typeof img === 'string' ? img : (img?.url || "");
            } else if (item.image) {
                finalImageUrl = typeof item.image === 'string' ? item.image : (item.image?.url || "");
            } else if (item.image_url) {
                finalImageUrl = typeof item.image_url === 'string' ? item.image_url : (item.image_url?.url || "");
            }
            if (typeof finalImageUrl !== 'string') finalImageUrl = "";
            
            let imageCachedUrl = "";
            if (finalImageUrl) {
                try {
                    const cacheRes = await base44.functions.invoke('cacheExternalImage', { url: finalImageUrl });
                    if (cacheRes.data && cacheRes.data.success) {
                        imageCachedUrl = cacheRes.data.cached_url;
                    }
                } catch (e) {
                    console.warn(`Failed to cache image for SKU ${sku}:`, e);
                }
            }
            
            const parsedPrice = parsePrice(item.price || item.base_price);

            productsToInsert.push({
                name: String(item.name || "Unnamed Product"),
                sku: String(sku),
                category: String(item.category || "Uncategorized"),
                subcategory: String(item.subcategory || ""),
                description: String(item.description || ""),
                base_price: parsedPrice || 0,
                image_url: finalImageUrl,
                image_cached_url: imageCachedUrl
            });
            
            variantsToInsert.push({
                display_name: String(item.name || "Unnamed Product"),
                manufacturer_sku: String(sku),
                category_name: String(item.category || "Uncategorized"),
                description: String(item.description || ""),
                base_price: parsedPrice || 0,
                image_url: finalImageUrl,
                thumbnail_url: finalImageUrl
            });
        }

        // Insert in batches of 50
        const batchSize = 50;
        for (let i = 0; i < productsToInsert.length; i += batchSize) {
            try {
                const pBatch = productsToInsert.slice(i, i + batchSize);
                const vBatch = variantsToInsert.slice(i, i + batchSize);
                
                await base44.asServiceRole.entities.Product.bulkCreate(pBatch);
                await base44.asServiceRole.entities.ProductVariant.bulkCreate(vBatch);
                
                results.success += pBatch.length;
            } catch (err) {
                results.errors.push({ batchIndex: i, error: err.message });
            }
        }
        
        return Response.json({ message: 'Import completed', results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});