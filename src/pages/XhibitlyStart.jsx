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

          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,0.92fr)] items-start min-h-[calc(100vh-120px)]">
            <section className="rounded-[30px] bg-white/96 backdrop-blur border border-white shadow-[0_25px_70px_rgba(15,23,42,0.12)] overflow-hidden min-h-[760px] xl:sticky xl:top-0">
              <XhibitlyAgentPane queuedPrompt={queuedPrompt} onPromptConsumed={() => setQueuedPrompt('')} />
            </section>

            <section className="rounded-[30px] bg-[linear-gradient(135deg,#1f4fa4_0%,#204d97_38%,#1c3f84_100%)] text-white p-4 md:p-5 shadow-[0_30px_80px_rgba(13,79,179,0.22)] border border-white/15">
              <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center h-full">
                <div className="text-center lg:text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">The Handbook</p>
                  <h1 className="mt-2 text-3xl md:text-4xl font-black leading-tight">The Power of The Handbook</h1>
                  <p className="mt-4 text-sm md:text-base text-white/80 max-w-sm mx-auto lg:mx-0">Walk the real catalog interface, explore products, and let the AI collect booth details while suggesting the right exhibit direction.</p>
                </div>
                <div className="min-w-0 rounded-[24px] overflow-hidden border border-white/10 shadow-[0_18px_40px_rgba(7,18,41,0.18)]">
                  <div className="h-[760px] bg-white">
                    <CatalogQuote />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <p className="text-center text-xs md:text-sm text-slate-500 mt-4">The Speed of AI. The Power of The Handbook.</p>
        </div>
      </div>
    </div>
  );
}