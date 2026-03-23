import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user?.role || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Fetch the catalog JSON
        const catalogUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/a605c34b5_nimlok_complete_catalog.json';
        const response = await fetch(catalogUrl);
        const catalogData = await response.json();

        const products = catalogData.products || [];
        const imported = [];
        const errors = [];

        // Map tier to price_tier
        const mapTier = (tier) => {
            if (!tier) return 'Modular';
            if (tier.toLowerCase().includes('premium') || tier.toLowerCase().includes('custom')) return 'Custom';
            if (tier.toLowerCase().includes('standard') || tier.toLowerCase().includes('hybrid')) return 'Hybrid';
            return 'Modular';
        };

        // Process products in batches
        for (const product of products) {
            try {
                // Check if product already exists
                const existing = await base44.asServiceRole.entities.Product.filter({ sku: product.sku });
                if (existing.length > 0) {
                    console.log(`Skipping existing product: ${product.sku}`);
                    continue;
                }

                const productData = {
                    sku: product.sku || '',
                    name: product.name || '',
                    description: product.description || '',
                    category: product.pricing_category || 'Display',
                    product_line: product.product_line || 'Nimlok',
                    price_tier: mapTier(product.tier),
                    base_price: product.dealer_cost || product.retail_price || 0,
                    market_value: product.retail_price || 0,
                    image_url: product.primary_image || '',
                    customizable: true,
                    is_active: true,
                    source: 'nimlok_catalog_2026',
                    imported_at: new Date().toISOString(),
                    raw_attributes: {
                        original_url: product.url,
                        product_id: product.product_id,
                        tier: product.tier,
                        dealer_margin_percent: product.dealer_margin_percent,
                        pricing_category: product.pricing_category
                    }
                };

                const created = await base44.asServiceRole.entities.Product.create(productData);
                imported.push(created.sku);
            } catch (error) {
                errors.push({
                    sku: product.sku,
                    error: error.message
                });
            }
        }

        return Response.json({
            success: true,
            total_in_catalog: products.length,
            imported_count: imported.length,
            error_count: errors.length,
            imported_skus: imported,
            errors: errors.length > 0 ? errors : undefined,
            metadata: catalogData.metadata
        });

    } catch (error) {
        console.error('Import error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});