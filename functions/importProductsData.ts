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
        
        for (const item of productsList) {
            try {
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
                
                // Create Product
                const productData = {
                    name: String(item.name || "Unnamed Product"),
                    sku: String(sku),
                    category: String(item.category || "Uncategorized"),
                    subcategory: String(item.subcategory || ""),
                    description: String(item.description || ""),
                    base_price: 0,
                    image_url: finalImageUrl
                };
                
                await base44.asServiceRole.entities.Product.create(productData);
                
                // Create ProductVariant
                const variantData = {
                    display_name: item.name || "Unnamed Product",
                    manufacturer_sku: sku,
                    category_name: item.category || "Uncategorized",
                    description: item.description || "",
                    base_price: 0,
                    image_url: imageUrl,
                    thumbnail_url: imageUrl
                };
                
                await base44.asServiceRole.entities.ProductVariant.create(variantData);
                
                results.success++;
                
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                results.errors.push({ name: item.name, error: err.message });
            }
        }
        
        return Response.json({ message: 'Import completed', results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});