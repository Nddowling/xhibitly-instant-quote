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
        
        // Let's use the search API again but specifically in the products folder
        const { data: searchData, error: searchError } = await supabase
            .storage
            .from(bucketName)
            .list('products', {
                limit: 1000,
                search: '.glb'
            });
            
        const { data: searchData2 } = await supabase
            .storage
            .from(bucketName)
            .list('products', {
                limit: 1000,
                search: 'glb'
            });

        return Response.json({ 
            searchResult: searchData,
            searchResult2: searchData2,
            error: searchError
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});