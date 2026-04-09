import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { base44 } from '@/api/base44Client';
import ProductCard from '../components/ProductCard';
import { normalizeStoreProduct, getStoreCategories } from '../lib/storeProductAdapter';

export default function OrbusProductCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.entities.Product.list('name', 500).then((all) => {
      setProducts((all || []).filter(product => product.is_active !== false).map(normalizeStoreProduct).filter(product => product.price > 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => getStoreCategories(products), [products]);
  const filtered = useMemo(() => products.filter((product) => {
    const query = search.toLowerCase();
    const matchesCategory = !category || product.category === category;
    const matchesSearch = !query || [product.name, product.sku, product.short_description].some(value => String(value || '').toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  }), [products, category, search]);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">Orbus Product Store</h1>
        <p className="text-white/45 text-sm">Browse individual products available for self-serve purchase.</p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          <FilterPill active={category === ''} onClick={() => setCategory('')}>All Products</FilterPill>
          {categories.map((item) => (
            <FilterPill key={item} active={category === item} onClick={() => setCategory(item)}>{item}</FilterPill>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU" className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#e2231a] h-10" />
        </div>
      </div>

      {!loading && <p className="text-sm text-white/35 mb-6">{filtered.length} {filtered.length === 1 ? 'product' : 'products'}</p>}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-white/8">
              <Skeleton className="aspect-square bg-white/5" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-20 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
}

function FilterPill({ children, active, onClick }) {
  return (
    <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${active ? 'bg-[#e2231a] text-white border-[#e2231a]' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/25 hover:text-white'}`}>
      {children}
    </button>
  );
}