import React, { useState } from 'react';
// updated product row
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';

export default function ProductRow({ product, projectId }) {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleAddToProject = async (e) => {
    e.preventDefault(); // prevent navigation
    if (!projectId) {
        toast.info("Please start a project first");
        navigate(createPageUrl('BoothDesigner'));
        return;
    }
    setIsAdding(true);
    try {
        const design = await base44.entities.BoothDesign.get(projectId);
        const skus = design.product_skus || [];
        for (let i = 0; i < quantity; i++) {
            skus.push(product.sku);
        }
        await base44.entities.BoothDesign.update(projectId, { product_skus: skus });
        toast.success(`Added ${quantity}x ${product.name} to project`);
        setAdded(true);
        setTimeout(() => { setAdded(false); setQuantity(1); }, 3000);
    } catch (err) {
        toast.error('Failed to add product');
    } finally {
        setIsAdding(false);
    }
  };

  return (
    <Link to={`${createPageUrl('ProductDetail')}?id=${product.id}${projectId ? `&projectId=${projectId}` : ''}`} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer">
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
      <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
        <div>
          <div className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
            ${product.base_price?.toLocaleString()}
          </div>
          {product.is_rental && product.rental_price && (
            <div className="text-[10px] text-[#e2231a]">${product.rental_price?.toLocaleString()}/event</div>
          )}
          <div className="text-[10px] text-slate-400 mt-0.5">{product.price_tier}</div>
        </div>
        <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800">
                <button onClick={(e) => { e.preventDefault(); setQuantity(Math.max(1, quantity - 1)); }} className="px-2 h-8 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500">-</button>
                <span className="px-2 text-xs font-medium w-6 text-center">{quantity}</span>
                <button onClick={(e) => { e.preventDefault(); setQuantity(quantity + 1); }} className="px-2 h-8 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500">+</button>
            </div>
            <Button 
                size="sm" 
                variant={added ? "secondary" : "default"}
                onClick={handleAddToProject} 
                disabled={isAdding}
                className={added ? "bg-green-100 text-green-700 hover:bg-green-200 h-8 text-xs" : "bg-[#e2231a] hover:bg-[#b01b13] h-8 text-xs"}
            >
                {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : added ? <Check className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                {added ? "Added" : "Add to Project"}
            </Button>
        </div>
      </div>
    </Link>
  );
}