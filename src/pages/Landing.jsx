import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Palette, Package, CheckCircle2 } from 'lucide-react';
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
    } catch (e) {
      // Not authenticated — stay on landing
    }
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
    <div className="min-h-screen bg-white overflow-hidden">

      {/* ─── Nav ─── */}
      <nav className="relative z-20 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <img
          src="/assets/orbus-logo.png"
          alt="Orbus Exhibit & Display Group"
          className="h-9"
        />
        <Button
          onClick={handleGetStarted}
          variant="outline"
          className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
        >
          Sign In
        </Button>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative max-w-7xl mx-auto px-6 pt-12 md:pt-20 pb-20 md:pb-28">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-[#e2231a]/8 text-[#e2231a] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <Clock className="w-3.5 h-3.5" />
              Instant Quote in Under 2 Minutes
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-6">
              Your Brand.{' '}
              <span className="text-[#e2231a]">Your Booth.</span>{' '}
              <span className="block mt-1">Done for You.</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-lg mb-8">
              Tell us your website, and our AI curator builds a complete trade show booth 
              experience matched to your brand — products selected, priced, and ready to ship.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleGetStarted}
                className="bg-[#e2231a] hover:bg-[#b01b13] h-14 px-8 text-lg font-semibold shadow-lg shadow-[#e2231a]/20"
              >
                Get Your Instant Quote
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            <p className="text-xs text-slate-400 mt-4">
              No credit card required • A specialist calls you within 10 minutes
            </p>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/1d7db6e3d_ChatGPTImageFeb5202603_16_45PM.png"
                alt="Trade show booth showcase"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div className="text-white">
                  <p className="text-sm font-medium opacity-80">Starting from</p>
                  <p className="text-3xl font-bold">$4,500</p>
                </div>
                <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
                  10×10 Complete Package
                </div>
              </div>
            </div>
            {/* Decorative dot pattern */}
            <div className="hidden md:block absolute -bottom-6 -right-6 w-32 h-32 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEuNSIgZmlsbD0iI2UyMjMxYSIgb3BhY2l0eT0iMC4xNSIvPjwvc3ZnPg==')] opacity-60 -z-10" />
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
              Three Steps to Your Trade Show Booth
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              No back-and-forth. No guesswork. Just a curated experience built around your brand.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                step: '01',
                icon: Palette,
                title: 'Share Your Brand',
                desc: 'Drop in your website URL and booth size. Our AI analyzes your colors, logo, and brand personality in seconds.'
              },
              {
                step: '02',
                icon: Package,
                title: 'Review Your Options',
                desc: 'Get three curated booth packages — Modular, Hybrid, or Custom — each hand-picked from premium Orbus products.'
              },
              {
                step: '03',
                icon: CheckCircle2,
                title: 'Reserve & We Handle the Rest',
                desc: 'Lock in your design. A booth specialist calls you within 10 minutes to finalize every detail.'
              }
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <div className="text-6xl font-black text-slate-100 absolute -top-2 -left-1 select-none pointer-events-none">
                  {item.step}
                </div>
                <div className="relative pt-8">
                  <div className="w-11 h-11 rounded-xl bg-[#e2231a]/10 flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-[#e2231a]" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Trust Bar ─── */}
      <section className="max-w-7xl mx-auto px-6 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '500+', label: 'Booths Delivered' },
            { value: '< 2 min', label: 'To Get a Quote' },
            { value: '10 min', label: 'Specialist Callback' },
            { value: '4.9/5', label: 'Customer Rating' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="text-2xl md:text-3xl font-extrabold text-slate-900">{stat.value}</div>
              <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Stop Piecing Together Your Booth
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
              Let us curate a complete, branded experience so you can focus on 
              what matters — winning business at the show.
            </p>
            <Button
              onClick={handleGetStarted}
              className="bg-[#e2231a] hover:bg-[#b01b13] h-14 px-10 text-lg font-semibold shadow-lg shadow-[#e2231a]/30"
            >
              Get Started — It's Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-slate-500 text-xs mt-4">Powered by Orbus Exhibit & Display Group</p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}