import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { 
  Building2, Mail, Phone, User, FileText, DollarSign, 
  Calendar, ArrowRight, Plus, Package
} from 'lucide-react';

export default function ContactDetail() {
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');

  useEffect(() => {
    if (!email) {
      navigate(createPageUrl('Contacts'));
      return;
    }
    loadContactData();
  }, [email]);

  const loadContactData = async () => {
    const currentUser = await base44.auth.me();
    if (!currentUser.is_sales_rep) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const contactOrders = await base44.entities.Order.filter(
      { dealer_email: email },
      '-created_date',
      100
    );

    if (contactOrders.length === 0) {
      navigate(createPageUrl('Contacts'));
      return;
    }

    const firstOrder = contactOrders[0];
    setContact({
      email: firstOrder.dealer_email,
      company_name: firstOrder.dealer_company,
      contact_name: firstOrder.dealer_name,
      phone: firstOrder.dealer_phone,
      total_orders: contactOrders.length,
      total_value: contactOrders.reduce((sum, o) => sum + (o.quoted_price || 0), 0),
    });
    setOrders(contactOrders);
    setIsLoading(false);
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price || 0);

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Confirmed': case 'Delivered': return 'bg-green-100 text-green-700';
      case 'Pending': case 'Contacted': return 'bg-blue-100 text-blue-700';
      case 'Quoted': case 'Negotiating': return 'bg-yellow-100 text-yellow-700';
      case 'In Production': case 'Shipped': return 'bg-purple-100 text-purple-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleNewQuote = () => {
    const customerData = {
      dealerEmail: contact.email,
      dealerCompany: contact.company_name,
      dealerName: contact.contact_name,
      dealerPhone: contact.phone,
      isSalesRepQuote: true
    };
    sessionStorage.setItem('salesCustomerData', JSON.stringify(customerData));
    navigate(createPageUrl('SalesQuoteStart'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-10 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto">
        {/* Contact Info Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#e2231a]/10 rounded-full flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-[#e2231a]" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{contact.company_name || 'No Company'}</CardTitle>
                    <CardDescription className="text-base font-medium text-slate-700 mt-1">
                      {contact.contact_name}
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={handleNewQuote} className="bg-[#e2231a] hover:bg-[#b01b13]">
                  <Plus className="w-4 h-4 mr-2" />
                  New Quote
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-900">{contact.email}</p>
                  </div>
                </div>
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="text-sm font-medium text-slate-900">{contact.phone}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Total Orders</p>
                    <p className="text-sm font-medium text-slate-900">{contact.total_orders}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Total Value</p>
                    <p className="text-sm font-medium text-slate-900">{formatPrice(contact.total_value)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Orders / Opportunities */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Opportunities & Quotes ({orders.length})
          </h2>
          <div className="space-y-4">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-lg hover:border-[#e2231a] transition-all"
                onClick={() => navigate(createPageUrl('OrderDetail') + '?id=' + order.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {order.reference_number || `Order #${order.id.slice(-6)}`}
                      </p>
                      {order.show_name && (
                        <p className="text-sm text-slate-500">{order.show_name}</p>
                      )}
                    </div>
                    <Badge className={getStatusBadgeStyle(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Booth Size</p>
                      <p className="font-medium text-slate-900">{order.booth_size}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tier</p>
                      <p className="font-medium text-slate-900">{order.selected_tier || '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Quoted Price</p>
                      <p className="font-medium text-slate-900">{formatPrice(order.quoted_price)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Show Date</p>
                      <p className="font-medium text-slate-900">
                        {order.show_date ? new Date(order.show_date).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                  {order.probability != null && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Win Probability</span>
                      <span className="font-semibold text-slate-900">{order.probability}%</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}