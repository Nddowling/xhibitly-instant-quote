import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createClient } from 'npm:@supabase/supabase-js@^2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Query the storage.objects table directly to find all GLB files
        // Note: Supabase JS client doesn't expose the storage schema directly through the standard API
        // but we can try to query it if it's exposed, or just use the REST API directly.
        // Actually, the storage schema is not exposed to the public API by default.
        
        // Let's try to list all products and check their 'other' folder in parallel
        const bucketName = 'orbus-assets';
        const { data: products } = await supabase.storage.from(bucketName).list('products', { limit: 5000 });
        
        if (!products) {
            return Response.json({ error: 'No products found' });
        }

        let glbFiles = [];
        let checkedCount = 0;
        
        // Process in batches of 50 to avoid rate limits
        const batchSize = 50;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            const promises = batch.map(async (product) => {
                if (product.id === null) { // It's a folder
                    const { data: files } = await supabase.storage.from(bucketName).list(`products/${product.name}/other`, { limit: 100 });
                    if (files) {
                        const glbs = files.filter(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf'));
                        if (glbs.length > 0) {
                            return glbs.map(g => `products/${product.name}/other/${g.name}`);
                        }
                    }
                }
                return [];
            });
            
            const results = await Promise.all(promises);
            for (const res of results) {
                glbFiles.push(...res);
            }
            checkedCount += batch.length;
            
            // If we found some, we can stop early if we just want to verify they exist, 
            // but the user said there should be 60, so let's count them all.
        }

        return Response.json({ 
            totalProductsChecked: checkedCount,
            glbCount: glbFiles.length,
            glbFiles: glbFiles
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});