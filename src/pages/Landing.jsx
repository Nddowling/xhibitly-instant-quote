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
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#e2231a]/6 rounded-full blur-[160px] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/5 px-6 md:px-12 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#e2231a] rounded-lg flex items-center justify-center font-black text-sm">EH</div>
          <span className="font-bold text-base tracking-tight">The Exhibitors' Handbook</span>
          <span className="hidden sm:block text-xs text-white/25 border border-white/10 rounded-full px-2.5 py-0.5">Dealer Portal</span>
        </div>
        <Button onClick={handleLogin} className="bg-[#e2231a] hover:bg-[#c91e16] text-white font-semibold px-6 h-9 text-sm rounded-lg">
          Dealer Login <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-[#e2231a]/10 border border-[#e2231a]/20 text-[#e2231a] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-8">
              <Zap className="w-3 h-3" />
              Orbus Authorized Dealer Tool
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6">
              Quote. Close.<br />
              <span className="text-[#e2231a]">Win the floor.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/45 max-w-xl mx-auto mb-10 leading-relaxed">
              Browse the Orbus catalog, build quotes on the spot, and manage your client pipeline — all in one place built for dealers.
            </p>

            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-[#e2231a] hover:bg-[#c91e16] text-white h-14 px-10 text-base font-bold rounded-xl shadow-2xl shadow-[#e2231a]/20 transition-all hover:scale-[1.02]"
            >
              Access Dealer Portal
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-xs text-white/20 mt-5">Authorized Orbus dealers only</p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-14"
          >
            {[
              { icon: BookOpen, label: 'Interactive Catalog' },
              { icon: Zap, label: 'Instant Quotes' },
              { icon: Users, label: 'Client CRM' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 bg-white/[0.03] border border-white/8 px-4 py-2 rounded-full text-sm text-white/50">
                <Icon className="w-3.5 h-3.5 text-[#e2231a]" />
                {label}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-5 px-6 text-center text-xs text-white/20">
        The Exhibitors' Handbook © {new Date().getFullYear()} — Powered by Orbus Exhibit & Display Group
      </footer>
    </div>
  );
}