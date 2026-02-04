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

  const prompt = `Create a photorealistic 3D architectural rendering of a ${width} feet wide by ${depth} feet deep (${squareFeet} square feet total) ${boothSize} trade show exhibition booth viewed from eye-level perspective standing on the trade show floor.

CRITICAL BOOTH DIMENSIONS:
- Exact size: ${width} feet wide × ${depth} feet deep × 8-10 feet tall
- Floor space: ${squareFeet} square feet
- Scale: The booth must look appropriately sized for a ${squareFeet} sq ft space - ${squareFeet < 150 ? 'compact and intimate' : squareFeet < 300 ? 'medium-sized' : 'large and spacious'}
- Show clear depth and width proportions matching ${boothSize} dimensions

BRAND IDENTITY (MUST BE PROMINENT):
- Primary Brand Color ${primaryColor}: Use extensively in large graphic panels, overhead signage, and key structural elements
- Secondary Color ${secondaryColor}: Use for accents, text, and complementary design elements
- Apply brand colors to at least 40% of visible surfaces including backwall graphics, hanging signs, or structural panels
- Industry: ${brandAnalysis?.industry || 'Professional'}
- Brand Personality: ${brandAnalysis?.brand_personality || 'Professional and polished'}

DESIGN AESTHETIC (FROM CUSTOMER QUESTIONNAIRE):
- Visual Style: ${lookStyles} design language
- Spatial Feel: ${feelQualities} layout and atmosphere
- Overall Vibe: ${design.experience_story}

REQUIRED FUNCTIONAL ELEMENTS:
${features.length > 0 ? features.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'Standard booth layout with open welcoming space'}

TIER CHARACTERISTICS (${design.tier} Tier - ${tierDescription.split(',')[0]}):
${tierDescription}

VISUAL REQUIREMENTS FOR PHOTOREALISM:
- Eye-level perspective from visitor approaching the booth (5.5 feet height)
- Professional exhibition hall with bright even lighting from ceiling grid
- Light gray carpeted floor or polished concrete typical of convention centers
- Show the booth within trade show context (hint of neighboring booth edges visible)
- Photorealistic materials: fabric graphics, metal frames, wood or laminate surfaces, LED lighting
- Professional trade show atmosphere
- Accurate scale showing booth fits within ${squareFeet} square foot footprint
- NO readable text, logos, or company names on any surfaces
- Ensure brand colors ${primaryColor} and ${secondaryColor} are highly visible and dominant in the design`;

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
