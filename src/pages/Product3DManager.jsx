import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ProductRow from '../components/catalog/ProductRow';
import MegaMenu from '../components/mega-menu/MegaMenu';
import { categories as megaCategories } from '../components/mega-menu/categories';

export default function Product3DManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const urlParams = new URLSearchParams(location.search);
  const projectId = urlParams.get('projectId');
  const activeCategorySlug = urlParams.get('category');
  const activeSubcategorySlug = urlParams.get('subcategory');

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

  // Map mega category to actual product categories
  const getCategoryMapping = (categorySlug) => {
    const categoryMap = {
      'portable-displays': ['Portable Display', 'Portable Displays', 'Banner Stands', 'Accessories', 'Display Elements', 'Counters', 'Info Centers'],
      'hanging-structures': ['Hanging Structure', 'Hanging Structures'],
      'outdoor': ['Flags', 'Outdoor Signs', 'Tents & Canopies'],
      'custom-booths': ['Custom Booth', 'Custom Booths']
    };
    return categoryMap[categorySlug] || [];
  };

  // Get current category info
  const activeCategory = megaCategories.find(c => c.slug === activeCategorySlug);
  const activeCategoryName = activeCategory?.name || null;

  // Filter products based on URL category/subcategory
  const getFilteredProducts = () => {
    if (searchTerm.length >= 2) {
      return products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.product_line?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (activeCategorySlug) {
      const mappedCategories = getCategoryMapping(activeCategorySlug);
      return products.filter(p => 
        mappedCategories.some(cat => p.category?.toLowerCase().includes(cat.toLowerCase()))
      );
    }
    
    return [];
  };

  const filteredProducts = getFilteredProducts();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Mega Menu Navigation */}
      <MegaMenu categories={megaCategories} />

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-1 justify-between">
            <div className="flex items-center gap-3">
              {projectId && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(createPageUrl('BoothDesigner') + '?projectId=' + projectId)}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  title="Back to Project"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  {activeCategoryName || 'Product Catalog'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {searchTerm.length >= 2 
                    ? `${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''} for "${searchTerm}"`
                    : activeCategorySlug 
                    ? `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`
                    : 'Browse by category above or search below'
                  }
                </p>
              </div>
            </div>
            <Link to={createPageUrl('CatalogImport')}>
              <Button variant="outline" className="gap-2 shrink-0">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Import Pages</span>
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name, SKU, or product line..."
            className="pl-10 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        {/* Products List */}
        {filteredProducts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {filteredProducts.map(p => (
              <ProductRow key={p.id} product={p} projectId={projectId} />
            ))}
          </motion.div>
        ) : (searchTerm.length >= 2 || activeCategorySlug) ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg mb-1">No products found</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {searchTerm.length >= 2 
                ? 'Try a different search term' 
                : 'This category is currently empty'}
            </p>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg mb-1">Welcome to the Product Catalog</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Use the menu above to browse by category or search for products</p>
          </div>
        )}
      </div>
    </div>
  );
}