import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { loadBrokerContext, scopeItems } from '@/lib/brokerAccess';
import LeadGridFilters from '@/components/leads/LeadGridFilters';

const createEmptyFilter = (fields = []) => ({
  field: fields[0]?.value || 'id',
  operator: 'contains',
  value: ''
});

function getRecordValue(record, field) {
  const value = record?.[field] ?? record?.data?.[field];
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function matchesFilter(record, filter) {
  const rawValue = getRecordValue(record, filter.field);
  const left = rawValue.toLowerCase();
  const right = String(filter.value || '').toLowerCase();
  const leftNumber = Number(rawValue);
  const rightNumber = Number(filter.value);

  switch (filter.operator) {
    case 'equals':
      return left === right;
    case 'not_equals':
      return left !== right;
    case 'greater_than':
      return !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber > rightNumber;
    case 'less_than':
      return !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber < rightNumber;
    case 'is_empty':
      return left.trim() === '';
    case 'is_not_empty':
      return left.trim() !== '';
    case 'contains':
    default:
      return left.includes(right);
  }
}

function humanizeLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export default function ObjectListPage({ objectApiName, title }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState([]);

  useEffect(() => {
    loadRecords();
  }, [objectApiName]);

  const loadRecords = async () => {
    setLoading(true);
    const data = await base44.entities[objectApiName].list('-created_date', 200);

    if (objectApiName === 'Contact') {
      const brokerContext = await loadBrokerContext();
      const dealerId = brokerContext.effectiveDealerId || brokerContext.effectiveBrokerId;
      const isGlobalAdminView = window.location.pathname === '/DesignerDashboard' || window.location.pathname === '/ExecutiveDashboard';
      const scopedContacts = isGlobalAdminView ? (data || []) : scopeItems(data || [], dealerId);
      const customerContacts = scopedContacts.filter(contact => {
        const recordType = contact.record_type || contact.data?.record_type;
        const portalStatus = contact.portal_status || contact.data?.portal_status;
        return recordType !== 'Dealer' && portalStatus !== 'lead';
      });
      setRecords(customerContacts);
      setLoading(false);
      return;
    }

    if (objectApiName === 'Lead') {
      const brokerContext = await loadBrokerContext();
      const dealerId = brokerContext.effectiveDealerId || brokerContext.effectiveBrokerId;
      const isGlobalAdminView = window.location.pathname === '/DesignerDashboard' || window.location.pathname === '/ExecutiveDashboard';
      const scopedLeads = isGlobalAdminView ? (data || []) : scopeItems(data || [], dealerId);
      setRecords(scopedLeads.filter((lead) => (lead.status || 'open') === 'open'));
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setLoading(false);
  };

  const columns = useMemo(() => {
    const excludedFields = new Set(['id', 'created_by', 'updated_date']);
    const preferredFieldsByObject = {
      Account: ['name', 'company_name', 'website', 'phone', 'email', 'city', 'state', 'record_type', 'created_date'],
      Contact: ['full_name', 'company_name', 'title', 'email', 'phone', 'record_type', 'portal_status', 'created_date'],
      Product: ['sku', 'name', 'category', 'product_line', 'base_price', 'retail_price', 'is_active', 'created_date'],
      Dealer: ['dealer_name', 'company_name', 'email', 'phone_number', 'city', 'state', 'website', 'created_date'],
      DealerInstance: ['name', 'company_name', 'owner_email', 'phone', 'city', 'state', 'website', 'status'],
      LineItem: ['product_name', 'sku', 'category', 'quantity', 'unit_price', 'total_price', 'order_id', 'created_date']
    };

    const sampleRecord = records[0] || {};
    const sampleData = sampleRecord.data || {};
    const availableFields = Array.from(new Set([
      ...Object.keys(sampleRecord),
      ...Object.keys(sampleData)
    ])).filter((field) => !excludedFields.has(field));

    const preferredFields = preferredFieldsByObject[objectApiName] || [];
    const orderedFields = [
      ...preferredFields.filter((field) => availableFields.includes(field)),
      ...availableFields.filter((field) => !preferredFields.includes(field))
    ];

    return orderedFields.slice(0, 10).map((field) => ({
      key: field,
      label: humanizeLabel(field)
    }));
  }, [records, objectApiName]);

  useEffect(() => {
    if (columns.length > 0) {
      setFilters((current) => current.length > 0 ? current : [createEmptyFilter(columns)]);
    }
  }, [columns]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !query || columns.some((column) => getRecordValue(record, column.key).toLowerCase().includes(query));
      const matchesAllFilters = filters.length === 0 || filters.every((filter) => {
        if (!filter.field || !filter.operator) return true;
        if (!filter.value && !['is_empty', 'is_not_empty'].includes(filter.operator)) return true;
        return matchesFilter(record, filter);
      });
      return matchesSearch && matchesAllFilters;
    });
  }, [records, search, filters, columns]);

  const handleFilterChange = (index, key, value) => {
    setFilters((current) => current.map((filter, filterIndex) => (
      filterIndex === index ? { ...filter, [key]: value } : filter
    )));
  };

  const handleAddFilter = () => {
    setFilters((current) => [...current, createEmptyFilter(columns)]);
  };

  const handleRemoveFilter = (index) => {
    setFilters((current) => current.filter((_, filterIndex) => filterIndex !== index));
  };

  const handleClearFilters = () => {
    setFilters(columns.length > 0 ? [createEmptyFilter(columns)] : []);
    setSearch('');
  };

  const handleRecordClick = (record) => {
    if (objectApiName === 'Product') {
      navigate(`/ProductDetail?id=${record.id}`);
      return;
    }
    if (objectApiName === 'Order') {
      navigate(`/OrderDetail?orderId=${record.id}`);
      return;
    }
    if (objectApiName === 'Contact') {
      const contactId = record.record_id || record.id;
      navigate(`/ContactDetail?id=${encodeURIComponent(contactId)}`);
      return;
    }
    if (objectApiName === 'Lead') {
      navigate(`/LeadDetail?id=${record.id}`);
      return;
    }
    navigate(`/ObjectRecordDetail?object=${encodeURIComponent(objectApiName)}&id=${record.id}`);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-8 pb-24 md:pb-10">
      <div className="max-w-[95vw] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">{filteredRecords.length} records</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search all visible ${title.toLowerCase()} fields...`}
            className="pl-9 h-10 bg-white"
          />
        </div>

        {columns.length > 0 && (
          <LeadGridFilters
            fields={columns.map((column) => ({ value: column.key, label: column.label }))}
            filters={filters}
            onChange={handleFilterChange}
            onAdd={handleAddFilter}
            onRemove={handleRemoveFilter}
            onClear={handleClearFilters}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredRecords.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-slate-500">No records found.</CardContent></Card>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => handleRecordClick(record)}
                      className="border-b border-slate-100 hover:bg-[#fff8f7] cursor-pointer"
                    >
                      {columns.map((column) => (
                        <td key={column.key} className="px-4 py-3 text-slate-700 whitespace-nowrap align-top">
                          {getRecordValue(record, column.key)}
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