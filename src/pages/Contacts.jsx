import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Search, Building2, Mail, Phone, FileText, Plus } from 'lucide-react';

export default function Contacts() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      if (!currentUser.is_sales_rep) {
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      setUser(currentUser);

      // Get all orders to extract unique contacts
      const orders = await base44.entities.Order.list('-created_date', 1000);
      
      // Group orders by customer email to create contact list
      const contactsMap = new Map();
      
      orders.forEach(order => {
        if (order.dealer_email) {
          if (!contactsMap.has(order.dealer_email)) {
            contactsMap.set(order.dealer_email, {
              email: order.dealer_email,
              company_name: order.dealer_company,
              contact_name: order.dealer_name,
              phone: order.dealer_phone,
              total_orders: 0,
              last_order_date: order.created_date,
              total_value: 0,
              orders: []
            });
          }
          
          const contact = contactsMap.get(order.dealer_email);
          contact.total_orders += 1;
          contact.total_value += (order.quoted_price || 0);
          contact.orders.push(order);
          
          // Update last order date if more recent
          if (new Date(order.created_date) > new Date(contact.last_order_date)) {
            contact.last_order_date = order.created_date;
          }
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
    navigate(createPageUrl('ContactDetail') + '?email=' + encodeURIComponent(contact.email));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price || 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Contacts</h1>
              <p className="text-slate-500">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <Button
              onClick={() => navigate(createPageUrl('SalesQuoteStart'))}
              className="bg-[#e2231a] hover:bg-[#b01b13]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Contact
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
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
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
                  onClick={() => navigate(createPageUrl('SalesQuoteStart'))}
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