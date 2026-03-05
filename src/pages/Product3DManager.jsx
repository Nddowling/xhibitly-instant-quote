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
import MegaMenu from '@/components/mega-menu/MegaMenu';
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

  // Get current category display name for the heading
  const activeCategory = megaCategories.find(c => c.slug === activeCategorySlug);
  const activeCategoryName = activeCategory?.name || null;

  let activeSubcategoryName = null;
  if (activeCategory && activeSubcategorySlug) {
    for (const sub of activeCategory.subcategories) {
      const found = sub.children?.find(c => c.slug === activeSubcategorySlug);
      if (found) { activeSubcategoryName = found.name; break; }
    }
  }

  // Mapping from mega-menu slugs → actual DB category values
  const SLUG_TO_DB_CATEGORIES = {
    // Portable Displays
    'portable-displays': ['Retractable', 'Telescopic', 'Collapsible Displays', 'Bar Counter', 'Xclaim Fabric Popup'],
    'retractable': ['Retractable'],
    'telescopic': ['Telescopic'],
    'spring-back': ['Xclaim Fabric Popup'],
    // Fabric Displays
    'fabric-displays': ['Master', 'Designer', 'Essential Lite', 'Hopup Tension Fabric', 'Embrace Tension Fabric', 'Modulate', 'Vector Fast Frame', 'Fabric Banners'],
    'fabric-banners': ['Fabric Banners', 'Modulate'],
    'light-boxes': ['Freestanding', 'Blaze Wall Mounted', 'Fabric Light Boxes'],
    'table-covers': ['Embrace Tension Fabric'],
    // Hanging Structures
    'hanging-structures': ['Towers', 'Arches', 'Architectural Structures'],
    'ring-structures': ['Towers'],
    'square-structures': ['Architectural Structures'],
    'other-hanging': ['Arches'],
    // Display Components
    'display-components': ['Counters', 'Fabric Counters', 'Info Centers', 'Fabric Kiosks', 'Modular Kiosks', 'Display Lighting', 'Bar Counter'],
    'counters': ['Counters', 'Fabric Counters', 'Bar Counter'],
    'info-centers': ['Info Centers', 'Fabric Kiosks', 'Modular Kiosks'],
    'sign-stands': ['Signs'],
    // Modular Displays
    'modular-displays': ['10 Inline', '20 Inline', 'Hybrid Pro Modular Displays', 'Island Exhibits', 'Formulate Fabric Structures'],
    '10x10-kits': ['10 Inline', 'Embrace Tension Fabric'],
    '20x20-kits': ['20 Inline', 'Island Exhibits'],
    'retail-displays': ['Collapsible Displays'],
    // Outdoor
    'outdoor': ['Banners Flags', 'Tents', 'Signs'],
    'flags': ['Banners Flags'],
    'tents': ['Tents'],
    // Accessories
    'accessories': ['Display Lighting', 'Shipping Cases'],
    'display-lighting': ['Display Lighting'],
    'shipping-cases': ['Shipping Cases'],
    'hardware-kits': ['Shipping Cases'],
  };

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

    if (!activeCategorySlug) return products;

    // Use the subcategory slug if present, otherwise the category slug
    const slug = activeSubcategorySlug || activeCategorySlug;
    const dbCategories = SLUG_TO_DB_CATEGORIES[slug];
    if (!dbCategories) return products;

    return products.filter(p => dbCategories.includes(p.category));
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
                  {activeSubcategoryName || activeCategoryName || 'Product Catalog'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {searchTerm.length >= 2 
                    ? `${filteredProducts.length} result${filteredProducts.length !== 1 ? 's' : ''} for "${searchTerm}"`
                    : `${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`
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
        ) : (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg mb-1">No products found</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {searchTerm.length >= 2 
                ? 'Try a different search term' 
                : 'This category is currently empty'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}