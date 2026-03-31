import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, FileText, Settings2, X } from 'lucide-react';
import { ensureBrokerInstance } from '@/lib/brokerInstance';

const STATUSES = ['All', 'Draft', 'Pending', 'Contacted', 'Quoted', 'Negotiating', 'Accepted', 'Confirmed', 'Declined', 'Ordered', 'In Production', 'Shipped', 'Delivered', 'Cancelled'];
const BOOTH_SIZES = ['All', '10x10', '10x20', '20x20', '20x30', 'island'];
const ORDER_FIELD_OPTIONS = [
  { value: 'reference_number', label: 'Quote Number' },
  { value: 'customer_company', label: 'Customer Company' },
  { value: 'customer_name', label: 'Customer Name' },
  { value: 'customer_email', label: 'Customer Email' },
  { value: 'status', label: 'Status' },
  { value: 'show_name', label: 'Show Name' },
  { value: 'show_date', label: 'Show Date' },
  { value: 'booth_size', label: 'Booth Size' },
  { value: 'booth_type', label: 'Booth Type' },
  { value: 'selected_tier', label: 'Tier' },
  { value: 'quoted_price', label: 'Quoted Price' },
  { value: 'final_price', label: 'Final Price' },
  { value: 'expected_close_date', label: 'Expected Close' },
  { value: 'follow_up_date', label: 'Follow Up' },
];
const DEFAULT_COLUMNS = ['reference_number', 'customer_company', 'customer_name', 'status', 'show_name', 'booth_size', 'quoted_price'];
const DEFAULT_FILTERS = [
  { id: 'status', field: 'status', value: 'All' },
  { id: 'booth_size', field: 'booth_size', value: 'All' },
];

