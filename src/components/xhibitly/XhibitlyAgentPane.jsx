import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MessageBubble from '@/components/agents/MessageBubble';
import { MessageSquare, Send, Sparkles } from 'lucide-react';

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
    <div className="w-full h-full min-h-0 flex flex-col bg-white overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-5 py-5 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf6ff] text-[#18C3F8]">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black tracking-tight text-slate-900">AI Booth Guide</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                live chat
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              I’ll gather event info, brand details, and suggest popular catalog items while helping shape the proposal.
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2 bg-slate-50 flex-shrink-0">
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

      <div ref={scrollRef} className="min-h-0 p-3 space-y-3 bg-slate-50/70 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
            <Sparkles className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-800">No conversation started yet</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Start chatting and I’ll guide the booth build, ask the right questions, and recommend exact products from the catalog.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))
        )}
        {loading && <div className="text-xs text-slate-400 px-1">Xhibitly AI is thinking…</div>}
      </div>

      <div className="p-3 border-t border-slate-200 bg-white space-y-2.5 mt-auto flex-shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current Focus</p>
          <p className="text-[11px] text-slate-500 mt-1">Booth size, event, brand, goals, and product direction</p>
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Tell me your booth size, event, company, or product idea"
            className="h-12 rounded-xl"
          />
          <Button onClick={() => handleSend()} className="h-12 px-5 rounded-xl bg-[#18C3F8] hover:bg-[#0fb2e4] text-white">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}