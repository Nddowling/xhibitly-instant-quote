import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatValue(value, type) {
  if (value === null || value === undefined) return '—';
  if (type === 'currency') return fmt.format(Number(value));
  if (type === 'number') return Number(value).toLocaleString();
  if (type === 'checkbox') return value ? '✓' : '✗';
  if (type === 'date') {
    try { return new Date(value).toLocaleDateString(); } catch { return value; }
  }
  if (type === 'datetime') {
    try { return new Date(value).toLocaleString(); } catch { return value; }
  }
  return String(value);
}

export default function ReportResultsTable({ report, results, compact }) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  if (!results?.rows?.length) {
    return <div className="text-center py-10 text-slate-400 text-sm">No results found</div>;
  }

  const columns = report?.selected_fields || Object.keys(results.rows[0]).filter(k => !k.startsWith('_')).map(k => ({ field: k, label: k, type: 'text' }));

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sorted = [...results.rows].sort((a, b) => {
    if (!sortField) return 0;
    const av = a[sortField];
    const bv = b[sortField];
    const dir = sortDir === 'asc' ? 1 : -1;
    if (av == null) return 1;
    if (bv == null) return -1;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });

  return (
    <div className={`overflow-auto ${compact ? 'max-h-64' : ''}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map(col => (
              <th key={col.field || col} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none"
                onClick={() => handleSort(col.field || col)}>
                <div className="flex items-center gap-1">
                  {col.label || col}
                  {sortField === (col.field || col) ? (
                    sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map(col => (
                <td key={col.field || col} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-xs truncate">
                  {formatValue(row[col.field || col], col.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td colSpan={columns.length} className="px-3 py-1.5 text-xs text-slate-400">
              {sorted.length} of {results.total} records
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}