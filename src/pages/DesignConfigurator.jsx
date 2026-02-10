import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Loader2, Sparkles, Eye, Palette, DollarSign, SlidersHorizontal, X } from 'lucide-react';

import BoothScene3D from '../components/booth/BoothScene3D';
import ProductSwapPanel from '../components/booth/ProductSwapPanel';

export default function DesignConfigurator() {
  const navigate = useNavigate();
  const [design, setDesign] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSwapPanel, setShowSwapPanel] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [view, setView] = useState('3d');

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

    // Load products for this design - try ProductVariant first, fallback to Product
    let designProducts = [];
    if (designData.product_skus?.length > 0) {
      const allVariants = await base44.entities.ProductVariant.filter({ is_active: true });
      designProducts = allVariants.filter(v =>
        designData.product_skus.includes(v.manufacturer_sku) ||
        designData.product_skus.includes(v.id)
      );

      // Fallback to legacy Product entity
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

  const handleSwapProduct = (oldProduct, newProduct) => {
    const updatedProducts = products.map(p =>
      p.id === oldProduct.id ? newProduct : p
    );
    setProducts(updatedProducts);

    // Update design SKUs
    const oldSku = oldProduct.manufacturer_sku || oldProduct.sku;
    const newSku = newProduct.manufacturer_sku || newProduct.sku;
    const updatedSKUs = (design.product_skus || []).map(sku =>
      sku === oldSku ? newSku : sku
    );

    // Recalculate price
    const newTotal = updatedProducts.reduce((sum, p) => sum + (p.base_price || 0), 0);
    setDesign(prev => ({
      ...prev,
      product_skus: updatedSKUs,
      total_price: newTotal
    }));
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

    // Track analytics
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

    // Send broker notification
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

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
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
            {/* Brand Colors */}
            {design.brand_identity && (
              <div className="hidden md:flex items-center gap-1.5 mr-2">
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: design.brand_identity.primary_color }} />
                <div className="w-5 h-5 rounded border" style={{ backgroundColor: design.brand_identity.secondary_color }} />
              </div>
            )}

            {/* Price */}
            <div className="text-right mr-3">
              <div className="text-xs text-slate-400">Total</div>
              <div className="text-lg font-bold text-[#e2231a]">{formatPrice(design.total_price)}</div>
            </div>

            {/* Reserve Button */}
            <Button
              onClick={handleReserve}
              disabled={isSubmitting}
              className="bg-[#e2231a] hover:bg-[#b01b13] h-10 px-6 font-semibold"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-2" /> Reserve Design</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto p-4">
        <div className="flex gap-4">
          {/* 3D Viewer */}
          <div className="flex-1">
            {/* View Toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={view === '3d' ? 'default' : 'outline'}
                  onClick={() => setView('3d')}
                  className={view === '3d' ? 'bg-[#e2231a] hover:bg-[#b01b13]' : ''}
                >
                  <Eye className="w-4 h-4 mr-1" /> 3D View
                </Button>
                <Button
                  size="sm"
                  variant={view === '2d' ? 'default' : 'outline'}
                  onClick={() => setView('2d')}
                  className={view === '2d' ? 'bg-[#e2231a] hover:bg-[#b01b13]' : ''}
                >
                  <Sparkles className="w-4 h-4 mr-1" /> AI Render
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSwapPanel(!showSwapPanel)}
                className="md:hidden"
              >
                <SlidersHorizontal className="w-4 h-4 mr-1" />
                Customize
              </Button>
            </div>

            {view === '3d' ? (
              <BoothScene3D
                products={products}
                brandIdentity={design.brand_identity}
                spatialLayout={design.spatial_layout}
                boothSize={quoteData.boothSize}
                onProductClick={(product) => {
                  setSelectedProduct(product);
                  setShowSwapPanel(true);
                }}
                selectedProductId={selectedProduct?.id}
              />
            ) : (
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="aspect-[16/10] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                  {design.design_image_url ? (
                    <img src={design.design_image_url} alt={design.design_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-8">
                      <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-400">AI-generated visualization</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Experience Story */}
            {design.experience_story && (
              <Card className="mt-4 border-0 shadow-md">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">The Experience</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{design.experience_story}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Swap Panel - Desktop */}
          <AnimatePresence>
            {showSwapPanel && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="hidden md:block flex-shrink-0 overflow-hidden"
              >
                <ProductSwapPanel
                  products={products}
                  spatialLayout={design.spatial_layout}
                  boothSize={quoteData.boothSize}
                  tier={design.tier}
                  onSwapProduct={handleSwapProduct}
                  selectedProduct={selectedProduct}
                  onClose={() => setShowSwapPanel(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Swap Panel Overlay */}
      <AnimatePresence>
        {showSwapPanel && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="md:hidden fixed inset-x-0 bottom-0 z-50 max-h-[70vh] bg-white rounded-t-2xl shadow-2xl"
          >
            <ProductSwapPanel
              products={products}
              spatialLayout={design.spatial_layout}
              boothSize={quoteData.boothSize}
              tier={design.tier}
              onSwapProduct={handleSwapProduct}
              selectedProduct={selectedProduct}
              onClose={() => setShowSwapPanel(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}