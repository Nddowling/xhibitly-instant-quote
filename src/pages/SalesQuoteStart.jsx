import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, User, Building2, Phone, Mail, Plus, FileText } from 'lucide-react';

export default function SalesQuoteStart() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const handleSearch = async () => {
    if (!email) {
      alert('Please enter customer email');
      return;
    }

    setIsSearching(true);
    try {
      const { data } = await base44.functions.invoke('checkCustomer', {
        email,
        company_name: companyName,
        contact_name: contactName,
        phone
      });

      setSearchResults(data);

      // Auto-fill fields if customer exists
      if (data.exists && data.customerInfo) {
        setCompanyName(data.customerInfo.company_name || companyName);
        setContactName(data.customerInfo.contact_name || contactName);
        setPhone(data.customerInfo.phone || phone);
      }
    } catch (error) {
      console.error('Error checking customer:', error);
      alert('Error checking customer information');
    }
    setIsSearching(false);
  };

  const handleStartNewQuote = () => {
    // Store customer info for the quote flow
    const customerData = {
      dealerEmail: email,
      dealerCompany: companyName,
      dealerName: contactName,
      dealerPhone: phone,
      isSalesRepQuote: true
    };
    sessionStorage.setItem('salesCustomerData', JSON.stringify(customerData));
    navigate(createPageUrl('QuoteRequest'));
  };

  const handleContinueOrder = (order) => {
    // Navigate to order detail
    navigate(createPageUrl('OrderDetail') + '?orderId=' + order.id);
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-10 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('SalesDashboard'))}
            className="mb-4 text-slate-600 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <h1 className="text-2xl md:text-4xl font-bold text-[#e2231a] mb-2">
            Create Quote for Customer
          </h1>
          <p className="text-lg text-slate-600">
            Enter customer information to check for existing records or start a new quote
          </p>
        </motion.div>

        {/* Customer Info Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="shadow-xl border-0 mb-6">
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Search for existing customer or enter new details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">
                    Customer Email *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="customer@company.com"
                      className="pl-11 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-700 font-medium">
                    Company Name
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="company"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Company Name"
                      className="pl-11 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact" className="text-slate-700 font-medium">
                    Contact Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="contact"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Contact Name"
                      className="pl-11 h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700 font-medium">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="pl-11 h-12"
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSearch}
                disabled={!email || isSearching}
                className="w-full bg-[#e2231a] hover:bg-[#b01b13] h-12 md:h-14 text-sm md:text-lg font-medium"
              >
                {isSearching ? (
                  'Searching...'
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2 shrink-0" />
                    <span className="hidden sm:inline">Check Customer & Previous Quotes</span>
                    <span className="sm:hidden">Check Customer</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search Results */}
        {searchResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {searchResults.exists && searchResults.orders.length > 0 ? (
              <Card className="shadow-xl border-0 mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Previous Quotes Found</CardTitle>
                      <CardDescription>
                        {searchResults.orders.length} quote(s) for {searchResults.customerInfo.company_name}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleStartNewQuote}
                      className="bg-[#e2231a] hover:bg-[#b01b13] text-xs md:text-sm shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1 md:mr-2" />
                      <span className="hidden sm:inline">Start New Quote</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {searchResults.orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 border border-slate-200 rounded-lg hover:border-[#e2231a] transition-colors cursor-pointer"
                        onClick={() => handleContinueOrder(order)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-slate-900 mb-1">
                              {order.booth_size} Booth - {order.show_name || 'Trade Show'}
                            </h4>
                            <p className="text-sm text-slate-500">
                              Ref: {order.reference_number || order.id.slice(0, 8)}
                            </p>
                          </div>
                          <Badge className={getStatusBadgeStyle(order.status)}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Quote Value</p>
                            <p className="font-medium">{formatPrice(order.quoted_price)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Show Date</p>
                            <p className="font-medium">
                              {order.show_date ? new Date(order.show_date).toLocaleDateString() : 'TBD'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Created</p>
                            <p className="font-medium">
                              {new Date(order.created_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Tier</p>
                            <p className="font-medium">{order.selected_tier || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-xl border-0 mb-6">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      New Customer
                    </h3>
                    <p className="text-slate-600 mb-6">
                      No previous quotes found for this customer. Ready to create their first quote?
                    </p>
                    <Button
                      onClick={handleStartNewQuote}
                      className="bg-[#e2231a] hover:bg-[#b01b13] h-12 md:h-14 px-6 md:px-8 text-sm md:text-base"
                    >
                      <Plus className="w-5 h-5 mr-2 shrink-0" />
                      Start New Quote
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}