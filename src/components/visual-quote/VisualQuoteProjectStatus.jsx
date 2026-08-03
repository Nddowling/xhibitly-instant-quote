import React from 'react';
import { AlertCircle, Check, Cloud } from 'lucide-react';

export default function VisualQuoteProjectStatus({ order, saveStatus, configurationVersion }) {
  if (!order) return null;
  const isSaving = saveStatus === 'saving';
  const isError = saveStatus === 'error';
  const Icon = isError ? AlertCircle : isSaving ? Cloud : Check;
  const label = isError ? 'Save failed' : isSaving ? 'Saving…' : 'Saved';

  return (
    <div className="hidden md:flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="max-w-32 truncate text-[10px] font-bold text-slate-700">{order.reference_number || 'Visual Quote'}</p>
        <p className="text-[9px] text-slate-400">Version {configurationVersion || 0}</p>
      </div>
      <span className={`flex items-center gap-1 text-[9px] font-semibold ${isError ? 'text-red-600' : isSaving ? 'text-blue-600' : 'text-green-600'}`}>
        <Icon className={`h-3 w-3 ${isSaving ? 'animate-pulse' : ''}`} />
        {label}
      </span>
    </div>
  );
}