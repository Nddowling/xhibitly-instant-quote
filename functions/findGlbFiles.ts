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
        
        // Search the entire bucket for glb files
        const { data: searchData, error: searchError } = await supabase
            .storage
            .from(bucketName)
            .list('', {
                limit: 100,
                offset: 0,
                search: 'glb'
            });

        const { data: searchData2 } = await supabase
            .storage
            .from(bucketName)
            .list('', {
                limit: 100,
                offset: 0,
                search: '.glb'
            });

        // Let's also just list the root to see if there's a models folder
        const { data: rootFolders } = await supabase.storage.from(bucketName).list('', { limit: 50 });

        return Response.json({ 
            searchResult: searchData,
            searchResult2: searchData2,
            rootFolders: rootFolders
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});