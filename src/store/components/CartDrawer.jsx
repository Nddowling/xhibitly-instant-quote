import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../StoreCartContext';

export default function CartDrawer({ open, onClose }) {
  const { items, itemCount, subtotal, removeItem, updateQuantity } = useCart();
  const navigate = useNavigate();

  const goToCheckout = () => {
    onClose();
    navigate('/store/checkout');
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="bg-[#111] border-white/10 text-white w-full max-w-sm flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b border-white/8">
          <SheetTitle className="text-white flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#00c9a7]" />
            Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </SheetTitle>
        </SheetHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-white/40">
              <ShoppingBag className="w-10 h-10 opacity-30" />
              <p className="text-sm">Your cart is empty</p>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/60 hover:text-white hover:bg-white/8 mt-2"
                onClick={() => { onClose(); navigate('/store/products'); }}
              >
                Browse Products
              </Button>
            </div>
          ) : (
            items.map(item => (
              <div key={item.product_id} className="flex gap-3 items-start">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg bg-white/5 flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-sm text-[#00c9a7] font-semibold mt-0.5">${item.price.toFixed(2)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-6 h-6 rounded border border-white/15 flex items-center justify-center hover:bg-white/8 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="w-6 h-6 rounded border border-white/15 flex items-center justify-center hover:bg-white/8 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeItem(item.product_id)}
                      className="ml-auto p-1 hover:text-red-400 text-white/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-white/8 space-y-3">
            <div className="flex justify-between text-sm text-white/60">
              <span>Subtotal</span>
              <span className="text-white font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <p className="text-xs text-white/30">Shipping calculated at checkout</p>
            <Button
              onClick={goToCheckout}
              className="w-full bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-12 text-base rounded-xl"
            >
              Checkout → ${subtotal.toFixed(2)}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
