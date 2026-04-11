import React, { useEffect, useMemo, useState } from 'react';

const MIN_COLUMN_WIDTH = 120;
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { loadBrokerContext, scopeItems } from '@/lib/brokerAccess';
import LeadGridFilters from '@/components/leads/LeadGridFilters';

const columns = [
  { key: 'show_name', label: 'Show', width: 160 },
  { key: 'company_name', label: 'Company', width: 220 },
  { key: 'title', label: 'Title', width: 200 },
  { key: 'full_name', label: 'Lead Name / Contact Name', width: 240 },
  { key: 'phone', label: 'Phone Number', width: 170 },
  { key: 'email', label: 'Email', width: 220 },
  { key: 'website', label: 'Website', width: 220 },
  { key: 'contact_type', label: 'Contact Type', width: 170 },
  { key: 'created_date', label: 'Created', width: 170 },
];

const createEmptyFilter = () => ({ field: 'show_name', operator: 'contains', value: '' });

function getValue(record, key) {
  const value = record?.[key] ?? record?.data?.[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

function matchesFilter(record, filter) {
  const rawValue = getValue(record, filter.field);
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

export default function Leads() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState([createEmptyFilter()]);
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(columns.map((column) => [column.key, column.width])));

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    const data = await base44.entities.Lead.list('-created_date', 2000);
    const brokerContext = await loadBrokerContext();
    const dealerId = brokerContext.effectiveDealerId || brokerContext.effectiveBrokerId;
    const isGlobalAdminView = window.location.pathname === '/DesignerDashboard' || window.location.pathname === '/ExecutiveDashboard';
    const scopedLeads = isGlobalAdminView ? (data || []) : scopeItems(data || [], dealerId);
    setRecords(scopedLeads.filter((lead) => (lead.status || lead.data?.status || 'open') === 'open'));
    setLoading(false);
  };

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSearch = !query || columns.some((column) => getValue(record, column.key).toLowerCase().includes(query));
      const matchesAllFilters = filters.every((filter) => {
        if (!filter.field || !filter.operator) return true;
        if (!filter.value && !['is_empty', 'is_not_empty'].includes(filter.operator)) return true;
        return matchesFilter(record, filter);
      });
      return matchesSearch && matchesAllFilters;
    });
  }, [records, search, filters]);

  const handleFilterChange = (index, key, value) => {
    setFilters((current) => current.map((filter, filterIndex) => (
      filterIndex === index ? { ...filter, [key]: value } : filter
    )));
  };

  const handleAddFilter = () => {
    setFilters((current) => [...current, createEmptyFilter()]);
  };

  const handleRemoveFilter = (index) => {
    setFilters((current) => current.filter((_, filterIndex) => filterIndex !== index));
  };

  const handleClearFilters = () => {
    setFilters([createEmptyFilter()]);
    setSearch('');
  };

  const handleResizeStart = (event, columnKey) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[columnKey] || MIN_COLUMN_WIDTH;

    const handlePointerMove = (moveEvent) => {
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + (moveEvent.clientX - startX));
      setColumnWidths((current) => ({ ...current, [columnKey]: nextWidth }));
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-8 pb-24 md:pb-10">
      <div className="max-w-[95vw] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">{filteredRecords.length} open leads</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all visible lead fields..."
            className="pl-9 h-10 bg-white"
          />
        </div>

        <LeadGridFilters
          fields={columns.map((column) => ({ value: column.key, label: column.label }))}
          filters={filters}
          onChange={handleFilterChange}
          onAdd={handleAddFilter}
          onRemove={handleRemoveFilter}
          onClear={handleClearFilters}
        />

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredRecords.length === 0 ? (
          <Card><CardContent className="py-14 text-center text-slate-500">No leads found.</CardContent></Card>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-sm table-fixed">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="relative px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap"
                        style={{ width: `${columnWidths[column.key]}px` }}
                      >
                        <div className="pr-3">{column.label}</div>
                        <div
                          className="absolute top-0 right-0 h-full w-2 cursor-col-resize select-none touch-none"
                          onPointerDown={(event) => handleResizeStart(event, column.key)}
                        >
                          <div className="mx-auto h-full w-px bg-slate-300" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      onClick={() => navigate(`/LeadDetail?id=${record.id}`)}
                      className="border-b border-slate-100 hover:bg-[#fff8f7] cursor-pointer"
                    >
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className="px-4 py-3 text-slate-700 whitespace-nowrap align-top overflow-hidden text-ellipsis"
                          style={{ width: `${columnWidths[column.key]}px` }}
                        >
                          {getValue(record, column.key)}
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