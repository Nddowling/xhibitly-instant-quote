import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function StudentHero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a0a09] to-[#0a0a0a] py-16 md:py-24 px-6">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Red glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#e2231a]/10 rounded-full blur-[120px]" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Floating geometric shapes */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-4 left-[10%] w-16 h-16 md:w-24 md:h-24 border border-[#e2231a]/20 rounded-2xl rotate-12"
          />
          <motion.div
            animate={{ y: [0, 12, 0], rotate: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-8 right-[8%] w-12 h-12 md:w-20 md:h-20 bg-[#e2231a]/5 border border-[#e2231a]/10 rounded-xl -rotate-6"
          />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-8 left-[15%] w-10 h-10 md:w-14 md:h-14 bg-[#e2231a]/8 rounded-full"
          />
          <motion.div
            animate={{ y: [0, 8, 0], rotate: [0, 12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-4 right-[12%] w-8 h-8 md:w-16 md:h-16 border border-white/5 rounded-lg rotate-45"
          />
          {/* Small dots */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }}
              className="absolute w-1.5 h-1.5 bg-[#e2231a]/40 rounded-full"
              style={{
                top: `${20 + i * 15}%`,
                left: `${5 + i * 20}%`
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 text-xs font-medium px-4 py-2 rounded-full mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#e2231a]" />
          Student Design Program
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6"
        >
          Watch Your Dreams
          <br />
          <span className="text-[#e2231a]">Come to Life</span>
          <br />
          <span className="text-white/40">at Orbus</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base md:text-lg text-white/40 max-w-lg mx-auto leading-relaxed"
        >
          Upload your 3D booth designs and see them reviewed by industry professionals. 
          Your creativity starts here.
        </motion.p>

        {/* Visual booth silhouette */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 relative max-w-md mx-auto"
        >
          <div className="relative h-32 md:h-40">
            {/* Booth base/floor */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-gradient-to-r from-transparent via-[#e2231a]/30 to-transparent rounded-full" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-8 bg-[#e2231a]/5 rounded-t-lg border-t border-x border-[#e2231a]/10" />
            
            {/* Booth backwall */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[50%] h-24 md:h-28 bg-gradient-to-t from-[#e2231a]/10 to-[#e2231a]/3 border border-[#e2231a]/15 rounded-t-lg">
              <div className="absolute inset-2 border border-dashed border-white/5 rounded" />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#e2231a]/20 rounded-lg flex items-center justify-center">
                <span className="text-[#e2231a] text-xs font-black">X</span>
              </div>
            </div>
            
            {/* Side elements */}
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute bottom-8 left-[12%] w-[12%] h-16 bg-white/[0.02] border border-white/5 rounded"
            />
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
              className="absolute bottom-8 right-[12%] w-[12%] h-16 bg-white/[0.02] border border-white/5 rounded"
            />
            
            {/* Light beams */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[70%] h-full">
              <div className="absolute top-0 left-[20%] w-px h-full bg-gradient-to-b from-[#e2231a]/20 to-transparent" />
              <div className="absolute top-0 right-[20%] w-px h-full bg-gradient-to-b from-[#e2231a]/20 to-transparent" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}