import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CategoryCard from '../components/catalog/CategoryCard';
import ProductRow from '../components/catalog/ProductRow';

const ALL_CATEGORIES = [
  'Portable Displays',
  'Fabric Structures',
  'Modular Exhibits',
  'Outdoor Displays',
  'Blaze SEG Light Boxes',
  'Rental Displays',
  'Vector Fast Frame',
  'Wall Signs',
  'Retail Displays'
];

export default function Product3DManager() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser?.is_sales_rep) {
        navigate(createPageUrl('Home'));
        return;
      }
      setUser(currentUser);
      const allProducts = await base44.entities.Product.list('-created_date', 1000);
      setProducts(allProducts);
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
    setIsLoading(false);
  };

  // Search across all products
  const searchResults = searchTerm.length >= 2
    ? products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.product_line?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  // Products in active category
  const categoryProducts = activeCategory
    ? products.filter(p => p.category === activeCategory)
    : [];

  // Count per category
  const categoryCounts = {};
  ALL_CATEGORIES.forEach(cat => {
    categoryCounts[cat] = products.filter(p => p.category === cat).length;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-7xl mx-auto p-4 md:p-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1 justify-between">
          <div className="flex items-center gap-3">
            {activeCategory && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveCategory(null)}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                {activeCategory || 'Product Catalog'}
              </h1>
              <p className="text-slate-500 text-sm">
                {activeCategory
                  ? `${categoryProducts.length} product${categoryProducts.length !== 1 ? 's' : ''}`
                  : `${products.length} products across ${ALL_CATEGORIES.length} categories`
                }
              </p>
              </div>
              </div>
              {!activeCategory && (
              <Link to={createPageUrl('CatalogImport')}>
                <Button variant="outline" className="gap-2 shrink-0">
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">Import Pages</span>
                </Button>
              </Link>
              )}
              </div>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value.length >= 2) setActiveCategory(null);
            }}
            placeholder="Search products by name, SKU, or product line..."
            className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        {/* Search Results */}
        {searchTerm.length >= 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <p className="text-sm text-slate-500 mb-3">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchTerm}"
            </p>
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map(p => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                No products match your search.
              </div>
            )}
          </motion.div>
        )}

        {/* Category Grid */}
        {!activeCategory && searchTerm.length < 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {ALL_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <CategoryCard
                  category={cat}
                  productCount={categoryCounts[cat]}
                  onClick={() => {
                    setActiveCategory(cat);
                    setSearchTerm('');
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Category Detail View */}
        {activeCategory && searchTerm.length < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {categoryProducts.length > 0 ? (
              <div className="space-y-2">
                {categoryProducts.map(p => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-slate-400 text-lg mb-1">No products in this category yet</p>
                <p className="text-slate-300 text-sm">Products will appear here once added to the catalog.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}