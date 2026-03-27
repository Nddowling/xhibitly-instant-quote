import React from 'react';

function fmtMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function ExecutiveStatusBreakdown({ rows }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">Pipeline Breakdown</h2>
        <p className="text-sm text-slate-500 mt-1">Active orders, value, and conversion by stage</p>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-1 md:grid-cols-4 gap-3 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{row.label}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Orders</p>
              <p className="text-sm font-bold text-slate-800">{row.count}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Value</p>
              <p className="text-sm font-bold text-slate-800">{fmtMoney(row.value)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Share</p>
              <p className="text-sm font-bold text-slate-800">{row.share}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}