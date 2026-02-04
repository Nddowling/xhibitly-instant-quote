import { base44 } from '@/api/base44Client';

/**
 * Builds a detailed DALL-E prompt for booth design visualization
 * @param {Object} design - The booth design object
 * @param {Object} brandAnalysis - Brand identity analysis
 * @param {Object} customerProfile - Customer requirements from questionnaire
 * @returns {string} - DALL-E prompt
 */
export function buildImagePrompt(design, brandAnalysis, customerProfile) {
  const lookStyles = customerProfile?.desired_look?.join(', ').toLowerCase() || 'modern';
  const feelQualities = customerProfile?.desired_feel?.join(', ').toLowerCase() || 'open';
  const boothSize = customerProfile?.booth_size || '10x10';

  // Parse booth dimensions
  const dimensions = boothSize.split('x').map(d => parseInt(d));
  const width = dimensions[0] || 10;
  const depth = dimensions[1] || 10;
  const squareFeet = width * depth;

  // Determine tier-specific characteristics with more detail
  const tierDescriptions = {
    Budget: `functional and cost-effective with clean simple design, minimal custom elements, standard materials and finishes`,
    Hybrid: `well-balanced design combining impact with value, mix of custom and modular elements, quality materials and professional finishes`,
    Custom: `premium fully customized design with high-end materials, sophisticated architectural elements, luxury finishes and innovative features`
  };

  const tierDescription = tierDescriptions[design.tier] || 'professional and polished';

  // Build detailed feature descriptions
  const features = [];
  if (customerProfile?.display_products) {
    features.push(`Multiple product display areas with pedestals, shelving, or showcases prominently featuring products`);
  }
  if (customerProfile?.needs_demo_space) {
    features.push(`Dedicated demonstration zone with large presentation screen or monitor for product demos`);
  }
  if (customerProfile?.needs_conference_area) {
    features.push(`Private semi-enclosed meeting area with seating for 4-6 people and table`);
  }

  // Construct prominent brand color guidance
  const primaryColor = brandAnalysis?.primary_color || '#e2231a';
  const secondaryColor = brandAnalysis?.secondary_color || '#333333';

  // Extract comprehensive brand identity from URL analysis
  const brandIdentity = {
    industry: brandAnalysis?.industry || 'Professional',
    personality: brandAnalysis?.brand_personality || 'Professional and polished',
    essence: brandAnalysis?.brand_essence || 'Quality and innovation',
    targetAudience: brandAnalysis?.target_audience || 'professionals',
    designStyle: brandAnalysis?.design_style || []
  };

  // Build brand-specific design language
  const brandDesignElements = brandIdentity.designStyle.length > 0
    ? `\nBrand Visual Language: ${brandIdentity.designStyle.join(', ')}`
    : '';

  const targetAudienceDesc = brandIdentity.targetAudience
    ? `\nTarget Audience: ${brandIdentity.targetAudience} - the booth design should appeal to and resonate with this audience`
    : '';

  // Build size-specific constraints
  const sizeConstraints = squareFeet <= 100
    ? `CRITICAL: This is a VERY SMALL booth (${squareFeet} sq ft = size of a small bedroom or single parking space)
- Maximum 1-2 functional zones ONLY (cannot fit conference area, demo space, AND product displays)
- Maximum 2-3 people can fit comfortably
- MUST show the booth looking cramped and compact, NOT spacious
- Include visible neighboring booth walls to show size constraint
- The entire booth must be visible in frame with clear spatial limits`
    : squareFeet <= 200
    ? `CRITICAL: This is a COMPACT booth (${squareFeet} sq ft = size of a large bedroom)
- Maximum 2-3 functional zones
- Maximum 4-5 people can fit comfortably
- Show the booth looking efficient and well-organized, NOT large
- Include neighboring booth edges to demonstrate size
- The entire booth width should be visible in frame`
    : squareFeet <= 400
    ? `This is a MEDIUM-SIZED booth (${squareFeet} sq ft)
- Can accommodate 3-4 functional zones
- Maximum 6-8 people can fit comfortably
- Show balanced use of space without appearing overly large`
    : `This is a LARGE booth (${squareFeet} sq ft)
- Can accommodate 4-6 functional zones
- Can comfortably hold 10-15 people
- Show spacious, premium exhibition space`;

  // Build visitor journey zones if available
  const journeyZones = [];
  if (design.visitor_journey) {
    // Extract key spatial elements from the visitor journey
    const journeyLower = design.visitor_journey.toLowerCase();
    if (journeyLower.includes('enter') || journeyLower.includes('entrance') || journeyLower.includes('archway')) {
      journeyZones.push('welcoming entrance area');
    }
    if (journeyLower.includes('central') || journeyLower.includes('center')) {
      journeyZones.push('central focal point');
    }
    if (journeyLower.includes('display') || journeyLower.includes('showcase')) {
      journeyZones.push('product display zones');
    }
  }

  // Build key moments into spatial layout
  const keyMomentsDesc = design.key_moments && design.key_moments.length > 0
    ? `\n\nKEY EXPERIENTIAL ZONES (based on visitor journey):\n${design.key_moments.slice(0, 3).map((moment, i) => `${i + 1}. ${moment}`).join('\n')}`
    : '';

  const prompt = `Create a photorealistic 3D architectural rendering of a ${width} feet wide by ${depth} feet deep (${squareFeet} square feet total) ${boothSize} trade show exhibition booth.

BOOTH CONCEPT: "${design.design_name}"
${design.experience_story}

${sizeConstraints}

ABSOLUTE DIMENSIONAL REQUIREMENTS:
- Exact floor dimensions: ${width} feet wide × ${depth} feet deep (${squareFeet} total square feet)
- Height: 8-10 feet tall maximum
- Real-world comparison: ${squareFeet <= 100 ? 'Size of a small bedroom or one parking space' : squareFeet <= 200 ? 'Size of a large bedroom or studio apartment living room' : squareFeet <= 400 ? 'Size of a small apartment or two parking spaces' : 'Size of a large apartment'}
- CRITICAL: If this is 10x10 (100 sq ft), it MUST look compact and intimate - DO NOT make it appear spacious or large
- Show the booth from a 45-degree angle perspective so both width AND depth are clearly visible
- Include people for scale (${squareFeet <= 100 ? '2-3 people max' : squareFeet <= 200 ? '4-5 people' : squareFeet <= 400 ? '6-8 people' : '10-12 people'})

BRAND IDENTITY FROM URL ANALYSIS (MUST BE PROMINENTLY REFLECTED):
- Industry: ${brandIdentity.industry}
- Brand Personality: ${brandIdentity.personality}
- Brand Essence: ${brandIdentity.essence}${targetAudienceDesc}${brandDesignElements}

BRAND COLORS (CRITICAL - EXTRACTED FROM WEBSITE):
- Primary Brand Color ${primaryColor}: This is the EXACT color from the brand's website. Use it extensively in:
  * Large fabric graphic panels on backwall
  * Overhead hanging signs or banners
  * Key structural accent elements
  * Flooring elements or carpet inlays
- Secondary Color ${secondaryColor}: Use for complementary elements, text, and accents
- REQUIREMENT: Brand colors must cover at least 50% of all visible surfaces
- The color scheme should IMMEDIATELY communicate the brand identity to visitors

BRAND VISUAL EXECUTION:
- Every design element should reflect the brand personality: "${brandIdentity.personality}"
- Graphics and materials should embody: "${brandIdentity.essence}"
- Visual style must align with the brand's design language${brandIdentity.designStyle.length > 0 ? `: ${brandIdentity.designStyle.join(', ')}` : ''}
- The booth should feel like a physical extension of the company's website and brand identity

VISITOR EXPERIENCE DESIGN:
${design.visitor_journey || 'Create an engaging flow that draws visitors through the space naturally'}
${journeyZones.length > 0 ? `\nSpatial Layout: Include ${journeyZones.join(', ')}` : ''}${keyMomentsDesc}

DESIGN AESTHETIC (FROM CUSTOMER QUESTIONNAIRE):
- Visual Style: ${lookStyles} design language reflecting the brand's personality
- Spatial Feel: ${feelQualities} layout and atmosphere
- Overall Atmosphere: Should support the experience story and visitor journey described above

FUNCTIONAL ELEMENTS (${squareFeet <= 100 ? 'SIMPLIFIED due to small size' : 'As specified'}):
${features.length > 0 ? features.map((f, i) => `${i + 1}. ${f}${squareFeet <= 100 ? ' (compact version)' : ''}`).join('\n') : 'Standard booth layout with open welcoming space'}

TIER CHARACTERISTICS (${design.tier} Tier):
${tierDescription}
${design.design_rationale ? `\nDesign Philosophy: ${design.design_rationale}` : ''}

VISUAL REQUIREMENTS FOR PHOTOREALISM:
- 45-degree angle view from trade show floor showing both width and depth clearly
- Include 2-3 neighboring booth edges/walls to provide scale context and show size constraints
- Professional exhibition hall with bright even lighting from ceiling grid
- Light gray carpeted floor typical of convention centers
- Photorealistic materials: fabric graphics, metal frames, wood or laminate surfaces, LED lighting
- Show people in and around the booth for accurate scale reference - they should appear to be experiencing the key moments described
- The ENTIRE booth must be visible in the frame to show true dimensions
- NO readable text, logos, or company names on any surfaces
- Ensure brand colors ${primaryColor} and ${secondaryColor} are highly visible and dominant in the design
- The design should visually communicate the experience story: "${design.experience_story}"
- ${squareFeet <= 100 ? 'CRITICAL: Booth must look compact and space-efficient, NOT large or spacious' : squareFeet <= 200 ? 'Booth should look well-organized but not overly spacious' : ''}`;

  return prompt;
}

