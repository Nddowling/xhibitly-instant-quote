import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReportChart from './ReportChart';

const CHART_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Line' },
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
];
const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'];

export default function ReportChartPanel({ report, fields, results, onChange }) {
  return (
    <div className="p-3 space-y-3 overflow-y-auto flex-1">
      <div>
        <label className="text-xs font-medium text-slate-500 block mb-1">Chart Type</label>
        <div className="flex flex-wrap gap-1">
          {CHART_TYPES.map(ct => (
            <button key={ct.value} onClick={() => onChange({ chart_type: ct.value })}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                report.chart_type === ct.value ? 'bg-[#e2231a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {report.chart_type && report.chart_type !== 'none' && (
        <>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">X Axis</label>
            <select value={report.chart_x_field} onChange={e => onChange({ chart_x_field: e.target.value })}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none">
              <option value="">Select field...</option>
              {fields.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Y Axis</label>
            <select value={report.chart_y_field} onChange={e => onChange({ chart_y_field: e.target.value })}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none mb-1">
              <option value="">Select field...</option>
              {fields.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
            <select value={report.chart_y_aggregate} onChange={e => onChange({ chart_y_aggregate: e.target.value })}
              className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none">
              {AGGREGATES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {results && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Preview</p>
              <ReportChart report={report} results={results} />
            </div>
          )}
        </>
      )}
    </div>
  );
}