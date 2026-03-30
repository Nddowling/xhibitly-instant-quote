import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { PAGE_PRODUCTS, MAX_PAGE } from '@/data/catalogPageMapping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import HotspotAuditResults from '@/components/audit/HotspotAuditResults';

function normalizeHotspot(spot) {
  const groupedSkus = Array.from(new Set((spot.groupedSkus?.length ? spot.groupedSkus : [spot.sku]).filter(Boolean)));
  return { ...spot, groupedSkus, sku: groupedSkus[0] || spot.sku };
}

export default function HotspotAudit() {
  const [page, setPage] = useState('62');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const knownProducts = useMemo(() => PAGE_PRODUCTS[Number(page)] || [], [page]);

  const runAudit = async () => {
    const pageNumber = Number(page);
    if (!pageNumber || pageNumber < 1 || pageNumber > MAX_PAGE) return;

    setLoading(true);
    const dbRows = await base44.entities.CatalogHotspot.filter({ page_number: pageNumber });
    const hotspots = (dbRows[0]?.hotspots || []).map(normalizeHotspot);

    const coveredSkuSet = new Set(hotspots.flatMap((spot) => spot.groupedSkus));
    const missingProducts = knownProducts.filter((product) => !coveredSkuSet.has(product.sku));

    const skuCounts = {};
    hotspots.forEach((spot) => {
      spot.groupedSkus.forEach((sku) => {
        skuCounts[sku] = (skuCounts[sku] || 0) + 1;
      });
    });

    const duplicateCoverage = Object.entries(skuCounts)
      .filter(([, count]) => count > 1)
      .map(([sku, count]) => ({ sku, reason: `Shown in ${count} hotspot lists on this page.` }));

    const mismatchedHotspots = hotspots.flatMap((spot) => {
      const issues = [];
      const pageSkuMatches = spot.groupedSkus.filter((sku) => knownProducts.some((p) => p.sku === sku));
      if (spot.groupedSkus.length > 0 && pageSkuMatches.length === 0) {
        issues.push({ ...spot, reason: 'None of the hotspot SKUs match the known products mapped to this page.' });
      }
      if (spot.groupedSkus.length === 0) {
        issues.push({ ...spot, reason: 'This hotspot has no SKU list for the click popup.' });
      }
      return issues;
    });

    setResults({ missingProducts, mismatchedHotspots, duplicateCoverage, hotspots });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">Hotspot Audit</h1>
          <p className="text-sm text-slate-600 mt-2">Review missing products and incorrect hotspot popup SKU lists together.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <Input
              type="number"
              min="1"
              max={MAX_PAGE}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="Catalog page"
              className="sm:w-40"
            />
            <Button onClick={runAudit} disabled={loading} className="bg-[#e2231a] hover:bg-[#b01b13]">
              {loading ? 'Auditing…' : 'Run Audit'}
            </Button>
          </div>
        </div>

        <HotspotAuditResults results={results} />
      </div>
    </div>
  );
}