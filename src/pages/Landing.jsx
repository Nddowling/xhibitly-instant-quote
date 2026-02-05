import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        navigate(createPageUrl('QuoteRequest'));
      }
    } catch (e) {
      // Not authenticated - stay on landing
    }
  };

  const handleClick = () => {
    base44.auth.redirectToLogin(createPageUrl('QuoteRequest'));
  };

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      {/* Full Screen Hero Image - Clickable */}
      <div
        className="relative w-full max-w-7xl aspect-[16/9] overflow-hidden rounded-2xl shadow-2xl cursor-pointer group"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        {/* Hero Image */}
        <img
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/42f4e7814_ChatGPTImageFeb5202603_16_45PM.png"
          alt="Orbus Showroom"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />

        {/* Click Indicator */}
        <div className="absolute top-6 right-6 z-10">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-white/90 backdrop-blur-sm text-slate-800 px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg"
          >
            Tap to Start
          </motion.div>
        </div>
      </div>
    </div>
  );
}