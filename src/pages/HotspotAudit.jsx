import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import HotspotAuditResults from '@/components/audit/HotspotAuditResults';
import CatalogAuditSummary from '@/components/audit/CatalogAuditSummary';
import { buildPageAudit, summarizeCatalogAudit, buildSuggestedHotspots } from '@/components/audit/hotspotAuditUtils';

export default function HotspotAudit() {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [catalogSummary, setCatalogSummary] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);

  const selectedResults = useMemo(() => {
    if (!catalogSummary || !selectedPage) return null;
    return catalogSummary.pagesNeedingUpdates.find((page) => page.pageNumber === selectedPage) || null;
  }, [catalogSummary, selectedPage]);

  const runFullAudit = async () => {
    setLoading(true);
    const dbRows = await base44.entities.CatalogHotspot.list('page_number', 500);
    const hotspotMap = Object.fromEntries(dbRows.map((row) => [row.page_number, row.hotspots || []]));

    const pageAudits = Array.from({ length: 218 }, (_, index) => {
      const pageNumber = index + 1;
      return buildPageAudit(pageNumber, hotspotMap[pageNumber] || []);
    });

    const summary = summarizeCatalogAudit(pageAudits);
    setCatalogSummary(summary);
    setSelectedPage(summary.pagesNeedingUpdates[0]?.pageNumber || null);
    setLoading(false);
  };

  const applyApprovedUpdate = async () => {
    if (!selectedResults) return;
    setApplying(true);
    const suggestedHotspots = buildSuggestedHotspots(selectedResults);
    const existing = await base44.entities.CatalogHotspot.filter({ page_number: selectedResults.pageNumber });

    if (existing.length > 0) {
      await base44.entities.CatalogHotspot.update(existing[0].id, { hotspots: suggestedHotspots });
    } else {
      await base44.entities.CatalogHotspot.create({ page_number: selectedResults.pageNumber, hotspots: suggestedHotspots });
    }

    const updatedPage = buildPageAudit(selectedResults.pageNumber, suggestedHotspots);
    const updatedPages = catalogSummary.pagesNeedingUpdates
      .map((page) => page.pageNumber === selectedResults.pageNumber ? updatedPage : page)
      .filter((page) => page.hasIssues);

    setCatalogSummary({
      ...catalogSummary,
      pagesNeedingUpdates: updatedPages,
      issueCount: updatedPages.length,
    });
    setSelectedPage(updatedPages[0]?.pageNumber || null);
    setApplying(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">Hotspot Audit</h1>
          <p className="text-sm text-slate-600 mt-2">Scan the full catalog, review pages that need fixes, and approve updates one page at a time.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <Button onClick={runFullAudit} disabled={loading} className="bg-[#e2231a] hover:bg-[#b01b13]">
              {loading ? 'Auditing catalog…' : 'Audit Entire Catalog'}
            </Button>
            {selectedResults && (
              <Button onClick={applyApprovedUpdate} disabled={applying} variant="outline">
                {applying ? 'Applying update…' : `Approve Update for Page ${selectedResults.pageNumber}`}
              </Button>
            )}
          </div>
        </div>

        <CatalogAuditSummary
          summary={catalogSummary}
          selectedPage={selectedPage}
          onSelectPage={setSelectedPage}
        />

        <HotspotAuditResults results={selectedResults} />
      </div>
    </div>
  );
}