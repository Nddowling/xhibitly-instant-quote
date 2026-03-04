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

        // List all buckets
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        let results = {
            buckets: buckets?.map(b => b.name) || [],
            glbFiles: []
        };

        if (buckets) {
            for (const bucket of buckets) {
                // Search for glb files in each bucket
                const { data: files } = await supabase
                    .storage
                    .from(bucket.name)
                    .list('', {
                        limit: 1000,
                        search: 'glb'
                    });
                
                if (files && files.length > 0) {
                    results.glbFiles.push({
                        bucket: bucket.name,
                        count: files.length,
                        files: files.slice(0, 5).map(f => f.name) // just show first 5
                    });
                }
                
                // Also search for .gltf
                const { data: filesGltf } = await supabase
                    .storage
                    .from(bucket.name)
                    .list('', {
                        limit: 1000,
                        search: 'gltf'
                    });
                
                if (filesGltf && filesGltf.length > 0) {
                    results.glbFiles.push({
                        bucket: bucket.name,
                        count: filesGltf.length,
                        files: filesGltf.slice(0, 5).map(f => f.name) // just show first 5
                    });
                }
            }
        }

        return Response.json(results);

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});