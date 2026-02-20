import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Star, ArrowRight, Sparkles, Palette, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { compositeBrand } from '../utils/brandCompositor';

// ═══════════════════════════════════════════════════════════════
// COMPOSITED IMAGE COMPONENT
// Handles per-image compositor lifecycle: raw → compositing → done
// ═══════════════════════════════════════════════════════════════

function CompositedBoothImage({ rawUrl, brandIdentity, designName, onComposited }) {
  const [state, setState] = useState('loading'); // loading | compositing | done | fallback
  const [displayUrl, setDisplayUrl] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!rawUrl || attempted.current) return;
    attempted.current = true;

    // Show raw image first while compositing
    setDisplayUrl(rawUrl);
    setState('compositing');

    // Run compositor in background
    compositeBrand(rawUrl, brandIdentity, {
      renderText: !brandIdentity.logo_url, // text fallback if no logo
      textColor: '#FFFFFF',
    })
      .then((compositedDataUrl) => {
        setDisplayUrl(compositedDataUrl);
        setState('done');
        if (onComposited) onComposited(compositedDataUrl);
        console.log(`[Results] Composited: ${designName}`);
      })
      .catch((err) => {
        console.warn(`[Results] Compositing failed for ${designName}, using raw:`, err);
        setState('fallback');
        // Keep rawUrl as display — still looks good, just has marker zones
      });
  }, [rawUrl, brandIdentity, designName, onComposited]);

  return (
    <div className="relative w-full h-full">
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={designName}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-slate-300 animate-spin" />
        </div>
      )}

      {/* Compositing status badge */}
      {state === 'compositing' && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Applying branding...
        </div>
      )}
      {state === 'done' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute top-2 right-2 bg-emerald-500/80 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
        >
          <Check className="w-3 h-3" />
          Brand applied
        </motion.div>
      )}
    </div>
  );
}

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
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-10 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto">
        {/* Header with Brand Identity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-bold text-[#e2231a] mb-2">
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

        {/* Booth Design Cards — click anywhere on the card to select */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
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
                  onClick={() => handleSelectDesign(design)}
                  className={`relative overflow-hidden h-full cursor-pointer ${styles.border} ${styles.highlight ? 'shadow-xl' : 'shadow-lg'} border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98]`}
                >
                  {/* Recommended Badge */}
                  {design.tier === 'Hybrid' && (
                    <div className="absolute top-0 left-0 right-0 bg-[#e2231a] text-white text-center py-2 text-sm font-semibold flex items-center justify-center gap-2 z-10">
                      <Star className="w-4 h-4 fill-current" />
                      Recommended Experience
                    </div>
                  )}

                  <CardContent className={`p-6 ${design.tier === 'Hybrid' ? 'pt-14' : ''}`}>
                    {/* Visual Header - Composited Booth Image */}
                    <div className={`aspect-[4/3] bg-gradient-to-br ${styles.gradient} rounded-xl mb-4 overflow-hidden flex items-center justify-center border border-slate-200`}>
                      {design.design_image_url && brandIdentity ? (
                        <CompositedBoothImage
                          rawUrl={design.raw_image_url || design.design_image_url}
                          brandIdentity={brandIdentity}
                          designName={design.design_name}
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

                    {/* Tier Badge + Design Name */}
                    <Badge className={`${styles.badge} mb-2 font-medium`}>
                      {design.tier} Experience
                    </Badge>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                      {design.design_name}
                    </h3>

                    {/* Experience Story — compact */}
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-3">
                      {design.experience_story}
                    </p>

                    {/* Price + CTA row */}
                    <div className="pt-3 border-t border-slate-200 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-[#e2231a]">
                          {formatPrice(design.total_price)}
                        </div>
                        <div className="text-slate-400 text-xs">Complete Experience</div>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-semibold ${
                        design.tier === 'Hybrid' ? 'text-[#e2231a]' : 'text-slate-700'
                      }`}>
                        View Details
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
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