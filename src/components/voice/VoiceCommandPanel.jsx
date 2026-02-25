import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Loader2, Volume2, PhoneOff, Clock, Zap, CheckCircle2, AlertCircle, ChevronRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FunctionDisplay = ({ toolCall }) => {
    const [expanded, setExpanded] = useState(false);
    const name = toolCall?.name || 'Function';
    const status = toolCall?.status || 'pending';
    const results = toolCall?.results;
    
    const parsedResults = (() => {
        if (!results) return null;
        try {
            return typeof results === 'string' ? JSON.parse(results) : results;
        } catch {
            return results;
        }
    })();
    
    const isError = results && (
        (typeof results === 'string' && /error|failed/i.test(results)) ||
        (parsedResults?.success === false)
    );
    
    const statusConfig = {
        pending: { icon: Clock, color: 'text-slate-400', text: 'Pending' },
        running: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
        in_progress: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
        completed: isError ? 
            { icon: AlertCircle, color: 'text-red-500', text: 'Failed' } : 
            { icon: CheckCircle2, color: 'text-green-600', text: 'Success' },
        success: { icon: CheckCircle2, color: 'text-green-600', text: 'Success' },
        failed: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' },
        error: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' }
    }[status] || { icon: Zap, color: 'text-slate-500', text: '' };
    
    const Icon = statusConfig.icon;
    const formattedName = name.split('.').reverse().join(' ').toLowerCase();
    
    return (
        <div className="mt-2 text-xs">
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all",
                    "hover:bg-slate-50 w-full",
                    expanded ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"
                )}
            >
                <Icon className={cn("h-3 w-3", statusConfig.color, statusConfig.spin && "animate-spin")} />
                <span className="text-slate-700 font-medium capitalize truncate">{formattedName}</span>
                {statusConfig.text && (
                    <span className={cn("text-slate-500 ml-auto", isError && "text-red-600")}>
                        {statusConfig.text}
                    </span>
                )}
                {!statusConfig.spin && (toolCall.arguments_string || results) && (
                    <ChevronRight className={cn("h-3 w-3 text-slate-400 transition-transform", 
                        expanded && "rotate-90")} />
                )}
            </button>
            
            {expanded && !statusConfig.spin && (
                <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200 space-y-2 text-left">
                    {toolCall.arguments_string && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Parameters</div>
                            <pre className="bg-slate-50 rounded-md p-2 text-[10px] text-slate-600 whitespace-pre-wrap">
                                {(() => {
                                    try {
                                        return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2);
                                    } catch {
                                        return toolCall.arguments_string;
                                    }
                                })()}
                            </pre>
                        </div>
                    )}
                    {parsedResults && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Result</div>
                            <pre className="bg-slate-50 rounded-md p-2 text-[10px] text-slate-600 whitespace-pre-wrap max-h-48 overflow-auto">
                                {typeof parsedResults === 'object' ? 
                                    JSON.stringify(parsedResults, null, 2) : parsedResults}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export function MessageBubble({ message, onImageClick }) {
    const isUser = message.role === 'user';
    
    return (
        <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
                <div className="h-7 w-7 rounded-full bg-[#e2231a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Volume2 className="h-3.5 w-3.5 text-[#e2231a]" />
                </div>
            )}
            <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
                {message.content && (
                    <div className={cn(
                        "rounded-2xl px-4 py-2.5",
                        isUser ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-700"
                    )}>
                        {isUser ? (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                        ) : (
                            <ReactMarkdown 
                                className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                                components={{
                                    img: ({ node, ...props }) => (
                                        <img 
                                            {...props} 
                                            className="rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity my-2 max-w-full h-auto object-cover max-h-48 shadow-sm border border-slate-100"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (onImageClick && props.src) {
                                                    onImageClick(props.src);
                                                }
                                            }}
                                        />
                                    )
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                    </div>
                )}
                
                {message.tool_calls?.length > 0 && (
                    <div className="space-y-1 w-full mt-1">
                        {message.tool_calls.map((toolCall, idx) => (
                            <FunctionDisplay key={idx} toolCall={toolCall} />
                        ))}
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
  onToggleListening,
  conversationActive,
  onEndConversation
}) {
  const scrollRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript]);

  return (
    <AnimatePresence>
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-8 h-8" />
          </Button>
          <img 
            src={lightboxImage} 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default" 
            alt="Enlarged view" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
                <div className={`w-2 h-2 rounded-full ${conversationActive ? 'bg-[#e2231a] animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-sm font-semibold text-slate-800">Voice Assistant</span>
                {isListening && (
                  <span className="text-xs text-[#e2231a] font-medium">Listening...</span>
                )}
                {isProcessing && (
                  <span className="text-xs text-amber-500 font-medium">Thinking...</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {conversationActive && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onEndConversation} 
                    className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1"
                  >
                    <PhoneOff className="w-3 h-3" />
                    End
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
              {messages.length === 0 && !interimTranscript && (
                <div className="text-center py-8 text-slate-400">
                  <Mic className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Tap the mic and start talking</p>
                  <div className="text-xs mt-2 text-slate-300 space-y-1">
                    <p>"Go to my pipeline"</p>
                    <p>"Find me a 10-foot backwall"</p>
                    <p>"Create a booth for nike.com"</p>
                    <p>"What Formulate products do you have?"</p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} onImageClick={setLightboxImage} />
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
                  {isListening ? '🔴 Listening... speak now' : isProcessing ? '⏳ Processing...' : 'Tap mic to speak'}
                </p>
                <div className="flex items-center gap-2">
                  {conversationActive && messages.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onEndConversation}
                      className="h-8 px-3 rounded-full text-xs font-medium text-red-500 border-red-200 hover:bg-red-50"
                    >
                      <PhoneOff className="w-3 h-3 mr-1" />
                      End Chat
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={onToggleListening}
                    disabled={isProcessing}
                    className={`h-8 px-3 rounded-full text-xs font-medium ${
                      isListening
                        ? 'bg-[#e2231a] hover:bg-[#b01b13] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5 mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
                    {isListening ? 'Pause' : 'Speak'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}