import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, CheckCircle, Palette, Layers, Lightbulb, ShieldCheck } from 'lucide-react';
import { enforceAllDesigns } from '../components/utils/boothRulesEngine';

// ═══════════════════════════════════════════════════════════════
// STATIC PROMPT FRAGMENTS (never change per request)
// ═══════════════════════════════════════════════════════════════

const BRAND_EXTRACTION_PROMPT = `Analyze this company website. Extract brand identity and find their logo image URL from <img>, <link rel="icon">, <meta property="og:image">, or linked SVGs. Return a direct, absolute image URL.

Extract 4 distinct brand colors. primary_color must match the dominant logo color. logo_url must be a real, working URL from the site.`;

const BRAND_SCHEMA = {
  type: "object",
  properties: {
    logo_url: { type: "string" },
    logo_description: { type: "string" },
    company_name: { type: "string" },
    primary_color: { type: "string" },
    secondary_color: { type: "string" },
    accent_color_1: { type: "string" },
    accent_color_2: { type: "string" },
    typography_primary: { type: "string" },
    typography_secondary: { type: "string" },
    brand_personality: { type: "string" },
    industry: { type: "string" },
    target_audience: { type: "string" },
    design_style: { type: "array", items: { type: "string" } },
    brand_essence: { type: "string" }
  }
};

const PLACEMENT_GUIDE = `PLACEMENT: Backwall→flush rear. Counter→front-center or right, angled to aisle. Banners→flanking L/R entrance. Monitor/iPad→beside counter or backwall. Lighting→clamped on frame or truss. Flooring→full footprint. Towers→corners. Lit rack→beside counter.`;

const CAMERA_STYLE = `CAMERA: 3/4 elevated angle from front-left aisle. Photorealistic architectural visualization. Clean, well-lit, inviting.`;

const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    designs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tier: { type: "string" },
          design_name: { type: "string" },
          experience_story: { type: "string" },
          visitor_journey: { type: "string" },
          key_moments: { type: "array", items: { type: "string" } },
          product_skus: { type: "array", items: { type: "string" } },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                name: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                line_total: { type: "number" }
              }
            }
          },
          design_rationale: { type: "string" },
          total_price: { type: "number" },
          spatial_layout: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_sku: { type: "string" },
                position: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } }
                },
                rotation: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } }
                },
                scale: { type: "number" },
                branding: {
                  type: "object",
                  properties: {
                    apply_brand_color: { type: "boolean" },
                    color_zone: { type: "string" },
                    color: { type: "string" },
                    apply_logo: { type: "boolean" },
                    logo_zone: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function slimCatalog(products) {
  return products.map(p => {
    const d = p.dimensions || {};
    return {
      sku: p.manufacturer_sku || p.sku,
      name: p.display_name || p.name,
      category: p.category_name || p.category,
      geometry: p.geometry_type,
      visual: p.visual_description || p.description || '',
      price_tier: p.price_tier,
      price: p.base_price,
      rental_price: p.rental_price || null,
      is_rental: p.is_rental || false,
      dims: d.width ? `${d.width}W×${d.height}H×${d.depth}D ft` : 'standard',
      w: d.width || null,
      h: d.height || null,
      d: d.depth || null,
      style: p.design_style,
      customizable: p.customizable,
      branding_surfaces: p.branding_surfaces,
      thumb: p.thumbnail_url || p.image_url || null
    };
  });
}

function formatProfile(cp) {
  if (!cp) return 'No specific requirements provided.';
  const lines = [
    `Objectives: ${cp.objectives.join(', ')}`,
    `Display products: ${cp.display_products ? 'Yes' : 'No'}`,
    `Demo space: ${cp.needs_demo_space ? 'Required' : 'No'}`,
    `Conference area: ${cp.needs_conference_area ? 'Required' : 'No'}`,
    `Look: ${cp.desired_look.join(', ')}`,
    `Feel: ${cp.desired_feel.join(', ')}`,
    `Logistics: ${cp.needs_logistics ? 'Required' : 'No'}`
  ];
  if (cp.additional_notes) lines.push(`Notes: ${cp.additional_notes}`);
  return lines.join(' | ');
}

function getBoothDims(boothSize) {
  const map = { '10x10': [10, 10], '10x20': [20, 10], '20x20': [20, 20] };
  const [w, d] = map[boothSize] || [10, 10];
  return { width: w, depth: d };
}

function collectReferenceImages(brandAnalysis, products) {
  const urls = [];
  const logoUrl = brandAnalysis.logo_url || '';
  if (logoUrl && /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)(\?|$)/i.test(logoUrl)) {
    urls.push(logoUrl);
  }
  const thumbs = products
    .map(p => p.thumbnail_url || p.image_url)
    .filter(url => url && /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)(\?|$)/i.test(url));
  urls.push(...[...new Set(thumbs)].slice(0, 4));
  return urls;
}

