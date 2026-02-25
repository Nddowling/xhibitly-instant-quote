import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, BookOpen, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import CatalogImportUploader from '../components/catalog/CatalogImportUploader';
import CatalogPageCard from '../components/catalog/CatalogPageCard';

export default function CatalogImport() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [pages, setPages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser?.is_sales_rep && currentUser?.role !== 'admin') {
        navigate(createPageUrl('Home'));
        return;
      }
      setUser(currentUser);

      const allPages = await base44.entities.CatalogPage.list('-page_number', 500);
      setPages(allPages.sort((a, b) => a.page_number - b.page_number));
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
    setIsLoading(false);
  };

  const handleImportComplete = (newPage) => {
    setPages(prev => {
      const existing = prev.findIndex(p => p.page_number === newPage.page_number);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...newPage };
        return updated;
      }
      return [...prev, newPage].sort((a, b) => a.page_number - b.page_number);
    });
  };

  const handlePageUpdate = (updatedPage) => {
    setPages(prev => prev.map(p => p.id === updatedPage.id ? updatedPage : p));
  };

  const handlePageDelete = (deletedId) => {
    setPages(prev => prev.filter(p => p.id !== deletedId));
  };

  const filteredPages = searchTerm.length >= 2
    ? pages.filter(p => {
        const q = searchTerm.toLowerCase();
        const textMatch = (p.page_text || '').toLowerCase().includes(q);
        const productMatch = (p.products || []).some(prod =>
          (prod.name || '').toLowerCase().includes(q) ||
          (prod.category || '').toLowerCase().includes(q)
        );
        const pageMatch = String(p.page_number) === searchTerm;
        return textMatch || productMatch || pageMatch;
      })
    : pages;

  const processedCount = pages.filter(p => p.is_processed).length;
  const totalProducts = pages.reduce((sum, p) => sum + (p.products || []).length, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Product3DManager'))}
              className="text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-[#e2231a]" />
                Catalog Import
              </h1>
              <p className="text-slate-500 text-sm">
                Import PDF catalog pages and extract products
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{pages.length}</p>
                <p className="text-xs text-slate-500">Pages Imported</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{processedCount}</p>
                <p className="text-xs text-slate-500">Processed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-[#e2231a]">{totalProducts}</p>
                <p className="text-xs text-slate-500">Products Found</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Upload Section */}
        <div className="mb-6">
          <CatalogImportUploader onImportComplete={handleImportComplete} />
        </div>

        {/* Search + Refresh */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by page number, product name, or category..."
              className="pl-9 bg-white"
            />
          </div>
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Page List */}
        <div className="space-y-3">
          {filteredPages.length > 0 ? (
            filteredPages.map(page => (
              <CatalogPageCard
                key={page.id}
                page={page}
                onUpdate={handlePageUpdate}
              />
            ))
          ) : (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-lg">
                {searchTerm ? 'No pages match your search' : 'No catalog pages imported yet'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Upload a JSON file above to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}