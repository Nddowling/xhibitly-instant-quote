import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Package, ChevronRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '../StoreCartContext';

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const { orderNumber, customerEmail } = location.state ?? {};

  useEffect(() => {
    clearCart();
  }, []);

  if (!orderNumber) {
    navigate('/store');
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Success icon */}
        <div className="w-20 h-20 bg-[#00c9a7]/15 border border-[#00c9a7]/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-[#00c9a7]" />
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Order Confirmed!</h1>
        <p className="text-white/50 text-lg mb-2">
          Thank you for your order. We're preparing your recovery tools.
        </p>

        {/* Order number */}
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2 mb-8">
          <Package className="w-4 h-4 text-[#00c9a7]" />
          <span className="text-sm text-white/60">Order #</span>
          <span className="font-bold text-white">{orderNumber}</span>
        </div>

        {customerEmail && (
          <div className="flex items-center justify-center gap-2 text-sm text-white/40 mb-10">
            <Mail className="w-4 h-4" />
            Confirmation sent to <span className="text-white/60">{customerEmail}</span>
          </div>
        )}

        {/* Steps */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { emoji: '✅', label: 'Order placed' },
            { emoji: '📦', label: 'Processing (1-2 days)' },
            { emoji: '🚚', label: 'Shipped to you' },
          ].map(({ emoji, label }) => (
            <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-4">
              <div className="text-2xl mb-2">{emoji}</div>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          ))}
        </div>

        {/* Upsell */}
        <div className="bg-gradient-to-br from-[#0d1a14] to-[#111] border border-[#00c9a7]/20 rounded-2xl p-7 mb-8 text-left">
          <h3 className="font-bold text-lg mb-2">Complete your recovery stack</h3>
          <p className="text-white/45 text-sm mb-5">Most customers also add sleep optimization tools to maximize results.</p>
          <Button
            onClick={() => navigate('/store/products')}
            className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-11 px-6 rounded-xl text-sm"
          >
            Shop More Products <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={() => navigate('/store')}
          className="text-white/30 hover:text-white hover:bg-white/5 text-sm"
        >
          Back to Home
        </Button>
      </motion.div>
    </div>
  );
}