// ═══════════════════════════════════════════════════════════════
// LOADING STEPS
// ═══════════════════════════════════════════════════════════════

const COMPANY_RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    industry: { type: "string" },
    industry_vertical: { type: "string" },
    core_products_or_services: { type: "array", items: { type: "string" } },
    brand_voice: { type: "string" },
    brand_tone: { type: "string" },
    brand_values: { type: "array", items: { type: "string" } },
    target_customers: { type: "string" },
    competitive_positioning: { type: "string" },
    key_messaging: { type: "array", items: { type: "string" } },
    trade_show_goals: { type: "string" },
    booth_atmosphere: { type: "string" },
    physical_products_to_display: { type: "array", items: { type: "string" } },
    industry_specific_booth_elements: { type: "array", items: { type: "string" } }
  }
};

const loadingSteps = [
  { icon: Search, text: "Scanning your website..." },
  { icon: Palette, text: "Extracting your logo & brand colors..." },
  { icon: Lightbulb, text: "Researching your brand voice & industry..." },
  { icon: Layers, text: "Curating from 500+ products..." },
  { icon: ShieldCheck, text: "Validating design & pricing rules..." },
  { icon: Sparkles, text: "Generating booth visuals with your logo..." },
  { icon: CheckCircle, text: "Finalizing your booth designs..." },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Loading() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const quoteData = sessionStorage.getItem('quoteRequest');
    if (!quoteData) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const parsed = JSON.parse(quoteData);
    base44.analytics.track({
      eventName: "quote_started",
      properties: { booth_size: parsed.boothSize }
    });

    generateDesigns(parsed);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  // ── MAIN GENERATION FUNCTION ──

  const generateDesigns = async (quoteData) => {
    const { websiteUrl, boothSize, dealerId, customerProfile } = quoteData;
    const dims = getBoothDims(boothSize);

    try {
      const minLoadTime = new Promise(r => setTimeout(r, 5000));

      // ── STEP 1: Brand analysis + product fetch (parallel) ──
      const brandAnalysisPromise = base44.integrations.Core.InvokeLLM({
        prompt: `${BRAND_EXTRACTION_PROMPT}\n\nWebsite: ${websiteUrl}`,
        add_context_from_internet: true,
        response_json_schema: BRAND_SCHEMA
      });

      const productsPromise = (async () => {
        const allVariants = await base44.entities.ProductVariant.filter({ is_active: true });
        let products = allVariants.filter(p => p.booth_sizes?.includes(boothSize));
        if (products.length === 0) {
          const allProducts = await base44.entities.Product.filter({ is_active: true });
          products = allProducts.filter(p => p.booth_sizes?.includes(boothSize));
        }
        return products;
      })();

      const [brandAnalysis, compatibleProducts] = await Promise.all([brandAnalysisPromise, productsPromise]);
      const catalog = slimCatalog(compatibleProducts);
      const profileStr = formatProfile(customerProfile);

      base44.analytics.track({
        eventName: "design_generated",
        properties: { booth_size: boothSize, website_url: websiteUrl }
      });

      // ── STEP 1b: Deep company research (brand voice, industry context) ──
      const companyResearch = await base44.integrations.Core.InvokeLLM({
        prompt: `Research this company thoroughly: ${websiteUrl}
Company name: ${brandAnalysis.company_name || 'Unknown'}
Industry detected: ${brandAnalysis.industry || 'Unknown'}

Provide a deep analysis focused on how this company should present itself at a trade show booth. Consider:
- What industry are they in? (automotive, electronics, healthcare, food & beverage, tech, etc.)
- What physical products or services do they sell that should be showcased?
- What is their brand voice? (authoritative, playful, technical, luxurious, down-to-earth, etc.)
- What tone do they use in marketing? (formal, casual, inspirational, data-driven, etc.)
- What are their core brand values?
- Who are their target customers visiting a trade show?
- What should the booth atmosphere feel like based on their brand?
- What industry-specific elements belong in their booth? (e.g., automotive → vehicle display area, product demo zones; electronics → interactive screens, charging stations; healthcare → clean/clinical feel, consultation area; food → sampling station, refrigerated display)

Be specific and actionable. This research will directly guide product selection for their trade show booth.`,
        add_context_from_internet: true,
        response_json_schema: COMPANY_RESEARCH_SCHEMA
      });

      // ── STEP 2: AI booth design curation ──
      const designPrompt = `You are an expert trade show booth designer. Create 3 booth designs (Modular, Hybrid, Custom tiers) for a ${boothSize} booth (${dims.width}ft × ${dims.depth}ft).

BRAND: ${JSON.stringify({ name: brandAnalysis.company_name, primary: brandAnalysis.primary_color, secondary: brandAnalysis.secondary_color, accent1: brandAnalysis.accent_color_1, accent2: brandAnalysis.accent_color_2, personality: brandAnalysis.brand_personality, logo: brandAnalysis.logo_description })}

COMPANY CONTEXT (use this to guide product selection and booth storytelling):
- Industry: ${companyResearch.industry} / ${companyResearch.industry_vertical}
- Products/Services: ${(companyResearch.core_products_or_services || []).join(', ')}
- Brand Voice: ${companyResearch.brand_voice} | Tone: ${companyResearch.brand_tone}
- Brand Values: ${(companyResearch.brand_values || []).join(', ')}
- Target Customers: ${companyResearch.target_customers}
- Competitive Position: ${companyResearch.competitive_positioning}
- Key Messaging: ${(companyResearch.key_messaging || []).join('; ')}
- Ideal Booth Atmosphere: ${companyResearch.booth_atmosphere}
- Physical Items to Display: ${(companyResearch.physical_products_to_display || []).join(', ')}
- Industry-Specific Booth Elements: ${(companyResearch.industry_specific_booth_elements || []).join(', ')}

IMPORTANT: Design the booth to reflect this company's actual business. If they sell cars, the booth should have space for vehicle display. If they sell software, emphasize demo stations and screens. If they sell food, include tasting/sampling areas. The experience_story, visitor_journey, and key_moments MUST align with what this company actually does.

CUSTOMER REQUIREMENTS: ${profileStr}

CONSTRAINT: Use ONLY products from the catalog below. Every product_sku must exactly match a catalog "sku". Any fabricated SKU invalidates the output.

FLOORING RULE: ALWAYS select branded carpet for flooring. NEVER select interlocking floor tiles.

CATALOG:
${JSON.stringify(catalog, null, 1)}

REQUIREMENTS PER TIER:
- Modular: 4-8 items, lower-priced. Hybrid: 6-12 items, mixed. Custom: 8-15+ items, premium.
- Every tier minimum: backwall + counter/kiosk + lighting + branded carpet flooring. Hybrid/Custom add banners, towers, monitor stands, accents.
- total_price = exact sum of selected products' base_price (or rental_price for rentals). Include line_items with sku, name, quantity, unit_price, line_total.
- Booth must look FULLY FURNISHED, not sparse.

SPATIAL FIT: Before selecting, check product dims. Sum of widths along back wall must be ≤ ${dims.width}ft. Items must not overlap. Leave ≥3ft walkway at front.

SPATIAL LAYOUT: For each product provide position {x,y,z} in feet (origin=booth center, x=[-${dims.width / 2},${dims.width / 2}], z=[-${dims.depth / 2},${dims.depth / 2}], y=0=floor), rotation {x,y,z} degrees, scale (usually 1.0).

BRANDING: primary_color on 2-3 structural pieces. secondary_color on 1-2 accents. Logo MUST appear on main backwall + counter (minimum). Only apply colors to customizable products.

FOR EACH DESIGN: include tier, design_name, experience_story, visitor_journey, key_moments[], product_skus[], line_items[], design_rationale, total_price, spatial_layout[].`;

      const designs = await base44.integrations.Core.InvokeLLM({
        prompt: designPrompt,
        response_json_schema: DESIGN_SCHEMA
      });

      // ── STEP 3: Validate SKUs and FORCE correct catalog prices ──
      const validSkus = new Set(compatibleProducts.map(p => p.manufacturer_sku || p.sku));
      const catalogPriceLookup = {};
      compatibleProducts.forEach(p => {
        const sku = p.manufacturer_sku || p.sku;
        catalogPriceLookup[sku] = {
          base_price: p.base_price,
          rental_price: p.rental_price || null,
          is_rental: p.is_rental || false,
          name: p.display_name || p.name
        };
      });

      for (const design of designs.designs) {
        design.product_skus = design.product_skus.filter(sku => validSkus.has(sku));
        if (design.line_items) {
          design.line_items = design.line_items.filter(li => validSkus.has(li.sku));
        }
        // Force prices from catalog — never trust LLM pricing
        let recalcTotal = 0;
        if (design.line_items) {
          design.line_items = design.line_items.map(li => {
            const entry = catalogPriceLookup[li.sku];
            if (entry) {
              const correctPrice = entry.is_rental && entry.rental_price ? entry.rental_price : entry.base_price;
              const qty = li.quantity || 1;
              const lineTotal = correctPrice * qty;
              recalcTotal += lineTotal;
              return { ...li, unit_price: correctPrice, line_total: lineTotal, name: entry.name };
            }
            return li;
          });
        }
        design.total_price = recalcTotal;
      }

      // ── STEP 4: Rules engine ──
      const allServices = await base44.entities.Service.filter({ is_active: true });
      const profileForRules = quoteData.customerProfile || customerProfile || null;

      const validatedDesigns = enforceAllDesigns(
        designs.designs,
        compatibleProducts,
        allServices,
        boothSize,
        profileForRules
      );

      validatedDesigns.forEach(d => {
        if (d.rules_corrections?.length > 0) {
          console.log(`[Rules] ${d.tier}:`, d.rules_corrections);
        }
      });

      designs.designs = validatedDesigns;

      // ── STEP 5: Generate booth images (parallel) ──
      const imagePromises = designs.designs.map(async (design) => {
        const designProducts = compatibleProducts.filter(p =>
          design.product_skus.includes(p.manufacturer_sku || p.sku)
        );

        const manifest = designProducts.map((p, i) => {
          const d = p.dimensions || {};
          const dimStr = d.width ? `${d.width}W×${d.height}H×${d.depth}D ft` : 'standard';
          return `${i + 1}. "${p.display_name || p.name}" — ${p.category_name || p.category}, ${dimStr}. ${p.visual_description || p.description || ''}`;
        }).join('\n');

        const imagePrompt = `Photorealistic 3D trade show booth rendering for a ${companyResearch.industry || brandAnalysis.industry || ''} company (${brandAnalysis.company_name}).

BOOTH: ${boothSize} (${dims.width}×${dims.depth}ft). Open front facing aisle. Grey carpet aisle, pipe-and-drape neighbors, convention center ceiling.

COMPANY CONTEXT: This is a ${companyResearch.industry || brandAnalysis.industry || ''} company. Brand atmosphere: ${companyResearch.booth_atmosphere || brandAnalysis.brand_personality || 'professional'}. The booth should feel like visiting ${brandAnalysis.company_name}'s showroom.

BRAND: Logo="${brandAnalysis.logo_description || brandAnalysis.company_name}" | Primary=${brandAnalysis.primary_color} (backwall, banners) | Secondary=${brandAnalysis.secondary_color} (counter, accents). Logo large+centered on main backwall, smaller on counter.

RENDER EXACTLY these ${designProducts.length} products — NOTHING ELSE. No invented screens, plants, chairs, monitors, or items not listed:
${manifest}

${PLACEMENT_GUIDE}

${CAMERA_STYLE}`;

        const refImages = collectReferenceImages(brandAnalysis, designProducts);
        const params = { prompt: imagePrompt };
        if (refImages.length > 0) params.existing_image_urls = refImages;

        try {
          const result = await base44.integrations.Core.GenerateImage(params);
          return result.url;
        } catch (err) {
          console.error('Image gen failed:', err);
          try {
            return (await base44.integrations.Core.GenerateImage({ prompt: imagePrompt })).url;
          } catch (retryErr) {
            console.error('Image retry failed:', retryErr);
            return null;
          }
        }
      });

      const generatedImages = await Promise.all(imagePromises);

      // ── STEP 6: Save to DB (parallel) ──
      const savePromises = designs.designs.map((design, i) =>
        base44.entities.BoothDesign.create({
          dealer_id: dealerId,
          booth_size: boothSize,
          tier: design.tier,
          design_name: design.design_name,
          brand_identity: brandAnalysis,
          experience_story: design.experience_story,
          visitor_journey: design.visitor_journey,
          key_moments: design.key_moments,
          product_skus: design.product_skus,
          total_price: design.total_price,
          design_rationale: design.design_rationale,
          spatial_layout: design.spatial_layout,
          design_image_url: generatedImages[i],
          line_items: design.line_items
        })
      );
      const savedDesigns = await Promise.all(savePromises);

      await minLoadTime;

      sessionStorage.setItem('boothDesigns', JSON.stringify(savedDesigns));
      sessionStorage.setItem('brandIdentity', JSON.stringify(brandAnalysis));
      navigate(createPageUrl('Results'));

    } catch (error) {
      console.error('Design generation error:', error);
      navigate(createPageUrl('Results'));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2231a] via-[#b01b13] to-[#0F1D2E] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}
          className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-10 border border-white/20"
        >
          <span className="text-5xl font-bold text-white">X</span>
        </motion.div>

        <div className="h-20 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-4"
            >
              {React.createElement(loadingSteps[currentStep].icon, {
                className: "w-8 h-8 text-white/80"
              })}
              <span className="text-2xl text-white font-light">
                {loadingSteps[currentStep].text}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-center gap-2 mt-10">
          {loadingSteps.map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: currentStep === i ? 1.5 : 1, opacity: currentStep === i ? 1 : 0.4 }}
              className="w-2 h-2 bg-white rounded-full"
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-1 mt-12">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [16, 32, 16] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
              className="w-2 bg-white/40 rounded-full"
              style={{ height: 16 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}