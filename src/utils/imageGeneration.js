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

  // Determine tier-specific characteristics
  const tierDescriptions = {
    Budget: 'functional and efficient with clean lines',
    Hybrid: 'balanced and impactful with thoughtful details',
    Custom: 'premium and immersive with sophisticated elements'
  };

  const tierDescription = tierDescriptions[design.tier] || 'professional and polished';

  // Build feature descriptions
  const features = [];
  if (customerProfile?.display_products) {
    features.push('- Product display pedestals and shelving with featured items');
  }
  if (customerProfile?.needs_demo_space) {
    features.push('- Demonstration area with presentation screen');
  }
  if (customerProfile?.needs_conference_area) {
    features.push('- Private meeting space with seating');
  }

  const featuresText = features.length > 0 ? `\nBooth Features:\n${features.join('\n')}` : '';

  const prompt = `Create a professional photorealistic 3D rendering of a ${customerProfile?.booth_size || '10x10'} trade show exhibition booth.

Design Style: ${lookStyles} aesthetic with ${feelQualities} spatial arrangement
Brand Colors: Primary ${brandAnalysis?.primary_color || '#e2231a'}, Secondary ${brandAnalysis?.secondary_color || '#333333'}
Industry: ${brandAnalysis?.industry || 'General'}
Brand Personality: ${brandAnalysis?.brand_personality || 'Professional'}
${featuresText}

Design Concept: ${design.experience_story}

Tier Level: ${design.tier} tier (${tierDescription})

Visual Requirements:
- Eye-level perspective from the trade show floor
- Professional exhibition hall environment with proper lighting
- Modern trade show setting with polished concrete or carpeted floor
- Photorealistic materials and textures
- Professional architectural visualization style
- Clean, inviting atmosphere that matches the brand identity
- No text or signage with readable words`;

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
