import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CatalogAuditSummary({ summary, selectedPage, onSelectPage }) {
  if (!summary) return null;

  const hasIssues = summary.pagesNeedingUpdates.length > 0;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${hasIssues ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
        <div className="flex items-center gap-2">
          {hasIssues ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
          <p className="text-sm font-semibold text-slate-900">
            {hasIssues ? `${summary.issueCount} pages need updates` : 'No pages need updates'}
          </p>
        </div>
      </div>

      {hasIssues && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Pages to review</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.pagesNeedingUpdates.map((page) => (
              <button
                key={page.pageNumber}
                onClick={() => onSelectPage(page.pageNumber)}
                className={`rounded-xl border p-3 text-left transition-colors ${selectedPage === page.pageNumber ? 'border-[#e2231a] bg-[#e2231a]/5' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <p className="text-sm font-bold text-slate-900">Page {page.pageNumber}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {page.missingProducts.length} missing · {page.mismatchedHotspots.length} mismatched · {page.duplicateCoverage.length} duplicate
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}