import React, { useEffect, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { base44 } from '@/api/base44Client';
import ProductCard from '../components/ProductCard';
import CategoryFilter from '../components/CategoryFilter';

export default function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const all = await base44.entities.StoreProduct.filter({ in_stock: true }, 'sort_order', 100);
      setProducts(all);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => {
    const matchesCat = !category || p.category === category;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      p.name?.toLowerCase().includes(q) ||
      p.short_description?.toLowerCase().includes(q) ||
      p.tags?.some(t => t.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-12 py-12">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">All Products</h1>
        <p className="text-white/45 text-sm">Science-backed biohacking & recovery tools</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <CategoryFilter value={category} onChange={setCategory} />
        <div className="relative md:ml-auto md:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00c9a7] h-9"
          />
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-sm text-white/35 mb-6">
          {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          {category || search ? ' found' : ''}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-white/8">
              <Skeleton className="aspect-square bg-white/5" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-3 w-20 bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
                <Skeleton className="h-8 w-full bg-white/5 mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <SlidersHorizontal className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No products found</p>
          <p className="text-sm mt-1">Try adjusting your filters or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
