import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, CheckCircle, Palette, Layers, Lightbulb } from 'lucide-react';

const loadingSteps = [
  { icon: Search, text: "Scanning your website..." },
  { icon: Palette, text: "Extracting your logo & brand colors..." },
  { icon: Layers, text: "Curating from 500+ products..." },
  { icon: Lightbulb, text: "Designing your experience..." },
  { icon: Sparkles, text: "Generating booth visuals with your logo..." },
  { icon: CheckCircle, text: "Finalizing your booth designs..." },
];

export default function Loading() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const quoteData = sessionStorage.getItem('quoteRequest');
    if (!quoteData) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const parsed = JSON.parse(quoteData);
    const { boothSize } = parsed;
    
    // Track analytics
    base44.analytics.track({
      eventName: "quote_started",
      properties: { booth_size: boothSize }
    });
    
    loadProducts(boothSize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  const loadProducts = async (boothSize) => {
    const { websiteUrl, dealerId, customerProfile } = JSON.parse(sessionStorage.getItem('quoteRequest'));
    
    try {
      // Simulate minimum loading time for UX
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 1: Run brand analysis AND product fetching in parallel
      const brandAnalysisPromise = base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this website: ${websiteUrl}

Do TWO things in one pass:

1. FIND THE LOGO: Look for the company's main logo image URL in <img> tags (header/nav), <link rel="icon">, <meta property="og:image">, or linked SVG files. Return the DIRECT, ABSOLUTE URL to the logo image file.

2. EXTRACT BRAND IDENTITY: Analyze the full website and extract:
- logo_url: the direct URL to the logo image you found
- logo_description: detailed description of what the logo looks like (colors, shapes, text, style) so it can be recreated in booth renderings
- company_name: the company name
- primary_color: hex color (main brand color from logo and website)
- secondary_color: hex color (secondary brand color)
- accent_color_1: hex color (third brand/accent color)
- accent_color_2: hex color (fourth brand/accent color)
- typography_primary: main font family name
- typography_secondary: secondary font family
- brand_personality: 2-3 words describing the brand feel
- industry: industry/sector
- target_audience: who they serve
- design_style: array of style keywords from [Modern, Industrial, Minimalist, Luxury, Tech, Organic, Bold, Classic, Creative]
- brand_essence: one sentence capturing their brand essence

IMPORTANT: Extract 4 distinct colors. The primary_color should match the dominant color in their logo. The logo_url MUST be a real, working image URL from their website.`,
        add_context_from_internet: true,
        response_json_schema: {
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
        }
      });

      // Fetch products in parallel with brand analysis
      const productsPromise = (async () => {
        let products = [];
        const allVariants = await base44.entities.ProductVariant.filter({ is_active: true });
        if (allVariants.length > 0) {
          products = allVariants.filter(p => p.booth_sizes && p.booth_sizes.includes(boothSize));
        }
        if (products.length === 0) {
          const allProducts = await base44.entities.Product.filter({ is_active: true });
          products = allProducts.filter(p => p.booth_sizes && p.booth_sizes.includes(boothSize));
        }
        return products;
      })();

      // Wait for both to complete
      const [brandAnalysis, compatibleProducts] = await Promise.all([brandAnalysisPromise, productsPromise]);
      const scrapedCompanyName = brandAnalysis.company_name || '';

      // Step 3: Use AI to curate 3 booth designs with spatial layouts
      const boothDimensions = boothSize === '10x10' ? { width: 10, depth: 10 } : boothSize === '10x20' ? { width: 20, depth: 10 } : { width: 20, depth: 20 };
      
      // Track analytics
      base44.analytics.track({
        eventName: "design_generated",
        properties: { booth_size: boothSize, website_url: websiteUrl }
      });

      const designPrompt = `You are an expert trade show booth designer. Create 3 unique booth experience designs (Modular, Hybrid, and Custom tiers) for a ${boothSize} booth (${boothDimensions.width}ft x ${boothDimensions.depth}ft).

Brand Identity:
${JSON.stringify(brandAnalysis, null, 2)}

Customer Requirements:
${customerProfile ? `
- Objectives: ${customerProfile.objectives.join(', ')}
- Display Products: ${customerProfile.display_products ? 'Yes' : 'No'}
- Demo/Presentation Space: ${customerProfile.needs_demo_space ? 'Required' : 'Not needed'}
- Conference Area: ${customerProfile.needs_conference_area ? 'Required' : 'Not needed'}
- Desired Look: ${customerProfile.desired_look.join(', ')}
- Desired Feel: ${customerProfile.desired_feel.join(', ')}
- Logistics Support: ${customerProfile.needs_logistics ? 'Required' : 'Not needed'}
${customerProfile.additional_notes ? `- Additional Notes: ${customerProfile.additional_notes}` : ''}
` : 'No specific customer requirements provided.'}

PRODUCT CATALOG (YOU MUST ONLY SELECT FROM THIS LIST — NO OTHER PRODUCTS ALLOWED):
${JSON.stringify(compatibleProducts.map(p => {
  const dims = p.dimensions || {};
  return {
    sku: p.manufacturer_sku || p.sku,
    name: p.display_name || p.name,
    category: p.category_name || p.category,
    geometry_type: p.geometry_type,
    price_tier: p.price_tier,
    base_price: p.base_price,
    rental_price: p.rental_price || null,
    is_rental: p.is_rental || false,
    dimensions_ft: dims.width ? `${dims.width}W x ${dims.height}H x ${dims.depth}D` : 'standard',
    width_ft: dims.width || null,
    height_ft: dims.height || null,
    depth_ft: dims.depth || null,
    design_style: p.design_style,
    customizable: p.customizable,
    branding_surfaces: p.branding_surfaces,
    image_url: p.image_url || null
  };
}), null, 2)}

CRITICAL RULES:
- You may ONLY use products listed above. Do NOT invent, fabricate, or reference any product not in this catalog.
- Every product_sku in your response MUST exactly match a "sku" value from the catalog above.
- The total_price for each design MUST equal the sum of base_price (or rental_price for rental items) of all selected products.
- Include a "line_items" array with each product's sku, name, quantity, unit_price, and line_total.
- IMPORTANT: The generated booth image will show ONLY the products you select — nothing more. So choose a complete, functional booth setup (backwall + counter + accessories). Do not assume anything extra will be in the booth.
- Use the dimensions_ft field to ensure products physically fit in the ${boothSize} space (${boothDimensions.width}ft x ${boothDimensions.depth}ft).

For each tier (Modular, Hybrid, and Custom), create a curated booth EXPERIENCE that:
1. Tells a story and creates a memorable journey
2. Matches the brand identity AND customer requirements
3. Addresses the customer's stated objectives (${customerProfile?.objectives.join(', ') || 'general lead generation'})
4. Incorporates the desired look (${customerProfile?.desired_look.join(', ') || 'modern'}) and feel (${customerProfile?.desired_feel.join(', ') || 'open'})
5. Selects products ONLY from the catalog above (use exact SKUs). Modular: 4-8 items, Hybrid: 6-12 items, Custom: 8-15+ items. More items = richer, more impressive booth. Fill the space!
6. ${customerProfile?.display_products ? 'Includes product display areas' : ''}
7. ${customerProfile?.needs_demo_space ? 'Includes demonstration/presentation space' : ''}
8. ${customerProfile?.needs_conference_area ? 'Includes a conference/meeting area' : ''}
9. Explains the visitor flow and key moments
10. Total price is calculated by summing the actual base_price of selected products. Modular tier should target lower-priced items, Custom tier should include premium items.
11. IMPORTANT: A great booth is NOT sparse. Every tier should include at minimum: a backwall, a counter or kiosk, lighting, and flooring. Hybrid and Custom tiers should also include banner stands, monitor stands, towers, or other accent pieces. The booth should look FULLY FURNISHED and impressive — not empty with just a backwall.

CRITICAL - 3D SPATIAL LAYOUT:
For each product selected, provide a spatial_layout array with exact 3D positioning:
- position: {x, y, z} coordinates in feet (origin at booth center, x=-width/2 to width/2, z=-depth/2 to depth/2, y=0 for floor)
- rotation: {x, y, z} in degrees (y-axis most important for orientation)
- scale: size multiplier (usually 1.0)
- branding: specify which products get brand colors/logo applied

Apply branding strategically:
- Use primary_color on 2-3 key structural pieces
- Use secondary_color on 1-2 accent pieces  
- CRITICAL: The company logo MUST be applied to at least 2 prominent surfaces (main backwall and reception counter). This is a REQUIRED element.
- Logo description: ${brandAnalysis.logo_description || 'Company logo'}
- Logo URL: ${brandAnalysis.logo_url || 'Not available'}
- Only apply custom colors to products marked as customizable

Arrange products logically for booth flow, leave pathways, create zones.

Return JSON with 3 designs.`;

      const designs = await base44.integrations.Core.InvokeLLM({
        prompt: designPrompt,
        response_json_schema: {
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
                          properties: {
                            x: { type: "number" },
                            y: { type: "number" },
                            z: { type: "number" }
                          }
                        },
                        rotation: {
                          type: "object",
                          properties: {
                            x: { type: "number" },
                            y: { type: "number" },
                            z: { type: "number" }
                          }
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
        }
      });

      // Validate: strip any SKUs not in our actual catalog
      const validSkus = new Set(compatibleProducts.map(p => p.manufacturer_sku || p.sku));
      for (const design of designs.designs) {
        design.product_skus = design.product_skus.filter(sku => validSkus.has(sku));
        if (design.line_items) {
          design.line_items = design.line_items.filter(li => validSkus.has(li.sku));
        }
        // Recalculate total from actual catalog prices
        let recalcTotal = 0;
        for (const sku of design.product_skus) {
          const product = compatibleProducts.find(p => (p.manufacturer_sku || p.sku) === sku);
          if (product) recalcTotal += (product.is_rental ? (product.rental_price || product.base_price) : product.base_price);
        }
        design.total_price = recalcTotal;
      }

      // Generate all 2D images in parallel using Base44 GenerateImage
      // Include the logo as a reference image so it appears in the booth rendering
      const imagePromises = designs.designs.map(async (design) => {
        const designProducts = compatibleProducts.filter(p => 
          design.product_skus.includes(p.manufacturer_sku || p.sku)
        );

        // Build accurate line items from catalog data
        design.line_items = designProducts.map(p => ({
          sku: p.manufacturer_sku || p.sku,
          name: p.display_name || p.name,
          category: p.category_name || p.category,
          quantity: 1,
          unit_price: p.is_rental ? (p.rental_price || p.base_price) : p.base_price,
          line_total: p.is_rental ? (p.rental_price || p.base_price) : p.base_price
        }));

        // Build a detailed product manifest with exact dimensions and visual descriptions for the AI renderer
        const productManifest = designProducts.map((p, idx) => {
          const dims = p.dimensions || {};
          const dimStr = dims.width ? `${dims.width}ft W × ${dims.height || '?'}ft H × ${dims.depth || '?'}ft D` : 'standard size';
          const desc = p.description || '';
          const features = (p.features || []).slice(0, 3).join(', ');
          return `${idx + 1}. "${p.display_name || p.name}" — ${p.category_name || p.category}, ${dimStr}. ${desc}${features ? ` Features: ${features}.` : ''}`;
        }).join('\n');
        
        const imagePrompt = `Photorealistic 3D architectural rendering of a trade show booth from the Orbus Exhibit & Display catalog.

THIS IS A SALES QUOTE — the customer will receive EXACTLY these ${designProducts.length} products. Accuracy is critical.

ABSOLUTE RESTRICTIONS:
- Render ONLY the ${designProducts.length} numbered products below. Nothing else.
- Do NOT add: TV screens, monitors, video walls, YouTube banners, social media logos, potted plants, flowers, hanging banners (unless listed), chairs (unless listed), tables (unless listed), brochure holders (unless listed), carpet (unless listed), any item not on this list.
- If only ${designProducts.length} items are listed, the booth should contain exactly ${designProducts.length} display items plus the booth space itself (floor, back drape if no backwall covers it).
- Every item must match its description below — a "banner stand" is a retractable pull-up banner on a narrow base, a "reception counter" is a podium-height counter with fabric wrap, a "backwall" is a large flat fabric display, etc.

BOOTH SPACE: ${boothSize} footprint (${boothDimensions.width}ft wide × ${boothDimensions.depth}ft deep). Open front facing the aisle. Standard trade show environment: grey carpet aisle, pipe-and-drape on neighbor sides, overhead convention center ceiling.

BRAND COLORS & LOGO:
${brandAnalysis.logo_description ? `Company logo: ${brandAnalysis.logo_description}` : `Company name: ${scrapedCompanyName}`}
Primary color: ${brandAnalysis.primary_color} — use on backwall graphic, banner stand graphics
Secondary color: ${brandAnalysis.secondary_color} — use on counter wrap, accent graphics
The company logo and name should appear large and centered on the main backwall graphic. Smaller logo on the counter front.

PRODUCTS TO RENDER (exactly ${designProducts.length} items):
${productManifest}

PLACEMENT GUIDE:
- Backwall(s): flush against the back wall of the booth space
- Counter(s): front-center or right side, angled toward the aisle
- Banner stand(s): flanking the left and/or right entrance edges
- Monitor/iPad stand(s): beside the counter or near the backwall
- Lighting: clamp-mounted on the backwall frame or overhead truss
- Flooring: covers the entire booth footprint if listed
- Tower(s): at booth corners
- Literature rack: beside the counter

CAMERA & STYLE: 3/4 elevated angle from the front-left aisle. Professional architectural visualization. Clean, well-lit. The booth should look inviting, professional, and fully set up for a real trade show.`;

        try {
          // Pass the logo URL as a reference image only if it looks like a valid image URL
          const generateParams = { prompt: imagePrompt };
          const logoUrl = brandAnalysis.logo_url || '';
          if (logoUrl && /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)(\?|$)/i.test(logoUrl)) {
            generateParams.existing_image_urls = [logoUrl];
          }
          
          const imageResult = await base44.integrations.Core.GenerateImage(generateParams);
          return imageResult.url;
        } catch (error) {
          console.error('Image generation failed:', error);
          // Retry without reference image
          try {
            const retryResult = await base44.integrations.Core.GenerateImage({ prompt: imagePrompt });
            return retryResult.url;
          } catch (retryError) {
            console.error('Image retry also failed:', retryError);
            return null;
          }
        }
      });

      const generatedImages = await Promise.all(imagePromises);

      // Save booth designs to database (in parallel)
      const savePromises = designs.designs.map((design, i) => {
        return base44.entities.BoothDesign.create({
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
        });
      });
      const savedDesigns = await Promise.all(savePromises);

      await minLoadTime;
      
      // Store designs and navigate
      sessionStorage.setItem('boothDesigns', JSON.stringify(savedDesigns));
      sessionStorage.setItem('brandIdentity', JSON.stringify(brandAnalysis));
      navigate(createPageUrl('Results'));
      
    } catch (error) {
      console.error('Design generation error:', error);
      // Fallback — go to Results page with whatever we have, not back to QuoteRequest
      // which would loop the user or show profile form again
      navigate(createPageUrl('Results'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2231a] via-[#b01b13] to-[#0F1D2E] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        {/* Animated Logo */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatType: "loop"
          }}
          className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-10 border border-white/20"
        >
          <span className="text-5xl font-bold text-white">X</span>
        </motion.div>

        {/* Loading Steps */}
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

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mt-10">
          {loadingSteps.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: currentStep === i ? 1.5 : 1,
                opacity: currentStep === i ? 1 : 0.4
              }}
              className="w-2 h-2 bg-white rounded-full"
            />
          ))}
        </div>

        {/* Animated Bars */}
        <div className="flex items-center justify-center gap-1 mt-12">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [16, 32, 16],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.1,
              }}
              className="w-2 bg-white/40 rounded-full"
              style={{ height: 16 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}