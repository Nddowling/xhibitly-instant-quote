import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Minus, Plus, ShoppingCart, Zap, Shield, Truck, ArrowLeft, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { base44 } from '@/api/base44Client';
import { useCart } from '../StoreCartContext';
import LeadCaptureForm from '../components/LeadCaptureForm';

export default function StoreProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const p = await base44.entities.StoreProduct.get(id);
      setProduct(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    navigate('/store/checkout');
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-12 grid md:grid-cols-2 gap-10">
        <Skeleton className="aspect-square rounded-2xl bg-white/5" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 bg-white/5" />
          <Skeleton className="h-8 w-full bg-white/5" />
          <Skeleton className="h-8 w-3/4 bg-white/5" />
          <Skeleton className="h-4 w-24 bg-white/5" />
          <Skeleton className="h-20 w-full bg-white/5" />
          <Skeleton className="h-12 w-full bg-white/5" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24 text-white/30">
        <p className="text-lg">Product not found.</p>
        <Button variant="outline" className="mt-6 border-white/20 text-white/60" onClick={() => navigate('/store/products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [null];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-10">
      {/* Back */}
      <button
        onClick={() => navigate('/store/products')}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to products
      </button>

      <div className="grid md:grid-cols-2 gap-10 mb-16">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl text-white/10">⚡</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === activeImage ? 'border-[#00c9a7]' : 'border-white/10 hover:border-white/30'}`}
                >
                  {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-xs text-white/35 uppercase tracking-widest mb-2">{product.category?.replace(/-/g, ' ')}</p>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-3 leading-tight">{product.name}</h1>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-4">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-[#00c9a7] text-[#00c9a7]" />)}
            <span className="text-sm text-white/40 ml-1">4.8 · 124 reviews</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-3xl font-extrabold text-white">${product.price.toFixed(2)}</span>
            {hasDiscount && (
              <>
                <span className="text-lg text-white/30 line-through">${product.compare_at_price.toFixed(2)}</span>
                <Badge className="bg-[#00c9a7] text-black text-xs font-bold border-0">
                  Save {Math.round((1 - product.price / product.compare_at_price) * 100)}%
                </Badge>
              </>
            )}
          </div>

          {product.short_description && (
            <p className="text-white/60 text-sm leading-relaxed mb-6">{product.short_description}</p>
          )}

          {/* Quantity */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm text-white/50">Qty</span>
            <div className="flex items-center gap-2 border border-white/15 rounded-lg p-1">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-white/8 rounded transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-white/8 rounded transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 mb-8">
            <Button
              onClick={handleBuyNow}
              className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-13 text-base rounded-xl w-full py-3"
            >
              Buy Now — ${(product.price * quantity).toFixed(2)}
            </Button>
            <Button
              variant="outline"
              onClick={handleAddToCart}
              className={`border-white/20 text-white hover:bg-white/8 h-12 rounded-xl w-full transition-all ${added ? 'border-[#00c9a7] text-[#00c9a7]' : ''}`}
            >
              {added ? (
                '✓ Added to Cart'
              ) : (
                <><ShoppingCart className="w-4 h-4 mr-2" />Add to Cart</>
              )}
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-col gap-2 text-sm text-white/40 border-t border-white/8 pt-5">
            {[
              { icon: Truck, text: 'Free shipping on orders over $75' },
              { icon: Shield, text: '30-day money-back guarantee' },
              { icon: Zap, text: 'Ships within 1-2 business days' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#00c9a7]" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="mb-16 border-t border-white/8 pt-10">
          <h2 className="text-xl font-bold mb-5">Product Details</h2>
          <div className="prose prose-invert prose-sm max-w-none text-white/60 leading-relaxed whitespace-pre-wrap">
            {product.description}
          </div>
        </div>
      )}

      {/* Lead capture at bottom */}
      <div className="bg-gradient-to-br from-[#0d1a14] to-[#111] border border-[#00c9a7]/20 rounded-2xl p-8 mb-8">
        <div className="max-w-md mx-auto text-center">
          <h3 className="text-lg font-bold mb-2">Get 10% off your first order</h3>
          <p className="text-white/40 text-sm mb-6">Join our list and get the free Biohacker's Starter Guide + an exclusive discount code.</p>
          <LeadCaptureForm source="product_page" ctaLabel="Get 10% Off + Free Guide" />
        </div>
      </div>
    </div>
  );
}
