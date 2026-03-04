import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: products, error: pErr } = await supabase.storage.from('orbus-assets').list('products', { limit: 100 });
        if (pErr) throw pErr;

        const { data: barricade } = await supabase.storage.from('orbus-assets').list('products/BARRICADE-COVER/model_3d', { limit: 10 });

        return Response.json({ 
            productsCount: products?.length, 
            firstFew: products?.slice(0, 5),
            barricadeFiles: barricade
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});