import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, Check, ChevronDown, DollarSign, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProductSwapPanel({ 
  products, 
  spatialLayout,
  boothSize, 
  tier, 
  onSwapProduct,
  selectedProduct,
  onClose
}) {
  const [allVariants, setAllVariants] = useState([]);
  const [swapOptions, setSwapOptions] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSwapOptions();
  }, []);

  const loadSwapOptions = async () => {
    const variants = await base44.entities.ProductVariant.filter({ is_active: true });
    setAllVariants(variants);

    // Group by swap_group
    const grouped = {};
    products.forEach(p => {
      const group = p.swap_group || p.category_name || p.category;
      if (!grouped[group]) grouped[group] = [];
      const alternatives = variants.filter(v =>
        v.swap_group === group &&
        v.id !== p.id &&
        v.booth_sizes?.includes(boothSize)
      );
      grouped[group] = alternatives;
    });
    setSwapOptions(grouped);
    setIsLoading(false);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(price);
  };

  const getPriceDiff = (current, alternative) => {
    const diff = alternative.base_price - current.base_price;
    if (diff === 0) return null;
    return diff > 0 ? `+${formatPrice(diff)}` : formatPrice(diff);
  };

  return (
    <Card className="border-0 shadow-xl bg-white h-full overflow-y-auto">
      <CardHeader className="pb-3 sticky top-0 bg-white z-10 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="w-4 h-4 text-[#e2231a]" />
            Customize Products
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">Select alternatives to swap into your design</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : (
          products.map((product, i) => {
            const group = product.swap_group || product.category_name || product.category;
            const alternatives = swapOptions[group] || [];
            const isSelected = selectedProduct?.id === product.id;

            return (
              <motion.div
                key={product.id || i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-lg border-2 p-3 transition-all ${
                  isSelected ? 'border-[#e2231a] bg-red-50/50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <Badge className="bg-slate-100 text-slate-600 text-[10px] mb-1">
                      {product.category_name || product.category}
                    </Badge>
                    <h4 className="font-semibold text-sm text-slate-800 truncate">{product.display_name || product.name}</h4>
                    <span className="text-xs text-[#e2231a] font-medium">{formatPrice(product.base_price)}</span>
                  </div>
                </div>

                {alternatives.length > 0 && (
                  <Select
                    onValueChange={(variantId) => {
                      const newProduct = allVariants.find(v => v.id === variantId);
                      if (newProduct) onSwapProduct(product, newProduct);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Swap to alternative..." />
                    </SelectTrigger>
                    <SelectContent>
                      {alternatives.map((alt) => {
                        const diff = getPriceDiff(product, alt);
                        return (
                          <SelectItem key={alt.id} value={alt.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{alt.display_name}</span>
                              {diff && (
                                <span className={`text-[10px] font-medium ${
                                  diff.startsWith('+') ? 'text-amber-600' : 'text-green-600'
                                }`}>
                                  {diff}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}

                {alternatives.length === 0 && (
                  <p className="text-[10px] text-slate-400 italic">No swap options available</p>
                )}
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}