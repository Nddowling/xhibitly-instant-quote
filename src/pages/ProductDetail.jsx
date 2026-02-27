import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Package, DollarSign, Tag, Check, Info, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ProductDetail() {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      const pid = urlParams.get('projectId');
      if (pid) setProjectId(pid);

      if (!id) {
        navigate(createPageUrl('Product3DManager'));
        return;
      }
      try {
        const prod = await base44.entities.Product.get(id);
        if (!prod) {
          navigate(createPageUrl('Product3DManager'));
          return;
        }
        setProduct(prod);
      } catch (e) {
        navigate(createPageUrl('Product3DManager'));
      }
      setIsLoading(false);
    };
    fetchProduct();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleAddToProject = async () => {
    if (!projectId) {
        toast.info("Please start a project first");
        navigate(createPageUrl('BoothDesigner'));
        return;
    }
    if (!product) return;
    setIsAdding(true);
    try {
        const design = await base44.entities.BoothDesign.get(projectId);
        const skus = design.product_skus || [];
        for (let i = 0; i < quantity; i++) {
            skus.push(product.sku);
        }
        await base44.entities.BoothDesign.update(projectId, { product_skus: skus });
        toast.success(`Added ${quantity}x ${product.name} to project`);
        setAdded(true);
        setTimeout(() => { setAdded(false); setQuantity(1); }, 3000);
    } catch (err) {
        toast.error('Failed to add product');
    } finally {
        setIsAdding(false);
    }
  };

  if (!product) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 -ml-4 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image Section */}
          <Card className="border-0 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <CardContent className="p-0">
              <div className="aspect-square bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-8">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name} 
                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" 
                  />
                ) : (
                  <Package className="w-32 h-32 text-slate-300" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Section */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {product.category && (
                  <Badge variant="outline" className="bg-slate-100">{product.category}</Badge>
                )}
                {product.product_line && (
                  <Badge variant="outline" className="bg-slate-100">{product.product_line}</Badge>
                )}
                {product.is_rental && (
                  <Badge className="bg-[#e2231a]/10 text-[#e2231a] border-0">Rental Option</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {product.name}
              </h1>
              {product.sku && (
                <p className="text-sm text-slate-500 font-mono">SKU: {product.sku}</p>
              )}
            </div>

            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-4xl font-bold text-slate-900 dark:text-white">
                        ${product.base_price?.toLocaleString() || '0'}
                      </span>
                      <span className="text-slate-500 mb-1">Base Price</span>
                    </div>
                    {product.is_rental && product.rental_price && (
                      <div className="text-sm text-[#e2231a] font-medium mt-1">
                        Rental from ${product.rental_price.toLocaleString()} / event
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-2">
                      Tier: {product.price_tier || 'Standard'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 h-10 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500">-</button>
                      <span className="px-3 font-medium w-8 text-center">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="px-3 h-10 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500">+</button>
                    </div>
                    <Button 
                      size="lg" 
                      variant={added ? "secondary" : "default"}
                      onClick={handleAddToProject} 
                      disabled={isAdding}
                      className={added ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-[#e2231a] hover:bg-[#b01b13]"}
                    >
                      {isAdding ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : added ? <Check className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                      {added ? "Added to Project" : "Add to Project"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {product.description && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-slate-400" />
                  Description
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                  {product.description}
                </div>
              </div>
            )}

            {(product.features?.length > 0 || product.dimensions || product.booth_sizes?.length > 0) && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Tag className="w-5 h-5 text-slate-400" />
                  Specifications
                </h3>
                <div className="space-y-4">
                  {product.dimensions && (
                    <div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">Dimensions: </span>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{product.dimensions}</span>
                    </div>
                  )}
                  {product.booth_sizes?.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white block mb-1">Compatible Booth Sizes: </span>
                      <div className="flex gap-2 flex-wrap">
                        {product.booth_sizes.map(size => (
                          <Badge key={size} variant="secondary">{size}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {product.features?.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white block mb-2">Features: </span>
                      <ul className="space-y-1">
                        {product.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}