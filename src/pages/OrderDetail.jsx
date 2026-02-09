import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Package, Calendar, MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function OrderDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id') || searchParams.get('orderId');
  
  const [order, setOrder] = useState(null);
  const [boothDesign, setBoothDesign] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      navigate(-1);
      return;
    }
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      // Load the order
      const orderData = await base44.entities.Order.filter({ id: orderId });
      if (!orderData || orderData.length === 0) {
        navigate(createPageUrl('OrderHistory'));
        return;
      }
      const currentOrder = orderData[0];
      setOrder(currentOrder);

      // Load the booth design
      if (currentOrder.selected_booth_design_id) {
        const designData = await base44.entities.BoothDesign.filter({ 
          id: currentOrder.selected_booth_design_id 
        });
        if (designData && designData.length > 0) {
          const design = designData[0];
          setBoothDesign(design);

          // Load products based on SKUs
          if (design.product_skus && design.product_skus.length > 0) {
            const allProducts = await base44.entities.Product.list();
            const matchedProducts = allProducts.filter(p => 
              design.product_skus.includes(p.sku)
            );
            setProducts(matchedProducts);
          }
        }
      }
    } catch (e) {
      console.error('Error loading order details:', e);
      navigate(createPageUrl('OrderHistory'));
    }
    setIsLoading(false);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Contacted':
        return 'bg-blue-100 text-blue-800';
      case 'Quoted':
        return 'bg-purple-100 text-purple-800';
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
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

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-[#e2231a]">
                  Order Details
                </h1>
                <Badge className={`${getStatusBadgeStyle(order.status)} font-medium`}>
                  {order.status}
                </Badge>
              </div>
              <p className="text-slate-500 font-mono text-sm">
                {order.reference_number}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#e2231a]">
                {formatPrice(order.quoted_price)}
              </div>
              <div className="text-slate-400 text-sm">
                {format(new Date(order.created_date), 'MMMM d, yyyy')}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Order Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-sm text-slate-500">Booth Size</div>
                    <div className="font-semibold text-slate-800">{order.booth_size}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-sm text-slate-500">Show Date</div>
                    <div className="font-semibold text-slate-800">{order.show_date}</div>
                  </div>
                </div>
                {order.show_name && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="text-sm text-slate-500">Show Name</div>
                      <div className="font-semibold text-slate-800">{order.show_name}</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Booth Design */}
        {boothDesign && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl text-slate-800">
                  {boothDesign.design_name}
                </CardTitle>
                <Badge className="bg-slate-100 text-slate-700 w-fit">
                  {boothDesign.tier} Experience
                </Badge>
              </CardHeader>
              <CardContent>
                {boothDesign.design_image_url && (
                  <div className="aspect-[16/9] bg-slate-100 rounded-lg overflow-hidden mb-4">
                    <img
                      src={boothDesign.design_image_url}
                      alt={boothDesign.design_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {boothDesign.experience_story && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-slate-700 mb-2">The Experience</h4>
                    <p className="text-slate-600 leading-relaxed">
                      {boothDesign.experience_story}
                    </p>
                  </div>
                )}
                {boothDesign.design_rationale && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Design Rationale</h4>
                    <p className="text-slate-600 leading-relaxed">
                      {boothDesign.design_rationale}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Itemized Products */}
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl text-slate-800">
                  Itemized Components
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {products.map((product, index) => (
                    <div 
                      key={product.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                    >
                      {product.image_url && (
                        <div className="w-24 h-24 bg-white rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-1">
                          {product.name}
                        </h4>
                        <p className="text-sm text-slate-500 mb-2">
                          {product.category} • {product.product_type}
                        </p>
                        {product.description && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#e2231a]">
                          {formatPrice(product.base_price)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {product.price_tier}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-800">
                      Total Experience
                    </div>
                    <div className="text-3xl font-bold text-[#e2231a]">
                      {formatPrice(order.quoted_price)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}