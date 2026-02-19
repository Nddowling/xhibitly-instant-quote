import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StudentHero({ onUploadClick }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a0a09] to-[#0a0a0a] px-6 pt-10 pb-14 md:pt-16 md:pb-20">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#e2231a]/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-6 left-[8%] w-12 h-12 md:w-20 md:h-20 border border-[#e2231a]/20 rounded-2xl rotate-12"
        />
        <motion.div
          animate={{ y: [0, 10, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-10 right-[6%] w-10 h-10 md:w-16 md:h-16 bg-[#e2231a]/5 border border-[#e2231a]/10 rounded-xl -rotate-6"
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute bottom-10 left-[12%] w-8 h-8 md:w-12 md:h-12 bg-[#e2231a]/8 rounded-full"
        />
        <motion.div
          animate={{ y: [0, 8, 0], rotate: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-6 right-[10%] w-8 h-8 md:w-14 md:h-14 border border-white/5 rounded-lg rotate-45"
        />
      </div>

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 text-xs font-medium px-3.5 py-1.5 rounded-full mb-5"
        >
          <Sparkles className="w-3 h-3 text-[#e2231a]" />
          Student Design Program
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white leading-[1.08] tracking-tight mb-4"
        >
          Watch Your Dreams
          <br />
          <span className="text-[#e2231a]">Come to Life</span>
          {' '}
          <span className="text-white/40">at Orbus</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm md:text-base text-white/40 max-w-md mx-auto leading-relaxed mb-8"
        >
          Upload your 3D booth designs and see them reviewed by industry professionals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button
            onClick={onUploadClick}
            className="bg-[#e2231a] hover:bg-[#c91e16] h-12 md:h-14 px-8 text-sm md:text-base font-semibold rounded-xl shadow-lg shadow-[#e2231a]/20 transition-all hover:shadow-[#e2231a]/30 hover:scale-[1.02] gap-2"
          >
            <Plus className="w-5 h-5" />
            Upload New Design
          </Button>
        </motion.div>
      </div>
    </div>
  );
}