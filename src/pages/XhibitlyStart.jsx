import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import CatalogQuote from '@/pages/CatalogQuote';
import XhibitlyAgentPane from '@/components/xhibitly/XhibitlyAgentPane';
import BoothPreviewPanel from '@/components/xhibitly/BoothPreviewPanel';

export default function XhibitlyStart() {
  const [queuedPrompt, setQueuedPrompt] = useState('');
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewLineItems, setPreviewLineItems] = useState([]);
  const [previewPricingResult, setPreviewPricingResult] = useState(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const handleGeneratePreview = async () => {
    if (!previewOrder || previewLineItems.length === 0 || isGeneratingPreview) return;

    const brand = previewOrder.customer_company || previewOrder.customer_name || 'Client brand';
    const booth = previewOrder.booth_size || 'trade show booth';
    const show = previewOrder.show_name || 'event booth';
    const items = previewLineItems
      .map((item) => item.product_name || item.sku)
      .filter(Boolean)
      .slice(0, 6)
      .join(', ');
    const referenceUrls = previewLineItems
      .map((item) => item.image_url)
      .filter(Boolean)
      .slice(0, 4);

    const prompt = `Create a polished branded trade show booth concept for ${brand}. Booth size: ${booth}. Event: ${show}. Include these selected products only: ${items}. Keep the layout realistic, premium, and presentation-ready with clear product placement and cohesive branded graphics.`;

    setIsGeneratingPreview(true);
    try {
      const response = await base44.functions.invoke('generateBoothRender', {
        prompt,
        reference_urls: referenceUrls,
      });

      if (response?.data?.url) {
        setPreviewOrder((prev) => ({ ...prev, booth_rendering_url: response.data.url }));
      }
    } finally {
      setIsGeneratingPreview(false);
    }
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