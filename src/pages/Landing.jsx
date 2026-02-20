import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Palette, Package, PhoneCall, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        if (!user.user_type) {
          navigate(createPageUrl('UserTypeSelection'));
        } else if (user.is_sales_rep) {
          navigate(createPageUrl('SalesDashboard'));
        } else if (user.user_type === 'student') {
          navigate(createPageUrl('StudentHome'));
        } else {
          navigate(createPageUrl('QuoteRequest'));
        }
        return;
      }
    } catch (e) {}
    setChecking(false);
  };

  const handleGetStarted = () => {
    base44.auth.redirectToLogin();
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#e2231a]/30">

      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#e2231a] rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">X</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Xhibitly</span>
            <span className="hidden sm:inline text-xs text-white/30 ml-1 font-medium">by Orbus</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGetStarted}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/5 text-sm hidden sm:inline-flex"
            >
              Sign In
            </Button>
            <Button
              onClick={handleGetStarted}
              className="bg-[#e2231a] hover:bg-[#c91e16] text-white h-9 px-5 text-sm font-semibold rounded-lg"
            >
              Get a Quote
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background gridlines */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        {/* Brighter cross lines at intersections */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '180px 180px' }} />
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#e2231a]/8 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/70 text-xs font-medium px-3.5 py-1.5 rounded-full mb-8">
                <Zap className="w-3 h-3 text-[#e2231a]" />
                AI-Curated Booth Experiences
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6"
            >
              Stop building
              <br />
              your booth
              <br />
              <span className="text-[#e2231a]">piece by piece.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg md:text-xl text-white/50 leading-relaxed max-w-xl mb-10"
            >
              Share your website. Get a complete, branded trade show booth — 
              products selected, priced, and ready to ship. In under two minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                onClick={handleGetStarted}
                className="bg-[#e2231a] hover:bg-[#c91e16] h-14 px-8 text-base font-semibold rounded-xl shadow-lg shadow-[#e2231a]/20 transition-all hover:shadow-[#e2231a]/30 hover:scale-[1.02]"
              >
                Get Your Instant Quote
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>

            <p className="text-xs text-white/25 mt-6">No credit card required • A specialist calls within 10 minutes</p>
          </div>

          {/* Hero Visual — right side */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="hidden md:block relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 rounded-full border border-white/5 animate-[spin_30s_linear_infinite]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#e2231a] rounded-full shadow-lg shadow-[#e2231a]/50" />
              </div>
              {/* Inner shapes */}
              <div className="absolute inset-8 rounded-full border border-white/[0.03]" />
              <div className="absolute inset-16 rounded-3xl bg-gradient-to-br from-[#e2231a]/20 to-transparent border border-[#e2231a]/10 rotate-12" />
              <div className="absolute inset-20 rounded-2xl bg-gradient-to-tr from-[#e2231a]/10 to-[#e2231a]/5 border border-white/5 -rotate-6" />
              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 bg-[#e2231a] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-[#e2231a]/30">
                    <span className="text-white font-black text-3xl">X</span>
                  </div>
                  <p className="text-sm font-semibold text-white/60">AI-Powered</p>
                  <p className="text-xs text-white/30">Booth Design</p>
                </div>
              </div>
              {/* Floating accent cards */}
              <div className="absolute top-8 right-0 bg-white/[0.04] backdrop-blur-sm border border-white/10 text-white px-4 py-2.5 rounded-xl">
                <p className="text-xs font-semibold text-white/70">Brand Matched</p>
              </div>
              <div className="absolute bottom-12 -left-2 bg-white/[0.04] backdrop-blur-sm border border-white/10 text-white px-4 py-2.5 rounded-xl">
                <p className="text-xs font-semibold text-white/70">Under 2 Minutes</p>
              </div>
              <div className="absolute bottom-4 right-4 bg-white/[0.04] backdrop-blur-sm border border-white/10 text-white px-4 py-2.5 rounded-xl">
                <p className="text-xs font-semibold text-white/70">Ship-Ready</p>
              </div>
            </div>
          </motion.div>
          </div>


        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="relative border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-[#e2231a] text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              From website to booth in three steps
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: Palette,
                title: 'Share Your Brand',
                desc: 'Enter your website URL and booth size. Our AI pulls your colors, logo, personality, and industry in seconds.',
                detail: '~30 seconds'
              },
              {
                icon: Package,
                title: 'Pick Your Package',
                desc: 'Review three curated booth options — each assembled from premium Orbus products, branded to match you.',
                detail: '~60 seconds'
              },
              {
                icon: PhoneCall,
                title: 'Reserve & Relax',
                desc: 'Lock in your design. A dedicated booth specialist calls within 10 minutes to handle every last detail.',
                detail: 'Done'
              }
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#e2231a]/10 flex items-center justify-center">
                    <step.icon className="w-5 h-5 text-[#e2231a]" />
                  </div>
                  <span className="text-xs font-mono text-white/20">{step.detail}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Value Props ─── */}
      <section className="border-t border-white/5 bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-[#e2231a] text-sm font-semibold uppercase tracking-widest mb-3">Why Xhibitly</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
                Premium booth service,
                <br />
                without the premium hassle
              </h2>
              <p className="text-white/40 leading-relaxed mb-8">
                Most exhibitors spend weeks sourcing individual displays, counters, lighting, 
                and graphics — juggling vendors, hoping it all looks good together. We eliminate that.
              </p>

              <div className="space-y-4">
                {[
                  'AI-matched products based on your actual brand identity',
                  'Complete packages — structure, graphics, lighting, furniture',
                  'Transparent, all-in pricing with no surprise line items',
                  'Dedicated specialist from quote to show floor'
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#e2231a]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ChevronRight className="w-3 h-3 text-[#e2231a]" />
                    </div>
                    <p className="text-sm text-white/60">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: '< 2 min', label: 'Time to quote' },
                  { value: '10 min', label: 'Specialist callback' },
                  { value: '3', label: 'Curated options' },
                  { value: '100%', label: 'Done for you' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-6 text-center">
                    <div className="text-2xl md:text-3xl font-extrabold text-white mb-1">{stat.value}</div>
                    <div className="text-xs text-white/30">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">
              Ready to look like the
              <br />
              <span className="text-[#e2231a]">biggest booth on the floor?</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto mb-10">
              Get a branded, complete booth package in under two minutes. 
              No commitments — just see what's possible.
            </p>
            <Button
              onClick={handleGetStarted}
              className="bg-[#e2231a] hover:bg-[#c91e16] h-14 px-10 text-lg font-semibold rounded-xl shadow-lg shadow-[#e2231a]/25 transition-all hover:shadow-[#e2231a]/40 hover:scale-[1.02]"
            >
              Get Your Instant Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-white/20 text-xs mt-5">No credit card required • Powered by Orbus Exhibit & Display Group</p>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/20 text-sm">
            <div className="w-5 h-5 bg-[#e2231a] rounded flex items-center justify-center">
              <span className="text-white font-black text-[10px]">X</span>
            </div>
            <span>Xhibitly © {new Date().getFullYear()}</span>
          </div>
          <div className="text-xs text-white/15">
            A product of Orbus Exhibit & Display Group
          </div>
        </div>
      </footer>
    </div>
  );
}