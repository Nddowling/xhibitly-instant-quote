import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight } from 'lucide-react';
import { loadBrokerContext, scopeItems } from '@/lib/brokerAccess';

export default function ObjectListPage({ objectApiName, title }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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
        return recordType !== 'Dealer';
      });
      setRecords(customerContacts);
      setLoading(false);
      return;
    }

    setRecords(data || []);
    setLoading(false);
  };

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(query));
  }, [records, search]);

  const getPrimaryLabel = (record) => {
    return record.name || record.full_name || record.label || record.record_name || record.reference_number || record.email || record.code || record.sku || record.id;
  };

  const getSecondaryLabel = (record) => {
    if (objectApiName === 'Product') {
      return [record.sku, record.category, record.product_line].filter(Boolean).join(' • ') || record.id;
    }
    return record.email || record.data?.email || record.phone || record.data?.phone || record.website || record.object_api_name || record.id;
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
      navigate(`/ContactDetail?email=${encodeURIComponent(record.email || record.data?.email || '')}`);
      return;
    }
    navigate(`/ObjectRecordDetail?object=${encodeURIComponent(objectApiName)}&id=${record.id}`);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-8 pb-24 md:pb-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
          <p className="text-slate-500 mt-1">{filteredRecords.length} records</p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`} className="pl-9 h-10 bg-white" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredRecords.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-slate-500">No records found.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filteredRecords.map((record) => (
              <Card key={record.id} className="hover:border-[#e2231a]/40 hover:shadow-md transition-all cursor-pointer" onClick={() => handleRecordClick(record)}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 truncate">{getPrimaryLabel(record)}</p>
                      {objectApiName === 'Product' && record.is_active !== undefined && (
                        <Badge variant="outline" className="text-[10px]">{record.is_active ? 'Active' : 'Inactive'}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{getSecondaryLabel(record)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRecordClick(record);
                    }}
                    className="text-slate-400 hover:text-[#e2231a] transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}