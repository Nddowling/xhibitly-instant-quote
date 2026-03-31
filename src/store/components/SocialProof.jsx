import React from 'react';
import { Star } from 'lucide-react';

const REVIEWS = [
  {
    name: 'Marcus T.',
    role: 'CrossFit athlete',
    text: 'The red light therapy wand cut my recovery time in half. I use it after every heavy session. Genuinely life-changing.',
    stars: 5,
  },
  {
    name: 'Sarah K.',
    role: 'Marathon runner',
    text: 'Finally sleeping 8 solid hours again. The sleep mask with the light-blocking technology is worth every penny.',
    stars: 5,
  },
  {
    name: 'Dr. James R.',
    role: 'Sports physician',
    text: 'I recommend these tools to patients looking for evidence-based recovery strategies. The HRV monitor is particularly impressive.',
    stars: 5,
  },
];

const STATS = [
  { value: '12,000+', label: 'Happy customers' },
  { value: '4.8★', label: 'Average rating' },
  { value: '30-day', label: 'Money-back guarantee' },
  { value: '$75+', label: 'Free shipping' },
];

export default function SocialProof() {
  return (
    <section className="px-6 md:px-12 py-16 bg-white/2 border-y border-white/6">
      <div className="max-w-6xl mx-auto">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-2xl md:text-3xl font-extrabold text-[#00c9a7] mb-1">{value}</p>
              <p className="text-xs text-white/40">{label}</p>
            </div>
          ))}
        </div>

        {/* Reviews */}
        <h2 className="text-xl font-bold text-center mb-8 text-white/80">What our customers say</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {REVIEWS.map(({ name, role, text, stars }) => (
            <div key={name} className="bg-white/4 border border-white/8 rounded-2xl p-6">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#00c9a7] text-[#00c9a7]" />
                ))}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-4">"{text}"</p>
              <div>
                <p className="text-sm font-semibold text-white">{name}</p>
                <p className="text-xs text-white/35">{role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
