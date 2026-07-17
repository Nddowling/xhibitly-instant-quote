import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CatalogQuote from '@/pages/CatalogQuote';
import XhibitlyAgentPane from '@/components/xhibitly/XhibitlyAgentPane';
import BoothPreviewPanel from '@/components/xhibitly/BoothPreviewPanel';
import SessionStartModal from '@/components/catalog/SessionStartModal';
import { Image as ImageIcon, BookOpen, MessageSquare } from 'lucide-react';

const ACTIVE_SESSION_KEY = 'xhibitly-active-order-id';

export default function XhibitlyStart2() {
  const navigate = useNavigate();
  const [mobileTab, setMobileTab] = useState('catalog'); // 'preview' | 'catalog' | 'agent'
  const [previewOrder, setPreviewOrder] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [queuedPromptForCatalog, setQueuedPromptForCatalog] = useState('');
  const [previewLineItems, setPreviewLineItems] = useState([]);
  const [previewPricingResult, setPreviewPricingResult] = useState(null);
  const [previewBrandWebsite, setPreviewBrandWebsite] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewStatus, setPreviewStatus] = useState('');

  const restoreSavedSession = useCallback(async () => {
    const savedOrderId = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!savedOrderId) {
      setShowSessionModal(true);
      return;
    }

    const orders = await base44.entities.Order.filter({ id: savedOrderId }, '-created_date', 1);
    const order = orders?.[0] || null;

    if (!order) {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
      setShowSessionModal(true);
      return;
    }

    const items = await base44.entities.LineItem.filter({ order_id: order.id });
    setPreviewOrder(order);
    setPreviewLineItems(items || []);
    setPreviewBrandWebsite(order?.website_url || '');
    setShowSessionModal(false);
  }, []);

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

      await base44.entities.Order.update(previewOrder.id, {
        website_url: cleanWebsite || previewOrder?.website_url || '',
        booth_rendering_url: renderUrl,
      });

      setPreviewOrder((prev) => prev ? {
        ...prev,
        website_url: cleanWebsite || prev?.website_url,
        booth_rendering_url: renderUrl,
      } : prev);
      setPreviewStatus('');
      toast.success('Booth preview is ready.');
    } catch (error) {
      setPreviewStatus('');
      const responseData = error?.response?.data;
      const validationMessages = responseData?.errors?.map((item) => item.message).filter(Boolean);
      toast.error(validationMessages?.join(' ') || responseData?.error || error?.message || 'Preview generation failed. Please try again.');
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

    const latestOrders = await base44.entities.Order.filter({ id: previewOrder.id }, '-created_date', 1);
    const latestOrder = latestOrders?.[0] || previewOrder;

    let shareToken = latestOrder.share_token;
    if (!shareToken) {
      shareToken = crypto.randomUUID();
      await base44.entities.Order.update(latestOrder.id, {
        share_token: shareToken,
        status: latestOrder.status === 'Draft' || latestOrder.status === 'Pending' ? 'Quoted' : latestOrder.status,
      });
    }

    setPreviewOrder((prev) => prev ? {
      ...prev,
      ...latestOrder,
      share_token: shareToken,
      status: (latestOrder.status === 'Draft' || latestOrder.status === 'Pending') ? 'Quoted' : latestOrder.status,
    } : prev);

    navigate(`/QuoteView?token=${shareToken}&edit=1`);
  };

  const startFreshQuote = () => {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
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
    if (order?.id) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, order.id);
    }
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
    restoreSavedSession();
  }, [restoreSavedSession]);

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
  }, [restoreSavedSession]);

  const mobileTabs = [
    { key: 'preview', label: 'Preview', icon: ImageIcon },
    { key: 'catalog', label: 'Catalog', icon: BookOpen },
    { key: 'agent', label: 'AI Guide', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,195,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(13,79,179,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(13,79,179,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(13,79,179,0.08) 1px, transparent 1px)', backgroundSize: '46px 46px' }} />

      {showSessionModal && (
        <SessionStartModal
          onComplete={handleSessionComplete}
          onDismiss={() => setShowSessionModal(false)}
        />
      )}

      <div className="relative z-10 flex h-screen flex-col">
        <div className="flex-shrink-0 flex items-center justify-center py-2 px-4 bg-white/90 border-b border-slate-200 lg:bg-transparent lg:border-0">
          <img src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/f3c8fd783_IMG_1062.png" alt="Xhibitly" className="h-7 lg:h-10 w-auto object-contain rounded-xl lg:rounded-[28px]" />
        </div>

        <div className="lg:hidden flex-shrink-0 flex bg-white border-b border-slate-200">
          {mobileTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${mobileTab === key ? 'border-[#0D4FB3] text-[#0D4FB3]' : 'border-transparent text-slate-500'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 px-3 py-3 lg:px-4 lg:pt-0">
          <div className="h-full max-w-[1560px] mx-auto lg:grid lg:grid-cols-[minmax(280px,0.9fr)_minmax(720px,1.65fr)_minmax(340px,1fr)] lg:gap-4">
            <section className={`${mobileTab === 'preview' ? 'block' : 'hidden'} lg:block h-full min-w-0 overflow-y-auto lg:overflow-hidden`}>
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

            <section className={`${mobileTab === 'catalog' ? 'block' : 'hidden'} lg:block h-full min-w-0 overflow-hidden rounded-[24px] lg:rounded-[30px] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.10)]`}>
              <CatalogQuote
                embeddedMode
                initialPrompt={queuedPromptForCatalog}
                onOrderChange={setPreviewOrder}
                onLineItemsChange={setPreviewLineItems}
                onPricingResult={setPreviewPricingResult}
              />
            </section>

            <section className={`${mobileTab === 'agent' ? 'block' : 'hidden'} lg:block h-full min-w-0 overflow-hidden rounded-[24px] lg:rounded-[30px] border border-white bg-white/96 shadow-[0_25px_70px_rgba(15,23,42,0.12)]`}>
              <XhibitlyAgentPane />
            </section>
          </div>
        </div>
      </div>

    </div>
  );
}