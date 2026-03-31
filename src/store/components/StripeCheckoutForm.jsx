import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';

export default function StripeCheckoutForm({ total, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError('');
    setLoading(true);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
      setLoading(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      setError('Payment was not completed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement
        options={{
          layout: 'tabs',
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#00c9a7',
              colorBackground: '#1a1a1a',
              colorText: '#ffffff',
              colorDanger: '#ef4444',
              borderRadius: '10px',
            },
          },
        }}
      />
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-13 text-base rounded-xl disabled:opacity-60 py-3"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
        ) : (
          <><Lock className="w-4 h-4 mr-2" />Pay ${total?.toFixed(2)}</>
        )}
      </Button>
      <p className="text-center text-xs text-white/25 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" /> Secured by Stripe · SSL encrypted
      </p>
    </form>
  );
}
