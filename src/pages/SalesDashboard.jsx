import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import SalesPipelineBoard from '@/components/sales/SalesPipelineBoard';
import MetricCard from '@/components/dashboard/MetricCard';
import { loadBrokerContext, scopeItems } from '@/lib/brokerAccess';
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
  BookOpen,
  ClipboardList
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

    // Real-time subscriptions: refresh when activities or orders change
    const unsubActivity = base44.entities.Activity.subscribe(() => {
      loadDashboardData();
    });
    const unsubOrder = base44.entities.Order.subscribe(() => {
      loadDashboardData();
    });

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
      unsubActivity();
      unsubOrder();
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance]);

  const loadDashboardData = async () => {
    try {
      const brokerContext = await loadBrokerContext();
      const currentUser = brokerContext.user;
      const brokerId = brokerContext.effectiveBrokerId;

      if (!currentUser.is_sales_rep && currentUser.role !== 'admin') {
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      setUser({ ...currentUser, broker_instance_id: brokerId });

      const salesReps = await base44.entities.SalesRep.filter({ user_id: currentUser.id });
      const scopedSalesReps = scopeItems((salesReps || []), brokerId);
      if (scopedSalesReps.length > 0) {
        setSalesRep(scopedSalesReps[0]);
      }

      const allOrders = await base44.entities.Order.list('-created_date', 200);
      const brokerOrders = scopeItems(allOrders || [], brokerId);
      let repOrders = brokerOrders.filter(order => order.assigned_sales_rep_id === scopedSalesReps[0]?.id);

      if (repOrders.length === 0) {
        repOrders = brokerOrders;
      }
      setOrders(repOrders);

      const allActivities = await base44.entities.Activity.list('-created_date', 100);
      let repActivities = scopeItems(allActivities || [], brokerId);

      if (scopedSalesReps[0]?.id) {
        const assignedActivities = repActivities.filter(activity => activity.sales_rep_id === scopedSalesReps[0].id);
        if (assignedActivities.length > 0) {
          repActivities = assignedActivities;
        }
      }
      setActivities(repActivities.slice(0, 10));

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
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  const todayProspects = orders.filter(o =>
    o.follow_up_date === todayStr &&
    ['Pending', 'Contacted', 'Quoted', 'Negotiating'].includes(o.status)
  );

  const activeOpportunities = orders.filter(o => 
    ['Pending', 'Contacted', 'Quoted', 'Negotiating'].includes(o.status)
  );

  const recentWins = orders.filter(o => 
    o.status === 'Confirmed' && 
    new Date(o.created_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  const totalPipelineValue = activeOpportunities.reduce((sum, o) => sum + (o.quoted_price || 0), 0);

  const handleOrderUpdate = () => {
    loadDashboardData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
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
      
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-8"
        >
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#e2231a]/15 bg-[#e2231a]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e2231a]">
                  Dealer command center
                </div>
                <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
                  Welcome back, {user?.full_name?.split(' ')[0] || user?.contact_name?.split(' ')[0]}
                </h1>
                <p className="mt-2 text-sm md:text-base text-slate-600">
                  Keep quotes moving, stay on top of follow-ups, and jump back into the catalog faster.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 lg:justify-end">
                <Button
                  onClick={() => navigate(createPageUrl('CatalogQuote'))}
                  className="bg-[#e2231a] hover:bg-[#b01b13] h-11 rounded-xl px-5"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Open Catalog
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl('Pipeline'))}
                  variant="outline"
                  className="h-11 rounded-xl border-slate-200 px-5"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Review Pipeline
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Today</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{todayLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{todayProspects.length} follow-up{todayProspects.length === 1 ? '' : 's'} due and {activeOpportunities.length} open opportunities in motion.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Focus</p>
                <p className="mt-2 text-lg font-bold text-slate-900">Keep proposals moving</p>
                <p className="mt-1 text-sm text-slate-600">Jump from the dashboard into the catalog, refine the quote, and send the next client-ready version faster.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Profile</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{salesRep?.territory || 'Sales rep workspace'}</p>
                <p className="mt-1 text-sm text-slate-600">{salesRep?.title || 'Use this workspace to manage deal stages, activity, and next steps.'}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8"
        >
          <MetricCard
            label="Pipeline Value"
            value={formatPrice(totalPipelineValue)}
            note="Open opportunity value"
            icon={DollarSign}
            tone="red"
            onClick={() => navigate(createPageUrl('Pipeline'))}
          />
          <MetricCard
            label="Active Deals"
            value={activeOpportunities.length}
            note="Deals still in progress"
            icon={Target}
            tone="blue"
            onClick={() => navigate(createPageUrl('Pipeline') + '?view=active')}
          />
          <MetricCard
            label="Follow-Ups"
            value={todayProspects.length}
            note="Due today"
            icon={Calendar}
            tone="amber"
            onClick={() => navigate(createPageUrl('Pipeline') + '?view=followups')}
          />
          <MetricCard
            label="Wins (30d)"
            value={recentWins.length}
            note="Recently confirmed"
            icon={TrendingUp}
            tone="green"
            onClick={() => navigate(createPageUrl('Pipeline') + '?view=wins')}
          />
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Today's Prospects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Today's Follow-ups</CardTitle>
                    <CardDescription>Prospects requiring attention today</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => navigate(createPageUrl('CatalogQuote'))}
                      variant="outline"
                      className="border-[#e2231a] text-[#e2231a] hover:bg-[#e2231a]/5 text-xs md:text-sm shrink-0"
                    >
                      <span className="hidden sm:inline">Catalog Quote</span>
                      <span className="sm:hidden">Catalog</span>
                    </Button>

                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {todayProspects.length > 0 ? (
                  <div className="space-y-4">
                    {todayProspects.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 border border-slate-200 rounded-lg hover:border-[#e2231a] transition-colors cursor-pointer"
                        onClick={() => navigate(createPageUrl('OrderDetail') + '?id=' + order.id)}
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
                        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-600 flex-wrap">
                            <span>{order.booth_size}</span>
                            <span>•</span>
                            <span>{formatPrice(order.quoted_price)}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="hidden sm:inline">{order.probability}%</span>
                          </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-base font-semibold text-slate-800">No follow-ups scheduled for today</p>
                    <p className="mt-1 text-sm text-slate-500">Use the catalog to build the next quote or review open opportunities in your pipeline.</p>
                    <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      <Button onClick={() => navigate(createPageUrl('CatalogQuote'))} className="bg-[#e2231a] hover:bg-[#b01b13]">
                        <BookOpen className="w-4 h-4 mr-2" />
                        Open Catalog
                      </Button>
                      <Button onClick={() => navigate(createPageUrl('Pipeline'))} variant="outline">
                        View Pipeline
                      </Button>
                    </div>
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
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-800">No recent activity yet</p>
                    <p className="mt-1 text-xs text-slate-500">Calls, emails, meetings, and quote updates will show up here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Kanban Pipeline Board */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Sales Pipeline</CardTitle>
                  <CardDescription>Drag deals between stages to update status</CardDescription>
                </div>
                <Button 
                  onClick={() => navigate(createPageUrl('Pipeline'))}
                  className="w-full sm:w-auto bg-[#e2231a] hover:bg-[#b01b13]"
                >
                  View Full Pipeline
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 md:px-4">
              {orders.length > 0 ? (
                <SalesPipelineBoard orders={orders} onOrderUpdate={handleOrderUpdate} />
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No deals in pipeline</p>
                  <Button 
                    onClick={() => navigate(createPageUrl('SalesQuoteStart'))}
                    className="mt-4 bg-[#e2231a] hover:bg-[#b01b13] text-sm"
                  >
                    Create First Quote
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