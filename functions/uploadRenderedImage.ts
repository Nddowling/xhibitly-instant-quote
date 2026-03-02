import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { booth_design_id, data_url } = await req.json();
        
        if (!booth_design_id || !data_url) {
            return Response.json({ error: 'booth_design_id and data_url are required' }, { status: 400 });
        }

        const design = await base44.entities.BoothDesign.get(booth_design_id);
        if (!design) {
            return Response.json({ error: 'Design not found' }, { status: 404 });
        }

        // Convert base64 data URL to Blob
        const match = data_url.match(/^data:(image\/[a-zA-Z]*);base64,(.*)$/);
        if (!match) {
            return Response.json({ error: 'Invalid data URL format' }, { status: 400 });
        }

        const mimeType = match[1];
        const b64Data = match[2];
        const binaryStr = atob(b64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        
        // Convert to a File object for the upload
        const blob = new Blob([bytes], { type: mimeType });
        const file = new File([blob], `booth_${booth_design_id}_snapshot.png`, { type: mimeType });

        // Upload via Core.UploadFile
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({
            file: file
        });

        if (!uploadRes || !uploadRes.file_url) {
            throw new Error('Failed to upload image');
        }

        // Update BoothDesign
        const renderHistory = Array.isArray(design.render_history) ? design.render_history : [];
        
        if (design.design_image_url) {
            renderHistory.push({
                url: design.design_image_url,
                generated_at: design.render_generated_at || new Date().toISOString(),
                product_skus: design.product_skus || [],
            });
        }

        const updatedDesign = await base44.entities.BoothDesign.update(booth_design_id, {
            design_image_url: uploadRes.file_url,
            render_generated_at: new Date().toISOString(),
            render_history: renderHistory.slice(-10)
        });

        return Response.json({ success: true, url: uploadRes.file_url, design: updatedDesign });
    } catch (error) {
        console.error(error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});