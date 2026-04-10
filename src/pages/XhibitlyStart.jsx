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
  const [renderTaskId, setRenderTaskId] = useState('');
  const pollTimerRef = useRef(null);

  const handleGeneratePreview = async ({ website_url = '' } = {}) => {
    if (!previewOrder || previewLineItems.length === 0 || isGeneratingPreview) return;

    let brandDetails = null;
    const cleanWebsite = website_url.trim();

    setIsGeneratingPreview(true);
    setRenderTaskId('');
    try {
      if (cleanWebsite) {
        try {
          const brandResponse = await base44.functions.invoke('fetchBrandData', { website_url: cleanWebsite });
          brandDetails = brandResponse?.data?.brand || null;
        } catch (error) {
          toast.error('Brand lookup is temporarily unavailable, so the render will continue without pulled branding.');
        }
      }

      const brand = brandDetails?.company_name || previewOrder.customer_company || previewOrder.customer_name || 'Client brand';
      const booth = previewOrder.booth_size || 'trade show booth';
      const show = previewOrder.show_name || 'event booth';
      const itemNames = previewLineItems
        .map((item) => item.product_name || item.sku)
        .filter(Boolean);
      const referenceUrls = previewLineItems
        .map((item) => item.image_url)
        .filter(Boolean)
        .slice(0, 4);
      const colorNotes = [brandDetails?.primary_color, brandDetails?.secondary_color, brandDetails?.accent_color_1, brandDetails?.accent_color_2]
        .filter(Boolean)
        .join(', ');
      const logoNote = brandDetails?.logo_cached_url || brandDetails?.logo_url;

      const prompt = `Create a polished branded trade show booth concept for ${brand}. Booth size: ${booth}. Event: ${show}. The customer is considering purchase, so make this look like a realistic, production-ready trade show proposal image. Use only these selected items from the quote and do not invent any extra products, structures, counters, seating, lighting, or furniture beyond what is shown in the provided references: ${itemNames.join(', ')}. Keep the layout realistic, within the stated booth footprint, and visually centered on the chosen items. ${colorNotes ? `Use these brand colors: ${colorNotes}. ` : ''}${logoNote ? 'Apply the provided brand logo and graphics where appropriate. ' : ''}If a selected item is unclear, stay conservative and do not add substitutes.`;

      const response = await base44.functions.invoke('generateBoothRender', {
        prompt,
        reference_urls: logoNote ? [logoNote, ...referenceUrls].slice(0, 4) : referenceUrls,
      });

      if (response?.data?.task_id) {
        setRenderTaskId(response.data.task_id);
        setPreviewOrder((prev) => ({
          ...prev,
          website_url: cleanWebsite || prev?.website_url,
          booth_rendering_url: '',
        }));
        if (cleanWebsite && brandDetails) {
          toast.success('Branding pulled in and render started.');
        }
      } else {
        throw new Error('No render task was returned');
      }
    } catch (error) {
      setIsGeneratingPreview(false);
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

        if ((status === 'success' || status === 'completed' || status === 'finished') && url) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRenderTaskId('');
          setIsGeneratingPreview(false);
          setPreviewOrder((prev) => prev ? { ...prev, booth_rendering_url: url } : prev);
          toast.success('Booth preview is ready.');
        }

        if (status === 'failed' || status === 'error') {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setRenderTaskId('');
          setIsGeneratingPreview(false);
          toast.error('Preview generation failed. Please try again.');
        }
      } catch (error) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setRenderTaskId('');
        setIsGeneratingPreview(false);
        toast.error('Preview generation failed. Please try again.');
      }
    }, 5000);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [renderTaskId]);

  const handleRemovePreviewItem = async (item) => {
    if (!item?.id) return;
    await base44.entities.LineItem.delete(item.id);
    setPreviewLineItems((prev) => prev.filter((entry) => entry.id !== item.id));
    setPreviewOrder((prev) => prev ? { ...prev, booth_rendering_url: '' } : prev);
    setRenderTaskId('');
    setIsGeneratingPreview(false);
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