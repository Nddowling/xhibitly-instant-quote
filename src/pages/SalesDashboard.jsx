import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Calendar, 
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Target,
  ArrowRight,
  Plus
} from 'lucide-react';

export default function SalesDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [salesRep, setSalesRep] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = React.useRef(0);

  useEffect(() => {
    loadDashboardData();
    
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
        await loadDashboardData();
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

  const loadDashboardData = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      if (!currentUser.is_sales_rep) {
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      setUser(currentUser);

      // Get sales rep profile
      const salesReps = await base44.entities.SalesRep.filter({ user_id: currentUser.id });
      if (salesReps.length > 0) {
        setSalesRep(salesReps[0]);
      }

      // Get orders assigned to this rep
      const repOrders = await base44.entities.Order.filter(
        { assigned_sales_rep_id: salesReps[0]?.id },
        '-created_date',
        50
      );
      setOrders(repOrders);

      // Get recent activities
      const repActivities = await base44.entities.Activity.filter(
        { sales_rep_id: salesReps[0]?.id },
        '-created_date',
        10
      );
      setActivities(repActivities);

    } catch (e) {
      console.error('Error loading dashboard:', e);
    }
    setIsLoading(false);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Confirmed':
      case 'Delivered':
        return 'bg-green-100 text-green-700';
      case 'Pending':
      case 'Contacted':
        return 'bg-blue-100 text-blue-700';
      case 'Quoted':
      case 'Negotiating':
        return 'bg-yellow-100 text-yellow-700';
      case 'In Production':
      case 'Shipped':
        return 'bg-purple-100 text-purple-700';
      case 'Cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Calculate metrics
  const todayProspects = orders.filter(o => {
    const followUp = o.follow_up_date ? new Date(o.follow_up_date) : null;
    const today = new Date();
    return followUp && 
           followUp.toDateString() === today.toDateString() &&
           ['Pending', 'Contacted', 'Quoted', 'Negotiating'].includes(o.status);
  });

  const activeOpportunities = orders.filter(o => 
    ['Pending', 'Contacted', 'Quoted', 'Negotiating'].includes(o.status)
  );

  const recentWins = orders.filter(o => 
    o.status === 'Confirmed' && 
    new Date(o.created_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  const totalPipelineValue = activeOpportunities.reduce((sum, o) => sum + (o.quoted_price || 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-950 p-6 pb-24 md:pb-10">
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
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome back, {user?.full_name?.split(' ')[0] || user?.contact_name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Here's what's happening with your sales today</p>
        </motion.div>

        {/* Metrics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Pipeline Value</p>
                  <p className="text-2xl font-bold text-slate-900">{formatPrice(totalPipelineValue)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Active Opportunities</p>
                  <p className="text-2xl font-bold text-slate-900">{activeOpportunities.length}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Target className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Follow-ups Today</p>
                  <p className="text-2xl font-bold text-slate-900">{todayProspects.length}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Recent Wins (30d)</p>
                  <p className="text-2xl font-bold text-slate-900">{recentWins.length}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today's Prospects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Today's Follow-ups</CardTitle>
                    <CardDescription>Prospects requiring attention today</CardDescription>
                  </div>
                  <Button 
                    onClick={() => navigate(createPageUrl('SalesQuoteStart'))}
                    className="bg-[#e2231a] hover:bg-[#b01b13]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Quote
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {todayProspects.length > 0 ? (
                  <div className="space-y-4">
                    {todayProspects.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 border border-slate-200 rounded-lg hover:border-[#e2231a] transition-colors cursor-pointer"
                        onClick={() => navigate(createPageUrl('OrderDetail') + '?orderId=' + order.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-slate-900">{order.dealer_company}</h4>
                            <p className="text-sm text-slate-500">{order.dealer_name}</p>
                          </div>
                          <Badge className={getStatusBadgeStyle(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>{order.booth_size} Booth</span>
                          <span>•</span>
                          <span>{formatPrice(order.quoted_price)}</span>
                          <span>•</span>
                          <span>{order.probability}% Win Probability</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No follow-ups scheduled for today</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Recent Activity</CardTitle>
                <CardDescription>Your latest interactions</CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.activity_type === 'call' ? 'bg-blue-100' :
                          activity.activity_type === 'email' ? 'bg-purple-100' :
                          activity.activity_type === 'meeting' ? 'bg-green-100' :
                          'bg-slate-100'
                        }`}>
                          {activity.activity_type === 'call' ? <Phone className="w-4 h-4 text-blue-600" /> :
                           activity.activity_type === 'email' ? <Mail className="w-4 h-4 text-purple-600" /> :
                           activity.activity_type === 'meeting' ? <Users className="w-4 h-4 text-green-600" /> :
                           <CheckCircle2 className="w-4 h-4 text-slate-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{activity.subject}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(activity.created_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Active Opportunities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Active Opportunities</CardTitle>
              <CardDescription>Deals in progress</CardDescription>
            </CardHeader>
            <CardContent>
              {activeOpportunities.length > 0 ? (
                <div className="space-y-4">
                  {activeOpportunities.slice(0, 10).map((order) => (
                    <div
                      key={order.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-[#e2231a] transition-colors cursor-pointer"
                      onClick={() => navigate(createPageUrl('OrderDetail') + '?orderId=' + order.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{order.dealer_company}</h4>
                          <p className="text-sm text-slate-500">{order.dealer_name} • {order.dealer_email}</p>
                        </div>
                        <Badge className={getStatusBadgeStyle(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Booth Size</p>
                          <p className="font-medium">{order.booth_size}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Quote Value</p>
                          <p className="font-medium">{formatPrice(order.quoted_price)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Probability</p>
                          <p className="font-medium">{order.probability}%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Show Date</p>
                          <p className="font-medium">{order.show_date ? new Date(order.show_date).toLocaleDateString() : 'TBD'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No active opportunities</p>
                  <Button 
                    onClick={() => navigate(createPageUrl('SalesQuoteStart'))}
                    className="mt-4 bg-[#e2231a] hover:bg-[#b01b13]"
                  >
                    Create Your First Quote
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}