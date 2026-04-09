import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingCart, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useCart } from '../StoreCartContext';
import { normalizeStoreProduct } from '../lib/storeProductAdapter';

export default function OrbusStoreProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    base44.entities.Product.get(id).then((item) => setProduct(normalizeStoreProduct(item)));
  }, [id]);

  if (!product) {
    return <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 text-white/50">Loading product...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-10">
      <button onClick={() => navigate('/store/products')} className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to products
      </button>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="aspect-square bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
          {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-6xl text-white/10"><Package className="w-16 h-16" /></div>}
        </div>

        <div>
          <p className="text-xs text-white/35 uppercase tracking-widest mb-2">{product.category}</p>
          <h1 className="text-3xl font-extrabold mb-2">{product.name}</h1>
          {product.sku && <p className="text-sm text-white/45 mb-6">SKU: {product.sku}</p>}
          <div className="text-3xl font-extrabold text-white mb-5">${product.price.toFixed(2)}</div>
          {product.short_description && <p className="text-white/60 text-sm leading-relaxed mb-6">{product.short_description}</p>}

          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm text-white/50">Qty</span>
            <div className="flex items-center gap-2 border border-white/15 rounded-lg p-1">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-white/8 rounded transition-colors"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-white/8 rounded transition-colors"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            <Button onClick={() => { addItem(product, quantity); navigate('/store/checkout'); }} className="bg-[#e2231a] hover:bg-[#c91e16] text-white font-bold h-12 rounded-xl w-full">Buy Now</Button>
            <Button variant="outline" onClick={() => addItem(product, quantity)} className="border-white/20 text-white hover:bg-white/8 h-12 rounded-xl w-full">
              <ShoppingCart className="w-4 h-4 mr-2" />Add to Cart
            </Button>
          </div>

          {product.description && <div className="border-t border-white/8 pt-6 text-sm text-white/60 whitespace-pre-wrap">{product.description}</div>}
        </div>
      </div>
    </div>
  );
}