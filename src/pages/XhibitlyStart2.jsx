import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CatalogQuote from '@/pages/CatalogQuote';
import XhibitlyAgentPane from '@/components/xhibitly/XhibitlyAgentPane';
import BoothPreviewPanel from '@/components/xhibitly/BoothPreviewPanel';
import SessionStartModal from '@/components/catalog/SessionStartModal';

export default function XhibitlyStart2() {
  const navigate = useNavigate();
  const [previewOrder, setPreviewOrder] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [queuedPromptForCatalog, setQueuedPromptForCatalog] = useState('');
  const [previewLineItems, setPreviewLineItems] = useState([]);
  const [previewPricingResult, setPreviewPricingResult] = useState(null);
  const [previewBrandWebsite, setPreviewBrandWebsite] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewStatus, setPreviewStatus] = useState('');

  const handleGeneratePreview = async ({ website_url = '' } = {}) => {
    if (!previewOrder || previewLineItems.length === 0 || isGeneratingPreview) return;

    const cleanWebsite = website_url.trim() || previewOrder?.website_url || '';
    const boothSize = previewOrder?.booth_size || '10x10';
    const boothType = previewOrder?.booth_type || 'Inline';
    const brandName = previewOrder?.customer_company || previewOrder?.customer_name || 'Client brand';
    const showName = previewOrder?.show_name || 'Convention event';
    const quoteItems = previewLineItems
      .map((item) => ({
        sku: item?.sku || '',
        name: item?.product_name || item?.sku || 'Quoted product',
        image_url: item?.image_url || '',
        quantity: item?.quantity || 1,
      }))
      .filter((item) => item.sku || item.name);
    const productImageUrls = quoteItems.map((item) => item.image_url).filter(Boolean).slice(0, 6);

    setPreviewBrandWebsite(cleanWebsite);
    setIsGeneratingPreview(true);
    setPreviewStatus(cleanWebsite ? 'Pulling brand details and generating render…' : 'Generating booth preview…');
    setPreviewOrder((prev) => prev ? { ...prev, booth_rendering_url: '' } : prev);

    try {
      const response = await base44.functions.invoke('generateBoothRender', {
        website_url: cleanWebsite,
        brand_name: brandName,
        booth_size: boothSize,
        booth_type: boothType,
        show_name: showName,
        quote_items: quoteItems,
        reference_urls: productImageUrls,
      });

      const renderUrl = response?.data?.url;
      if (!renderUrl) {
        throw new Error(response?.data?.error || 'No booth render image was returned');
      }

      setPreviewOrder((prev) => prev ? {
        ...prev,
        website_url: cleanWebsite || prev?.website_url,
        booth_rendering_url: renderUrl,
      } : prev);
      setPreviewStatus('');
      toast.success('Booth preview is ready.');
    } catch (error) {
      setPreviewStatus('');
      toast.error(error?.message || 'Preview generation failed. Please try again.');
    }

    setIsGeneratingPreview(false);
  };

  const resetPreviewRenderState = () => {
    setPreviewOrder((prev) => prev ? { ...prev, booth_rendering_url: '' } : prev);
    setIsGeneratingPreview(false);
    setPreviewStatus('');
  };

  const handleGenerateQuote = async () => {
    if (!previewOrder?.id || previewLineItems.length === 0) return;

    let shareToken = previewOrder.share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID();
      await base44.entities.Order.update(previewOrder.id, {
        share_token: shareToken,
        status: previewOrder.status === 'Draft' || previewOrder.status === 'Pending' ? 'Quoted' : previewOrder.status,
      });
      setPreviewOrder((prev) => prev ? { ...prev, share_token: shareToken, status: prev.status === 'Draft' || prev.status === 'Pending' ? 'Quoted' : prev.status } : prev);
    }

    navigate(`/QuoteView?token=${shareToken}&edit=1`);
  };

  const startFreshQuote = () => {
    setPreviewOrder(null);
    setPreviewLineItems([]);
    setPreviewPricingResult(null);
    setPreviewBrandWebsite('');
    setQueuedPromptForCatalog('');
    setIsGeneratingPreview(false);
    setPreviewStatus('');
    setShowSessionModal(true);
  };

  const handleSessionComplete = (order) => {
    setPreviewOrder(order || null);
    setPreviewLineItems([]);
    setPreviewPricingResult(null);
    setPreviewBrandWebsite(order?.website_url || '');
    setQueuedPromptForCatalog('');
    setIsGeneratingPreview(false);
    setPreviewStatus('');
    setShowSessionModal(false);
  };

  const handleQuantityChange = async (item, value) => {
    if (!item?.id) return;
    const parsedQty = parseInt(value, 10);
    const newQty = Number.isNaN(parsedQty) ? 1 : Math.max(1, parsedQty);
    const total_price = parseFloat((newQty * (item.unit_price || 0)).toFixed(2));

    await base44.entities.LineItem.update(item.id, {
      quantity: newQty,
      total_price,
    });

    setPreviewLineItems((prev) => prev.map((entry) => (
      entry.id === item.id ? { ...entry, quantity: newQty, total_price } : entry
    )));
    resetPreviewRenderState();
  };

  const handleRemovePreviewItem = async (item) => {
    if (!item?.id) return;
    await base44.entities.LineItem.delete(item.id);
    setPreviewLineItems((prev) => prev.filter((entry) => entry.id !== item.id));
    resetPreviewRenderState();
  };

  useEffect(() => {
    const handleCatalogPrompt = (event) => {
      const prompt = event?.detail?.prompt || '';
      if (!prompt) return;
      setQueuedPromptForCatalog(prompt);
    };

    const handleNewQuote = () => {
      startFreshQuote();
    };

    window.addEventListener('xhibitly:catalog-prompt', handleCatalogPrompt);
    window.addEventListener('xhibitly:new-quote', handleNewQuote);
    return () => {
      window.removeEventListener('xhibitly:catalog-prompt', handleCatalogPrompt);
      window.removeEventListener('xhibitly:new-quote', handleNewQuote);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,195,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(13,79,179,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(13,79,179,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(13,79,179,0.08) 1px, transparent 1px)', backgroundSize: '46px 46px' }} />
      <div className="relative z-10 px-4 md:px-8 py-4 md:py-6">
        <div className="max-w-[1560px] mx-auto">
          {showSessionModal && (
            <SessionStartModal
              onComplete={handleSessionComplete}
              onDismiss={() => setShowSessionModal(false)}
            />
          )}

          <div className="flex items-center justify-center mb-5 md:mb-6">
            <div className="rounded-2xl overflow-hidden">
              <img src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/f3c8fd783_IMG_1062.png" alt="Xhibitly" className="h-10 md:h-12 w-auto object-contain block rounded-[28px]" />
            </div>
          </div>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(720px,1.65fr)_minmax(340px,1fr)] items-start min-h-[calc(100vh-24px)]">
            <section className="min-w-0 h-auto lg:h-[calc(100vh-8px)] lg:sticky lg:top-2">
              <BoothPreviewPanel
                order={previewOrder}
                lineItems={previewLineItems}
                pricingResult={previewPricingResult}
                brandWebsite={previewBrandWebsite}
                onGeneratePreview={handleGeneratePreview}
                onGenerateQuote={handleGenerateQuote}
                onRemoveItem={handleRemovePreviewItem}
                onQuantityChange={handleQuantityChange}
                isGeneratingPreview={isGeneratingPreview}
                previewStatus={previewStatus}
              />
            </section>

            <section className="min-w-0 rounded-[24px] md:rounded-[30px] overflow-hidden border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.10)] min-h-[70vh] lg:h-[calc(100vh-8px)]">
              <div className="h-full bg-white">
                <CatalogQuote
                  embeddedMode
                  initialPrompt={queuedPromptForCatalog}
                  onOrderChange={setPreviewOrder}
                  onLineItemsChange={setPreviewLineItems}
                  onPricingResult={setPreviewPricingResult}
                />
              </div>
            </section>

            <section className="min-w-0 rounded-[24px] md:rounded-[30px] bg-white/96 backdrop-blur border border-white shadow-[0_25px_70px_rgba(15,23,42,0.12)] overflow-hidden min-h-[560px] lg:h-[calc(100vh-8px)] lg:sticky lg:top-2">
              <XhibitlyAgentPane />
            </section>
          </div>

          <p className="text-center text-xs md:text-sm text-slate-500 mt-4">The Speed of AI. The Power of The Handbook.</p>
        </div>
      </div>
    </div>
  );
}