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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hero Section with Large Orbus Banner - Fully Interactive */}
      <div
        className="relative h-[70vh] min-h-[500px] bg-gradient-to-br from-[#e2231a] via-[#c41e17] to-[#b01b13] overflow-hidden cursor-pointer group"
        onClick={handleLogin}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity">
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
        </div>

        {/* Click Indicator */}
        <div className="absolute top-6 right-6 z-20">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium"
          >
            Tap anywhere to start
          </motion.div>
        </div>

        {/* Orbus Logo and Hero Content */}
        <div className="relative h-full flex flex-col items-center justify-center text-center px-6 z-10 group-hover:scale-105 transition-transform duration-500">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <img
              src="/assets/orbus-logo.png"
              alt="Orbus"
              className="h-20 md:h-28 mx-auto mb-6 drop-shadow-2xl"
            />
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight drop-shadow-lg">
              Instant Quote
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed font-light">
              Your Perfect Trade Show Booth Experience
              <br />
              <span className="text-white/70">Designed in Minutes</span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="flex items-center gap-8 text-white/90 text-base md:text-lg font-medium">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span>AI-Powered Design</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span>Instant Pricing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span>3 Custom Options</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-2 text-white/60">
            <span className="text-xs">Scroll to learn more</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-6 h-10 border-2 border-white/40 rounded-full flex items-start justify-center p-2"
            >
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Features Section */}
      <main className="flex-1 bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-800 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Get your custom booth design in three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <Card className="border-0 shadow-lg h-full hover:shadow-xl transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-[#e2231a] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">
                    Enter Your Details
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Share your website URL, booth size, and design preferences. Our AI analyzes your brand instantly.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
            >
              <Card className="border-0 shadow-lg h-full hover:shadow-xl transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-[#e2231a] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">
                    Review 3 Options
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Choose from Budget, Hybrid, or Custom tier designs - each with photorealistic renderings and instant pricing.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.1 }}
            >
              <Card className="border-0 shadow-lg h-full hover:shadow-xl transition-shadow">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-[#e2231a] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">
                    Connect with Orbus
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Our team contacts you within 2 hours to finalize details and bring your vision to life.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            className="text-center mt-16"
          >
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-[#e2231a] hover:bg-[#b01b13] text-white h-14 px-10 text-lg font-semibold shadow-lg transition-all duration-300 hover:scale-105"
            >
              <LogIn className="w-5 h-5 mr-3" />
              Sign In to Get Started
              <ArrowRight className="w-5 h-5 ml-3" />
            </Button>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-8 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <img
            src="/assets/orbus-logo.png"
            alt="Orbus"
            className="h-8 mx-auto mb-4 opacity-80"
          />
          <p className="text-slate-400 text-sm">
            © 2024 Orbus Exhibit & Display Group. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}