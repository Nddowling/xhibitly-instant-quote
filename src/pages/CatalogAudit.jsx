import { useState, useMemo, useEffect } from 'react';
import rawMapping from '../../orbus_catalog/product_catalog_page_mapping.json';
import { base44 } from '@/api/base44Client';

// ── Static catalog mapping ────────────────────────────────────────────────────
const mappingSkus = new Set(rawMapping.product_page_mapping.map(p => p.product_sku));
const mappingBySku = {};
for (const p of rawMapping.product_page_mapping) mappingBySku[p.product_sku] = p;

function buildAuditData(dbRows) {
  // Convert DB rows [{page_number, hotspots:[]}] to {pageNum: spots[]} map
  const hotspotsData = {};
  for (const row of dbRows) {
    if (row.page_number && Array.isArray(row.hotspots)) {
      hotspotsData[row.page_number] = row.hotspots;
    }
  }

  const hotspotPrimarySkus = new Set();
  const hotspotGroupedSkus = new Set();
  const primaryNotInGrouped = [];
  const emptyGrouped = [];
  const duplicatesPerPage = {};

  for (const [page, spots] of Object.entries(hotspotsData)) {
    const seen = new Set();
    const dupes = [];

    for (const spot of spots) {
      hotspotPrimarySkus.add(spot.sku);
      const grouped = spot.groupedSkus || [];

      for (const gsku of grouped) {
        hotspotGroupedSkus.add(gsku);
        if (seen.has(gsku)) dupes.push(gsku);
        seen.add(gsku);
      }

      if (grouped.length === 0) {
        emptyGrouped.push({ page: Number(page), sku: spot.sku, name: spot.name });
      } else if (!grouped.includes(spot.sku)) {
        primaryNotInGrouped.push({ page: Number(page), sku: spot.sku, name: spot.name });
      }
    }

    if (dupes.length) duplicatesPerPage[page] = dupes;
  }

  const allHotspotSkus = new Set([...hotspotPrimarySkus, ...hotspotGroupedSkus]);

  const missingFromHotspots = [...mappingSkus]
    .filter(s => !allHotspotSkus.has(s))
    .map(sku => {
      const p = mappingBySku[sku];
      return { sku, name: p.product_name, category: p.category, primaryPage: p.primary_page, pages: p.pages };
    })
    .sort((a, b) => a.primaryPage - b.primaryPage);

  const extraInHotspots = [...allHotspotSkus].filter(s => !mappingSkus.has(s));

  return {
    totalPages: Object.keys(hotspotsData).length,
    allHotspotSkus,
    missingFromHotspots,
    extraInHotspots,
    primaryNotInGrouped,
    emptyGrouped,
    duplicatesPerPage,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const severityColor = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  info:     'bg-blue-100 text-blue-800 border-blue-200',
  good:     'bg-green-100 text-green-800 border-green-200',
};

function Badge({ children, severity = 'info' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityColor[severity]}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, severity, sub }) {
  return (
    <div className={`rounded-lg border p-4 ${severityColor[severity]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CatalogAudit() {
  const [activeTab, setActiveTab] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [fixedItems, setFixedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const dbRows = await base44.entities.CatalogHotspot.list('page_number', 500);
      setAudit(buildAuditData(dbRows));
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Failed to load hotspots from DB:', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadAudit(); }, []);

  const categories = useMemo(() => {
    if (!audit) return ['All'];
    const cats = new Set(audit.missingFromHotspots.map(p => p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [audit]);

  const filteredMissing = useMemo(() => {
    if (!audit) return [];
    return audit.missingFromHotspots.filter(item => {
      const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
      const matchSearch = !search || item.sku.toLowerCase().includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [audit, categoryFilter, search]);

  const markFixed = (sku) => setFixedItems(prev => new Set([...prev, sku]));

  const TABS = audit ? [
    'Overview',
    `Missing (${audit.missingFromHotspots.length})`,
    `Extra (${audit.extraInHotspots.length})`,
    `Primary Not In Grouped (${audit.primaryNotInGrouped.length})`,
    `Empty Grouped (${audit.emptyGrouped.length})`,
    `Duplicates (${Object.keys(audit.duplicatesPerPage).length})`,
  ] : ['Overview', 'Missing', 'Extra', 'Primary Not In Grouped', 'Empty Grouped', 'Duplicates'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading live hotspot data from database…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catalog SKU Audit</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live DB — <strong>{mappingSkus.size} SKUs</strong> in page mapping vs{' '}
              <strong>{audit?.allHotspotSkus.size ?? 0} SKUs</strong> across{' '}
              <strong>{audit?.totalPages ?? 0} hotspot pages</strong>
              {lastRefresh && <span className="ml-2 text-gray-400">· Last refreshed {lastRefresh}</span>}
            </p>
          </div>
          <button
            onClick={loadAudit}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border p-1 w-fit flex-wrap">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === i ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 0 && audit && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard label="Total Catalog SKUs" value={mappingSkus.size} severity="info" sub="In page mapping" />
              <StatCard label="SKUs in Hotspots" value={audit.allHotspotSkus.size} severity="info" sub="Primary + grouped (live DB)" />
              <StatCard label="Missing from Hotspots" value={audit.missingFromHotspots.length} severity="critical" sub="In catalog, no hotspot" />
              <StatCard label="Extra in Hotspots" value={audit.extraInHotspots.length} severity="warning" sub="In hotspot, not catalog" />
              <StatCard label="Primary Not in Grouped" value={audit.primaryNotInGrouped.length} severity="warning" sub="Easy auto-fix" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Hotspots with Empty Grouped" value={audit.emptyGrouped.length} severity="info" sub="Single-SKU hotspots (may be intentional)" />
              <StatCard label="Pages with Duplicate SKUs" value={Object.keys(audit.duplicatesPerPage).length} severity="warning" sub="Same SKU listed twice on a page" />
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-900">Issue Summary</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Issue</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Count</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Severity</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">SKUs in catalog with no hotspot</td>
                    <td className="px-4 py-3">{audit.missingFromHotspots.length}</td>
                    <td className="px-4 py-3"><Badge severity="critical">Critical</Badge></td>
                    <td className="px-4 py-3 text-gray-500">Add hotspots in catalog editor or via re-analyze</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">SKUs in hotspots not in catalog mapping</td>
                    <td className="px-4 py-3">{audit.extraInHotspots.length}</td>
                    <td className="px-4 py-3"><Badge severity="warning">Warning</Badge></td>
                    <td className="px-4 py-3 text-gray-500">Verify or replace with real SKUs</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">Primary SKU not in its own groupedSkus list</td>
                    <td className="px-4 py-3">{audit.primaryNotInGrouped.length}</td>
                    <td className="px-4 py-3"><Badge severity="warning">Warning</Badge></td>
                    <td className="px-4 py-3 text-gray-500">Auto-fixable — primary should always be in grouped</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">Hotspots with empty groupedSkus</td>
                    <td className="px-4 py-3">{audit.emptyGrouped.length}</td>
                    <td className="px-4 py-3"><Badge severity="info">Info</Badge></td>
                    <td className="px-4 py-3 text-gray-500">Single-SKU hotspots — review if variants exist</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">Duplicate SKUs within a page's hotspots</td>
                    <td className="px-4 py-3">{Object.keys(audit.duplicatesPerPage).length} pages</td>
                    <td className="px-4 py-3"><Badge severity="warning">Warning</Badge></td>
                    <td className="px-4 py-3 text-gray-500">Same SKU in multiple hotspots on same page</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MISSING FROM HOTSPOTS ── */}
        {activeTab === 1 && audit && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <strong>{audit.missingFromHotspots.length} SKUs</strong> are in the catalog page mapping but have no clickable hotspot in the live DB. End users cannot click to view or add these products.
            </div>
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm w-64 bg-white"
              />
              <div className="flex gap-1 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      categoryFilter === cat ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-sm text-gray-500">{filteredMissing.length} results</div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">SKU</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Name</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Category</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Primary Page</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Also on Pages</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredMissing.map(item => (
                    <tr key={item.sku} className={`hover:bg-gray-50 ${fixedItems.has(item.sku) ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2 font-mono text-xs text-red-700">{item.sku}</td>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2"><Badge severity="info">{item.category}</Badge></td>
                      <td className="px-4 py-2 text-center font-medium">{item.primaryPage}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{item.pages.filter(p => p !== item.primaryPage).join(', ') || '—'}</td>
                      <td className="px-4 py-2">
                        {fixedItems.has(item.sku)
                          ? <Badge severity="good">Marked Fixed</Badge>
                          : <button onClick={() => markFixed(item.sku)} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100">Mark Fixed</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EXTRA IN HOTSPOTS ── */}
        {activeTab === 2 && audit && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <strong>{audit.extraInHotspots.length} SKUs</strong> exist in live hotspots but are not in the catalog page mapping. Verify or replace with real SKUs.
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">SKU</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Issue</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {audit.extraInHotspots.map(sku => (
                    <tr key={sku} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-yellow-700">{sku}</td>
                      <td className="px-4 py-2">
                        {sku.startsWith('BANNER-') ? <Badge severity="warning">Placeholder SKU</Badge> : <Badge severity="info">Not in catalog mapping</Badge>}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {sku.startsWith('BANNER-') ? 'Replace with real banner stand SKU from catalog mapping'
                          : (sku === 'LUM-LED7-ORL-B' || sku === 'LUM-LED7-ORL-B-EXT') ? 'Add this SKU to product_catalog_page_mapping.json'
                          : 'Verify SKU exists in Orbus catalog'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PRIMARY NOT IN GROUPED ── */}
        {activeTab === 3 && audit && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <strong>{audit.primaryNotInGrouped.length} hotspots</strong> have a primary SKU not included in their own <code>groupedSkus</code> array — that product won't appear in the variant picker when clicked.
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Page</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Primary SKU</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Hotspot Name</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {audit.primaryNotInGrouped.map(item => (
                    <tr key={item.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{item.page}</td>
                      <td className="px-4 py-2 font-mono text-xs text-yellow-700">{item.sku}</td>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        Add <code className="bg-gray-100 px-1 rounded">{item.sku}</code> to position 0 of groupedSkus on page {item.page}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EMPTY GROUPED ── */}
        {activeTab === 4 && audit && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <strong>{audit.emptyGrouped.length} hotspots</strong> have an empty <code>groupedSkus</code> array. When clicked, only the primary SKU will be available.
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Page</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">SKU</th>
                      <th className="text-left px-4 py-2 text-gray-600 font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {audit.emptyGrouped.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{item.page}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600">{item.sku}</td>
                        <td className="px-4 py-2">{item.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── DUPLICATES ── */}
        {activeTab === 5 && audit && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <strong>{Object.keys(audit.duplicatesPerPage).length} pages</strong> have the same SKU in multiple hotspot grouped lists.
            </div>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Page</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Duplicate SKUs</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(audit.duplicatesPerPage).map(([page, dupes]) => (
                    <tr key={page} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{page}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {dupes.map(sku => (
                            <span key={sku} className="font-mono text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200">{sku}</span>
                          ))}
                        </div>
                      </td>
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