function statusColor(status) {
  switch (status) {
    case 'Confirmed': case 'Delivered': case 'Accepted': return 'bg-green-100 text-green-700';
    case 'Quoted': case 'Negotiating': return 'bg-yellow-100 text-yellow-700';
    case 'In Production': case 'Shipped': case 'Ordered': return 'bg-purple-100 text-purple-700';
    case 'Pending': case 'Contacted': return 'bg-blue-100 text-blue-700';
    case 'Cancelled': case 'Declined': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function fmt(n) {
  if (!n) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RecentQuotes() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_COLUMNS);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const currentUser = await base44.auth.me();
        const brokerInstance = await ensureBrokerInstance(currentUser);
        const res = await base44.entities.Order.list('-created_date', 500);
        const scopedOrders = (res || []).filter(order => {
          if (order.broker_instance_id) {
            return order.broker_instance_id === (brokerInstance?.id || currentUser.broker_instance_id);
          }
          return order.dealer_email === currentUser.email || order.created_by === currentUser.email;
        });
        setOrders(scopedOrders);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  const fieldValueOptions = useMemo(() => {
    return ORDER_FIELD_OPTIONS.reduce((acc, field) => {
      const values = Array.from(new Set((orders || []).map((order) => order?.[field.value]).filter(Boolean)));
      acc[field.value] = values.sort((a, b) => String(a).localeCompare(String(b)));
      return acc;
    }, {});
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      const passesFilters = activeFilters.every((filter) => {
        if (!filter.value || filter.value === 'All') return true;
        return String(order?.[filter.field] || '') === String(filter.value);
      });
      if (!passesFilters) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        order.customer_name?.toLowerCase().includes(q) ||
        order.customer_company?.toLowerCase().includes(q) ||
        order.customer_email?.toLowerCase().includes(q) ||
        order.show_name?.toLowerCase().includes(q) ||
        order.reference_number?.toLowerCase().includes(q)
      );
    });
  }, [orders, activeFilters, searchQuery]);

  const updateFilter = (id, key, value) => {
    setActiveFilters((prev) => prev.map((filter) => {
      if (filter.id !== id) return filter;
      if (key === 'field') {
        return { ...filter, field: value, value: 'All' };
      }
      return { ...filter, [key]: value };
    }));
  };

  const addFilter = () => {
    const nextField = ORDER_FIELD_OPTIONS.find((option) => !activeFilters.some((filter) => filter.field === option.value))?.value || ORDER_FIELD_OPTIONS[0].value;
    setActiveFilters((prev) => [...prev, { id: crypto.randomUUID(), field: nextField, value: 'All' }]);
  };

  const removeFilter = (id) => {
    setActiveFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const toggleColumn = (field) => {
    setSelectedColumns((prev) => {
      if (prev.includes(field)) {
        return prev.filter((item) => item !== field);
      }
      if (prev.length >= 10) {
        return prev;
      }
      return [...prev, field];
    });
  };

  const renderFieldValue = (order, field) => {
    const value = order?.[field];
    if (!value) return '—';
    if (field === 'status') {
      return <Badge className={`${statusColor(value)} border-0 inline-flex`}>{value}</Badge>;
    }
    if (['quoted_price', 'final_price'].includes(field)) return fmt(value);
    if (['show_date', 'expected_close_date', 'follow_up_date'].includes(field)) return new Date(value).toLocaleDateString();
    return String(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 pb-24 md:pb-10">
      <div className="border-b border-slate-200 bg-white px-4 md:px-6 py-4">
        <div className="max-w-[1400px] mx-auto space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Orders</h1>
              <p className="text-sm text-slate-500 mt-0.5">{filtered.length} of {orders.length} orders</p>
            </div>
            <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings2 className="w-4 h-4" />
                  Edit List View
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Edit list view</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addFilter}>Add filter</Button>
                    </div>
                    <div className="space-y-3">
                      {activeFilters.map((filter) => {
                        const options = filter.field === 'status'
                          ? STATUSES
                          : filter.field === 'booth_size'
                            ? BOOTH_SIZES
                            : ['All', ...(fieldValueOptions[filter.field] || [])];
                        return (
                          <div key={filter.id} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                              <Select value={filter.field} onValueChange={(value) => updateFilter(filter.id, 'field', value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Field" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ORDER_FIELD_OPTIONS.map((field) => (
                                    <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select value={String(filter.value || 'All')} onValueChange={(value) => updateFilter(filter.id, 'value', value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Value" />
                                </SelectTrigger>
                                <SelectContent>
                                  {options.map((option) => (
                                    <SelectItem key={String(option)} value={String(option)}>
                                      {option === 'All' ? 'Any value' : String(option)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeFilter(filter.id)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Columns</h3>
                      <span className="text-xs text-slate-500">{selectedColumns.length}/10 selected</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ORDER_FIELD_OPTIONS.map((field) => {
                        const checked = selectedColumns.includes(field.value);
                        const disabled = !checked && selectedColumns.length >= 10;
                        return (
                          <label key={field.value} className={`flex items-center gap-3 rounded-xl border p-3 ${disabled ? 'opacity-50' : 'cursor-pointer'} border-slate-200`}>
                            <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleColumn(field.value)} />
                            <span className="text-sm text-slate-700">{field.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, company, email, show, or quote number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => {
              const fieldLabel = ORDER_FIELD_OPTIONS.find((item) => item.value === filter.field)?.label || filter.field;
              const valueLabel = filter.value === 'All' ? 'Any' : filter.value;
              return (
                <div key={filter.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  <span className="font-semibold">{fieldLabel}:</span>
                  <span>{valueLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-20 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No orders match your filters</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>
                    {selectedColumns.map((field) => {
                      const fieldLabel = ORDER_FIELD_OPTIONS.find((item) => item.value === field)?.label || field;
                      return (
                        <th key={field} className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          {fieldLabel}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`${createPageUrl('OrderDetail')}?id=${order.id}`)}
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    >
                      {selectedColumns.map((field) => (
                        <td key={field} className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                          {renderFieldValue(order, field)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}