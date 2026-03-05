import Anthropic from '@anthropic-ai/sdk';

/**
 * Generate Booth Suggestions - AI "Remote Control" for Editor
 *
 * Takes natural language queries and returns product placement suggestions
 *
 * Examples:
 * - "Add a counter at the back" → Suggest counters positioned at back
 * - "Make it more modern" → Suggest modern products to replace existing
 * - "Optimize for foot traffic" → Reposition items for better flow
 * - "Complete the layout" → Generate full booth design
 *
 * @serverless
 */
export default async function generateBoothSuggestions(
  { query, boothSize, brandIdentity, currentProducts, catalogFilters },
  { entities }
) {
  // Parse booth dimensions
  const [boothW, boothD] = (boothSize || '10x10')
    .split('x')
    .map((n) => parseInt(n) || 10);

  // Get relevant products from catalog
  const products = await entities.Product.list({
    where: catalogFilters || { is_active: true },
    limit: 50
  });

  // Prepare context for Claude
  const contextPrompt = `You are a trade show booth design AI assistant. Help the user by suggesting products and placements.

BOOTH CONTEXT:
- Size: ${boothSize} (${boothW}ft x ${boothD}ft)
- Brand: ${brandIdentity?.company_name || 'Generic'}
- Industry: ${brandIdentity?.industry || 'General'}
- Current products: ${currentProducts?.length || 0}

USER QUERY: "${query}"

AVAILABLE PRODUCTS (sample):
${products.slice(0, 20).map((p, i) => `
${i + 1}. ${p.name}
   SKU: ${p.sku}
   Category: ${p.category}
   Dimensions: ${p.footprint_w_ft || '?'}W x ${p.footprint_d_ft || '?'}D x ${p.height_ft || '?'}H ft
   Tier: ${p.price_tier}
`).join('\n')}

CURRENT PRODUCTS IN BOOTH:
${currentProducts?.map((p, i) => `
${i + 1}. ${p.name} at position (${p.position?.x || 0}, ${p.position?.z || 0})
`).join('\n') || 'None'}

RESPONSE FORMAT (JSON):
{
  "suggestions": [
    {
      "description": "Brief description for user",
      "product_sku": "SKU from available products",
      "position": { "x": 0-${boothW}, "z": 0-${boothD} },
      "rotation": 0,
      "reasoning": "Why this placement makes sense"
    }
  ]
}

PLACEMENT GUIDELINES:
- x=0,z=0 is front-left corner
- x=${boothW},z=0 is front-right corner
- x=0,z=${boothD} is back-left corner
- Leave walkways (2-3ft clear space)
- Counters typically at back or sides
- Banner stands at corners or entrances
- Ensure products fit within booth dimensions

Provide 1-3 specific suggestions based on the user's query.`;

  // Call Claude API
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: contextPrompt
        }
      ]
    });

    // Parse Claude's response
    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const aiResponse = JSON.parse(jsonMatch[0]);

    // Hydrate suggestions with full product data
    const suggestions = await Promise.all(
      aiResponse.suggestions.map(async (s) => {
        const product = products.find((p) => p.sku === s.product_sku);

        if (!product) {
          return null;
        }

        return {
          description: s.description,
          product,
          position: s.position,
          rotation: s.rotation || 0,
          reasoning: s.reasoning
        };
      })
    );

    return {
      suggestions: suggestions.filter(Boolean),
      query,
      model: 'claude-sonnet-4'
    };
  } catch (error) {
    console.error('AI suggestion error:', error);

    // Fallback: Simple rule-based suggestions
    return generateFallbackSuggestions(
      query,
      boothSize,
      products,
      currentProducts
    );
  }
}

/**
 * Fallback suggestions if AI fails
 */
function generateFallbackSuggestions(query, boothSize, products, currentProducts) {
  const [boothW, boothD] = boothSize.split('x').map((n) => parseInt(n) || 10);
  const queryLower = query.toLowerCase();

  let filtered = products;

  // Simple keyword matching
  if (queryLower.includes('counter')) {
    filtered = products.filter((p) =>
      p.name?.toLowerCase().includes('counter') ||
      p.pricing_category === 'counter'
    );
  } else if (queryLower.includes('banner')) {
    filtered = products.filter((p) =>
      p.name?.toLowerCase().includes('banner') ||
      p.category?.toLowerCase().includes('banner')
    );
  } else if (queryLower.includes('backwall') || queryLower.includes('back wall')) {
    filtered = products.filter((p) =>
      p.pricing_category === 'backwall' ||
      p.name?.toLowerCase().includes('backwall')
    );
  }

  // Take top 3
  const suggestions = filtered.slice(0, 3).map((product, i) => ({
    description: `${product.name}`,
    product,
    position: {
      x: boothW / 2,
      z: boothD - (product.footprint_d_ft || 2)
    },
    rotation: 0,
    reasoning: 'Matching your search query'
  }));

  return {
    suggestions,
    query,
    fallback: true
  };
}
