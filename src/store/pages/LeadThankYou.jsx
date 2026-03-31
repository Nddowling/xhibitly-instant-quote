import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Once you create a PDF and upload it to Supabase public storage, replace this URL
const GUIDE_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/biohacking-starter-guide.pdf';

const NEXT_STEPS = [
  { emoji: '💡', title: 'Red Light Therapy', text: 'Start with 10-min sessions post-workout for fastest recovery results.' },
  { emoji: '🧊', title: 'Cold Exposure', text: 'Begin with 30-second cold showers. Work up to 2-minute cold plunge sessions.' },
  { emoji: '📊', title: 'Track HRV', text: 'Morning HRV readings give you a daily readiness score to guide training intensity.' },
];

export default function LeadThankYou() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Icon */}
        <div className="w-20 h-20 bg-[#00c9a7]/15 border border-[#00c9a7]/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Zap className="w-9 h-9 text-[#00c9a7]" />
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold mb-4">Your Free Guide is Ready</h1>
        <p className="text-white/50 text-lg mb-8 max-w-lg mx-auto">
          The Biohacker's Starter Guide is ready to download. Check your inbox for your copy — and use code <span className="text-[#00c9a7] font-semibold">RECOVER10</span> for 10% off your first order.
        </p>

        <a
          href={GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold px-8 py-4 rounded-xl text-base mb-4 transition-all hover:scale-[1.02] shadow-xl shadow-[#00c9a7]/20"
        >
          <Download className="w-5 h-5" />
          Download Free Guide (PDF)
        </a>

        <p className="text-xs text-white/25 mb-14">Direct PDF download · No app required</p>

        {/* Quick tips */}
        <div className="grid md:grid-cols-3 gap-5 mb-14 text-left">
          {NEXT_STEPS.map(({ emoji, title, text }) => (
            <div key={title} className="bg-white/4 border border-white/8 rounded-2xl p-5">
              <div className="text-2xl mb-3">{emoji}</div>
              <h3 className="font-bold text-sm mb-2">{title}</h3>
              <p className="text-xs text-white/45 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Shop CTA */}
        <div className="bg-gradient-to-br from-[#0d1a14] to-[#111] border border-[#00c9a7]/20 rounded-2xl p-8">
          <h2 className="text-xl font-bold mb-2">Ready to gear up?</h2>
          <p className="text-white/45 text-sm mb-6">Use code <span className="text-[#00c9a7] font-semibold">RECOVER10</span> at checkout for 10% off your first order.</p>
          <Button
            onClick={() => navigate('/store/products')}
            className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-12 px-8 rounded-xl"
          >
            Shop All Products <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
