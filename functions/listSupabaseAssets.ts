import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createClient } from 'npm:@supabase/supabase-js@^2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse the request body to get the bucket name and optional path
        const body = await req.json().catch(() => ({}));
        const bucketName = body.bucket || 'orbus-assets'; // Default to 'orbus-assets' if not provided
        const path = body.path || ''; // Optional path within the bucket

        // List files in the specified bucket and path
        const { data, error } = await supabase
            .storage
            .from(bucketName)
            .list(path, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error) {
            console.error('Supabase storage error:', error);
            return Response.json({ error: error.message }, { status: 500 });
        }

        // Generate public URLs for the files
        const filesWithUrls = data.map(file => {
            const filePath = path ? `${path}/${file.name}` : file.name;
            const { data: urlData } = supabase
                .storage
                .from(bucketName)
                .getPublicUrl(filePath);

            return {
                ...file,
                publicUrl: urlData.publicUrl
            };
        });

        return Response.json({ files: filesWithUrls });

    } catch (error) {
        console.error('Function error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});