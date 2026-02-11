import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const referenceUrls = [
      'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/5f8ad27f9_image.png',
      'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8e0582084_OrbusFactory.jpeg'
    ];

    const prompts = [
      { key: 'hero', prompt: 'A premium 20x20 trade show booth in a modern convention center, featuring sleek aluminum truss structure, vibrant backlit fabric graphics with blue and teal corporate branding, a white illuminated reception counter, digital display screens, modern white chairs, professional lighting from above. Wide angle view showing the complete booth setup. Photorealistic, high-end commercial photography style, warm exhibition hall lighting.' },
      { key: 'install', prompt: 'Professional trade show booth installation crew in a convention center, workers in branded polo shirts efficiently assembling a modular aluminum truss display system. Action shot showing teamwork, one person connecting truss sections while another unfurls a large fabric graphic panel. Clean concrete floor, high ceiling with industrial lighting. Photorealistic, editorial photography style, dynamic angle.' },
      { key: 'standout', prompt: 'Wide angle shot of a stunning trade show booth with a large overhead hanging sign structure, architectural LED lighting strips, and dramatic backlit walls, standing out prominently on a crowded exhibition floor. Other booths visible in background for scale. The booth features a modern minimalist design with clean lines, fabric tension displays, and warm accent lighting. Photorealistic convention center photography, high ceiling visible.' },
      { key: 'detail', prompt: 'Close-up detail shot of a premium trade show booth feature — a seamless integrated digital touchscreen display mounted in a sleek branded reception counter with edge-lit LED accents and custom printed fabric graphic wrap. Modern materials including brushed aluminum trim and backlit acrylic panels. Shallow depth of field, professional product photography style, warm ambient exhibition lighting.' }
    ];

    const results = {};
    for (const { key, prompt } of prompts) {
      const { url } = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt,
        existing_image_urls: referenceUrls
      });
      results[key] = url;
    }

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});