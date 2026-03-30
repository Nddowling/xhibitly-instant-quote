import React from 'react';
import { AlertTriangle, CheckCircle2, PackageSearch } from 'lucide-react';

export default function HotspotAuditResults({ results }) {
  if (!results) return null;

  const { missingProducts = [], mismatchedHotspots = [], duplicateCoverage = [], productsWithImageIssues = [] } = results;
  const hasIssues = missingProducts.length || mismatchedHotspots.length || duplicateCoverage.length || productsWithImageIssues.length;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border p-4 ${hasIssues ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
        <div className="flex items-center gap-2">
          {hasIssues ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
          <p className="text-sm font-semibold text-slate-900">
            {hasIssues ? 'Audit found items to review' : 'This page looks fully represented'}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <PackageSearch className="w-4 h-4 text-[#e2231a]" />
          <h3 className="text-sm font-bold text-slate-900">Missing products</h3>
        </div>
        {results.pageNumber && <p className="text-xs text-slate-500 mb-3">Page {results.pageNumber}</p>}
        {missingProducts.length ? (
          <div className="space-y-2">
            {missingProducts.map((item) => (
              <div key={item.sku} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-900">{item.sku}</p>
                <p className="text-xs text-slate-600 mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No missing products found.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Hotspot SKU list issues</h3>
        {mismatchedHotspots.length ? (
          <div className="space-y-2">
            {mismatchedHotspots.map((item, index) => (
              <div key={`${item.sku}-${index}`} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-900">{item.name || item.sku}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">{item.groupedSkus?.join(', ')}</p>
                <p className="text-xs text-slate-600 mt-2">{item.reason}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No hotspot SKU list issues found.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Duplicate coverage</h3>
        {duplicateCoverage.length ? (
          <div className="space-y-2">
            {duplicateCoverage.map((item, index) => (
              <div key={`${item.sku}-${index}`} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-900">{item.sku}</p>
                <p className="text-xs text-slate-600 mt-1">{item.reason}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No duplicate hotspot coverage found.</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Image file issues</h3>
        {productsWithImageIssues.length ? (
          <div className="space-y-2">
            {productsWithImageIssues.map((item) => (
              <div key={item.sku} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-900">{item.sku}</p>
                <p className="text-xs text-slate-600 mt-1">{item.name}</p>
                <p className="text-xs text-slate-500 mt-2">
                  {!item.hasImage ? 'No image found.' : item.isDefaultImage ? 'Using a default or generic image.' : item.isCatalogPageFallback ? 'Using a catalog page image instead of a product image.' : 'Needs image review.'}
                </p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No image file issues found.</p>}
      </section>
    </div>
  );
}