import React from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LogoSelector({ logoOptions, selectedLogo, singleLogoUrl, onSelect }) {
  if (logoOptions && logoOptions.length > 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Select Logo</h2>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            {logoOptions.length} option{logoOptions.length > 1 ? 's' : ''} available
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {logoOptions.map((logoOption, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(logoOption.url)}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                selectedLogo === logoOption.url
                  ? 'border-[#e2231a] bg-red-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="bg-slate-50 rounded-lg p-3 mb-2 h-24 flex items-center justify-center">
                <img
                  src={logoOption.url}
                  alt={`Logo option ${idx + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
              <p className="text-slate-500 text-xs text-center truncate">
                {logoOption.type || 'Logo'} · {logoOption.format?.toUpperCase()}
              </p>
              {selectedLogo === logoOption.url && (
                <div className="absolute top-2 right-2 bg-[#e2231a] rounded-full p-0.5">
                  <Check size={14} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (singleLogoUrl) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Logo</h2>
        <div className="bg-white rounded-xl p-6 flex items-center justify-center h-36 border border-slate-200">
          <img
            src={singleLogoUrl}
            alt="Company logo"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>
    );
  }

  return null;
}