/**
 * Generates a booth design image using DALL-E 3
 * @param {Object} design - The booth design object
 * @param {Object} brandAnalysis - Brand identity analysis
 * @param {Object} customerProfile - Customer requirements
 * @returns {Promise<string>} - Image URL
 */
export async function generateBoothImage(design, brandAnalysis, customerProfile) {
  try {
    const prompt = buildImagePrompt(design, brandAnalysis, customerProfile);

    console.log(`Generating image for ${design.tier} tier booth...`);
    console.log('Prompt:', prompt);

    // Call Base44 backend function for image generation
    const response = await base44.functions.generateBoothImage({
      prompt: prompt,
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard'
    });

    const imageUrl = response.image_url;
    console.log(`Image generated successfully for ${design.tier} tier:`, imageUrl);

    return imageUrl;
  } catch (error) {
    console.error(`Failed to generate image for ${design.tier} tier:`, error.message);
    throw error;
  }
}

/**
 * Generates images for all booth designs with error handling
 * @param {Array} designs - Array of booth design objects
 * @param {Object} brandAnalysis - Brand identity analysis
 * @param {Object} customerProfile - Customer requirements
 * @param {Function} onImageGenerated - Callback when each image is generated
 * @returns {Promise<Array>} - Array of designs with image URLs
 */
export async function generateAllBoothImages(designs, brandAnalysis, customerProfile, onImageGenerated) {
  const results = [];

  for (const design of designs) {
    try {
      const imageUrl = await generateBoothImage(design, brandAnalysis, customerProfile);
      const updatedDesign = { ...design, design_image_url: imageUrl };
      results.push(updatedDesign);

      // Call callback to update UI progressively
      if (onImageGenerated) {
        onImageGenerated(updatedDesign);
      }
    } catch (error) {
      console.error(`Skipping image for ${design.tier} tier due to error`);
      results.push(design); // Keep design without image
    }
  }

  return results;
}
