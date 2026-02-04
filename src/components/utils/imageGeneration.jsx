import { base44 } from '@/api/base44Client';

export async function generateBoothImage(design, brandIdentity, customerProfile) {
  const imagePrompt = `Create a photorealistic 3D rendering of a ${design.booth_size} trade show booth with the following design:
  
Design Name: ${design.design_name}
Tier: ${design.tier}
Experience Story: ${design.experience_story}

Brand Identity:
- Primary Color: ${brandIdentity.primary_color}
- Secondary Color: ${brandIdentity.secondary_color}
- Style: ${brandIdentity.brand_personality}
- Industry: ${brandIdentity.industry}

${customerProfile ? `Customer Requirements:
- Objectives: ${customerProfile.objectives?.join(', ')}
- Desired Look: ${customerProfile.desired_look?.join(', ')}
- Desired Feel: ${customerProfile.desired_feel?.join(', ')}
` : ''}

Key Experience Moments:
${design.key_moments?.map(m => `- ${m}`).join('\n')}

Create a high-quality, professional trade show booth visualization that matches this ${design.tier} tier design. Show the booth from a 3/4 angle view with proper lighting and a realistic trade show floor environment. Include the brand colors prominently in the booth design. Make it look modern, inviting, and professional.`;

  const result = await base44.functions.invoke('generateBoothImage', {
    prompt: imagePrompt
  });

  return result.data.url;
}