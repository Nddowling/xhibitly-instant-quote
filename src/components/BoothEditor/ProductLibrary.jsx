import React, { useState, useEffect } from 'react';
import { base44 } from '@/lib/base44';
import { BOOTH_KITS, KIT_SIZES, KIT_TIERS } from '@/data/boothKits';

/**
 * Product Library Browser
 *
 * Sidebar catalog of all 345 products:
 * - Search and filter
 * - Category navigation
 * - Drag-and-drop to editor
 * - Quick product details
 * - Starter Kits tab — curated product playlists
 */
export default function ProductLibrary({ onSelectProduct, onSelectKit }) {
  const [activeTab, setActiveTab] = useState('kits'); // 'kits' | 'products'
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [selectedKitSize, setSelectedKitSize] = useState('all');

  // Load products from Base44
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const result = await base44.entities.Product.list({
        where: { is_active: true },
        orderBy: { name: 'asc' }
      });

      setProducts(result);
      setFilteredProducts(result);

      // Extract unique categories
      const cats = [...new Set(result.map(p => p.category))].filter(Boolean);
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  useEffect(() => {
    let filtered = products;

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, products]);

  const handleLoadKit = (kit) => {
    if (onSelectKit) {
      onSelectKit(kit);
    } else if (onSelectProduct) {
      // Fallback: add products one by one
      kit.products.forEach(item => {
        const product = products.find(p => p.sku === item.sku);
        if (product) onSelectProduct(product);
      });
    }
  };

  const filteredKits = selectedKitSize === 'all'
    ? BOOTH_KITS
    : BOOTH_KITS.filter(k => k.size === selectedKitSize);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading catalog...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">

      {/* Tab Toggle */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('kits')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'kits'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ✦ Starter Kits
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
            activeTab === 'products'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          All Products
        </button>
      </div>

      {/* ── KITS TAB ── */}
      {activeTab === 'kits' && (
        <div className="h-full flex flex-col">
          {/* Size filter */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex gap-1 flex-wrap">
              {['all', ...KIT_SIZES].map(size => (
                <button
                  key={size}
                  onClick={() => setSelectedKitSize(size)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedKitSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size === 'all' ? 'All Sizes' : size}
                </button>
              ))}
            </div>
          </div>

          {/* Kits list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredKits.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                onLoad={() => handleLoadKit(kit)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── PRODUCTS TAB ── */}
      {activeTab === 'products' && (
        <>
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
        <input
          type="search"
          placeholder="Search 345 products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Filter */}
      <div className="p-3 border-b border-gray-200">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="all">All Categories ({products.length})</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat} ({products.filter(p => p.category === cat).length})
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No products found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
              />
            ))}
          </div>
        )}
      </div>

          {/* Stats Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Kit Card — the "playlist" item
 */
function KitCard({ kit, onLoad }) {
  const [expanded, setExpanded] = useState(false);
  const tierStyle = KIT_TIERS[kit.tier]?.color || 'bg-gray-100 text-gray-700';

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${kit.accentColor}` }}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{kit.icon}</span>
            <div>
              <h4 className="font-semibold text-sm text-gray-900">{kit.name}</h4>
              <p className="text-xs text-gray-500">{kit.tagline}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tierStyle}`}>
              {kit.tier}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">{kit.size}</span>
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-2 leading-relaxed line-clamp-2">
          {kit.description}
        </p>

        {/* Product count badge row */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {kit.products.length} products
          </span>
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {kit.style}
          </span>
        </div>
      </div>

      {/* Expandable product list */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-2">
          {kit.products.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] font-bold text-gray-400 w-4 shrink-0 mt-0.5">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{item.role}</p>
                <p className="text-[10px] text-gray-500 leading-snug">{item.sku} — {item.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3 pt-1">
        <button
          onClick={onLoad}
          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ backgroundColor: kit.accentColor }}
        >
          Load Kit →
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
    </div>
  );
}

/**
 * Individual Product Card
 */
function ProductCard({ product, onSelect }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
      {/* Product Image */}
      <div
        className="relative h-32 bg-gray-50 flex items-center justify-center"
        onClick={() => onSelect(product)}
      >
        {product.image_cached_url ? (
          <img
            src={product.image_cached_url}
            alt={product.name}
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <div className="text-gray-400 text-xs text-center p-4">
            No image
          </div>
        )}

        {/* Drag indicator */}
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs">
          Click to add
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3">
        <h4 className="font-medium text-sm text-gray-800 line-clamp-2">
          {product.name}
        </h4>

        {product.sku && (
          <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
        )}

        {/* Dimensions */}
        {(product.footprint_w_ft || product.height_ft) && (
          <div className="flex gap-2 mt-2 text-xs text-gray-600">
            {product.footprint_w_ft && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {product.footprint_w_ft.toFixed(1)}' W
              </span>
            )}
            {product.footprint_d_ft && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {product.footprint_d_ft.toFixed(1)}' D
              </span>
            )}
            {product.height_ft && (
              <span className="bg-gray-100 px-2 py-1 rounded">
                {product.height_ft.toFixed(1)}' H
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSelect(product)}
            className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
          >
            Add to Booth
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            {showDetails ? '▲' : 'ℹ️'}
          </button>
        </div>

        {/* Expandable Details */}
        {showDetails && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2 text-xs text-gray-600">
            {product.category && (
              <div>
                <span className="font-medium">Category:</span> {product.category}
              </div>
            )}
            {product.description && (
              <div>
                <span className="font-medium">Description:</span>
                <p className="text-gray-500 mt-1 line-clamp-3">
                  {product.description}
                </p>
              </div>
            )}
            {product.price_tier && (
              <div>
                <span className="font-medium">Tier:</span> {product.price_tier}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
