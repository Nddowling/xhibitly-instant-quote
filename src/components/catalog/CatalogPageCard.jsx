import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2, Package, ChevronDown, ChevronUp, ArrowUpFromLine } from 'lucide-react';

export default function CatalogPageCard({ page, onUpdate }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const products = page.products || [];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Thumbnail */}
          {page.page_image_url ? (
            <img
              src={page.page_image_url}
              alt={`Page ${page.page_number}`}
              className="w-20 h-28 object-cover rounded-lg border border-slate-200 shrink-0"
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
              <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.category} {p.sku ? `• ${p.sku}` : ''}</p>
                  {p.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                  )}
                </div>
                {p.estimated_price && (
                  <span className="text-sm font-semibold text-[#e2231a]">${p.estimated_price.toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}