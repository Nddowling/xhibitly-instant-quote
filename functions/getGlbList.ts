import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: products, error: pErr } = await supabase.storage.from('orbus-assets').list('products', { limit: 3000 });
        if (pErr) throw pErr;

        const glbProducts = [];
        
        const batchSize = 50;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            const promises = batch.map(async (p) => {
                if (p.id) {
                    const { data: files } = await supabase.storage.from('orbus-assets').list(`products/${p.name}/model_3d`, { limit: 10 });
                    if (files && files.some(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf'))) {
                        return p.name;
                    }
                }
                return null;
            });
            const results = await Promise.all(promises);
            glbProducts.push(...results.filter(Boolean));
        }

        return Response.json({ count: glbProducts.length, products: glbProducts });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});