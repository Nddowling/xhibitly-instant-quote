import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Box, Image, CheckCircle, Loader2, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Product3DManager() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingProduct, setUploadingProduct] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  const checkAuth = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (!currentUser?.is_sales_rep) {
        navigate(createPageUrl('Home'));
        return;
      }
      setUser(currentUser);
      await loadProducts();
    } catch (e) {
      navigate(createPageUrl('Home'));
    }
    setIsLoading(false);
  };

  const loadProducts = async () => {
    const allProducts = await base44.entities.Product.list('-created_date', 1000);
    setProducts(allProducts);
    setFilteredProducts(allProducts);
  };

  const handleFileUpload = async (productId, file, type) => {
    try {
      setUploadProgress(prev => ({ ...prev, [productId + type]: 'uploading' }));
      
      const { data } = await base44.integrations.Core.UploadFile({ file });
      
      const updateData = type === 'model' 
        ? { model_url: data.file_url }
        : { thumbnail_url: data.file_url };
      
      await base44.entities.Product.update(productId, updateData);
      
      setUploadProgress(prev => ({ ...prev, [productId + type]: 'success' }));
      await loadProducts();
      
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [productId + type]: null }));
      }, 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress(prev => ({ ...prev, [productId + type]: 'error' }));
    }
  };

  const handleDimensionsUpdate = async (productId, dimensions) => {
    try {
      await base44.entities.Product.update(productId, {
        model_dimensions: dimensions
      });
      await loadProducts();
    } catch (error) {
      console.error('Failed to update dimensions:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-7xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            3D Product Manager
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Upload and manage 3D models for booth visualization
          </p>
        </motion.div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, SKU, or category..."
                className="pl-10 h-12"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {products.length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Products</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {products.filter(p => p.model_url).length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">With 3D Models</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">
                {products.filter(p => !p.model_url).length}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Missing Models</div>
            </CardContent>
          </Card>
        </div>

        {/* Products List */}
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              uploadProgress={uploadProgress}
              onFileUpload={handleFileUpload}
              onDimensionsUpdate={handleDimensionsUpdate}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-slate-400 dark:text-slate-600 mb-2">No products found</div>
              <div className="text-sm text-slate-500 dark:text-slate-500">
                Try adjusting your search
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, uploadProgress, onFileUpload, onDimensionsUpdate }) {
  const [dimensions, setDimensions] = useState(
    product.model_dimensions || { width: 0, height: 0, depth: 0 }
  );
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveDimensions = () => {
    onDimensionsUpdate(product.id, dimensions);
    setIsEditing(false);
  };

  const modelStatus = uploadProgress[product.id + 'model'];
  const thumbnailStatus = uploadProgress[product.id + 'thumbnail'];

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>{product.sku}</span>
              <Badge variant="outline" className="text-xs">
                {product.category}
              </Badge>
              {product.model_url && (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  <Box className="w-3 h-3 mr-1" />
                  3D Ready
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              ${product.base_price?.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">{product.price_tier}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* 3D Model Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Box className="w-4 h-4" />
              3D Model (GLB/GLTF)
            </Label>
            
            {product.model_url ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-600 dark:text-slate-400 truncate flex-1">
                  {product.model_url.split('/').pop()}
                </span>
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">No model uploaded</div>
            )}
            
            <div className="relative">
              <Input
                type="file"
                accept=".glb,.gltf"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    onFileUpload(product.id, e.target.files[0], 'model');
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={modelStatus === 'uploading'}
              >
                {modelStatus === 'uploading' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                ) : modelStatus === 'success' ? (
                  <><CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Uploaded</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> {product.model_url ? 'Replace' : 'Upload'} Model</>
                )}
              </Button>
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Image className="w-4 h-4" />
              Thumbnail Image
            </Label>
            
            {product.thumbnail_url ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-slate-600 dark:text-slate-400 truncate flex-1">
                  {product.thumbnail_url.split('/').pop()}
                </span>
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">No thumbnail</div>
            )}
            
            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    onFileUpload(product.id, e.target.files[0], 'thumbnail');
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={thumbnailStatus === 'uploading'}
              >
                {thumbnailStatus === 'uploading' ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                ) : thumbnailStatus === 'success' ? (
                  <><CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Uploaded</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> {product.thumbnail_url ? 'Replace' : 'Upload'} Thumbnail</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Model Dimensions */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Model Dimensions (meters)</Label>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-600 dark:text-slate-400">Width</Label>
              <Input
                type="number"
                step="0.1"
                value={dimensions.width || ''}
                onChange={(e) => setDimensions({ ...dimensions, width: parseFloat(e.target.value) || 0 })}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600 dark:text-slate-400">Height</Label>
              <Input
                type="number"
                step="0.1"
                value={dimensions.height || ''}
                onChange={(e) => setDimensions({ ...dimensions, height: parseFloat(e.target.value) || 0 })}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600 dark:text-slate-400">Depth</Label>
              <Input
                type="number"
                step="0.1"
                value={dimensions.depth || ''}
                onChange={(e) => setDimensions({ ...dimensions, depth: parseFloat(e.target.value) || 0 })}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>
          </div>
          
          {isEditing && (
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleSaveDimensions}
                className="flex-1 bg-[#e2231a] hover:bg-[#b01b13]"
                size="sm"
              >
                Save Dimensions
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDimensions(product.model_dimensions || { width: 0, height: 0, depth: 0 });
                  setIsEditing(false);
                }}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}