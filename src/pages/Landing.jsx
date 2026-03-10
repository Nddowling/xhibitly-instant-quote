import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Users, Zap } from 'lucide-react';
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
        navigate(createPageUrl('SalesDashboard'));
        return;
      }
    } catch (e) {}
    setChecking(false);
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('SalesDashboard'));
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-20 px-6 md:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#e2231a] rounded-lg flex items-center justify-center font-black text-sm">EH</div>
          <span className="font-bold text-base tracking-tight drop-shadow-lg">The Exhibitors' Handbook</span>
          <span className="hidden sm:block text-xs text-white/40 border border-white/15 rounded-full px-2.5 py-0.5">Dealer Portal</span>
        </div>
        <Button onClick={handleLogin} className="bg-[#e2231a] hover:bg-[#c91e16] text-white font-semibold px-6 h-9 text-sm rounded-lg shadow-lg">
          Dealer Login <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </nav>

      {/* Hero — full-bleed image */}
      <div className="relative min-h-screen flex flex-col">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/c1fe8927a_image.png')` }}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/20" />

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex items-end pb-20 md:pb-28 px-6 md:px-16 pt-24">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-[#e2231a]/20 border border-[#e2231a]/40 text-[#e2231a] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
                <Zap className="w-3 h-3" />
                Orbus Authorized Dealer Tool · 2026
              </div>

              <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6 drop-shadow-2xl">
                Quote. Close.<br />
                <span className="text-[#e2231a]">Win the floor.</span>
              </h1>

              <p className="text-base md:text-lg text-white/60 max-w-lg mb-10 leading-relaxed">
                Browse the Orbus catalog, build quotes on the spot, and manage your client pipeline — all in one place built for dealers.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="bg-[#e2231a] hover:bg-[#c91e16] text-white h-14 px-10 text-base font-bold rounded-xl shadow-2xl shadow-[#e2231a]/30 transition-all hover:scale-[1.02]"
                >
                  Access Dealer Portal
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-xs text-white/30">Authorized Orbus dealers only</p>
              </div>

              {/* Feature pills */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap items-center gap-3 mt-10"
              >
                {[
                  { icon: BookOpen, label: 'Interactive Catalog' },
                  { icon: Zap, label: 'Instant Quotes' },
                  { icon: Users, label: 'Client CRM' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 bg-black/40 border border-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-white/60">
                    <Icon className="w-3.5 h-3.5 text-[#e2231a]" />
                    {label}
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-[#0a0a0a] border-t border-white/5 py-5 px-6 text-center text-xs text-white/20">
        The Exhibitors' Handbook © {new Date().getFullYear()} — Powered by Orbus Exhibit & Display Group
      </footer>
    </div>
  );
}