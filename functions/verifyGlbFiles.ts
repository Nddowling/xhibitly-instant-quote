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
        let allFiles = [];
        
        // Recursive function to list all files
        async function listAllFiles(path = '') {
            const { data, error } = await supabase.storage.from(bucketName).list(path, { limit: 1000 });
            if (error) {
                console.error(`Error listing path ${path}:`, error);
                return;
            }
            if (!data) return;

            for (const item of data) {
                if (item.id === null) {
                    // It's a folder
                    const newPath = path ? `${path}/${item.name}` : item.name;
                    await listAllFiles(newPath);
                } else {
                    // It's a file
                    if (item.name.endsWith('.glb') || item.name.endsWith('.gltf')) {
                        allFiles.push(path ? `${path}/${item.name}` : item.name);
                    }
                }
            }
        }

        // We'll just check if there's a models folder first
        const { data: rootItems } = await supabase.storage.from(bucketName).list('', { limit: 100 });
        
        let glbFiles = [];
        for (const item of rootItems || []) {
            if (item.name === 'models') {
                const { data: modelsFiles } = await supabase.storage.from(bucketName).list('models', { limit: 1000 });
                if (modelsFiles) {
                    glbFiles = modelsFiles.filter(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf')).map(f => `models/${f.name}`);
                }
            }
        }

        if (glbFiles.length === 0) {
            // Let's do a deeper search in products
            const { data: products } = await supabase.storage.from(bucketName).list('products', { limit: 1000 });
            if (products) {
                for (const product of products) {
                    if (product.id === null) {
                        const { data: productFiles } = await supabase.storage.from(bucketName).list(`products/${product.name}`, { limit: 100 });
                        if (productFiles) {
                            for (const pf of productFiles) {
                                if (pf.id === null) {
                                    const { data: subFiles } = await supabase.storage.from(bucketName).list(`products/${product.name}/${pf.name}`, { limit: 100 });
                                    if (subFiles) {
                                        const glbs = subFiles.filter(f => f.name.endsWith('.glb') || f.name.endsWith('.gltf'));
                                        glbs.forEach(g => glbFiles.push(`products/${product.name}/${pf.name}/${g.name}`));
                                    }
                                } else if (pf.name.endsWith('.glb') || pf.name.endsWith('.gltf')) {
                                    glbFiles.push(`products/${product.name}/${pf.name}`);
                                }
                            }
                        }
                    }
                }
            }
        }

        return Response.json({
            rootItems: rootItems?.map(i => i.name) || [],
            glbCount: glbFiles.length,
            glbFiles: glbFiles.slice(0, 10) // Show first 10
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});