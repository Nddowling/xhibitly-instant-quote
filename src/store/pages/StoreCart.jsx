import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '../StoreCartContext';

export default function StoreCart() {
  const { items, subtotal, removeItem, updateQuantity } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <ShoppingBag className="w-14 h-14 text-white/15 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-white/40 mb-8">Add some biohacking tools to get started.</p>
        <Button
          onClick={() => navigate('/store/products')}
          className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold px-8 h-12 rounded-xl"
        >
          Browse Products
        </Button>
      </div>
    );
  }

  const freeShippingThreshold = 75;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
      <h1 className="text-2xl font-bold mb-8">Your Cart ({items.length} {items.length === 1 ? 'item' : 'items'})</h1>

      {/* Free shipping bar */}
      {remaining > 0 && (
        <div className="bg-white/4 border border-white/8 rounded-xl px-5 py-3 mb-8">
          <p className="text-sm text-white/60">
            Add <span className="text-[#00c9a7] font-semibold">${remaining.toFixed(2)}</span> more for <span className="font-semibold text-white">free shipping</span>
          </p>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00c9a7] rounded-full transition-all"
              style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Items */}
        <div className="md:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.product_id} className="flex gap-4 bg-white/4 border border-white/8 rounded-2xl p-4">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl bg-white/5 flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center text-2xl">⚡</div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-white mb-1 truncate">{item.name}</h3>
                <p className="text-[#00c9a7] font-bold">${item.price.toFixed(2)}</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 border border-white/15 rounded-lg p-0.5">
                    <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-white/8 rounded transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-white/8 rounded transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.product_id)} className="text-white/25 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="ml-auto text-sm font-semibold text-white">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-6 h-fit">
          <h2 className="font-bold text-lg mb-5">Order Summary</h2>
          <div className="space-y-3 text-sm mb-5">
            <div className="flex justify-between text-white/60">
              <span>Subtotal</span>
              <span className="text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white/60">
              <span>Shipping</span>
              <span className="text-[#00c9a7]">{subtotal >= freeShippingThreshold ? 'FREE' : 'Calculated at checkout'}</span>
            </div>
          </div>
          <div className="border-t border-white/8 pt-4 mb-5">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
          <Button
            onClick={() => navigate('/store/checkout')}
            className="w-full bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-12 rounded-xl"
          >
            Proceed to Checkout <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/store/products')}
            className="w-full mt-2 text-white/40 hover:text-white hover:bg-white/5 text-sm"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    </div>
  );
}
