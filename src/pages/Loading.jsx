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

    const { boothSize } = JSON.parse(quoteData);
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
      // Always generate fresh designs (sessionStorage preserves them for back button navigation)
      
      // Simulate minimum loading time for UX (AI processing takes time)
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 8000));
      
      // Step 1: Scrape the website to find the logo URL
      const logoScrape = await base44.integrations.Core.InvokeLLM({
        prompt: `Visit this website: ${websiteUrl}
        
        Your ONLY job is to find the company's main logo image URL.
        Look for:
        1. <img> tags in the header/nav area
        2. Logo in <link rel="icon"> or <meta property="og:image">
        3. SVG logos embedded or linked
        4. Any image file in the header that is clearly the company logo
        
        Return the DIRECT, ABSOLUTE URL to the logo image file (not a page URL).
        If the logo is an SVG inline, describe it so we can reference it.
        If you find multiple logos, pick the primary/main one (usually in the header).
        
        CRITICAL: The logo_url MUST be a real, working image URL from their website.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            logo_url: { type: "string" },
            logo_description: { type: "string" },
            company_name: { type: "string" }
          }
        }
      });

      const scrapedLogoUrl = logoScrape.logo_url || '';
      const logoDescription = logoScrape.logo_description || '';
      const scrapedCompanyName = logoScrape.company_name || '';

      // Step 2: Full brand identity analysis (with logo context)
      const brandAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this website (${websiteUrl}) and extract comprehensive brand identity.
        
        We already found their logo: ${scrapedLogoUrl ? `URL: ${scrapedLogoUrl}` : `Description: ${logoDescription}`}
        Company name: ${scrapedCompanyName}
        
        Extract and return JSON with:
        - logo_url: "${scrapedLogoUrl}" (use exactly this URL we already scraped)
        - logo_description: detailed description of what the logo looks like (colors, shapes, text, style) so it can be recreated in booth renderings
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
        
        IMPORTANT: Extract 4 distinct colors. The primary_color should match the dominant color in their logo.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            logo_url: { type: "string" },
            logo_description: { type: "string" },
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
      
      // Ensure the scraped logo URL is preserved in the brand analysis
      if (scrapedLogoUrl) {
        brandAnalysis.logo_url = scrapedLogoUrl;
      }

      // Step 2: Get all available products for this booth size
      const allProducts = await base44.entities.Product.filter({
        is_active: true
      });

      // Filter by booth size compatibility
      const compatibleProducts = allProducts.filter(p =>
        p.booth_sizes && p.booth_sizes.includes(boothSize)
      );

      // Step 3: Use AI to curate 3 booth designs with spatial layouts
      const boothDimensions = boothSize === '10x10' ? { width: 10, depth: 10 } : boothSize === '10x20' ? { width: 20, depth: 10 } : { width: 20, depth: 20 };
      
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

Available Products (select from these):
${JSON.stringify(compatibleProducts.map(p => ({
  sku: p.sku,
  name: p.name,
  category: p.category,
  product_type: p.product_type,
  price_tier: p.price_tier,
  base_price: p.base_price,
  design_style: p.design_style,
  features: p.features,
  placement_type: p.placement_type,
  footprint: p.footprint,
  customizable: p.customizable,
  branding_surfaces: p.branding_surfaces
})), null, 2)}

For each tier (Modular, Hybrid, and Custom), create a curated booth EXPERIENCE that:
1. Tells a story and creates a memorable journey
2. Matches the brand identity AND customer requirements
3. Addresses the customer's stated objectives (${customerProfile?.objectives.join(', ') || 'general lead generation'})
4. Incorporates the desired look (${customerProfile?.desired_look.join(', ') || 'modern'}) and feel (${customerProfile?.desired_feel.join(', ') || 'open'})
5. Selects 5-12 compatible products from the catalog
6. ${customerProfile?.display_products ? 'Includes product display areas' : ''}
7. ${customerProfile?.needs_demo_space ? 'Includes demonstration/presentation space' : ''}
8. ${customerProfile?.needs_conference_area ? 'Includes a conference/meeting area' : ''}
9. Explains the visitor flow and key moments
10. Total price should be: Modular $3-8K, Hybrid $8-18K, Custom $18-50K+

CRITICAL - 3D SPATIAL LAYOUT:
For each product selected, provide a spatial_layout array with exact 3D positioning:
- position: {x, y, z} coordinates in feet (origin at booth center, x=-width/2 to width/2, z=-depth/2 to depth/2, y=0 for floor)
- rotation: {x, y, z} in degrees (y-axis most important for orientation)
- scale: size multiplier (usually 1.0)
- branding: specify which products get brand colors/logo applied

Apply branding strategically:
- Use primary_color on 2-3 key structural pieces
- Use secondary_color on 1-2 accent pieces  
- Apply logo to 1-2 prominent surfaces (reception counter, main wall)
- Only apply to products marked as customizable

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

      // Generate all 2D images in parallel using Base44 GenerateImage
      // Include the logo as a reference image so it appears in the booth rendering
      const imagePromises = designs.designs.map(async (design) => {
        const designProducts = compatibleProducts.filter(p => design.product_skus.includes(p.sku));
        
        const imagePrompt = `Photorealistic 3D rendering of a trade show booth.

BOOTH: ${boothSize} booth, ${design.tier} tier design called "${design.design_name}".

BRAND LOGO (MUST BE VISIBLE ON BOOTH):
${brandAnalysis.logo_description ? `The company logo looks like: ${brandAnalysis.logo_description}` : `Company: ${scrapedCompanyName}`}
The logo MUST appear prominently on the main backwall and reception counter of the booth. Show it as a large, clearly visible graphic element.

BRAND COLORS (USE THROUGHOUT):
- Primary: ${brandAnalysis.primary_color} (dominant color on walls, structures)
- Secondary: ${brandAnalysis.secondary_color} (accents, counters)
- Accent: ${brandAnalysis.accent_color_1} (lighting, details)

DESIGN CONCEPT: ${design.experience_story}

PRODUCTS IN BOOTH: ${designProducts.map(p => p.name).join(', ')}

RENDERING STYLE: Professional architectural visualization, 3/4 angle view, trade show floor with carpet, dramatic lighting, photorealistic quality. The booth must look like a real trade show exhibit with the company's branding clearly displayed.`;

        try {
          // Pass the logo URL as a reference image if available
          const generateParams = { prompt: imagePrompt };
          if (brandAnalysis.logo_url) {
            generateParams.existing_image_urls = [brandAnalysis.logo_url];
          }
          
          const imageResult = await base44.integrations.Core.GenerateImage(generateParams);
          return imageResult.url;
        } catch (error) {
          console.error('Image generation failed:', error);
          return null;
        }
      });

      const generatedImages = await Promise.all(imagePromises);

      // Save booth designs to database
      const savedDesigns = [];
      for (let i = 0; i < designs.designs.length; i++) {
        const design = designs.designs[i];
        const boothDesign = await base44.entities.BoothDesign.create({
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
          design_image_url: generatedImages[i]
        });
        savedDesigns.push(boothDesign);
      }

      await minLoadTime;
      
      // Store designs and navigate
      sessionStorage.setItem('boothDesigns', JSON.stringify(savedDesigns));
      sessionStorage.setItem('brandIdentity', JSON.stringify(brandAnalysis));
      navigate(createPageUrl('Results'));
      
    } catch (error) {
      console.error('Design generation error:', error);
      // Fallback to basic flow
      navigate(createPageUrl('QuoteRequest'));
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