import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2, Package, ChevronDown, ChevronUp, ArrowUpFromLine, Trash2, RefreshCw, X } from 'lucide-react';

export default function CatalogPageCard({ page, onUpdate, onDelete }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete page ${page.page_number}? This cannot be undone.`)) return;
    setIsDeleting(true);
    await base44.entities.CatalogPage.delete(page.id);
    if (onDelete) onDelete(page.id);
    setIsDeleting(false);
  };

  const handleExtractProducts = async () => {
    if (!page.page_image_url) return;
    setIsExtracting(true);

    const response = await base44.functions.invoke('importCatalogPage', {
      action: 'extract_products',
      page_id: page.id,
      image_url: page.page_image_url,
      page_text: page.page_text
    });

    if (response.data.success && onUpdate) {
      onUpdate({ ...page, products: response.data.products, is_processed: true });
    }
    setIsExtracting(false);
  };

  const handlePushToVariants = async () => {
    setIsPushing(true);
    const response = await base44.functions.invoke('importCatalogPage', {
      action: 'push_to_variants',
      page_id: page.id
    });
    if (response.data.success) {
      alert(`Created ${response.data.created_count} product variants from page ${page.page_number}`);
    }
    setIsPushing(false);
  };

  const handleEnrichProducts = async () => {
    setIsCleaning(true);
    const response = await base44.functions.invoke('processProductImage', {
      action: 'batch_enrich_page',
      page_id: page.id
    });
    if (response.data.success && onUpdate) {
      onUpdate({ ...page, products: response.data.products });
    }
    setIsCleaning(false);
  };

  const products = page.products || [];
  const hasUnenrichedProducts = products.some(p => p.image_url && !p.is_enriched);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Thumbnail */}
          {page.page_image_url ? (
            <img
              src={page.page_image_url}
              alt={`Page ${page.page_number}`}
              className="w-20 h-28 object-cover rounded-lg border border-slate-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setLightboxUrl(page.page_image_url)}
            />
          ) : (
            <div className="w-20 h-28 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-slate-400 text-xs">No img</span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">Page {page.page_number}</h3>
                <p className="text-xs text-slate-500">{page.handbook_name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {page.is_processed ? (
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Processed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">Unprocessed</Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Page text preview */}
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
              {page.page_text || 'No text extracted'}
            </p>

            {/* Product count + actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <Package className="w-3 h-3 mr-1" />
                {products.length} product{products.length !== 1 ? 's' : ''}
              </Badge>

              {page.page_image_url && !page.is_processed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtractProducts}
                  disabled={isExtracting}
                  className="h-7 text-xs"
                >
                  {isExtracting ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                  )}
                  Extract Products
                </Button>
              )}

              {page.page_image_url && page.is_processed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtractProducts}
                  disabled={isExtracting}
                  className="h-7 text-xs"
                >
                  {isExtracting ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1 text-orange-500" />
                  )}
                  Reprocess
                </Button>
              )}

              {products.length > 0 && hasUnenrichedProducts && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEnrichProducts}
                  disabled={isCleaning}
                  className="h-7 text-xs"
                >
                  {isCleaning ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                  )}
                  {isCleaning ? 'Enriching...' : 'Enrich Descriptions'}
                </Button>
              )}

              {products.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePushToVariants}
                    disabled={isPushing}
                    className="h-7 text-xs"
                  >
                    {isPushing ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <ArrowUpFromLine className="w-3 h-3 mr-1 text-blue-500" />
                    )}
                    Push to Catalog
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(!expanded)}
                    className="h-7 text-xs"
                  >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? 'Hide' : 'Show'} Products
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Expanded products list */}
        {expanded && products.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-2">
            {products.map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-100">
                <div className="relative shrink-0">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-14 h-14 object-contain rounded border border-slate-200 bg-white cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxUrl(p.image_url)}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                      <Package className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                  {p.is_enriched && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center" title="Enriched">
                      <Sparkles className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.category} {p.sku ? `• ${p.sku}` : ''}</p>
                  {p.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                </div>
                {p.estimated_price && (
                  <span className="text-sm font-semibold text-[#e2231a] shrink-0">${p.estimated_price.toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Card>
  );
}