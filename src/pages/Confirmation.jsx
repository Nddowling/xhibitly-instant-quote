import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle, Phone, FileText, Plus, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Confirmation() {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    const storedConfirmation = sessionStorage.getItem('orderConfirmation');
    
    if (!storedConfirmation) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    setConfirmation(JSON.parse(storedConfirmation));

    // Track analytics
    base44.analytics.track({
      eventName: "order_confirmed",
      properties: { source: "instant_quote" }
    });

    // Clear session storage
    sessionStorage.removeItem('quoteRequest');
    sessionStorage.removeItem('quoteProducts');
    sessionStorage.removeItem('selectedProduct');
    sessionStorage.removeItem('selectedDesign');
    sessionStorage.removeItem('orderConfirmation');
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(price);
  };

  if (!confirmation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { refNumber, design, quoteData } = confirmation;
  const displayItem = design || confirmation.product;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-0 shadow-2xl overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-br from-[#e2231a] to-[#b01b13] text-white p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold mb-2"
            >
              Design Reserved!
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/80"
            >
              Your booth design has been locked in
            </motion.p>
          </div>

          <CardContent className="p-8">
            {/* Reference Number */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-slate-50 rounded-xl p-6 text-center mb-6"
            >
              <div className="text-slate-500 text-sm mb-1">Reference Number</div>
              <div className="text-2xl font-bold text-[#e2231a] font-mono tracking-wider">
                {refNumber}
              </div>
            </motion.div>

            {/* COUNTDOWN - Broker Call Notification */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-6 text-center"
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Phone className="w-6 h-6 text-green-600" />
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-green-800 mb-2">
                Your Booth Specialist Will Call You
              </h3>
              
              <div className="text-4xl font-bold text-green-700 font-mono mb-2">
                {formatCountdown(countdown)}
              </div>
              
              <p className="text-green-600 text-sm">
                {countdown > 0 
                  ? "Estimated time until your personal specialist reaches out"
                  : "Your specialist should be reaching out momentarily!"
                }
              </p>

              <div className="mt-4 flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 bg-green-400 rounded-full"
                  />
                ))}
              </div>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="border border-slate-200 rounded-xl p-6 mb-6"
            >
              <h3 className="font-semibold text-slate-800 mb-4">Design Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Experience</span>
                  <span className="font-medium text-slate-800">{displayItem?.design_name || displayItem?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tier</span>
                  <span className="font-medium text-slate-800">{displayItem?.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booth Size</span>
                  <span className="font-medium text-slate-800">{quoteData?.boothSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Show Date</span>
                  <span className="font-medium text-slate-800">{quoteData?.showDate}</span>
                </div>
                {quoteData?.showName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Show Name</span>
                    <span className="font-medium text-slate-800">{quoteData.showName}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 flex justify-between">
                  <span className="text-slate-800 font-semibold">Total Investment</span>
                  <span className="font-bold text-[#e2231a] text-xl">
                    {formatPrice(displayItem?.total_price || displayItem?.msrp || 0)}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="grid grid-cols-2 gap-4"
            >
              <Button 
                variant="outline"
                onClick={() => navigate(createPageUrl('OrderHistory'))}
                className="h-14 text-base font-medium"
              >
                <FileText className="w-5 h-5 mr-2" />
                View Orders
              </Button>
              <Button 
                onClick={() => navigate(createPageUrl('QuoteRequest'))}
                className="h-14 text-base font-medium bg-[#e2231a] hover:bg-[#b01b13]"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Quote
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}