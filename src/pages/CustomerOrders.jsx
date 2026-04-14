import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const CUSTOMER_PORTAL_LOGO = 'https://media.base44.com/images/public/69834d9e0d7220d671bfd124/f3c8fd783_IMG_1062.png';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
}

export default function CustomerOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const me = await base44.auth.me();
    setUser(me);
    const email = String(me?.email || '').trim().toLowerCase();
    const allOrders = await base44.entities.Order.list('-created_date', 200);
    const result = (allOrders || []).filter((order) => String(order.customer_email || '').trim().toLowerCase() === email);
    setOrders(result || []);
    setLoading(false);
  };

  const stats = useMemo(() => ({
    total: orders.length,
    quoted: orders.filter(order => ['Quoted', 'Accepted', 'Confirmed', 'Ordered', 'In Production', 'Shipped', 'Delivered'].includes(order.status)).length,
    value: orders.reduce((sum, order) => sum + (order.final_price || order.quoted_price || 0), 0),
  }), [orders]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5 md:space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="rounded-2xl overflow-hidden inline-block mb-4">
              <img src={CUSTOMER_PORTAL_LOGO} alt="Xhibitly" className="h-12 w-auto object-contain block" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">My Orders & Quotes</h1>
            <p className="text-slate-500 mt-1">Only your own Exhibitly orders and quote activity are shown here.</p>
            {user?.email && <p className="text-xs text-slate-400 mt-2">Signed in as {user.email}</p>}
          </div>
          <Button asChild className="w-full md:w-auto bg-[#e2231a] hover:bg-[#c41e17] text-white">
            <Link to="/XhibitlyStart2"><Plus className="w-4 h-4 mr-2" />Start New Quote</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardDescription>Total Orders</CardDescription><CardTitle>{stats.total}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Active Quotes</CardDescription><CardTitle>{stats.quoted}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Total Value</CardDescription><CardTitle>{formatMoney(stats.value)}</CardTitle></CardHeader></Card>
        </div>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900">No orders yet</h2>
                <p className="text-slate-500 mt-2 mb-6">Once you start a quote, it will appear here.</p>
                <Button asChild className="bg-[#e2231a] hover:bg-[#c41e17] text-white"><Link to="/XhibitlyStart2">Create Your First Quote</Link></Button>
              </CardContent>
            </Card>
          ) : orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-slate-900">{order.show_name || order.reference_number || 'Untitled Order'}</h2>
                      <Badge variant="outline">{order.status || 'Pending'}</Badge>
                    </div>
                    <div className="text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Quote #{order.reference_number || '—'}</span>
                      <span>Booth {order.booth_size || '—'}</span>
                      <span>{order.show_date ? new Date(order.show_date).toLocaleDateString() : 'No date'}</span>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center md:min-w-[240px] md:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Quote Value</p>
                      <p className="text-lg font-bold text-[#e2231a]">{formatMoney(order.final_price || order.quoted_price)}</p>
                    </div>
                    {order.share_token && (
                      <Button asChild variant="outline" className="w-full sm:w-auto">
                        <a href={`/QuoteView?token=${encodeURIComponent(order.share_token)}`} target="_blank" rel="noreferrer">
                          View Quote <ArrowRight className="w-4 h-4 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}