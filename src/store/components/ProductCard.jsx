import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Star } from 'lucide-react';
import { useCart } from '../StoreCartContext';

const CATEGORY_LABELS = {
  'red-light-therapy': 'Red Light',
  'sleep': 'Sleep',
  'cold-plunge': 'Cold Plunge',
  'hrv-monitoring': 'HRV',
  'compression': 'Compression',
};

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const image = product.images?.[0];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : null;

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addItem(product);
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      onClick={() => navigate(`/store/products/${product.id}`)}
      className="group bg-white/4 hover:bg-white/6 border border-white/8 hover:border-[#00c9a7]/30 rounded-2xl overflow-hidden cursor-pointer transition-all"
    >
      {/* Image */}
      <div className="aspect-square bg-white/5 overflow-hidden relative">
        {image ? (
          <img src={image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/15 text-5xl">⚡</div>
        )}
        {discountPct && (
          <Badge className="absolute top-3 left-3 bg-[#00c9a7] text-black text-xs font-bold border-0">
            -{discountPct}%
          </Badge>
        )}
        {product.tags?.includes('bestseller') && (
          <Badge className="absolute top-3 right-3 bg-[#ff6b35]/20 text-[#ff6b35] border-[#ff6b35]/30 text-xs">
            Bestseller
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-white/35 mb-1.5">{CATEGORY_LABELS[product.category] ?? product.category}</p>
        <h3 className="font-semibold text-sm text-white leading-snug mb-1 line-clamp-2">{product.name}</h3>
        {product.short_description && (
          <p className="text-xs text-white/40 mb-3 line-clamp-2 leading-snug">{product.short_description}</p>
        )}

        {/* Rating (static for now) */}
        <div className="flex items-center gap-1 mb-3">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-[#00c9a7] text-[#00c9a7]" />)}
          <span className="text-xs text-white/30 ml-1">4.8</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-lg font-bold text-white">${product.price.toFixed(2)}</span>
            {hasDiscount && (
              <span className="text-xs text-white/30 line-through ml-2">${product.compare_at_price.toFixed(2)}</span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleAddToCart}
            className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-semibold h-8 px-3 text-xs rounded-lg flex-shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
