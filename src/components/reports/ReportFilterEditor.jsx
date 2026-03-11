import React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const OPERATORS = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: "doesn't contain" },
  { value: 'starts_with', label: 'starts with' },
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'greater_or_equal', label: '>=' },
  { value: 'less_or_equal', label: '<=' },
  { value: 'is_null', label: 'is blank' },
  { value: 'is_not_null', label: 'is not blank' },
  { value: 'in', label: 'in (comma sep)' },
  { value: 'last_n_days', label: 'last N days' },
];

export default function ReportFilterEditor({ filters = [], filterLogic, fields, onChange }) {
  const addFilter = () => {
    const newFilters = [...filters, { field: fields[0]?.api_name || '', operator: 'equals', value: '' }];
    onChange(newFilters, filterLogic);
  };

  const removeFilter = (i) => {
    const newFilters = filters.filter((_, idx) => idx !== i);
    onChange(newFilters, filterLogic);
  };

  const updateFilter = (i, updates) => {
    const newFilters = filters.map((f, idx) => idx === i ? { ...f, ...updates } : f);
    onChange(newFilters, filterLogic);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filters</p>
        <Button size="sm" variant="ghost" onClick={addFilter} className="h-6 gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add Filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No filters — showing all records</p>
      ) : (
        <div className="space-y-2">
          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 w-4 text-right">{i + 1}</span>
              <select value={f.field} onChange={e => updateFilter(i, { field: e.target.value })}
                className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none min-w-0">
                {fields.map(fld => <option key={fld.api_name} value={fld.api_name}>{fld.label}</option>)}
              </select>
              <select value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value })}
                className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none">
                {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              {!['is_null', 'is_not_null'].includes(f.operator) && (
                <Input value={f.value} onChange={e => updateFilter(i, { value: e.target.value })}
                  placeholder="Value" className="h-7 text-xs w-28" />
              )}
              <button onClick={() => removeFilter(i)} className="text-slate-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {filters.length > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-400">Logic:</span>
              <Input
                value={filterLogic}
                onChange={e => onChange(filters, e.target.value)}
                placeholder={`e.g. 1 AND (2 OR 3) — default: ALL`}
                className="h-7 text-xs flex-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}