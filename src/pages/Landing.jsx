import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, LayoutDashboard, Users, Zap } from 'lucide-react';
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
    <div className="min-h-screen bg-[#070707] text-white flex flex-col">
      <nav className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 md:px-12 py-4 min-h-16 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#e2231a] rounded-xl flex items-center justify-center font-black text-sm shadow-lg shadow-[#e2231a]/30">EH</div>
          <div>
            <span className="block font-bold text-sm sm:text-base tracking-tight leading-tight">The Exhibitors' Handbook</span>
            <span className="text-[11px] text-white/45">Dealer portal for Orbus sales brokers</span>
          </div>
        </div>
        <Button onClick={handleLogin} className="bg-[#e2231a] hover:bg-[#c91e16] text-white font-semibold px-4 sm:px-6 h-10 text-sm rounded-xl shadow-lg shadow-[#e2231a]/25">
          Dealer Login <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </nav>

      <div className="relative min-h-screen flex flex-col">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/c1fe8927a_image.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(226,35,26,0.22),transparent_28%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

        <div className="relative z-10 flex-1 flex items-center px-4 sm:px-6 md:px-16 pt-24 sm:pt-28 pb-10 sm:pb-16">
          <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,420px)] gap-10 items-end">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 bg-[#e2231a]/15 border border-[#e2231a]/30 text-[#ff8d87] text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
                <Zap className="w-3 h-3 text-[#e2231a]" />
                Built for independent Orbus booth brokers
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-[1.02] tracking-tight mb-6 drop-shadow-2xl">
                Build faster quotes.
                <br />
                <span className="text-[#e2231a]">Present every booth with confidence.</span>
              </h1>

              <p className="text-base md:text-lg text-white/82 max-w-2xl mb-8 leading-relaxed mx-auto lg:mx-0">
                Search the catalog, assemble client-ready booth configurations, and keep every follow-up organized in one clean workflow made for real exhibit sales conversations.
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-center gap-4 mb-8 flex-wrap">
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="w-full sm:w-auto bg-[#e2231a] hover:bg-[#c91e16] text-white h-14 px-6 sm:px-10 text-base font-bold rounded-2xl shadow-2xl shadow-[#e2231a]/25 transition-all hover:scale-[1.02]"
                >
                  Enter Dealer Workspace
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  onClick={() => navigate('/store')}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-white/20 bg-white/5 text-white h-14 px-6 sm:px-10 text-base font-bold rounded-2xl hover:bg-white/10"
                >
                  Shop Self-Serve Store
                </Button>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Catalog-driven quoting + self-serve store</p>
                  <p className="text-xs text-white/58">Verified Orbus products for both guided and direct buying</p>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="grid sm:grid-cols-3 gap-3"
              >
                {[
                  { icon: BookOpen, label: 'Search the catalog', text: 'Locate exact SKUs and page references fast.' },
                  { icon: ClipboardList, label: 'Build a quote', text: 'Turn selections into clean client proposals.' },
                  { icon: LayoutDashboard, label: 'Track the pipeline', text: 'Stay on top of deals, follow-ups, and wins.' },
                ].map(({ icon: Icon, label, text }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/6 backdrop-blur-sm p-4 text-left shadow-lg shadow-black/20">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e2231a]/12 text-[#e2231a]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">{text}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="rounded-[28px] border border-white/10 bg-black/45 backdrop-blur-md p-5 sm:p-6 shadow-2xl shadow-black/40"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Why brokers use this</p>
              <div className="mt-4 space-y-4">
                {[
                  'Stay inside the real Orbus catalog instead of juggling PDFs and spreadsheets.',
                  'Build cleaner proposals faster while talking live with clients.',
                  'Keep every opportunity, revision, and follow-up in one system.'
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#e2231a]/15 text-[#e2231a]">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-sm leading-relaxed text-white/78">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-[#e2231a]/20 bg-[#e2231a]/8 p-4">
                <p className="text-sm font-semibold text-white">Ready for faster client conversations?</p>
                <p className="mt-1 text-xs leading-relaxed text-white/62">Open the dealer workspace to browse products, prepare booth quotes, and manage your pipeline in one place.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 bg-[#070707] border-t border-white/5 py-5 px-6 text-center text-xs text-white/50">
        The Exhibitors' Handbook © {new Date().getFullYear()} — Powered by Orbus Exhibit & Display Group
      </footer>
    </div>
  );
}