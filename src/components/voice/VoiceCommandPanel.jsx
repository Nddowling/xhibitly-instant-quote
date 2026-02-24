import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Loader2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#e2231a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Volume2 className="w-3.5 h-3.5 text-[#e2231a]" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? 'bg-slate-800 text-white'
          : 'bg-white border border-slate-200 text-slate-700'
      }`}>
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VoiceCommandPanel({
  isOpen,
  onClose,
  messages,
  isListening,
  isProcessing,
  interimTranscript,
  onToggleListening
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-36 md:bottom-24 right-4 md:right-6 z-[59] w-[calc(100vw-2rem)] max-w-md"
        >
          <div className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[60vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#e2231a] animate-pulse" />
                <span className="text-sm font-semibold text-slate-800">Voice Assistant</span>
                {isListening && (
                  <span className="text-xs text-[#e2231a] font-medium">Listening...</span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
              {messages.length === 0 && !interimTranscript && (
                <div className="text-center py-8 text-slate-400">
                  <Mic className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Press the mic button and speak a command</p>
                  <p className="text-xs mt-1 text-slate-300">Try "Go to dashboard" or "Create a booth for nike.com"</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}

              {/* Interim transcript */}
              {interimTranscript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-slate-300/50 text-slate-500 italic">
                    <p className="text-sm">{interimTranscript}</p>
                  </div>
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#e2231a]/10 flex items-center justify-center flex-shrink-0">
                    <Volume2 className="w-3.5 h-3.5 text-[#e2231a]" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#e2231a]" />
                      <span className="text-sm text-slate-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom bar */}
            <div className="px-4 py-3 bg-white border-t border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {isListening ? '🔴 Listening... speak now' : 'Tap mic to speak'}
                </p>
                <Button
                  size="sm"
                  onClick={onToggleListening}
                  className={`h-8 px-3 rounded-full text-xs font-medium ${
                    isListening
                      ? 'bg-[#e2231a] hover:bg-[#b01b13] text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 mr-1" />
                  {isListening ? 'Stop' : 'Speak'}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}