import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Shield, Truck, Star, ChevronRight, Activity, Moon, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LeadCaptureForm from '../components/LeadCaptureForm';
import SocialProof from '../components/SocialProof';

const FEATURED_CATEGORIES = [
  {
    icon: Zap,
    title: 'Red Light Therapy',
    description: 'Cellular recovery & skin rejuvenation',
    color: '#ff6b35',
  },
  {
    icon: Moon,
    title: 'Sleep Optimization',
    description: 'Smart masks & sleep tracking tools',
    color: '#7c3aed',
  },
  {
    icon: Thermometer,
    title: 'Cold Plunge',
    description: 'Cold exposure accessories & gear',
    color: '#0ea5e9',
  },
  {
    icon: Activity,
    title: 'HRV & Recovery',
    description: 'Monitor & optimize your recovery',
    color: '#00c9a7',
  },
];

const BENEFITS = [
  { icon: Truck, label: 'Free shipping over $75' },
  { icon: Shield, label: '30-day returns' },
  { icon: Star, label: '4.8★ average rating' },
];

export default function PublicStoreLanding() {
  const navigate = useNavigate();

  return (
    <div className="text-white">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden px-6">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#0d1a14] to-[#0a0a0a]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00c9a7]/10 via-transparent to-transparent" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-[#00c9a7]/15 border border-[#00c9a7]/30 text-[#00c9a7] text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              <Zap className="w-3 h-3" />
              Science-backed recovery tools · Free shipping $75+
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Optimize Your Recovery.<br />
              <span className="text-[#00c9a7]">Backed by Science.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
              Red light therapy, sleep optimization, cold exposure, and HRV monitoring tools — everything serious biohackers use to train harder and recover faster.
            </p>

            {/* Benefits bar */}
            <div className="flex flex-wrap justify-center gap-6 mb-12">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-white/50">
                  <Icon className="w-4 h-4 text-[#00c9a7]" />
                  {label}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => navigate('/store/products')}
                size="lg"
                className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-14 px-10 text-base rounded-xl shadow-2xl shadow-[#00c9a7]/20 transition-all hover:scale-[1.02]"
              >
                Shop All Products
                <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => document.getElementById('lead-form').scrollIntoView({ behavior: 'smooth' })}
                className="border-white/20 text-white/70 hover:text-white hover:bg-white/8 h-14 px-8 text-base rounded-xl"
              >
                Get Free Guide
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category cards */}
      <section className="px-6 md:px-12 py-16 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-3">Shop by Category</h2>
        <p className="text-white/40 text-center text-sm mb-10">Tools used by elite athletes and top performers</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURED_CATEGORIES.map(({ icon: Icon, title, description, color }) => (
            <motion.button
              key={title}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/store/products')}
              className="bg-white/5 hover:bg-white/8 border border-white/8 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}30` }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <p className="font-semibold text-sm text-white mb-1">{title}</p>
              <p className="text-xs text-white/40 leading-snug">{description}</p>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <SocialProof />

      {/* Lead capture */}
      <section id="lead-form" className="px-6 md:px-12 py-20">
        <div className="max-w-xl mx-auto">
          <div className="bg-gradient-to-br from-[#0d1a14] to-[#111] border border-[#00c9a7]/20 rounded-3xl p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-[#00c9a7]/15 border border-[#00c9a7]/25 text-[#00c9a7] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4">
                <Zap className="w-3 h-3" />
                FREE DOWNLOAD
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">The Biohacker's Starter Guide</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Learn the exact protocols elite athletes use — red light timing, HRV tracking, cold exposure schedules, and sleep optimization — all in one free PDF.
              </p>
            </div>
            <LeadCaptureForm source="store_landing" />
          </div>
        </div>
      </section>
    </div>
  );
}
