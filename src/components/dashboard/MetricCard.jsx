import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const toneStyles = {
  red: {
    card: 'border-[#e2231a]/15 bg-white hover:border-[#e2231a]/30',
    iconWrap: 'bg-[#e2231a]/10 text-[#e2231a]',
    note: 'text-[#e2231a]'
  },
  blue: {
    card: 'border-blue-200 bg-white hover:border-blue-300',
    iconWrap: 'bg-blue-100 text-blue-700',
    note: 'text-blue-700'
  },
  amber: {
    card: 'border-amber-200 bg-white hover:border-amber-300',
    iconWrap: 'bg-amber-100 text-amber-700',
    note: 'text-amber-700'
  },
  green: {
    card: 'border-green-200 bg-white hover:border-green-300',
    iconWrap: 'bg-green-100 text-green-700',
    note: 'text-green-700'
  }
};

export default function MetricCard({ label, value, note, icon: Icon, tone = 'blue', onClick }) {
  const styles = toneStyles[tone] || toneStyles.blue;

  return (
    <Card
      onClick={onClick}
      className={`${styles.card} shadow-sm transition-all ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-xl md:text-3xl font-black tracking-tight text-slate-900">{value}</p>
            {note && <p className={`mt-2 text-xs font-medium ${styles.note}`}>{note}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${styles.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}