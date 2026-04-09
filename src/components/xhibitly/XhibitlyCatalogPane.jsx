import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Package } from 'lucide-react';

function formatPrice(value) {
  if (typeof value !== 'number') return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export default function XhibitlyCatalogPane({ onProductPrompt }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const result = await base44.entities.Product.list('-updated_date', 120);
    setProducts(result || []);
    setLoading(false);
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products.slice(0, 24);
    return products.filter((product) => {
      const haystack = [
        product.sku,
        product.name,
        product.category,
        product.subcategory,
        product.description,
        product.dimensions,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    }).slice(0, 24);
  }, [products, search]);

  return (
    <div className="h-full flex flex-col bg-white/10 backdrop-blur-sm border border-white/10 rounded-[24px] overflow-hidden shadow-[0_18px_40px_rgba(7,18,41,0.18)]">
      <div className="p-5 border-b border-white/10 bg-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-[#18C3F8]/15 text-[#0D4FB3] flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8FE7FF]">Orbus Catalog</p>
            <h2 className="text-xl font-black text-white">Browse Products</h2>
          </div>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, category, or size"
            className="pl-9 h-11 rounded-xl border-white/15 bg-white text-slate-900"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-transparent">
        {loading ? (
          <div className="text-sm text-slate-500">Loading catalog…</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-sm text-slate-500">No matching products found.</div>
        ) : (
          filteredProducts.map((product) => {
            const imageUrl = product.image_cached_url || product.image_url;
            const price = formatPrice(product.base_price || product.retail_price);
            return (
              <Card key={product.id} className="border-slate-200 shadow-none hover:border-[#18C3F8]/40 transition-colors">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold tracking-wide text-[#18C3F8]">{product.sku || 'No SKU'}</p>
                          <h3 className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">{product.name}</h3>
                        </div>
                        {price && <Badge variant="outline" className="text-[#0D4FB3] border-[#0D4FB3]/20">{price}</Badge>}
                      </div>
                      <p className="mt-2 text-xs text-slate-500 line-clamp-2">{product.description || product.category || 'Catalog product'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {product.category && <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>}
                        {product.dimensions && <Badge variant="outline" className="text-[10px]">{product.dimensions}</Badge>}
                      </div>
                      <button
                        onClick={() => onProductPrompt?.(`Show me this product in context and tell me if it fits my booth: ${product.sku} ${product.name}`)}
                        className="mt-3 text-xs font-semibold text-[#0D4FB3] hover:text-[#18C3F8] transition-colors"
                      >
                        Ask agent about this product →
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}