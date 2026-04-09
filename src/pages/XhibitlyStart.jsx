import React, { useState } from 'react';
import XhibitlyCatalogPane from '@/components/xhibitly/XhibitlyCatalogPane';
import XhibitlyAgentPane from '@/components/xhibitly/XhibitlyAgentPane';

export default function XhibitlyStart() {
  const [queuedPrompt, setQueuedPrompt] = useState('');

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,252,255,0.98))]" />
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(13,79,179,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(13,79,179,0.06) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
      <div className="relative z-10 px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-6">
            <div className="flex items-center gap-4 min-w-0">
              <img src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/d492801c9_IMG_1017.PNG" alt="Xhibitly" className="h-14 md:h-20 w-auto object-contain" />
              <div className="hidden md:block w-px self-stretch bg-slate-200" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#18C3F8]">The AI Bot</p>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#0D2E73]">The Speed of AI</h1>
                <p className="mt-2 text-sm md:text-base text-slate-600">The Power of The Handbook.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[#18C3F8]/20 bg-white/80 backdrop-blur px-4 py-3 shadow-sm max-w-xl">
              <p className="text-sm text-slate-600">Start your booth right here: browse the live catalog, chat with Xhibitly’s design guide, and move from concept to quote-ready direction.</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] min-h-[calc(100vh-180px)]">
            <div className="min-h-[42vh] xl:min-h-0">
              <XhibitlyCatalogPane onProductPrompt={setQueuedPrompt} />
            </div>
            <div className="min-h-[48vh] xl:min-h-0">
              <XhibitlyAgentPane queuedPrompt={queuedPrompt} onPromptConsumed={() => setQueuedPrompt('')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}