import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VoiceCommandButton({ isListening, onToggle, hasTranscript, onOpenPanel }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (isListening) {
      setPulse(true);
    } else {
      setPulse(false);
    }
  }, [isListening]);

  // Keyboard shortcut: Cmd+Shift+V
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[60] flex flex-col items-end gap-2">
      {/* Transcript indicator dot */}
      <AnimatePresence>
        {hasTranscript && !isListening && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={onOpenPanel}
            className="w-8 h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shadow-lg"
          >
            💬
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main mic button */}
      <motion.div className="relative">
        {/* Pulse rings when listening */}
        <AnimatePresence>
          {pulse && (
            <>
              <motion.div
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-[#e2231a]"
              />
              <motion.div
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                className="absolute inset-0 rounded-full bg-[#e2231a]"
              />
            </>
          )}
        </AnimatePresence>

        <Button
          onClick={onToggle}
          className={`relative w-14 h-14 rounded-full shadow-xl transition-all duration-200 ${
            isListening
              ? 'bg-[#e2231a] hover:bg-[#b01b13] scale-110'
              : 'bg-slate-900 hover:bg-slate-800'
          }`}
        >
          {isListening ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </Button>
      </motion.div>
    </div>
  );
}