import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Star, ArrowRight, Sparkles, Lightbulb, Palette, Loader2 } from 'lucide-react';
import { generateBoothImage } from '@/components/utils/imageGeneration';
import { base44 } from '@/api/base44Client';

export default function Results() {
  const navigate = useNavigate();
  const [boothDesigns, setBoothDesigns] = useState([]);
  const [brandIdentity, setBrandIdentity] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [generatingImages, setGeneratingImages] = useState({});

  useEffect(() => {
    const storedDesigns = sessionStorage.getItem('boothDesigns');
    const storedBrand = sessionStorage.getItem('brandIdentity');
    const storedQuote = sessionStorage.getItem('quoteRequest');

    if (!storedDesigns || !storedQuote) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const designs = JSON.parse(storedDesigns);
    const brand = JSON.parse(storedBrand);
    const quote = JSON.parse(storedQuote);

    setBoothDesigns(designs);
    setBrandIdentity(brand);
    setQuoteData(quote);

    // Initialize generating state for designs without images
    const initialGeneratingState = {};
    designs.forEach(design => {
      if (!design.design_image_url) {
        initialGeneratingState[design.id] = true;
      }
    });
    setGeneratingImages(initialGeneratingState);

    // Trigger async image generation
    generateImagesForDesigns(designs, brand, quote);
  }, []);

  const generateImagesForDesigns = async (designs, brand, quote) => {
    // Image generation disabled - placeholder view only
    console.log('Image generation disabled for designs');
  };

  const handleSelectDesign = (design) => {
    sessionStorage.setItem('selectedDesign', JSON.stringify(design));
    navigate(createPageUrl('DesignConfigurator'));
  };

  const getTierStyles = (tier) => {
    switch (tier) {
      case 'Modular':
        return {
          border: 'border-slate-200',
          badge: 'bg-slate-100 text-slate-700',
          gradient: 'from-slate-50 to-slate-100',
          highlight: false
        };
      case 'Hybrid':
        return {
          border: 'border-[#e2231a] ring-2 ring-[#e2231a]/20',
          badge: 'bg-[#e2231a] text-white',
          gradient: 'from-blue-50 to-indigo-50',
          highlight: true
        };
      case 'Custom':
        return {
          border: 'border-amber-300',
          badge: 'bg-amber-100 text-amber-800',
          gradient: 'from-amber-50 to-orange-50',
          highlight: false
        };
      default:
        return {
          border: 'border-slate-200',
          badge: 'bg-slate-100 text-slate-700',
          gradient: 'from-slate-50 to-slate-100',
          highlight: false
        };
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (!quoteData || boothDesigns.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header with Brand Identity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-[#e2231a] mb-3">
            Curated {quoteData.boothSize} Experience for {quoteData.dealerCompany}
          </h1>
          <p className="text-slate-500 text-lg mb-4">
            Personalized booth designs based on your brand
          </p>
          
          {brandIdentity && (
            <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
              {brandIdentity.logo_url && (
                <div className="flex items-center gap-2">
                  <img 
                    src={brandIdentity.logo_url} 
                    alt="Brand Logo" 
                    className="h-8 max-w-[120px] object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-slate-400" />
                <div className="flex gap-1.5">
                  <div 
                    className="w-6 h-6 rounded border border-slate-200" 
                    style={{ backgroundColor: brandIdentity.primary_color }}
                    title={brandIdentity.primary_color}
                  />
                  <div 
                    className="w-6 h-6 rounded border border-slate-200" 
                    style={{ backgroundColor: brandIdentity.secondary_color }}
                    title={brandIdentity.secondary_color}
                  />
                </div>
              </div>
              <div className="text-slate-600">
                <span className="font-medium">{brandIdentity.brand_personality}</span>
                {brandIdentity.industry && <span className="text-slate-400"> • {brandIdentity.industry}</span>}
              </div>
            </div>
          )}
        </motion.div>

        {brandIdentity?.brand_essence && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-3xl mx-auto mb-10"
          >
            <Card className="border-0 shadow-md bg-gradient-to-br from-[#e2231a]/5 to-indigo-50/50">
              <CardContent className="p-6 text-center">
                <p className="text-slate-700 italic text-lg">"{brandIdentity.brand_essence}"</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Booth Design Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {boothDesigns.map((design, index) => {
            const styles = getTierStyles(design.tier);
            
            return (
              <motion.div
                key={design.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 + 0.2 }}
              >
                <Card 
                  className={`relative overflow-hidden h-full ${styles.border} ${styles.highlight ? 'shadow-xl' : 'shadow-lg'} border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1`}
                >
                  {/* Recommended Badge */}
                  {design.tier === 'Hybrid' && (
                    <div className="absolute top-0 left-0 right-0 bg-[#e2231a] text-white text-center py-2 text-sm font-semibold flex items-center justify-center gap-2 z-10">
                      <Star className="w-4 h-4 fill-current" />
                      Recommended Experience
                    </div>
                  )}

                  <CardContent className={`p-6 ${design.tier === 'Hybrid' ? 'pt-14' : ''}`}>
                    {/* Visual Header - Show Generated Image or Loading */}
                    <div className={`aspect-[4/3] bg-gradient-to-br ${styles.gradient} rounded-xl mb-6 overflow-hidden flex items-center justify-center border border-slate-200`}>
                      {design.design_image_url ? (
                        <img 
                          src={design.design_image_url} 
                          alt={design.design_name}
                          className="w-full h-full object-cover"
                        />
                      ) : generatingImages[design.id] ? (
                        <div className="text-center p-6">
                          <Loader2 className="w-16 h-16 text-slate-400 mx-auto mb-3 animate-spin" />
                          <div className="text-sm text-slate-500 font-medium">Generating booth preview...</div>
                        </div>
                      ) : (
                        <div className="text-center p-6">
                          <Sparkles className="w-16 h-16 text-slate-400 mx-auto mb-3" />
                          <div className="text-sm text-slate-500 font-medium">Curated from {design.product_skus?.length || 0} Products</div>
                        </div>
                      )}
                    </div>

                    {/* Tier Badge */}
                    <Badge className={`${styles.badge} mb-3 font-medium`}>
                      {design.tier} Experience
                    </Badge>

                    {/* Design Name */}
                    <h3 className="text-xl font-bold text-slate-800 mb-3">
                      {design.design_name}
                    </h3>

                    {/* Experience Story */}
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Lightbulb className="w-3 h-3" />
                        The Experience
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed line-clamp-4">
                        {design.experience_story}
                      </p>
                    </div>

                    {/* Key Moments */}
                    {design.key_moments && design.key_moments.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                          Key Moments
                        </div>
                        <div className="space-y-1">
                          {design.key_moments.slice(0, 3).map((moment, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#e2231a] mt-1.5 flex-shrink-0" />
                              <span className="line-clamp-2">{moment}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Price */}
                    <div className="mb-6 pt-4 border-t border-slate-200">
                      <div className="text-3xl font-bold text-[#e2231a]">
                        {formatPrice(design.total_price)}
                      </div>
                      <div className="text-slate-400 text-sm">Complete Experience</div>
                    </div>

                    {/* Select Button */}
                    <Button 
                      onClick={() => handleSelectDesign(design)}
                      className={`w-full h-12 text-base font-semibold transition-all ${
                        design.tier === 'Hybrid' 
                          ? 'bg-[#e2231a] hover:bg-[#b01b13]' 
                          : 'bg-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      Customize in 3D
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-4 mt-10"
        >
          <Button 
            variant="ghost" 
            onClick={() => navigate(createPageUrl('QuoteRequest'))}
            className="text-slate-500"
          >
            ← Start New Design
          </Button>
        </motion.div>
      </div>
    </div>
  );
}