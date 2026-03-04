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
        
        // We'll use the search feature of Supabase storage list
        const { data, error } = await supabase
            .storage
            .from(bucketName)
            .list('products', {
                limit: 100,
                offset: 0,
                search: 'glb'
            });

        if (error) {
            return Response.json({ error: error.message }, { status: 500 });
        }

        // Also let's just get a list of product folders and check a few
        const { data: folders } = await supabase.storage.from(bucketName).list('products', { limit: 50 });
        
        let glbFiles = [];
        
        // Check the first 20 folders for an 'other' folder containing glb
        if (folders) {
            for (const folder of folders.slice(0, 20)) {
                if (!folder.id) continue; // It's a folder
                const { data: otherFiles } = await supabase.storage.from(bucketName).list(`products/${folder.name}/other`, { limit: 10 });
                if (otherFiles) {
                    const glbs = otherFiles.filter(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf'));
                    for (const glb of glbs) {
                        glbFiles.push(`products/${folder.name}/other/${glb.name}`);
                    }
                }
            }
        }

        return Response.json({ 
            searchResult: data,
            foundInFolders: glbFiles
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});