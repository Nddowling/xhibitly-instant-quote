import React, { useState } from 'react';
import CatalogQuote from '@/pages/CatalogQuote';
import XhibitlyAgentPane from '@/components/xhibitly/XhibitlyAgentPane';

export default function XhibitlyStart() {
  const [queuedPrompt, setQueuedPrompt] = useState('');

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,195,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(13,79,179,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(rgba(13,79,179,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(13,79,179,0.08) 1px, transparent 1px)', backgroundSize: '46px 46px' }} />
      <div className="relative z-10 px-4 md:px-8 py-4 md:py-6">
        <div className="max-w-[1560px] mx-auto">
          <div className="flex items-center justify-center mb-5 md:mb-6">
            <img src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/d492801c9_IMG_1017.PNG" alt="Xhibitly" className="h-10 md:h-12 w-auto object-contain" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] items-start min-h-[calc(100vh-120px)]">
            <section className="min-w-0 rounded-[30px] overflow-hidden border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.10)]">
              <div className="h-[760px] bg-white">
                <CatalogQuote />
              </div>
            </section>

            <section className="min-w-0 rounded-[30px] bg-white/96 backdrop-blur border border-white shadow-[0_25px_70px_rgba(15,23,42,0.12)] overflow-hidden min-h-[760px] lg:sticky lg:top-4">
              <XhibitlyAgentPane queuedPrompt={queuedPrompt} onPromptConsumed={() => setQueuedPrompt('')} />
            </section>
          </div>

          <p className="text-center text-xs md:text-sm text-slate-500 mt-4">The Speed of AI. The Power of The Handbook.</p>
        </div>
      </div>
    </div>
  );
}