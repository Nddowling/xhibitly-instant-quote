import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ensureBrokerInstance } from '@/lib/brokerInstance';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, Filter, ArrowLeft, Settings2, X } from 'lucide-react';

const WON_STATUSES = ['Confirmed', 'Delivered', 'Accepted'];
const LOST_STATUSES = ['Declined', 'Cancelled'];
const ACTIVE_STATUSES = ['Pending', 'Contacted', 'Quoted', 'Negotiating', 'Ordered', 'In Production', 'Shipped'];
const STATUS_OPTIONS = ['all', 'Pending', 'Contacted', 'Quoted', 'Negotiating', 'Ordered', 'In Production', 'Shipped', 'Accepted', 'Confirmed', 'Delivered', 'Declined', 'Cancelled'];
const ORDER_FIELD_OPTIONS = [
  { value: 'customer_company', label: 'Customer Company' },
  { value: 'customer_name', label: 'Customer Name' },
  { value: 'customer_email', label: 'Customer Email' },
  { value: 'dealer_company', label: 'Dealer Company' },
  { value: 'dealer_name', label: 'Dealer Name' },
  { value: 'reference_number', label: 'Reference Number' },
  { value: 'status', label: 'Status' },
  { value: 'show_name', label: 'Show Name' },
  { value: 'show_date', label: 'Show Date' },
  { value: 'booth_size', label: 'Booth Size' },
  { value: 'booth_type', label: 'Booth Type' },
  { value: 'selected_tier', label: 'Tier' },
  { value: 'quoted_price', label: 'Quoted Price' },
  { value: 'final_price', label: 'Final Price' },
  { value: 'probability', label: 'Probability' },
  { value: 'expected_close_date', label: 'Expected Close Date' },
  { value: 'follow_up_date', label: 'Follow Up Date' },
  { value: 'assigned_sales_rep_id', label: 'Assigned Sales Rep' },
];
const DEFAULT_COLUMNS = ['customer_company', 'customer_name', 'status', 'show_name', 'booth_size', 'final_price'];
const DEFAULT_FILTERS = [
  { id: 'status', field: 'status', value: 'all' },
  { id: 'booth_size', field: 'booth_size', value: 'all' },
];

function fmtMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getPresetConfig(preset) {
  switch (preset) {
    case 'pipelineValue':
      return {
        title: 'Pipeline Orders',
        subtitle: 'Orders currently included in active pipeline value',
        statuses: ACTIVE_STATUSES,
      };
    case 'won':
      return {
        title: 'Won Orders',
        subtitle: 'All confirmed, delivered, and accepted business',
        statuses: WON_STATUSES,
      };
    case 'lost':
      return {
        title: 'Lost Orders',
        subtitle: 'Declined and cancelled opportunities',
        statuses: LOST_STATUSES,
      };
    case 'closedWon':
      return {
        title: 'Closed Won Orders',
        subtitle: 'Orders contributing to closed-won value',
        statuses: WON_STATUSES,
      };
    case 'pending':
      return {
        title: 'Pending Orders',
        subtitle: 'Orders currently in pending status',
        statuses: ['Pending'],
      };
    case 'contacted':
      return {
        title: 'Contacted Orders',
        subtitle: 'Orders currently in contacted status',
        statuses: ['Contacted'],
      };
    case 'quoted':
      return {
        title: 'Quoted Orders',
        subtitle: 'Orders currently in quoted status',
        statuses: ['Quoted'],
      };
    case 'negotiating':
      return {
        title: 'Negotiating Orders',
        subtitle: 'Orders currently in negotiating status',
        statuses: ['Negotiating'],
      };
    case 'production':
      return {
        title: 'Production Orders',
        subtitle: 'Orders in ordered, in production, or shipped stages',
        statuses: ['Ordered', 'In Production', 'Shipped'],
      };
    case 'active':
    default:
      return {
        title: 'Active Orders',
        subtitle: 'Open deals currently moving through the dealer pipeline',
        statuses: ACTIVE_STATUSES,
      };
  }
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Confirmed':
    case 'Delivered':
    case 'Accepted':
      return 'bg-green-100 text-green-700';
    case 'Pending':
    case 'Contacted':
      return 'bg-blue-100 text-blue-700';
    case 'Quoted':
    case 'Negotiating':
      return 'bg-yellow-100 text-yellow-700';
    case 'In Production':
    case 'Ordered':
    case 'Shipped':
      return 'bg-purple-100 text-purple-700';
    case 'Declined':
    case 'Cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function ExecutiveListView() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const preset = urlParams.get('preset') || 'active';
  const companyFilterFromUrl = urlParams.get('company') || '';
  const presetConfig = getPresetConfig(preset);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState(companyFilterFromUrl);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_COLUMNS);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser?.role !== 'admin') {
          navigate(createPageUrl('SalesDashboard'));
          return;
        }

        const brokerInstance = await ensureBrokerInstance(currentUser);
        const allOrders = await base44.entities.Order.list('-created_date', 1000);
        const scopedOrders = (allOrders || []).filter(order => {
          if (order.broker_instance_id) {
            return order.broker_instance_id === (brokerInstance?.id || currentUser.broker_instance_id);
          }
          return order.dealer_email === currentUser.email || order.created_by === currentUser.email;
        });

        setOrders(scopedOrders);
        if (presetConfig.statuses.length === 1) {
          setActiveFilters(prev => prev.map((filter) =>
            filter.field === 'status' ? { ...filter, value: presetConfig.statuses[0] } : filter
          ));
        }
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [preset]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!presetConfig.statuses.includes(order.status)) return false;

      const passesFilters = activeFilters.every((filter) => {
        if (!filter.value || filter.value === 'all') return true;
        return String(order?.[filter.field] || '') === String(filter.value);
      });
      if (!passesFilters) return false;

      if (companyFilterFromUrl) {
        return (order.customer_company || order.dealer_company || '') === companyFilterFromUrl;
      }
      if (!searchQuery) return true;

      const q = searchQuery.toLowerCase();
      return (
        order.customer_name?.toLowerCase().includes(q) ||
        order.customer_company?.toLowerCase().includes(q) ||
        order.customer_email?.toLowerCase().includes(q) ||
        order.dealer_company?.toLowerCase().includes(q) ||
        order.dealer_name?.toLowerCase().includes(q) ||
        order.show_name?.toLowerCase().includes(q) ||
        order.reference_number?.toLowerCase().includes(q)
      );
    });
  }, [orders, presetConfig, searchQuery, activeFilters, companyFilterFromUrl]);

  const availableStatuses = STATUS_OPTIONS.filter(
    (status) => status === 'all' || presetConfig.statuses.includes(status)
  );
  const boothSizes = ['all', '10x10', '10x20', '20x20', '20x30', 'island'];
  const fieldValueOptions = useMemo(() => {
    return ORDER_FIELD_OPTIONS.reduce((acc, field) => {
      const values = Array.from(new Set((orders || []).map((order) => order?.[field.value]).filter(Boolean)));
      acc[field.value] = values.sort((a, b) => String(a).localeCompare(String(b)));
      return acc;
    }, {});
  }, [orders]);

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

  const updateFilter = (id, key, value) => {
    setActiveFilters((prev) => prev.map((filter) => {
      if (filter.id !== id) return filter;
      if (key === 'field') {
        return { ...filter, field: value, value: 'all' };
      }
      return { ...filter, [key]: value };
    }));
  };

  const addFilter = () => {
    const nextField = ORDER_FIELD_OPTIONS.find((option) => !activeFilters.some((filter) => filter.field === option.value))?.value || ORDER_FIELD_OPTIONS[0].value;
    setActiveFilters((prev) => [...prev, { id: crypto.randomUUID(), field: nextField, value: 'all' }]);
  };

  const removeFilter = (id) => {
    setActiveFilters((prev) => prev.filter((filter) => filter.id !== id));
  };

  const renderFieldValue = (order, field) => {
    const value = order?.[field];
    if (!value) return '—';
    if (field === 'status') {
      return <Badge className={`${getStatusBadgeStyle(value)} border-0 inline-flex`}>{value}</Badge>;
    }
    if (['quoted_price', 'final_price'].includes(field)) return fmtMoney(value);
    if (['show_date', 'expected_close_date', 'follow_up_date'].includes(field)) return new Date(value).toLocaleDateString();
    if (field === 'probability') return `${value}%`;
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
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-6 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <button
                onClick={() => navigate(createPageUrl('ExecutiveDashboard'))}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Executive Dashboard
              </button>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e2231a]/15 bg-[#e2231a]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e2231a]">
                Executive List View
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">{presetConfig.title}</h1>
              <p className="mt-2 text-sm md:text-base text-slate-600">{presetConfig.subtitle}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Visible Orders</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{filteredOrders.length}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 md:p-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by company, contact, show, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  readOnly={!!companyFilterFromUrl}
                />
              </div>

              <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings2 className="w-4 h-4" />
                    Customize View
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
                            ? availableStatuses
                            : filter.field === 'booth_size'
                              ? boothSizes
                              : ['all', ...(fieldValueOptions[filter.field] || [])];
                          return (
                            <div key={filter.id} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                                <Select value={filter.field} onValueChange={(value) => updateFilter(filter.id, 'field', value)}>
                                  <SelectTrigger>
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ORDER_FIELD_OPTIONS.map((field) => (
                                      <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={String(filter.value || 'all')} onValueChange={(value) => updateFilter(filter.id, 'value', value)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((option) => (
                                      <SelectItem key={String(option)} value={String(option)}>
                                        {option === 'all' ? 'Any value' : String(option)}
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
                              <Checkbox
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={() => toggleColumn(field.value)}
                              />
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

            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => {
                const fieldLabel = ORDER_FIELD_OPTIONS.find((item) => item.value === filter.field)?.label || filter.field;
                const valueLabel = filter.value === 'all' ? 'Any' : filter.value;
                return (
                  <div key={filter.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    <span className="font-semibold">{fieldLabel}:</span>
                    <span>{valueLabel}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-500">No orders match the current filters.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => navigate(`${createPageUrl('OrderDetail')}?id=${order.id}&returnTo=${encodeURIComponent(`${createPageUrl('ExecutiveListView')}?preset=${preset}`)}`)}
                    className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {selectedColumns.map((field) => {
                        const fieldLabel = ORDER_FIELD_OPTIONS.find((item) => item.value === field)?.label || field;
                        return (
                          <div key={field} className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-slate-400">{fieldLabel}</p>
                            <div className="mt-1 text-sm font-medium text-slate-900">{renderFieldValue(order, field)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}