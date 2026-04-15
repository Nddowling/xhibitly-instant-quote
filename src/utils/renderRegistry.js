const SUPABASE_URL = "https://xpgvpzbzmkubahyxwipk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZ3ZwemJ6bWt1YmFoeXh3aXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjA3MzYsImV4cCI6MjA4NTc5NjczNn0.FAPjUh3kqYLV9wVYsIMBF5_e2OZM1IxgJc2abhwCH38";
const RENDER_DATA_ENDPOINT = `${SUPABASE_URL}/functions/v1/get-render-data`;

/**
 * Fetches enriched render data for an array of SKUs from the Supabase product registry.
 * Returns physical descriptions, placement rules, render instructions, and product image URLs.
 */
export async function fetchRenderRegistry(skus) {
  try {
    const res = await fetch(RENDER_DATA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ skus }),
    });
    if (!res.ok) {
      console.warn("Render registry lookup failed, falling back to basic mode:", res.status);
      return { products: [], missing_skus: skus, total: 0 };
    }
    return await res.json();
  } catch (err) {
    console.warn("Render registry unavailable, falling back to basic mode:", err);
    return { products: [], missing_skus: skus, total: 0 };
  }
}

/**
 * Builds detailed, physically-grounded placement instructions from registry data.
 * Groups products by placement zone and provides structural descriptions.
 */
export function buildEnrichedPlacementInstructions(registryProducts, boothInfo) {
  if (!registryProducts || registryProducts.length === 0) {
    return "No product data available. Generate a generic booth layout.";
  }

  const zones = {};
  for (const p of registryProducts) {
    const zone = p.placement_zone || "center";
    if (!zones[zone]) zones[zone] = [];
    zones[zone].push(p);
  }

  const zoneOrder = ["overhead", "back_wall", "perimeter", "side", "accent", "center", "front", "flanking", "accessory", "hidden"];
  const zoneLabels = {
    overhead: "OVERHEAD / CEILING",
    back_wall: "BACK WALL",
    perimeter: "PERIMETER WALLS",
    side: "SIDE AREAS",
    accent: "ACCENT STRUCTURES",
    center: "CENTER OF BOOTH",
    front: "FRONT / AISLE-FACING",
    flanking: "FLANKING / ENTRANCE",
    accessory: "ATTACHED ACCESSORIES",
  };

  const lines = [];
  lines.push(`BOOTH LAYOUT: ${boothInfo.boothSize} ${boothInfo.boothType} booth for ${boothInfo.brandName || "client"}.`);
  lines.push("");

  for (const zone of zoneOrder) {
    const items = zones[zone];
    if (!items || items.length === 0) continue;
    if (zone === "hidden") continue;

    lines.push(`--- ${zoneLabels[zone] || zone.toUpperCase()} ---`);
    for (const item of items) {
      const dims = item.dimensions || {};
      const dimStr = dims.width_ft
        ? `${dims.width_ft}ft W x ${dims.height_ft}ft H x ${dims.depth_ft}ft D`
        : "";
      lines.push(`- ${item.product_name} (${item.sku})`);
      lines.push(`  Type: ${item.render_category_name}`);
      lines.push(`  Physical: ${item.physical_description}`);
      if (dimStr) lines.push(`  Dimensions: ${dimStr}`);
      if (item.material) lines.push(`  Material: ${item.material}`);
      lines.push(`  Placement: ${item.placement_rule}`);
      lines.push(`  Render: ${item.render_instruction}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Builds the complete render prompt with enriched product data.
 * This is the system prompt for Claude Sonnet which then writes the GPT-Image prompt.
 */
export function buildEnrichedRenderPrompt({
  brandName, boothSize, boothType, showName,
  placementInstructions, colorNotes, brandDetails, registryProducts,
}) {
  const productImageUrls = (registryProducts || [])
    .filter(p => p.image_url)
    .map(p => ({ sku: p.sku, name: p.product_name, url: p.image_url, render_category: p.render_category_name }));

  return `You are an expert trade show booth designer and 3D visualization specialist.
Your job is to write an image generation prompt that will produce a photorealistic trade show booth render.

You have been given EXACT product data from the Orbus catalog including physical descriptions,
dimensions, materials, and placement rules. Use this information precisely — do NOT guess or
improvise what products look like. Each product has a reference photo attached.

BOOTH SPECIFICATIONS:
- Brand: ${brandName}
- Booth Size: ${boothSize}
- Booth Type: ${boothType}
- Event: ${showName}

PRODUCT PLACEMENT & PHYSICAL DATA:
${placementInstructions}

BRAND DIRECTION:
${colorNotes ? `Brand colors: ${colorNotes}. Apply these to all branded surfaces.` : "Use a clean, professional branded graphic treatment."}
${brandDetails?.logo_cached_url || brandDetails?.logo_url
    ? `The ${brandName} logo has been provided as a reference. Apply it prominently on the backwall and counter surfaces.`
    : `Display the brand name "${brandName}" prominently on all major graphic surfaces.`
}

PRODUCT REFERENCE IMAGES:
${productImageUrls.length > 0
    ? productImageUrls.map(p => `- ${p.sku} (${p.render_category}): ${p.name}`).join("\n")
    : "No reference images available — use the physical descriptions above."
}

CRITICAL RENDERING RULES:
1. Match each product's physical description EXACTLY — correct shape, dimensions, and material.
2. Place products in the zones specified — back_wall items against the back, front items face the aisle.
3. Show the booth from a 3/4 angle view (front-left perspective) to reveal depth and layout.
4. Convention center environment: concrete floor, pipe-and-drape neighboring booths, overhead lighting.
5. Booth carpet should be brand-colored, covering the entire booth footprint.
6. All fabric graphics should appear taut, wrinkle-free, with edge-to-edge branded content.
7. Items marked as "accessory" should be attached to parent structures, not standalone.
8. Do NOT include items marked as "hidden" (shipping cases).
9. Scale products realistically — a 10ft backwall should fill the back of a 10ft booth.
10. Lighting should show dramatic trade show effect — spotlights on graphics, ambient convention hall glow.

Write a single, detailed image generation prompt (400-600 words) that describes this exact booth
from a photorealistic 3/4 perspective. Be specific about every product's appearance, position,
and how branded graphics appear on each surface.`;
}

/**
 * Merges Supabase bucket images with Base44 Product image_url as fallback.
 * Returns a deduplicated array of image URLs.
 */
export function mergeImageUrls(registryProducts, lineItems) {
  const urls = new Map();
  for (const p of registryProducts || []) {
    if (p.image_url) urls.set(p.sku, p.image_url);
  }
  for (const item of lineItems || []) {
    if (item.sku && !urls.has(item.sku) && item.image_url) {
      urls.set(item.sku, item.image_url);
    }
  }
  return Array.from(urls.values());
}
