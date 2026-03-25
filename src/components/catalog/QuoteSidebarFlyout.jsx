import React, { useEffect, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import QuoteSidebar from '@/components/catalog/QuoteSidebar';

export default function QuoteSidebarFlyout(props) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const itemCount = props.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 4000);
  };

  const openPanel = () => {
    setIsOpen(true);
    scheduleClose();
  };

  const closePanel = () => {
    clearCloseTimer();
    setIsOpen(false);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <div className="relative h-full w-[74px] flex-shrink-0 border-l border-slate-200 bg-white/90 backdrop-blur">
      <div
        className="absolute inset-0 flex items-center justify-center p-3"
        onMouseEnter={openPanel}
        onMouseLeave={closePanel}
      >
        <button
          onClick={openPanel}
          className={`relative flex w-full flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 shadow-sm transition-all ${isOpen ? 'border-[#e2231a]/30 bg-[#e2231a]/5 text-[#e2231a]' : 'border-slate-200 bg-white text-slate-600 hover:border-[#e2231a]/40 hover:text-[#e2231a] hover:shadow-md'}`}
          title="Quote Builder"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Quote</span>
          {itemCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 h-5 px-1 rounded-full bg-[#e2231a] text-white text-[10px] font-bold flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute right-full top-0 h-full w-[24rem] shadow-2xl z-30"
          onMouseEnter={openPanel}
          onMouseMove={scheduleClose}
          onClick={scheduleClose}
          onMouseLeave={closePanel}
        >
          <QuoteSidebar {...props} />
        </div>
      )}
    </div>
  );
}