import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find products with unusually low prices
        const products = await base44.asServiceRole.entities.Product.list();
        let updatedCount = 0;
        
        let promises = [];
        for (const product of products) {
            if (product.base_price && product.base_price > 0 && product.base_price < 100) {
                // Heuristic: if price is like 2, 3, 7, it's likely meant to be 2000, 3000, 7000
                // because of parseFloat stopping at commas.
                const newPrice = product.base_price * 1000;
                promises.push(
                    base44.asServiceRole.entities.Product.update(product.id, {
                        base_price: newPrice
                    })
                );
                updatedCount++;
                
                if (promises.length >= 20) {
                    await Promise.all(promises);
                    promises = [];
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
        if (promises.length > 0) {
            await Promise.all(promises);
        }
        
        return Response.json({ success: true, updatedCount });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});