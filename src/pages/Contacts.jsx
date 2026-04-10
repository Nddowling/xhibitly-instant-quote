import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Search, Building2, Mail, Phone, FileText, Plus, Send, KeyRound } from 'lucide-react';
import { loadBrokerContext, scopeItems } from '@/lib/brokerAccess';

export default function Contacts() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sendingInviteId, setSendingInviteId] = useState(null);
  const [sendingResetId, setSendingResetId] = useState(null);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      const brokerContext = await loadBrokerContext();
      const currentUser = brokerContext.user;
      const brokerId = brokerContext.effectiveDealerId || brokerContext.effectiveBrokerId;

      if (!currentUser.is_sales_rep && currentUser.role !== 'admin') {
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      setUser({ ...currentUser, dealer_instance_id: brokerId });

      const [allOrders, allContacts, allDealerInstances] = await Promise.all([
        base44.entities.Order.list('-created_date', 1000),
        base44.entities.Contact.list('-created_date', 1000),
        base44.entities.DealerInstance.list('name', 1000),
      ]);
      const orders = scopeItems(allOrders || [], brokerId);
      const customerContacts = scopeItems(allContacts || [], brokerId).filter(contact => {
        const recordType = contact.record_type || contact.data?.record_type;
        return recordType !== 'Dealer';
      });
      const dealerInstanceMap = new Map((allDealerInstances || []).map(instance => [instance.id, instance]));

      const contactsMap = new Map();

      customerContacts.forEach(contact => {
        const key = contact.id;
        const dealerInstanceId = contact.dealer_instance_id || contact.data?.dealer_instance_id;
        const dealerInstance = dealerInstanceMap.get(dealerInstanceId);
        contactsMap.set(key, {
          id: contact.id,
          record_id: contact.id,
          dealer_instance_id: dealerInstanceId,
          email: contact.email || contact.data?.email,
          company_name: contact.company_name || contact.data?.company_name || contact.account_name || contact.data?.account_name || dealerInstance?.company_name || dealerInstance?.name || '',
          contact_name: contact.full_name || contact.data?.full_name,
          phone: contact.phone || contact.data?.phone,
          title: contact.title || contact.data?.title,
          total_orders: 0,
          last_order_date: contact.created_date,
          total_value: 0,
          orders: [],
          source: 'contact',
        });
      });

      orders.forEach(order => {
        const matchingContact = customerContacts.find(contact => {
          const email = contact.email || contact.data?.email;
          const fullName = contact.full_name || contact.data?.full_name;
          return (email && email === order.dealer_email) || (fullName && fullName === order.dealer_name);
        });
        const key = matchingContact?.id || order.dealer_email || order.dealer_name;
        if (!contactsMap.has(key)) {
          contactsMap.set(key, {
            id: key,
            email: order.dealer_email,
            company_name: order.dealer_company,
            contact_name: order.dealer_name,
            phone: order.dealer_phone,
            total_orders: 0,
            last_order_date: order.created_date,
            total_value: 0,
            orders: [],
            source: 'order',
          });
        }

        const contact = contactsMap.get(key);
        contact.total_orders += 1;
        contact.total_value += (order.quoted_price || 0);
        contact.orders.push(order);
        contact.company_name = contact.company_name || order.dealer_company;
        contact.phone = contact.phone || order.dealer_phone;
        contact.email = contact.email || order.dealer_email;

        if (new Date(order.created_date) > new Date(contact.last_order_date)) {
          contact.last_order_date = order.created_date;
        }
      });

      const contactsList = Array.from(contactsMap.values());
      setContacts(contactsList);
      setFilteredContacts(contactsList);
    } catch (e) {
      console.error('Error loading contacts:', e);
    }
    setIsLoading(false);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setFilteredContacts(contacts);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = contacts.filter(contact => 
      contact.email?.toLowerCase().includes(query) ||
      contact.company_name?.toLowerCase().includes(query) ||
      contact.contact_name?.toLowerCase().includes(query) ||
      contact.phone?.includes(query)
    );
    
    setFilteredContacts(filtered);
  };

  const handleContactClick = (contact) => {
    const query = contact.record_id
      ? `?id=${encodeURIComponent(contact.record_id)}`
      : `?email=${encodeURIComponent(contact.email || '')}`;
    navigate(createPageUrl('ContactDetail') + query);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  const sendInvite = async (contact, event) => {
    event?.stopPropagation();
    if (!contact.email) return;
    setSendingInviteId(contact.id);
    await base44.auth.inviteUser(contact.email, 'user');
    setSendingInviteId(null);
  };

  const sendPasswordReset = async (contact, event) => {
    event?.stopPropagation();
    if (!contact.email) return;
    setSendingResetId(contact.id);
    await base44.auth.resetPasswordRequest(contact.email);
    setSendingResetId(null);
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Contacts</h1>
              <p className="text-slate-500">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <Button
              onClick={() => navigate(createPageUrl('CatalogQuote'))}
              className="bg-[#e2231a] hover:bg-[#b01b13]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name, company, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
        </motion.div>

        {/* Contacts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6"
        >
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact, index) => (
              <motion.div
                key={contact.email}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-[#e2231a]"
                  onClick={() => handleContactClick(contact)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-12 h-12 bg-[#e2231a]/10 rounded-full flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-[#e2231a]" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {contact.total_orders} order{contact.total_orders !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{contact.company_name || 'No Company'}</CardTitle>
                    <CardDescription className="font-medium text-slate-700">
                      {contact.contact_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                    <div className="pt-3 border-t border-slate-200 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Total Value:</span>
                        <span className="font-semibold text-slate-900">
                          {formatPrice(contact.total_value)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Last Order:</span>
                        <span className="font-medium text-slate-700">
                          {new Date(contact.last_order_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {contact.source === 'contact' && contact.email && (
                      <div className="pt-3 border-t border-slate-200 grid grid-cols-1 gap-2">
                        <Button size="sm" className="bg-[#e2231a] hover:bg-[#b01b13]" onClick={(e) => sendInvite(contact, e)} disabled={sendingInviteId === contact.id}>
                          <Send className="w-4 h-4 mr-2" />
                          {sendingInviteId === contact.id ? 'Sending invite...' : 'Send Dealer Invite'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={(e) => sendPasswordReset(contact, e)} disabled={sendingResetId === contact.id}>
                          <KeyRound className="w-4 h-4 mr-2" />
                          {sendingResetId === contact.id ? 'Sending reset...' : 'Send Password Reset'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No contacts found</h3>
              <p className="text-slate-500 mb-6">
                {searchQuery ? 'Try a different search term' : 'Create your first quote to add contacts'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => navigate(createPageUrl('CatalogQuote'))}
                  className="bg-[#e2231a] hover:bg-[#b01b13]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Quote
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}