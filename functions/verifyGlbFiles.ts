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

        const bucketName = 'orbus-assets';
        const { data: products } = await supabase.storage.from(bucketName).list('products', { limit: 5000 });
        
        if (!products) {
            return Response.json({ error: 'No products found' });
        }

        let glbFiles = [];
        let checkedCount = 0;
        
        // Process in batches of 50
        const batchSize = 50;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            const promises = batch.map(async (product) => {
                if (product.id === null) { // It's a folder
                    // Check root of product folder
                    const { data: files } = await supabase.storage.from(bucketName).list(`products/${product.name}`, { limit: 100 });
                    if (files) {
                        const glbs = files.filter(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf'));
                        if (glbs.length > 0) {
                            return glbs.map(g => `products/${product.name}/${g.name}`);
                        }
                        
                        // Check if there's a 3d or models folder
                        const subFolders = files.filter(f => f.id === null);
                        for (const sub of subFolders) {
                            if (sub.name !== 'image' && sub.name !== 'other') { // we already checked other, but let's check it again just in case
                                const { data: subFiles } = await supabase.storage.from(bucketName).list(`products/${product.name}/${sub.name}`, { limit: 100 });
                                if (subFiles) {
                                    const subGlbs = subFiles.filter(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf'));
                                    if (subGlbs.length > 0) {
                                        return subGlbs.map(g => `products/${product.name}/${sub.name}/${g.name}`);
                                    }
                                }
                            }
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