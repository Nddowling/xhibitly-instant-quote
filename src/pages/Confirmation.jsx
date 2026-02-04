import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, FileText, Plus } from 'lucide-react';
// Confetti animation on success

export default function Confirmation() {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    const storedConfirmation = sessionStorage.getItem('orderConfirmation');
    
    if (!storedConfirmation) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    setConfirmation(JSON.parse(storedConfirmation));
    
    // Success animation handled by Framer Motion

    // Clear session storage
    sessionStorage.removeItem('quoteRequest');
    sessionStorage.removeItem('quoteProducts');
    sessionStorage.removeItem('selectedProduct');
    sessionStorage.removeItem('orderConfirmation');
  }, []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (!confirmation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2C5282] border-t-transparent rounded-full animate-spin" />
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
          <div className="bg-gradient-to-br from-[#2C5282] to-[#1E3A5F] text-white p-8 text-center">
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
              Quote Request Submitted!
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-white/80"
            >
              Your booth reservation has been received
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
              <div className="text-2xl font-bold text-[#2C5282] font-mono tracking-wider">
                {refNumber}
              </div>
            </motion.div>

            {/* Contact Notice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl p-4 mb-6"
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="font-semibold text-green-800">We'll contact you within 2 hours</div>
                <div className="text-green-600 text-sm">Our team will reach out to finalize your quote</div>
              </div>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="border border-slate-200 rounded-xl p-6 mb-6"
            >
              <h3 className="font-semibold text-slate-800 mb-4">Order Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">{design ? 'Experience' : 'Product'}</span>
                  <span className="font-medium text-slate-800">{displayItem.design_name || displayItem.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tier</span>
                  <span className="font-medium text-slate-800">{displayItem.tier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booth Size</span>
                  <span className="font-medium text-slate-800">{quoteData.boothSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Show Date</span>
                  <span className="font-medium text-slate-800">{quoteData.showDate}</span>
                </div>
                {quoteData.showName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Show Name</span>
                    <span className="font-medium text-slate-800">{quoteData.showName}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-3 flex justify-between">
                  <span className="text-slate-800 font-semibold">Total Investment</span>
                  <span className="font-bold text-[#2C5282] text-xl">
                    {formatPrice(displayItem.total_price || displayItem.msrp)}
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
                className="h-14 text-base font-medium bg-[#2C5282] hover:bg-[#1E3A5F]"
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