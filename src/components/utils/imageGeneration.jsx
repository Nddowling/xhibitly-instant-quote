import { base44 } from '@/api/base44Client';

export async function generateBoothImage(design, brandIdentity, customerProfile) {
  // Define booth dimensions for accuracy
  const boothDimensions = {
    '10x10': '10 feet by 10 feet (100 square feet) - a compact inline booth',
    '10x20': '10 feet by 20 feet (200 square feet) - a medium inline booth',
    '20x20': '20 feet by 20 feet (400 square feet) - a large island booth'
  };

  const imagePrompt = `Create a photorealistic 3D rendering of a trade show booth with these EXACT specifications:

BOOTH SIZE: ${design.booth_size} - ${boothDimensions[design.booth_size]}
CRITICAL: The booth must be ${design.booth_size} in dimensions. Show the correct proportions for this size.

BRAND IDENTITY (MUST USE):
- Primary Brand Color: ${brandIdentity.primary_color} (use prominently in booth design, graphics, and accents)
- Secondary Brand Color: ${brandIdentity.secondary_color} (use for supporting elements)
- Brand Personality: ${brandIdentity.brand_personality}
- Industry: ${brandIdentity.industry}
- Brand Style: ${brandIdentity.design_style?.join(', ') || 'Modern'}

DESIGN CONCEPT:
- Name: ${design.design_name}
- Tier: ${design.tier}
- Story: ${design.experience_story}

${customerProfile ? `CUSTOMER REQUIREMENTS:
- Objectives: ${customerProfile.objectives?.join(', ')}
- Desired Look: ${customerProfile.desired_look?.join(', ')}
- Desired Feel: ${customerProfile.desired_feel?.join(', ')}
` : ''}

KEY FEATURES TO SHOW:
${design.key_moments?.map(m => `- ${m}`).join('\n')}

RENDERING REQUIREMENTS:
- Show booth from 3/4 angle view
- Professional trade show lighting
- Realistic trade show floor environment with carpet
- MUST incorporate the brand colors (${brandIdentity.primary_color} and ${brandIdentity.secondary_color}) throughout the booth design
- Include branded graphics, signage, and displays matching the brand identity
- ${design.tier === 'Budget' ? 'Simple, clean design with essential elements' : design.tier === 'Hybrid' ? 'Professional design with balanced features' : 'Premium, sophisticated design with advanced features'}
- Photorealistic quality, professional photography style`;


  const result = await base44.functions.invoke('generateBoothImage', {
    prompt: imagePrompt
  });

  return result.data.url;
}