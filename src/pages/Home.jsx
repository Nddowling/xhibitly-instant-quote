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
        navigate(createPageUrl('QuoteRequest'));
      }
    } catch (e) {
      // Not authenticated
    }
    setIsLoading(false);
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(createPageUrl('QuoteRequest'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e2231a] to-[#b01b13] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2231a] via-[#b01b13] to-[#0F1D2E] flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
            <span className="text-2xl font-bold text-white">X</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Xhibitly</h1>
            <p className="text-white/60 text-sm">Instant Quote</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Hero Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white"
          >
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              Get Your Perfect
              <br />
              <span className="text-white/80">Trade Show Booth</span>
              <br />
              In Minutes
            </h2>
            <p className="text-white/70 text-lg mb-8 leading-relaxed">
              Select your booth size, choose from curated options across three tiers, 
              and receive a personalized quote instantly. Our team will contact you within 2 hours.
            </p>
            <div className="flex items-center gap-6 text-white/60 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span>Instant Pricing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span>3 Tier Options</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span>Fast Response</span>
              </div>
            </div>
          </motion.div>

          {/* Right - Login Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-0">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl text-[#e2231a]">Dealer Portal</CardTitle>
                <CardDescription className="text-slate-500">
                  Sign in or create an account to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Button 
                  onClick={handleLogin}
                  className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white h-14 text-lg font-medium transition-all duration-300 hover:shadow-lg"
                >
                  <LogIn className="w-5 h-5 mr-3" />
                  Sign In / Register
                  <ArrowRight className="w-5 h-5 ml-3" />
                </Button>
                
                <p className="text-center text-slate-400 text-sm mt-6">
                  By continuing, you agree to our Terms of Service
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-white/40 text-sm">
        © 2024 Xhibitly. All rights reserved.
      </footer>
    </div>
  );
}