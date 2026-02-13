import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { FileText, Plus, Calendar, MapPin, Package, ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function OrderHistory() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = React.useRef(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadOrders();
    
    // Pull-to-refresh handlers
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (window.scrollY === 0 && startY.current > 0) {
        const currentY = e.touches[0].clientY;
        const distance = currentY - startY.current;
        if (distance > 0 && distance < 150) {
          setPullDistance(distance);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 80) {
        setIsRefreshing(true);
        await loadOrders();
        setIsRefreshing(false);
      }
      setPullDistance(0);
      startY.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance]);

  const loadOrders = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const userOrders = await base44.entities.Order.filter(
        { dealer_email: currentUser.email },
        '-created_date'
      );
      setOrders(userOrders);
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
    setIsLoading(false);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Contacted':
        return 'bg-blue-100 text-blue-800';
      case 'Quoted':
        return 'bg-purple-100 text-purple-800';
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 p-4 md:p-6 pb-24 md:pb-10">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-16 left-0 right-0 flex justify-center z-40 transition-opacity"
          style={{ opacity: Math.min(pullDistance / 80, 1) }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-full p-2 shadow-lg">
            <div className={`w-6 h-6 border-4 border-[#e2231a] border-t-transparent rounded-full ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}
      
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-[#e2231a] dark:text-[#e2231a] mb-2">
              Order History
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Track all your quote requests and orders
            </p>
          </div>
          <Button 
            onClick={() => navigate(createPageUrl('QuoteRequest'))}
            className="bg-[#e2231a] hover:bg-[#b01b13] h-12 px-6"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Quote
          </Button>
        </motion.div>

        {/* Orders List */}
        {orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="border-0 shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(createPageUrl('OrderDetail') + `?id=${order.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left Side - Order Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge className={`${getStatusBadgeStyle(order.status)} font-medium`}>
                            {order.status}
                          </Badge>
                          <span className="text-slate-400 text-sm font-mono">
                            {order.reference_number}
                          </span>
                        </div>
                        
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                          {order.selected_product_name || 'Quote Request'}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            <span>{order.booth_size}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{order.show_date}</span>
                          </div>
                          {order.show_name && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{order.show_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Side - Price and Date */}
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#e2231a] mb-1">
                          {formatPrice(order.quoted_price)}
                        </div>
                        <div className="text-slate-400 text-sm">
                          {format(new Date(order.created_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-md">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  No Orders Yet
                </h3>
                <p className="text-slate-500 mb-6">
                  Start your first quote request to see it here
                </p>
                <Button 
                  onClick={() => navigate(createPageUrl('QuoteRequest'))}
                  className="bg-[#e2231a] hover:bg-[#b01b13]"
                >
                  Get Your First Quote
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}