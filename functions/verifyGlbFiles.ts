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

        const { data: buckets } = await supabase.storage.listBuckets();
        
        let results = {
            buckets: buckets?.map(b => b.name) || [],
            rootFolders: {}
        };

        if (buckets) {
            for (const bucket of buckets) {
                const { data: rootItems } = await supabase.storage.from(bucket.name).list('', { limit: 100 });
                results.rootFolders[bucket.name] = rootItems?.map(i => i.name) || [];
                
                // If there's a models folder, check it
                if (rootItems?.some(i => i.name === 'models')) {
                    const { data: modelsFiles } = await supabase.storage.from(bucket.name).list('models', { limit: 1000 });
                    results[`${bucket.name}_models_count`] = modelsFiles?.length || 0;
                    results[`${bucket.name}_models_sample`] = modelsFiles?.slice(0, 5).map(f => f.name) || [];
                }
                
                // If there's a glb folder, check it
                if (rootItems?.some(i => i.name === 'glb' || i.name === '3d')) {
                    const folderName = rootItems.find(i => i.name === 'glb' || i.name === '3d').name;
                    const { data: files } = await supabase.storage.from(bucket.name).list(folderName, { limit: 1000 });
                    results[`${bucket.name}_${folderName}_count`] = files?.length || 0;
                }
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});