import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown, Filter, Calendar, DollarSign, Briefcase, User, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Pipeline() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view'); // 'active', 'followups', 'wins', or null (all pipeline)
  
  const [user, setUser] = useState(null);
  const [salesRep, setSalesRep] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [orders, searchTerm, statusFilter, sortBy, sortOrder]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser?.is_sales_rep) {
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      setUser(currentUser);
      
      const [reps] = await Promise.all([
        base44.entities.SalesRep.filter({ user_id: currentUser.id })
      ]);

      if (reps.length > 0) {
        setSalesRep(reps[0]);
        let assignedOrders = await base44.entities.Order.filter({ 
          assigned_sales_rep_id: reps[0].id 
        });
        
        // Demo fallback: if no orders assigned, show all
        if (assignedOrders.length === 0) {
          assignedOrders = await base44.entities.Order.list('-created_date', 50);
        }

        // Pre-filter based on view param
        if (view === 'active') {
          assignedOrders = assignedOrders.filter(o => 
            ['Pending', 'Contacted', 'Quoted', 'Negotiating'].includes(o.status)
          );
        } else if (view === 'followups') {
          const today = new Date();
          assignedOrders = assignedOrders.filter(o => {
            const followUp = o.follow_up_date ? new Date(o.follow_up_date) : null;
            return followUp && 
                   followUp.toDateString() === today.toDateString() &&
                   ['Pending', 'Contacted', 'Quoted', 'Negotiating'].includes(o.status);
          });
        } else if (view === 'wins') {
          assignedOrders = assignedOrders.filter(o => 
            o.status === 'Confirmed' && 
            new Date(o.created_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          );
        }

        setOrders(assignedOrders);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setIsLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.dealer_company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.dealer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.show_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'company':
          aVal = a.dealer_company || '';
          bVal = b.dealer_company || '';
          break;
        case 'amount':
          aVal = a.quoted_price || 0;
          bVal = b.quoted_price || 0;
          break;
        case 'show_date':
          aVal = new Date(a.show_date || 0);
          bVal = new Date(b.show_date || 0);
          break;
        case 'probability':
          aVal = a.probability || 0;
          bVal = b.probability || 0;
          break;
        default:
          aVal = new Date(a.created_date || 0);
          bVal = new Date(b.created_date || 0);
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredOrders(filtered);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': 'bg-slate-100 text-slate-700',
      'Contacted': 'bg-blue-100 text-blue-700',
      'Quoted': 'bg-purple-100 text-purple-700',
      'Negotiating': 'bg-amber-100 text-amber-700',
      'Confirmed': 'bg-green-100 text-green-700',
      'In Production': 'bg-indigo-100 text-indigo-700',
      'Shipped': 'bg-teal-100 text-teal-700',
      'Delivered': 'bg-emerald-100 text-emerald-700',
      'Cancelled': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {view === 'active' ? 'Active Opportunities' :
             view === 'followups' ? "Today's Follow-ups" :
             view === 'wins' ? 'Recent Wins (30d)' :
             'Sales Pipeline'}
          </h1>
          <p className="text-slate-500">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'opportunity' : 'opportunities'}
          </p>
        </div>

        {/* Filters & Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by company, contact, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Quoted">Quoted</SelectItem>
                  <SelectItem value="Negotiating">Negotiating</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="In Production">In Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4">
                    <button 
                      onClick={() => handleSort('company')}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-900"
                    >
                      <Building2 className="w-4 h-4" />
                      Company
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button 
                      onClick={() => handleSort('created_date')}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-900"
                    >
                      <Briefcase className="w-4 h-4" />
                      Reference
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      <User className="w-4 h-4" />
                      Contact
                    </div>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button 
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-900"
                    >
                      <DollarSign className="w-4 h-4" />
                      Amount
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button 
                      onClick={() => handleSort('show_date')}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-900"
                    >
                      <Calendar className="w-4 h-4" />
                      Show Date
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left py-3 px-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Status
                    </div>
                  </th>
                  <th className="text-left py-3 px-4">
                    <button 
                      onClick={() => handleSort('probability')}
                      className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-900"
                    >
                      Probability
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredOrders.map((order, index) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => navigate(`${createPageUrl('OrderDetail')}?id=${order.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{order.dealer_company}</div>
                      <div className="text-sm text-slate-500">{order.booth_size} • {order.selected_tier}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-mono text-sm text-slate-700">{order.reference_number}</div>
                      <div className="text-xs text-slate-500">{order.show_name || '-'}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-700">{order.dealer_name}</div>
                      <div className="text-xs text-slate-500">{order.dealer_email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">
                        {formatPrice(order.final_price || order.quoted_price)}
                      </div>
                      {order.discount_amount > 0 && (
                        <div className="text-xs text-green-600">
                          -{formatPrice(order.discount_amount)} discount
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-700">{formatDate(order.show_date)}</div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-2">
                          <div 
                            className="bg-[#e2231a] h-2 rounded-full transition-all"
                            style={{ width: `${order.probability || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-10">
                          {order.probability || 0}%
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="py-12 text-center">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No opportunities found</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}