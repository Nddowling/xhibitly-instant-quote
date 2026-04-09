import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, ChevronRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '../StoreCartContext';

export default function OrbusOrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const { orderNumber, customerEmail } = location.state ?? {};

  useEffect(() => { clearCart(); }, []);
  if (!orderNumber) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="w-20 h-20 bg-[#e2231a]/15 border border-[#e2231a]/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-[#e2231a]" />
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Order Confirmed</h1>
      <p className="text-white/50 text-lg mb-3">Thanks for your order. We’ve saved your self-serve store purchase.</p>
      <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2 mb-6">
        <span className="text-sm text-white/60">Order #</span>
        <span className="font-bold text-white">{orderNumber}</span>
      </div>
      {customerEmail && <div className="flex items-center justify-center gap-2 text-sm text-white/40 mb-10"><Mail className="w-4 h-4" />Confirmation sent to <span className="text-white/60">{customerEmail}</span></div>}
      <Button onClick={() => navigate('/store/products')} className="bg-[#e2231a] hover:bg-[#c91e16] text-white font-bold h-12 px-8 rounded-xl">Continue Shopping <ChevronRight className="w-4 h-4 ml-1" /></Button>
    </div>
  );
}