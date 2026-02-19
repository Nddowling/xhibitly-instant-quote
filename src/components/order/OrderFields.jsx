import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Calendar, MapPin, Building2, User, Mail, Phone, Globe, DollarSign, Percent, Target } from 'lucide-react';

function Field({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function OrderFields({ order, formatPrice }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Order Info */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Order Information</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Field icon={Package} label="Booth Size" value={order.booth_size} />
          <Field icon={Calendar} label="Show Date" value={order.show_date} />
          <Field icon={MapPin} label="Show Name" value={order.show_name} />
          <Field icon={DollarSign} label="Quoted Price" value={formatPrice(order.quoted_price)} />
          {order.selected_tier && <Field icon={Target} label="Tier" value={order.selected_tier} />}
          {order.probability != null && <Field icon={Percent} label="Win Probability" value={`${order.probability}%`} />}
          {order.source && <Field icon={Globe} label="Source" value={order.source} />}
        </CardContent>
      </Card>

      {/* Client Info */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <Field icon={Building2} label="Company" value={order.dealer_company} />
          <Field icon={User} label="Contact" value={order.dealer_name} />
          <Field icon={Mail} label="Email" value={order.dealer_email} />
          <Field icon={Phone} label="Phone" value={order.dealer_phone} />
          <Field icon={Globe} label="Website" value={order.website_url} />
          {order.customer_notes && <Field icon={MapPin} label="Notes" value={order.customer_notes} />}
        </CardContent>
      </Card>
    </div>
  );
}