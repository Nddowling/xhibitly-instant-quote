import { base44 } from '@/api/base44Client';

export async function generateBoothImage(design, brandIdentity, customerProfile) {
  const boothDimensions = {
    '10x10': '10 feet by 10 feet (100 square feet) - a compact inline booth',
    '10x20': '10 feet by 20 feet (200 square feet) - a medium inline booth',
    '20x20': '20 feet by 20 feet (400 square feet) - a large island booth'
  };

  const imagePrompt = `Photorealistic 3D rendering of a trade show booth.

BOOTH SIZE: ${design.booth_size} - ${boothDimensions[design.booth_size]}

BRAND LOGO (MUST BE VISIBLE):
${brandIdentity.logo_description ? `The company logo looks like: ${brandIdentity.logo_description}` : 'Show company branding prominently'}
The logo MUST appear prominently on the main backwall and reception counter.

BRAND COLORS:
- Primary: ${brandIdentity.primary_color} (dominant on walls, structures)
- Secondary: ${brandIdentity.secondary_color} (accents, counters)
- Accent: ${brandIdentity.accent_color_1 || brandIdentity.primary_color} (lighting, details)
- Brand Personality: ${brandIdentity.brand_personality}
- Industry: ${brandIdentity.industry}

DESIGN: "${design.design_name}" - ${design.tier} tier
Story: ${design.experience_story}

${customerProfile ? `CUSTOMER REQUIREMENTS:
- Objectives: ${customerProfile.objectives?.join(', ')}
- Look: ${customerProfile.desired_look?.join(', ')}
- Feel: ${customerProfile.desired_feel?.join(', ')}
` : ''}

KEY FEATURES: ${design.key_moments?.map(m => m).join(', ')}

Professional architectural visualization, 3/4 angle view, trade show floor, dramatic lighting, photorealistic.`;

  const generateParams = { prompt: imagePrompt };
  if (brandIdentity.logo_url) {
    generateParams.existing_image_urls = [brandIdentity.logo_url];
  }

  const result = await base44.integrations.Core.GenerateImage(generateParams);
  return result.url;
}