import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

/**
 * Import all Orbus catalog products to Base44
 *
 * This imports products from the scraped Orbus catalog with:
 * - Clean SKUs
 * - Product images
 * - Download links (templates, instructions)
 * - Catalog page mappings
 * - Complete metadata
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || (!user.is_sales_rep && user.role !== 'admin')) {
            return Response.json({ error: 'Unauthorized - Admin or Sales Rep required' }, { status: 401 });
        }

        const { mode = 'preview', skip_existing = true, batch_size = 50, products_url, mapping_url } = await req.json();

        // Load catalog products
        console.log('📦 Loading Orbus catalog...');
        let catalogData;
        if (products_url) {
            console.log(`Fetching products from ${products_url}...`);
            const resp = await fetch(products_url);
            if (!resp.ok) throw new Error(`Failed to fetch products from ${products_url}: ${resp.statusText}`);
            catalogData = await resp.json();
        } else {
            try {
                const catalogPath = './orbus_catalog/products.json';
                catalogData = JSON.parse(await Deno.readTextFile(catalogPath));
            } catch (e) {
                return Response.json({ 
                    error: `Could not load products. Please provide 'products_url' in the payload. Local file error: ${e.message}` 
                }, { status: 400 });
            }
        }
        const products = catalogData.products || [];

        console.log(`Found ${products.length} products in catalog`);

        // Load catalog page mappings
        let pageMap = new Map();
        try {
            let mappingData;
            if (mapping_url) {
                console.log(`Fetching mappings from ${mapping_url}...`);
                const resp = await fetch(mapping_url);
                if (resp.ok) {
                    mappingData = await resp.json();
                } else {
                    console.warn(`Failed to fetch mappings from ${mapping_url}: ${resp.statusText}`);
                }
            } else {
                try {
                    const mappingPath = './orbus_catalog/product_catalog_page_mapping.json';
                    mappingData = JSON.parse(await Deno.readTextFile(mappingPath));
                } catch (e) {
                    // Ignore local file error if not found, as it might be optional or handled by URL
                    if (!products_url) console.warn('Could not load local catalog page mappings:', e.message);
                }
            }

            if (mappingData) {
                for (const item of mappingData.product_page_mapping || []) {
                    if (item.product_sku) {
                        pageMap.set(item.product_sku, item);
                    }
                }
                console.log(`Loaded ${pageMap.size} catalog page mappings`);
            }
        } catch (e) {
            console.warn('Error loading catalog page mappings:', e.message);
        }

        // Get existing products from Base44
        let existingProducts = [];
        if (skip_existing) {
            console.log('🔍 Checking existing products in Base44...');
            existingProducts = await base44.asServiceRole.entities.Product.list();
            console.log(`Found ${existingProducts.length} existing products`);
        }
        const existingSKUs = new Set(existingProducts.map(p => p.sku).filter(Boolean));

        // Filter products to import
        const toImport = products.filter(p => {
            if (!p.sku) return false; // Skip products without SKU
            if (skip_existing && existingSKUs.has(p.sku)) return false;
            return true;
        });

        console.log(`📥 Will import ${toImport.length} products (${products.length - toImport.length} skipped)`);

        if (mode === 'preview') {
            const preview = toImport.slice(0, 10).map(p => ({
                sku: p.sku,
                name: p.name,
                category: p.category,
                has_images: (p.images || []).length,
                has_downloads: (p.downloads || []).length,
                catalog_page: pageMap.get(p.sku)?.primary_page || null
            }));

            return Response.json({
                mode: 'preview',
                total_to_import: toImport.length,
                total_skipped: products.length - toImport.length,
                preview_sample: preview,
                message: 'Set mode="import" to actually import products'
            });
        }

        // IMPORT MODE - Actually create products
        console.log('🚀 Starting import...');
        const results = {
            imported: [],
            failed: [],
            skipped: []
        };

        // Process in batches
        for (let i = 0; i < toImport.length; i += batch_size) {
            const batch = toImport.slice(i, i + batch_size);
            console.log(`Processing batch ${Math.floor(i / batch_size) + 1}/${Math.ceil(toImport.length / batch_size)}...`);

            for (const product of batch) {
                try {
                    // Get catalog page mapping
                    const pageMapping = pageMap.get(product.sku);

                    // Prepare image URL (use first image)
                    const imageUrl = (product.images && product.images.length > 0)
                        ? product.images[0].url
                        : null;

                    // Prepare download URLs
                    const templates = (product.downloads || [])
                        .filter(d => d.asset_type === 'template')
                        .map(d => d.url);

                    const instructions = (product.downloads || [])
                        .filter(d => d.asset_type === 'setup_guide')
                        .map(d => d.url);

                    // Create product in Base44
                    const created = await base44.asServiceRole.entities.Product.create({
                        sku: product.sku,
                        name: product.name,
                        category: product.category || 'Uncategorized',
                        subcategory: product.subcategory || null,
                        description: product.description || '',
                        image_url: imageUrl,

                        // Pricing (you may need to set these separately)
                        base_price: product.price ? parseFloat(product.price.replace(/[^0-9.]/g, '')) : null,
                        market_value: null, // To be enriched later

                        // Catalog references
                        handbook_page: pageMapping?.primary_page?.toString() || null,
                        catalog_pages: pageMapping?.pages || [],
                        product_url: product.url || null,

                        // Downloads
                        template_urls: templates,
                        instruction_urls: instructions,

                        // Metadata
                        sizes: product.sizes || [],
                        colors: product.colors || [],
                        features: product.features || [],
                        raw_attributes: product.raw_attributes || {},

                        // Source tracking
                        source: 'orbus_catalog_scrape',
                        imported_at: new Date().toISOString()
                    });

                    results.imported.push({
                        sku: product.sku,
                        name: product.name,
                        id: created.id
                    });

                } catch (error) {
                    console.error(`Failed to import ${product.sku}:`, error.message);
                    results.failed.push({
                        sku: product.sku,
                        name: product.name,
                        error: error.message
                    });
                }
            }

            // Small delay between batches to avoid rate limits
            if (i + batch_size < toImport.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('✅ Import complete!');
        return Response.json({
            success: true,
            summary: {
                total_processed: toImport.length,
                imported: results.imported.length,
                failed: results.failed.length,
                skipped: results.skipped.length
            },
            imported: results.imported,
            failed: results.failed.length > 0 ? results.failed : undefined
        });

    } catch (error) {
        console.error('Import error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});