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
            
            productsToInsert.push({
                name: String(item.name || "Unnamed Product"),
                sku: String(sku),
                category: String(item.category || "Uncategorized"),
                subcategory: String(item.subcategory || ""),
                description: String(item.description || ""),
                base_price: 0,
                image_url: finalImageUrl
            });
            
            variantsToInsert.push({
                display_name: String(item.name || "Unnamed Product"),
                manufacturer_sku: String(sku),
                category_name: String(item.category || "Uncategorized"),
                description: String(item.description || ""),
                base_price: 0,
                image_url: finalImageUrl,
                thumbnail_url: finalImageUrl
            });
        }

        // Insert in batches of 20
        const batchSize = 20;
        for (let i = 0; i < productsToInsert.length; i += batchSize) {
            try {
                const pBatch = productsToInsert.slice(i, i + batchSize);
                const vBatch = variantsToInsert.slice(i, i + batchSize);
                
                await base44.asServiceRole.entities.Product.bulkCreate(pBatch);
                await base44.asServiceRole.entities.ProductVariant.bulkCreate(vBatch);
                
                results.success += pBatch.length;
                
                // delay to avoid rate limit
                await new Promise(r => setTimeout(r, 2000));
            } catch (err) {
                results.errors.push({ batchIndex: i, error: err.message });
            }
        }
        
        return Response.json({ message: 'Import completed', results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});