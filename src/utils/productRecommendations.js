import { base44 } from '@/api/base44Client';

/**
 * Recommends products based on booth size, tier, and customer requirements
 * @param {Object} params - Parameters for product recommendation
 * @param {string} params.boothSize - Booth size (e.g., "10x10", "10x20")
 * @param {string} params.tier - Design tier: "Budget", "Hybrid", or "Custom"
 * @param {Object} params.customerProfile - Customer requirements
 * @returns {Promise<Object>} - Recommended products organized by type
 */
export async function recommendProducts({ boothSize, tier, customerProfile }) {
  // Parse booth dimensions
  const dimensions = boothSize.split('x').map(d => parseInt(d));
  const width = dimensions[0] || 10;
  const depth = dimensions[1] || 10;
  const squareFeet = width * depth;

  try {
    // Query all active products
    const allProducts = await base44.entities.Product.list({
      filter: { is_active: true }
    });

    // Filter products by tier compatibility and booth size
    const compatibleProducts = allProducts.filter(product => {
      const tierMatch = product.tier_compatibility?.includes(tier);
      const sizeMatch = (!product.booth_size_min || squareFeet >= product.booth_size_min) &&
                       (!product.booth_size_max || squareFeet <= product.booth_size_max);
      return tierMatch && sizeMatch;
    });

    // Organize by product type
    const recommendations = {
      backwall: null,
      accents: [],
      tabletop: null
    };

    // Select primary backwall based on booth width
    const backwalls = compatibleProducts.filter(p =>
      p.product_type === 'Backwall' || p.product_type === 'Banner Display'
    );

    // Find closest width match
    const widthMatch = backwalls.find(b => b.width === `${width}'`) ||
                       backwalls.find(b => parseInt(b.width) >= width);

    if (widthMatch) {
      recommendations.backwall = widthMatch;
    }

    // Select accent ladders based on requirements
    const accents = compatibleProducts.filter(p => p.product_type === 'Accent Ladder');

    if (customerProfile?.needs_demo_space) {
      // Add monitor mount accent
      const monitorAccent = accents.find(a => a.features?.includes('monitor_mount'));
      if (monitorAccent) recommendations.accents.push(monitorAccent);
    }

    if (customerProfile?.display_products && squareFeet >= 100) {
      // Add shelving accent
      const shelvingAccent = accents.find(a =>
        a.features?.includes('shelving') &&
        !recommendations.accents.find(r => r.sku === a.sku)
      );
      if (shelvingAccent) recommendations.accents.push(shelvingAccent);
    }

    // Add tabletop for small booths
    if (squareFeet <= 100) {
      const tabletop = compatibleProducts.find(p => p.product_type === 'Tabletop');
      if (tabletop) recommendations.tabletop = tabletop;
    }

    return recommendations;
  } catch (error) {
    console.error('Failed to recommend products:', error);
    return { backwall: null, accents: [], tabletop: null };
  }
}

/**
 * Builds product description for image generation prompts
 * @param {Object} recommendations - Product recommendations from recommendProducts()
 * @param {Object} brandAnalysis - Brand colors and personality
 * @returns {string} - Detailed product description for DALL-E prompt
 */
export function buildProductDescription(recommendations, brandAnalysis) {
  const parts = [];

  if (recommendations.backwall) {
    const { product_line, width, shape, description } = recommendations.backwall;
    const shapeDesc = shape === 'Straight' ? 'straight' :
                      shape === 'Horizontal Curved' ? 'elegantly curved horizontally' :
                      shape === 'Vertical Curved' ? 'curved with vertical dimension' :
                      shape === 'Serpentine Curved' ? 'flowing S-curve serpentine' : 'straight';

    parts.push(`Main backwall: ${width} ${shapeDesc} ${product_line} display with large fabric graphic panel in primary color ${brandAnalysis?.primary_color || '#e2231a'}`);
  }

  if (recommendations.accents && recommendations.accents.length > 0) {
    recommendations.accents.forEach(accent => {
      if (accent.features?.includes('monitor_mount')) {
        parts.push(`Accent ladder with mounted presentation monitor/screen for product demonstrations`);
      } else if (accent.features?.includes('shelving')) {
        parts.push(`Accent ladder with multiple shelves displaying products and promotional materials`);
      } else {
        parts.push(`Branded accent ladder panel with fabric graphics`);
      }
    });
  }

  if (recommendations.tabletop) {
    parts.push(`Tabletop display with branded fabric graphic for literature and small product display`);
  }

  return parts.join('. ') + '.';
}

/**
 * Calculates total product cost
 * @param {Object} recommendations - Product recommendations
 * @returns {number} - Total cost in USD
 */
export function calculateProductCost(recommendations) {
  let total = 0;

  if (recommendations.backwall?.price) {
    total += recommendations.backwall.price;
  }

  if (recommendations.accents) {
    recommendations.accents.forEach(accent => {
      if (accent.price) total += accent.price;
    });
  }

  if (recommendations.tabletop?.price) {
    total += recommendations.tabletop.price;
  }

  return total;
}
