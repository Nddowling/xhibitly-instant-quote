import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, CheckCircle, Palette, Layers, Lightbulb } from 'lucide-react';

const loadingSteps = [
  { icon: Search, text: "Analyzing your brand identity..." },
  { icon: Palette, text: "Extracting colors and style..." },
  { icon: Layers, text: "Curating from 500+ products..." },
  { icon: Lightbulb, text: "Designing your experience..." },
  { icon: Sparkles, text: "Crafting the perfect story..." },
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
      // Simulate minimum loading time for UX (AI processing takes time)
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 8000));
      
      // Step 1: Analyze brand identity from website
      const brandAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this website and extract the brand identity: ${websiteUrl}
        
        Extract and return JSON with:
        - primary_color: hex color
        - secondary_color: hex color  
        - brand_personality: 2-3 words describing the brand feel
        - industry: industry/sector
        - target_audience: who they serve
        - design_style: array of style keywords from [Modern, Industrial, Minimalist, Luxury, Tech, Organic, Bold, Classic, Creative]
        - brand_essence: one sentence capturing their brand essence`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            primary_color: { type: "string" },
            secondary_color: { type: "string" },
            brand_personality: { type: "string" },
            industry: { type: "string" },
            target_audience: { type: "string" },
            design_style: { type: "array", items: { type: "string" } },
            brand_essence: { type: "string" }
          }
        }
      });

      // Step 2: Get all available products for this booth size
      const allProducts = await base44.entities.Product.filter({
        is_active: true
      });

      // Filter by booth size compatibility
      const compatibleProducts = allProducts.filter(p =>
        p.booth_sizes && p.booth_sizes.includes(boothSize)
      );

      // Step 3: Use AI to curate 3 booth designs
      const designPrompt = `You are an expert trade show booth designer. Create 3 unique booth experience designs (Budget, Hybrid, Custom tiers) for a ${boothSize} booth.

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
  price_tier: p.price_tier,
  base_price: p.base_price,
  design_style: p.design_style,
  features: p.features
})), null, 2)}

For each tier (Budget, Hybrid, Custom), create a curated booth EXPERIENCE that:
1. Tells a story and creates a memorable journey
2. Matches the brand identity AND customer requirements
3. Addresses the customer's stated objectives (${customerProfile?.objectives.join(', ') || 'general lead generation'})
4. Incorporates the desired look (${customerProfile?.desired_look.join(', ') || 'modern'}) and feel (${customerProfile?.desired_feel.join(', ') || 'open'})
5. Selects 5-12 compatible products from the catalog
6. ${customerProfile?.display_products ? 'Includes product display areas' : ''}
7. ${customerProfile?.needs_demo_space ? 'Includes demonstration/presentation space' : ''}
8. ${customerProfile?.needs_conference_area ? 'Includes a conference/meeting area' : ''}
9. Explains the visitor flow and key moments
10. Total price should be: Budget $3-8K, Hybrid $8-18K, Custom $18-50K+

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
                  total_price: { type: "number" }
                }
              }
            }
          }
        }
      });

      // Save booth designs to database
      const savedDesigns = [];
      for (const design of designs.designs) {
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
          design_rationale: design.design_rationale
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
    <div className="min-h-screen bg-gradient-to-br from-[#2C5282] via-[#1E3A5F] to-[#0F1D2E] flex flex-col items-center justify-center p-6">
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