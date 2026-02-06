import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('login');
  
  // Registration additional fields
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        
        // Check if user has selected their type
        if (!user.user_type) {
          navigate(createPageUrl('UserTypeSelection'));
        } else {
          navigate(createPageUrl('QuoteRequest'));
        }
      }
    } catch (e) {
      // Not authenticated
    }
    setIsLoading(false);
  };

  const handleLogin = () => {
    // After login, user will be redirected back to Home, which will then route to UserTypeSelection
    base44.auth.redirectToLogin();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e2231a] to-[#b01b13] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      {/* Full Screen Hero Image - Clickable */}
      <div
        className="relative w-full max-w-7xl aspect-[16/9] overflow-hidden rounded-2xl shadow-2xl cursor-pointer group"
        onClick={handleLogin}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
      >
        {/* Hero Image */}
        <img
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/acf930752_OrbusHero.jpeg"
          alt="Orbus Showroom"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />

        {/* Dark Overlay for Better Text Visibility */}
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