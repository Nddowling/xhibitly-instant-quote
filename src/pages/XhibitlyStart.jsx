import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import CatalogQuote from '@/pages/CatalogQuote';
import XhibitlyAgentPane from '@/components/xhibitly/XhibitlyAgentPane';
import BoothPreviewPanel from '@/components/xhibitly/BoothPreviewPanel';

export default function XhibitlyStart() {
  const [queuedPrompt, setQueuedPrompt] = useState('');
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewLineItems, setPreviewLineItems] = useState([]);
  const [previewPricingResult, setPreviewPricingResult] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewStatus, setPreviewStatus] = useState('');
  const [renderTaskId, setRenderTaskId] = useState('');
  const [pollAttempts, setPollAttempts] = useState(0);
  const pollTimerRef = useRef(null);

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
      }))
      .filter((item) => item.sku || item.name);

    const productLabels = quoteItems.map((item) => `${item.sku ? `${item.sku} ` : ''}${item.name}`.trim());
    const productImageUrls = quoteItems.map((item) => item.image_url).filter(Boolean).slice(0, 6);

    setIsGeneratingPreview(true);
    setPreviewStatus(cleanWebsite ? 'Pulling brand details and starting render…' : 'Starting booth preview…');
    setRenderTaskId('');
    setPollAttempts(0);

    try {
      const prompt = `Create a realistic, production-ready branded exhibitors booth rendering for a convention center. Brand: ${brandName}. Booth size: ${boothSize}. Booth type: ${boothType}. Event: ${showName}. This must be spatially correct for the stated booth footprint and booth type. Use the provided quoted product images as the actual products in the booth. Do not invent extra structures, counters, furniture, lighting, flooring, hanging signs, or accessories that are not represented by the quoted items. The booth should look like a clean inline trade show proposal image suitable for a client presentation. Selected quote items: ${productLabels.join(', ')}. If branding is provided from the website, apply the actual logo, colors, and graphic style to the booth naturally. If any product is unclear, stay conservative and preserve the referenced shapes and proportions.`;

      const response = await base44.functions.invoke('generateBoothRender', {
        prompt,
        website_url: cleanWebsite,
        brand_name: brandName,
        booth_size: boothSize,
        booth_type: boothType,
        show_name: showName,
        quote_items: quoteItems,
        reference_urls: productImageUrls,
      });

      if (response?.data?.task_id) {
        setPreviewStatus('Render started. Checking for the finished image…');
        setRenderTaskId(response.data.task_id);
        setPreviewOrder((prev) => ({
          ...prev,
          website_url: cleanWebsite || prev?.website_url,
          booth_rendering_url: '',
        }));
      } else {
        throw new Error('No render task was returned');
      }
    } catch (error) {
      setIsGeneratingPreview(false);
      setPreviewStatus('');
      toast.error('Preview generation failed. Please try again.');
    }
  };

  useEffect(() => {
    if (!renderTaskId) return;

    pollTimerRef.current = window.setInterval(async () => {
      try {
        const response = await base44.functions.invoke('generateBoothRender', { task_id: renderTaskId });
        const status = response?.data?.status;
        const url = response?.data?.url;

        setPollAttempts((prev) => prev + 1);

        if (status === 'pending' || status === 'queued' || status === 'running' || status === 'processing') {
          setPreviewStatus('Rendering your booth preview…');
        }

        if (url && (status === 'success' || status === 'completed' || status === 'finished' || status === 'running' || status === 'processing')) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRenderTaskId('');
          setPollAttempts(0);
          setIsGeneratingPreview(false);
          setPreviewStatus('');
          setPreviewOrder((prev) => prev ? { ...prev, booth_rendering_url: url } : prev);
          toast.success('Booth preview is ready.');
          return;
        }

        if (status === 'failed' || status === 'error') {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRenderTaskId('');
          setPollAttempts(0);
          setIsGeneratingPreview(false);
          setPreviewStatus('');
          toast.error('Preview generation failed. Please try again.');
        }
      } catch (error) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setRenderTaskId('');
        setPollAttempts(0);
        setIsGeneratingPreview(false);
        setPreviewStatus('');
        toast.error(error?.message || 'Preview generation failed. Please try again.');
      }
    }, 5000);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [renderTaskId]);

  useEffect(() => {
    if (!renderTaskId || pollAttempts < 36) return;

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setRenderTaskId('');
    setPollAttempts(0);
    setIsGeneratingPreview(false);
    setPreviewStatus('');
    toast.error('Preview generation timed out. Please try again.');
  }, [pollAttempts, renderTaskId]);

  const handleRemovePreviewItem = async (item) => {
    if (!item?.id) return;
    await base44.entities.LineItem.delete(item.id);
    setPreviewLineItems((prev) => prev.filter((entry) => entry.id !== item.id));
    setPreviewOrder((prev) => prev ? { ...prev, booth_rendering_url: '' } : prev);
    setRenderTaskId('');
    setIsGeneratingPreview(false);
    setPreviewStatus('');
  };

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,195,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(13,79,179,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(13,79,179,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(13,79,179,0.08) 1px, transparent 1px)', backgroundSize: '46px 46px' }} />
      <div className="relative z-10 px-4 md:px-8 py-4 md:py-6">
        <div className="max-w-[1560px] mx-auto">
          <div className="flex items-center justify-center mb-5 md:mb-6">
            <img src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/d492801c9_IMG_1017.PNG" alt="Xhibitly" className="h-10 md:h-12 w-auto object-contain" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(720px,1.65fr)_minmax(340px,1fr)] items-start min-h-[calc(100vh-24px)]">
            <section className="min-w-0 h-[1004px] lg:h-[calc(100vh-8px)] lg:sticky lg:top-2">
              <BoothPreviewPanel
                order={previewOrder}
                lineItems={previewLineItems}
                pricingResult={previewPricingResult}
                onGeneratePreview={handleGeneratePreview}
                onRemoveItem={handleRemovePreviewItem}
                isGeneratingPreview={isGeneratingPreview}
                previewStatus={previewStatus}
              />
            </section>

            <section className="min-w-0 rounded-[30px] overflow-hidden border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.10)] h-[1004px] lg:h-[calc(100vh-8px)]">
              <div className="h-full bg-white">
                <CatalogQuote
                  embeddedMode
                  onOrderChange={setPreviewOrder}
                  onLineItemsChange={setPreviewLineItems}
                  onPricingResult={setPreviewPricingResult}
                />
              </div>
            </section>

            <section className="min-w-0 rounded-[30px] bg-white/96 backdrop-blur border border-white shadow-[0_25px_70px_rgba(15,23,42,0.12)] overflow-hidden h-[1004px] lg:h-[calc(100vh-8px)] lg:sticky lg:top-2">
              <XhibitlyAgentPane queuedPrompt={queuedPrompt} onPromptConsumed={() => setQueuedPrompt('')} />
            </section>
          </div>

          <p className="text-center text-xs md:text-sm text-slate-500 mt-4">The Speed of AI. The Power of The Handbook.</p>
        </div>
      </div>
    </div>
  );
}