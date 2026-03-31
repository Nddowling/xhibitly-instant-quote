import React from 'react';

const CATEGORIES = [
  { value: '', label: 'All Products' },
  { value: 'red-light-therapy', label: 'Red Light Therapy' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'cold-plunge', label: 'Cold Plunge' },
  { value: 'hrv-monitoring', label: 'HRV & Recovery' },
  { value: 'compression', label: 'Compression' },
];

export default function CategoryFilter({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(cat => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
            value === cat.value
              ? 'bg-[#00c9a7] text-black border-[#00c9a7]'
              : 'bg-white/5 text-white/60 border-white/10 hover:border-white/25 hover:text-white'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
