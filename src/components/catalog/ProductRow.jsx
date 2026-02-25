import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ProductRow({ product }) {
  return (
    <Link to={`${createPageUrl('ProductDetail')}?id=${product.id}`} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer">
      {/* Thumbnail */}
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-2xl">
            📦
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm md:text-base truncate">
            {product.name}
          </h4>
          {product.is_rental && (
            <Badge className="bg-[#e2231a]/10 text-[#e2231a] text-[10px] px-1.5 py-0">Rental</Badge>
          )}
        </div>
        {product.sku && (
          <p className="text-xs text-slate-400 mt-0.5">SKU: {product.sku}</p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
          {product.description}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {product.subcategory && (
            <Badge variant="outline" className="text-[10px]">{product.subcategory}</Badge>
          )}
          {product.product_line && (
            <Badge variant="outline" className="text-[10px] border-slate-300">{product.product_line}</Badge>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
          ${product.base_price?.toLocaleString()}
        </div>
        {product.is_rental && product.rental_price && (
          <div className="text-[10px] text-[#e2231a]">${product.rental_price?.toLocaleString()}/event</div>
        )}
        <div className="text-[10px] text-slate-400 mt-0.5">{product.price_tier}</div>
      </div>
    </Link>
  );
}