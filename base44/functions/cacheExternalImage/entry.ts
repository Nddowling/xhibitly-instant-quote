import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { url } = await req.json();
        
        if (!url) {
            return Response.json({ error: 'url is required' }, { status: 400 });
        }

        // Download the image
        const imageRes = await fetch(url);
        if (!imageRes.ok) {
            throw new Error(`Failed to fetch image from ${url}`);
        }
        
        const blob = await imageRes.blob();
        const contentType = imageRes.headers.get('content-type') || 'application/octet-stream';
        const extension = contentType.split('/')[1] || 'png';
        const file = new File([blob], `cached_image_${Date.now()}.${extension}`, { type: contentType });

        // Upload via Core.UploadFile
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({
            file: file
        });

        if (!uploadRes || !uploadRes.file_url) {
            throw new Error('Failed to upload cached image');
        }

        return Response.json({ success: true, cached_url: uploadRes.file_url });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});