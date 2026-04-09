import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ShoppingBag } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCart } from '../StoreCartContext';
import StripeCheckoutForm from '../components/StripeCheckoutForm';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#00c9a7',
    colorBackground: '#1a1a1a',
    colorText: '#ffffff',
    colorDanger: '#ef4444',
    borderRadius: '10px',
  },
};

export default function StoreCheckout() {
  const navigate = useNavigate();
  const { items, subtotal, itemCount } = useCart();

  const [phase, setPhase] = useState('info'); // 'info' | 'payment'
  const [clientSecret, setClientSecret] = useState(null);
  const [serverTotal, setServerTotal] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [intentError, setIntentError] = useState('');

  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    line1: '', city: '', state: '', zip: '', country: 'US',
  });
  const [formError, setFormError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    if (itemCount === 0) navigate('/store/cart');
  }, [itemCount]);

  const handleFormChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.line1 || !form.city || !form.state || !form.zip) {
      setFormError('Please fill in all required fields.');
      return;
    }
    setFormError('');
    setLoadingIntent(true);
    setIntentError('');

    try {
      const response = await base44.functions.invoke('createStorePaymentIntent', {
        line_items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        customer_email: form.email,
      });
      setClientSecret(response.data?.client_secret);
      setPaymentIntentId(response.data?.payment_intent_id);
      setServerTotal(response.data?.total);
      setPhase('payment');
    } catch (err) {
      console.error(err);
      setIntentError('Could not initialize payment. Please try again.');
    } finally {
      setLoadingIntent(false);
    }
  };

  const handlePaymentSuccess = async (intentId) => {
    setSubmittingOrder(true);
    try {
      const res = await base44.functions.invoke('confirmStoreOrder', {
        payment_intent_id: intentId,
        customer_email: form.email,
        customer_name: form.name,
        customer_phone: form.phone || null,
        shipping_address: { line1: form.line1, city: form.city, state: form.state, zip: form.zip, country: form.country },
        line_items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
        })),
      });
      navigate('/store/order-success', { state: { orderNumber: res.order_number, customerEmail: form.email } });
    } catch (err) {
      console.error(err);
      // Navigate to confirmation anyway — payment was successful
      navigate('/store/order-success', { state: { orderNumber: intentId.slice(-8).toUpperCase(), customerEmail: form.email } });
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (submittingOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-white/60">
        <Loader2 className="w-8 h-8 animate-spin text-[#00c9a7]" />
        <p className="text-sm">Confirming your order...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-12 py-10">
      <button
        onClick={() => phase === 'payment' ? setPhase('info') : navigate('/store/cart')}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {phase === 'payment' ? 'Back to shipping info' : 'Back to cart'}
      </button>

      <div className="grid md:grid-cols-5 gap-10">
        {/* Left: form */}
        <div className="md:col-span-3">
          <h1 className="text-2xl font-bold mb-6">
            {phase === 'info' ? 'Shipping Information' : 'Payment'}
          </h1>

          {phase === 'info' ? (
            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">Full Name *</Label>
                  <Input name="name" value={form.name} onChange={handleFormChange} required placeholder="Jane Smith" className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
                </div>
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">Email *</Label>
                  <Input name="email" type="email" value={form.email} onChange={handleFormChange} required placeholder="jane@email.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
                </div>
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1.5 block">Phone (optional)</Label>
                <Input name="phone" value={form.phone} onChange={handleFormChange} placeholder="+1 (555) 000-0000" className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1.5 block">Street Address *</Label>
                <Input name="line1" value={form.line1} onChange={handleFormChange} required placeholder="123 Main St" className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <Label className="text-white/60 text-xs mb-1.5 block">City *</Label>
                  <Input name="city" value={form.city} onChange={handleFormChange} required placeholder="Chicago" className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
                </div>
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">State *</Label>
                  <Input name="state" value={form.state} onChange={handleFormChange} required placeholder="IL" maxLength={2} className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
                </div>
                <div>
                  <Label className="text-white/60 text-xs mb-1.5 block">ZIP *</Label>
                  <Input name="zip" value={form.zip} onChange={handleFormChange} required placeholder="60601" className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-[#00c9a7]" />
                </div>
              </div>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              {intentError && <p className="text-red-400 text-sm">{intentError}</p>}
              <Button
                type="submit"
                disabled={loadingIntent}
                className="w-full bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-12 rounded-xl mt-2"
              >
                {loadingIntent ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</> : 'Continue to Payment'}
              </Button>
            </form>
          ) : !stripePublishableKey ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-200">
              Stripe checkout is not configured yet. Add your Stripe publishable key to enable card payments.
            </div>
          ) : (
            clientSecret && stripePromise && (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
                <StripeCheckoutForm total={serverTotal ?? subtotal} onSuccess={handlePaymentSuccess} />
              </Elements>
            )
          )}
        </div>

        {/* Right: order summary */}
        <div className="md:col-span-2">
          <div className="bg-white/4 border border-white/8 rounded-2xl p-6 sticky top-20">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#00c9a7]" />
              Order Summary
            </h2>
            <div className="space-y-3 mb-5">
              {items.map(item => (
                <div key={item.product_id} className="flex gap-3 items-start">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-white/5 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{item.name}</p>
                    <p className="text-xs text-white/40">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-white flex-shrink-0">${(item.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-white/50">
                <span>Subtotal</span>
                <span>${(serverTotal ?? subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Shipping</span>
                <span className="text-[#00c9a7]">{subtotal >= 75 ? 'FREE' : 'TBD'}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span>${(serverTotal ?? subtotal).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}