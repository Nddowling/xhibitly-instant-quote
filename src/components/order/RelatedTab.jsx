import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Mail, Phone, FileText, DollarSign, ArrowRight, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_STYLES = {
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Contacted': 'bg-blue-100 text-blue-800',
  'Quoted': 'bg-purple-100 text-purple-800',
  'Negotiating': 'bg-amber-100 text-amber-800',
  'Confirmed': 'bg-green-100 text-green-800',
  'In Production': 'bg-indigo-100 text-indigo-800',
  'Shipped': 'bg-cyan-100 text-cyan-800',
  'Delivered': 'bg-emerald-100 text-emerald-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

export default function RelatedTab({ order, formatPrice }) {
  const navigate = useNavigate();
  const [relatedOrders, setRelatedOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (order?.dealer_email) {
      loadRelated();
    }
  }, [order?.dealer_email]);

  const loadRelated = async () => {
    const orders = await base44.entities.Order.filter(
      { dealer_email: order.dealer_email },
      '-created_date',
      50
    );
    setRelatedOrders(orders.filter(o => o.id !== order.id));
    setIsLoading(false);
  };

  const contact = {
    company: order.dealer_company,
    name: order.dealer_name,
    email: order.dealer_email,
    phone: order.dealer_phone,
  };

  const totalValue = relatedOrders.reduce((sum, o) => sum + (o.quoted_price || 0), 0) + (order.quoted_price || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* Contact Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Related Contact</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#e2231a] hover:text-[#b01b13] gap-1 h-7"
              onClick={() => navigate(createPageUrl('ContactDetail') + '?email=' + encodeURIComponent(contact.email))}
            >
              View Contact <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-[#e2231a]/10 rounded-full flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-[#e2231a]" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{contact.company || 'N/A'}</p>
              <p className="text-sm text-slate-500">{contact.name}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {contact.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-slate-700">{contact.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{relatedOrders.length + 1} total orders</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">Lifetime value: {formatPrice(totalValue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Orders */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Other Orders by Client ({relatedOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : relatedOrders.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No other orders from this client</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {relatedOrders.map((ro) => (
                <div
                  key={ro.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(createPageUrl('OrderDetail') + '?id=' + ro.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {ro.reference_number || `#${ro.id.slice(-6)}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {ro.show_name || ro.booth_size} · {format(new Date(ro.created_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{formatPrice(ro.quoted_price)}</p>
                    <Badge className={`${STATUS_STYLES[ro.status] || 'bg-slate-100 text-slate-700'} text-[10px] h-5`}>
                      {ro.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}