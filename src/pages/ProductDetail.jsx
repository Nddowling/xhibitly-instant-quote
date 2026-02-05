import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Star, Lightbulb, Route, Package, Loader2, Check, Sparkles, Eye, Grid3X3 } from 'lucide-react';
import BoothViewer3D from '../components/booth/BoothViewer3D';
import ProductSwapper from '../components/booth/ProductSwapper';

export default function ProductDetail() {
  const navigate = useNavigate();
  const [design, setDesign] = useState(null);
  const [quoteData, setQuoteData] = useState(null);
  const [products, setProducts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [show3DView, setShow3DView] = useState(false);
  const [selectedProductForSwap, setSelectedProductForSwap] = useState(null);

  useEffect(() => {
    loadDesignDetails();
  }, []);

  const loadDesignDetails = async () => {
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

    // Load actual products for this design
    if (designData.product_skus && designData.product_skus.length > 0) {
      const allProducts = await base44.entities.Product.list();
      const selectedProducts = allProducts.filter(p =>
        designData.product_skus.includes(p.sku)
      );
      setProducts(selectedProducts);
    }
    
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

    // Create order
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
      reference_number: refNumber
    });

    // Send email notification
    await base44.integrations.Core.SendEmail({
      to: 'orders@xhibitly.com',
      subject: `New Curated Booth Design Request - ${refNumber}`,
      body: `
New curated booth design request received!

Reference Number: ${refNumber}

DEALER INFORMATION:
- Company: ${quoteData.dealerCompany}
- Contact: ${quoteData.dealerName}
- Email: ${quoteData.dealerEmail}
- Phone: ${quoteData.dealerPhone}
- Website: ${quoteData.websiteUrl}

BOOTH DETAILS:
- Size: ${quoteData.boothSize}
- Show Date: ${quoteData.showDate}
- Show Name: ${quoteData.showName || 'Not specified'}

SELECTED EXPERIENCE:
- Design Name: ${design.design_name}
- Tier: ${design.tier}
- Total Price: $${design.total_price.toLocaleString()}
- Products Included: ${design.product_skus?.length || 0} curated items

EXPERIENCE STORY:
${design.experience_story}

VISITOR JOURNEY:
${design.visitor_journey}

KEY MOMENTS:
${design.key_moments?.map((m, i) => `${i + 1}. ${m}`).join('\n') || 'N/A'}

DESIGN RATIONALE:
${design.design_rationale}

Please contact the dealer within 2 hours to begin customization.
      `
    });

    // Store confirmation data
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
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading || !design || !quoteData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleProductSwap = async (oldProduct, newProduct) => {
    // Update products array
    const updatedProducts = products.map(p => 
      p.id === oldProduct.id ? newProduct : p
    );
    setProducts(updatedProducts);

    // Update design with new product SKU
    const updatedSKUs = design.product_skus.map(sku =>
      sku === oldProduct.sku ? newProduct.sku : sku
    );
    
    // Recalculate total price
    const newTotal = updatedProducts.reduce((sum, p) => sum + p.base_price, 0);
    
    setDesign({
      ...design,
      product_skus: updatedSKUs,
      total_price: newTotal
    });

    // Close swapper
    setSelectedProductForSwap(null);
  };

  const getTierBadgeStyle = (tier) => {
    switch (tier) {
      case 'Modular': return 'bg-slate-100 text-slate-700';
      case 'Hybrid': return 'bg-[#e2231a] text-white';
      case 'Custom': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button 
            variant="ghost" 
            onClick={() => navigate(createPageUrl('Results'))}
            className="mb-6 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Experiences
          </Button>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-3 space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Badge className={`${getTierBadgeStyle(design.tier)} font-medium text-base px-3 py-1`}>
                  {design.tier} Experience
                </Badge>
                {design.tier === 'Hybrid' && (
                  <Badge className="bg-green-100 text-green-700 font-medium flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Recommended
                  </Badge>
                )}
              </div>
              
              <h1 className="text-4xl font-bold text-slate-800 mb-2">
                {design.design_name}
              </h1>
              
              <p className="text-slate-500 text-lg">
                Curated {quoteData.boothSize} Experience for {quoteData.dealerCompany}
              </p>
            </motion.div>

            {/* 3D Toggle Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex gap-3"
            >
              <Button
                variant={!show3DView ? "default" : "outline"}
                onClick={() => setShow3DView(false)}
                className={!show3DView ? "bg-[#e2231a] hover:bg-[#b01b13]" : ""}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                2D Visualization
              </Button>
              <Button
                variant={show3DView ? "default" : "outline"}
                onClick={() => setShow3DView(true)}
                className={show3DView ? "bg-[#e2231a] hover:bg-[#b01b13]" : ""}
              >
                <Eye className="w-4 h-4 mr-2" />
                3D Walkthrough
              </Button>
            </motion.div>

            {/* Booth Visualization */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {show3DView ? (
                <BoothViewer3D 
                  products={products}
                  brandIdentity={design.brand_identity}
                  onProductClick={(product) => setSelectedProductForSwap(product)}
                />
              ) : (
                <Card className="border-0 shadow-lg overflow-hidden">
                  <div className="aspect-[16/10] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    {design.design_image_url ? (
                      <img
                        src={design.design_image_url}
                        alt={design.design_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-8">
                        <Sparkles className="w-20 h-20 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-medium">Booth Visualization</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </motion.div>

            {/* Experience Story */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="w-5 h-5 text-[#e2231a]" />
                    The Experience Story
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 leading-relaxed">
                    {design.experience_story}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Visitor Journey */}
            {design.visitor_journey && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Route className="w-5 h-5 text-[#e2231a]" />
                      Visitor Journey
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {design.visitor_journey}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Key Moments */}
            {design.key_moments && design.key_moments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Memorable Moments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {design.key_moments.map((moment, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-[#e2231a]/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[#e2231a] font-semibold text-sm">{i + 1}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed pt-1">{moment}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Design Rationale */}
            {design.design_rationale && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card className="border-0 shadow-md bg-slate-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Why This Design Works</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-700 leading-relaxed italic">
                      {design.design_rationale}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Products Included */}
            {products.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="w-5 h-5 text-[#e2231a]" />
                      Curated Products ({products.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {products.map((product, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedProductForSwap(product)}
                          className="flex items-center gap-2 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200 hover:border-[#e2231a] hover:bg-slate-50 transition-all text-left"
                        >
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="truncate">{product.name}</span>
                          <Grid3X3 className="w-3 h-3 text-slate-400 ml-auto" />
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Click any product to explore swap options
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Product Swapper */}
            {selectedProductForSwap && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <ProductSwapper
                  currentProduct={selectedProductForSwap}
                  onSwap={handleProductSwap}
                  boothSize={quoteData.boothSize}
                  tier={design.tier}
                />
              </motion.div>
            )}
          </div>

          {/* Sidebar - Right Side */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-6 space-y-6"
            >
              {/* Price Card */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-[#e2231a] to-[#b01b13] text-white">
                <CardContent className="p-6">
                  <div className="text-white/70 text-sm mb-1">Total Investment</div>
                  <div className="text-5xl font-bold mb-6">{formatPrice(design.total_price)}</div>
                  
                  <Button 
                    onClick={handleReserve}
                    disabled={isSubmitting}
                    className="w-full h-14 text-lg font-semibold bg-white text-[#e2231a] hover:bg-white/90 transition-all duration-300"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5 mr-3" />
                        Reserve This Experience
                      </>
                    )}
                  </Button>

                  <p className="text-center text-white/70 text-sm mt-4">
                    We'll contact you within 2 hours to customize details
                  </p>
                </CardContent>
              </Card>

              {/* Show Details */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your Show Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Booth Size</div>
                    <div className="font-semibold text-slate-800">{quoteData.boothSize}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Show Date</div>
                    <div className="font-semibold text-slate-800">{quoteData.showDate}</div>
                  </div>
                  {quoteData.showName && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Show Name</div>
                      <div className="font-semibold text-slate-800">{quoteData.showName}</div>
                    </div>
                  )}
                  {design.brand_identity && (
                    <div className="pt-3 border-t border-slate-200">
                      <div className="text-xs text-slate-500 mb-2">Brand Colors</div>
                      <div className="flex gap-2">
                        <div 
                          className="w-12 h-12 rounded-lg border-2 border-slate-200" 
                          style={{ backgroundColor: design.brand_identity.primary_color }}
                        />
                        <div 
                          className="w-12 h-12 rounded-lg border-2 border-slate-200" 
                          style={{ backgroundColor: design.brand_identity.secondary_color }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}