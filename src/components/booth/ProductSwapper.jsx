import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProductSwapper({ currentProduct, onSwap, boothSize, tier }) {
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (currentProduct) {
      loadSimilarProducts();
    }
  }, [currentProduct]);

  const loadSimilarProducts = async () => {
    setIsLoading(true);
    
    // Get all products
    const allProducts = await base44.entities.Product.list();
    
    // Filter similar products
    const similar = allProducts.filter(p => 
      p.id !== currentProduct.id &&
      p.category === currentProduct.category &&
      p.price_tier === tier &&
      p.booth_sizes?.includes(boothSize) &&
      p.is_active
    );

    setSimilarProducts(similar.slice(0, 4)); // Limit to 4 alternatives
    setIsLoading(false);
  };

  const handleSwap = (newProduct) => {
    if (onSwap) {
      onSwap(currentProduct, newProduct);
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

  if (!currentProduct) return null;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowLeftRight className="w-5 h-5 text-[#e2231a]" />
          Swap This Product
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Product */}
        <div className="bg-slate-50 rounded-lg p-4 border-2 border-[#e2231a]">
          <Badge className="bg-[#e2231a] text-white mb-2">Current Selection</Badge>
          <div className="flex items-center gap-3">
            {currentProduct.image_url && (
              <img 
                src={currentProduct.image_url} 
                alt={currentProduct.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800">{currentProduct.name}</h4>
              <p className="text-sm text-slate-600">{formatPrice(currentProduct.base_price)}</p>
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {isLoading ? (
          <div className="text-center py-6 text-slate-500">
            Loading alternatives...
          </div>
        ) : similarProducts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600 mb-3">Similar alternatives in the same tier:</p>
            {similarProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg p-3 border border-slate-200 hover:border-[#e2231a] transition-colors cursor-pointer"
                onClick={() => handleSwap(product)}
              >
                <div className="flex items-center gap-3">
                  {product.image_url && (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-14 h-14 object-cover rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <h5 className="font-medium text-slate-800 text-sm">{product.name}</h5>
                    <p className="text-xs text-slate-500">{formatPrice(product.base_price)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="text-[#e2231a] border-[#e2231a] hover:bg-[#e2231a] hover:text-white">
                    <Check className="w-4 h-4 mr-1" />
                    Swap
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm">
            No alternative products available in this tier
          </div>
        )}
      </CardContent>
    </Card>
  );
}