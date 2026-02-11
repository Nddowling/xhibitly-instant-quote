import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';

const CATEGORY_INFO = {
  'Portable Displays': {
    desc: 'Banner stands, table covers, collapsible displays, counters & lighting',
    icon: '📐',
    color: 'from-slate-800 to-slate-900'
  },
  'Fabric Structures': {
    desc: 'Formulate backwalls, hanging structures, architectural accents & kiosks',
    icon: '🏗',
    color: 'from-slate-800 to-slate-900'
  },
  'Modular Exhibits': {
    desc: 'Hybrid Pro, Vector Frame & Orbital Express truss exhibit systems',
    icon: '🔧',
    color: 'from-slate-800 to-slate-900'
  },
  'Outdoor Displays': {
    desc: 'Tents, flags, banners & outdoor signage for events',
    icon: '🏕',
    color: 'from-slate-800 to-slate-900'
  },
  'Blaze SEG Light Boxes': {
    desc: 'Backlit SEG fabric light boxes for high-impact illuminated displays',
    icon: '💡',
    color: 'from-slate-800 to-slate-900'
  },
  'Rental Displays': {
    desc: '10\' & 20\' inline rentals, island exhibits, hanging signs & counters',
    icon: '🔄',
    color: 'from-[#e2231a]/90 to-[#b01b13]'
  },
  'Vector Fast Frame': {
    desc: 'Quick-assembly aluminum SEG frames for fabric graphics',
    icon: '⚡',
    color: 'from-slate-800 to-slate-900'
  },
  'Wall Signs': {
    desc: 'Directional signs, snap frames, LED light boxes & sign stands',
    icon: '🪧',
    color: 'from-slate-800 to-slate-900'
  },
  'Retail Displays': {
    desc: 'Point-of-purchase displays, floor stands & retail merchandising',
    icon: '🏪',
    color: 'from-slate-800 to-slate-900'
  }
};

export default function CategoryCard({ category, productCount, onClick }) {
  const info = CATEGORY_INFO[category] || { desc: '', icon: '📦', color: 'from-slate-800 to-slate-900' };

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group hover:shadow-xl transition-all duration-300 border-0 overflow-hidden"
    >
      <CardContent className={`p-0`}>
        <div className={`bg-gradient-to-br ${info.color} p-6 text-white min-h-[160px] flex flex-col justify-between`}>
          <div className="flex items-start justify-between">
            <span className="text-3xl">{info.icon}</span>
            <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1">{category}</h3>
            <p className="text-white/50 text-xs leading-relaxed">{info.desc}</p>
            <p className="text-white/30 text-xs mt-2">{productCount} product{productCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}