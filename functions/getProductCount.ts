import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

/**
 * Get current product count and statistics from Base44
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Get all products
        console.log('📊 Fetching all products...');
        const products = await base44.asServiceRole.entities.Product.list();

        // Calculate statistics
        const stats = {
            total_products: products.length,
            by_source: {},
            by_category: {},
            with_images: 0,
            with_catalog_pages: 0,
            with_prices: 0,
            recent_imports: []
        };

        // Analyze products
        for (const product of products) {
            // By source
            const source = product.source || 'unknown';
            stats.by_source[source] = (stats.by_source[source] || 0) + 1;

            // By category
            const category = product.category || 'uncategorized';
            stats.by_category[category] = (stats.by_category[category] || 0) + 1;

            // With images
            if (product.image_url) stats.with_images++;

            // With catalog pages
            if (product.catalog_pages && product.catalog_pages.length > 0) {
                stats.with_catalog_pages++;
            }

            // With prices
            if (product.base_price || product.market_value) stats.with_prices++;

            // Track recent imports
            if (product.imported_at) {
                stats.recent_imports.push({
                    sku: product.sku,
                    name: product.name,
                    imported_at: product.imported_at
                });
            }
        }

        // Sort recent imports by date
        stats.recent_imports.sort((a, b) =>
            new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime()
        );
        stats.recent_imports = stats.recent_imports.slice(0, 10); // Top 10

        return Response.json({
            success: true,
            stats,
            sample_products: products.slice(0, 5).map(p => ({
                sku: p.sku,
                name: p.name,
                category: p.category,
                source: p.source,
                has_image: !!p.image_url,
                imported_at: p.imported_at
            }))
        });

    } catch (error) {
        console.error('Error getting product count:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
