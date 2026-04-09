import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MessageBubble from '@/components/agents/MessageBubble';
import { Sparkles, Send } from 'lucide-react';

const STARTERS = [
  'I need help designing a 10x10 booth',
  'Help me choose products for a 10x20 island feel',
  'Can you build me a quote-ready booth concept?'
];

export default function XhibitlyAgentPane({ queuedPrompt, onPromptConsumed }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    ensureConversation();
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setLoading(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    });
    return unsubscribe;
  }, [conversation?.id]);

  useEffect(() => {
    if (queuedPrompt && conversation) {
      handleSend(queuedPrompt);
      onPromptConsumed?.();
    }
  }, [queuedPrompt, conversation]);

  const ensureConversation = async () => {
    const created = await base44.agents.createConversation({
      agent_name: 'xhibitly_sales_designer',
      metadata: {
        name: 'Xhibitly Booth Planning',
        description: 'Customer-facing exhibit design assistant',
      },
    });
    setConversation(created);
    setMessages(created.messages || []);
  };

  const handleSend = async (messageText = input) => {
    const trimmed = String(messageText || '').trim();
    if (!trimmed || !conversation) return;
    setLoading(true);
    setInput('');
    await base44.agents.addMessage(conversation, {
      role: 'user',
      content: trimmed,
    });
  };

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-white text-slate-900">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#18C3F8]">The AI Bot</p>
            <h2 className="text-2xl font-black text-[#0D2E73]">The Speed of AI</h2>
          </div>
        </div>
        <p className="text-sm text-slate-600 max-w-xl">I’ll guide your booth design, gather event and brand details, and suggest popular catalog items while building toward a quote-ready direction.</p>
      </div>

      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-2 bg-slate-50">
        {STARTERS.map((item) => (
          <button
            key={item}
            onClick={() => handleSend(item)}
            className="px-3 py-2 rounded-full bg-white border border-slate-200 text-xs font-semibold text-[#0D4FB3] hover:border-[#18C3F8]/50"
          >
            {item}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-[#18C3F8]/20 bg-[#18C3F8]/5 p-4 text-sm text-slate-700">
            To get started, tell me your booth size, event name, company, and whether you want me to help pull your branding direction from your website.
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))
        )}
        {loading && <div className="text-xs text-slate-400">Xhibitly AI is thinking…</div>}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about booth size, products, branding, budget, or event details"
            className="h-12 rounded-xl"
          />
          <Button onClick={() => handleSend()} className="h-12 px-5 rounded-xl bg-[#0D4FB3] hover:bg-[#0A3D8B] text-white">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}