import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Loader2, Sparkles, Check, Package, Palette, DollarSign, X, ZoomIn } from 'lucide-react';

export default function DesignConfigurator() {
  const navigate = useNavigate();
  const [design, setDesign] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    loadDesign();
  }, []);

  const loadDesign = async () => {
    const storedDesign = sessionStorage.getItem('selectedDesign');
    const storedQuote = sessionStorage.getItem('quoteRequest');

    if (!storedDesign || !storedQuote) {
      navigate(createPageUrl('Results'));
      return;
    }

    const designData = JSON.parse(storedDesign);
    const quoteInfo = JSON.parse(storedQuote);

    setDesign(designData);
    setQuoteData(quoteInfo);

    // Load products for this design
    let designProducts = [];
    if (designData.product_skus?.length > 0) {
      const allVariants = await base44.entities.ProductVariant.filter({ is_active: true });
      designProducts = allVariants.filter(v =>
        designData.product_skus.includes(v.manufacturer_sku) ||
        designData.product_skus.includes(v.id)
      );

      if (designProducts.length === 0) {
        const allProducts = await base44.entities.Product.filter({ is_active: true });
        designProducts = allProducts.filter(p =>
          designData.product_skus.includes(p.sku)
        );
      }
    }

    setProducts(designProducts);
    setIsLoading(false);
  };

  const generateRefNumber = () => {
    const prefix = 'XQ';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleReserve = async () => {
    setIsSubmitting(true);
    const refNumber = generateRefNumber();

    base44.analytics.track({
      eventName: "design_reserved",
      properties: { tier: design.tier, booth_size: quoteData.boothSize, total_price: design.total_price }
    });

    const order = await base44.entities.Order.create({
      dealer_id: quoteData.dealerId,
      dealer_email: quoteData.dealerEmail,
      dealer_company: quoteData.dealerCompany,
      dealer_name: quoteData.dealerName,
      dealer_phone: quoteData.dealerPhone,
      website_url: quoteData.websiteUrl,
      booth_size: quoteData.boothSize,
      show_date: quoteData.showDate,
      show_name: quoteData.showName || '',
      selected_booth_design_id: design.id,
      selected_tier: design.tier,
      quoted_price: design.total_price,
      status: 'Pending',
      reference_number: refNumber,
      source: 'instant_quote'
    });

    await base44.integrations.Core.SendEmail({
      to: quoteData.dealerEmail || 'orders@xhibitly.com',
      subject: `🔥 New Design Reserved - ${refNumber} - Call within 10 minutes!`,
      body: `
URGENT: New booth design reserved! Contact the customer within 10 minutes.

Reference: ${refNumber}

CUSTOMER:
- Company: ${quoteData.dealerCompany}
- Contact: ${quoteData.dealerName}
- Email: ${quoteData.dealerEmail}
- Phone: ${quoteData.dealerPhone}
- Website: ${quoteData.websiteUrl}

BOOTH DESIGN:
- Design: ${design.design_name}
- Tier: ${design.tier}
- Size: ${quoteData.boothSize}
- Price: $${design.total_price?.toLocaleString()}
- Show: ${quoteData.showName || 'Not specified'} on ${quoteData.showDate}

Products: ${products.map(p => p.display_name || p.name).join(', ')}

ACTION REQUIRED: Call the customer immediately to finalize the order.
`
    });

    sessionStorage.setItem('orderConfirmation', JSON.stringify({
      refNumber,
      orderId: order.id,
      design,
      quoteData
    }));

    navigate(createPageUrl('Confirmation'));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(price || 0);
  };

  if (isLoading || !design || !quoteData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-[#e2231a] animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Loading your design...</p>
        </div>
      </div>
    );
  }

  const brandIdentity = design.brand_identity;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-16 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(createPageUrl('Results'))}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="hidden sm:block h-6 w-px bg-slate-200" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-800">{design.design_name}</h1>
              <div className="flex items-center gap-2">
                <Badge className="bg-slate-100 text-slate-600 text-[10px]">{design.tier}</Badge>
                <span className="text-xs text-slate-400">{quoteData.boothSize} Booth</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {brandIdentity && (
              <div className="hidden md:flex items-center gap-1.5 mr-2">
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: brandIdentity.primary_color }} />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: brandIdentity.secondary_color }} />
              </div>
            )}

            <div className="text-right mr-3">
              <div className="text-xs text-slate-400">Total Investment</div>
              <div className="text-lg font-bold text-[#e2231a]">{formatPrice(design.total_price)}</div>
            </div>

            <Button
              onClick={handleReserve}
              disabled={isSubmitting}
              className="bg-[#e2231a] hover:bg-[#b01b13] h-10 px-6 font-semibold"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-2" /> Reserve This Design</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* AI Render Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-lg overflow-hidden">
            <div
              className="aspect-[16/9] md:aspect-[21/9] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative group cursor-pointer"
              onClick={() => design.design_image_url && setShowFullImage(true)}
            >
              {design.design_image_url ? (
                <>
                  <img src={design.design_image_url} alt={design.design_name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
                      <ZoomIn className="w-6 h-6 text-slate-700" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-8">
                  <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400">AI-generated booth visualization</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Full Image Modal */}
        {showFullImage && design.design_image_url && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowFullImage(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
              onClick={() => setShowFullImage(false)}
            >
              <X className="w-6 h-6" />
            </Button>
            <img
              src={design.design_image_url}
              alt={design.design_name}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Experience Story + Key Moments */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Experience Story */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#e2231a]" />
                  Your Experience
                </h3>
                <p className="text-slate-600 leading-relaxed">{design.experience_story}</p>
                {design.visitor_journey && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Visitor Journey</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{design.visitor_journey}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Moments */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-[#e2231a]" />
                  Key Moments
                </h3>
                {design.key_moments && design.key_moments.length > 0 ? (
                  <div className="space-y-3">
                    {design.key_moments.map((moment, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#e2231a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-[#e2231a]">{i + 1}</span>
                        </div>
                        <p className="text-sm text-slate-600">{moment}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No key moments defined</p>
                )}

                {design.design_rationale && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-semibold text-slate-500 mb-2">Why This Works</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{design.design_rationale}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* What's Included - Product List */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#e2231a]" />
                What's Included ({products.length} Products)
              </h3>

              {products.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.display_name || product.name}
                          className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-white border"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white border flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {product.display_name || product.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {product.category_name || product.category}
                        </p>
                        <p className="text-xs font-medium text-[#e2231a] mt-1">
                          {formatPrice(product.base_price)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">{design.product_skus?.length || 0} curated products included</p>
                </div>
              )}

              {/* Price Summary */}
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Complete {design.tier} Experience</p>
                  <p className="text-xs text-slate-400">{quoteData.boothSize} booth • {products.length} products • Setup included</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#e2231a]">{formatPrice(design.total_price)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-0 shadow-lg bg-gradient-to-r from-[#e2231a] to-[#b01b13]">
            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-white text-center md:text-left">
                <h3 className="text-xl font-bold mb-1">Ready to Reserve?</h3>
                <p className="text-white/80 text-sm">Our booth specialist will call you within 10 minutes to finalize your design.</p>
              </div>
              <Button
                onClick={handleReserve}
                disabled={isSubmitting}
                className="bg-white text-[#e2231a] hover:bg-slate-100 h-12 px-8 font-bold text-base shrink-0"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><ShoppingCart className="w-4 h-4 mr-2" /> Reserve This Design</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}