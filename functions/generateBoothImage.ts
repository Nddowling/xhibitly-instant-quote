import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai@4.77.3';

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Generate image using DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0].url;

    // Download the image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // Upload to Base44 using FormData
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    formData.append('file', blob, 'booth-design.png');
    
    const uploadResponse = await fetch(`${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/apps/${Deno.env.get('BASE44_APP_ID')}/integrations/Core/UploadFile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${base44.auth.token}`
      },
      body: formData
    });
    
    const uploadResult = await uploadResponse.json();

    return Response.json({ 
      url: uploadResult.file_url,
      original_url: imageUrl 
    });

  } catch (error) {
    console.error('Image generation error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate image' 
    }, { status: 500 });
  }
});