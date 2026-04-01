import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { MessageSquare, X, Minus } from 'lucide-react';

export default function GlobalAgentLauncher() {
  const [hidden, setHidden] = React.useState(false);
  const [conversation, setConversation] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const renderMessageContent = (content) => {
    if (!content) return null;

    const linkMatches = [...content.matchAll(/\[([^\]]+)\]\((\/[^)]+)\)/g)];
    if (linkMatches.length === 0) {
      return <p>{content}</p>;
    }

    const parts = content.split(/\[[^\]]+\]\(\/[^)]+\)/g);

    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          const match = linkMatches[index];
          return (
            <React.Fragment key={`${part}-${index}`}>
              {part ? <p>{part}</p> : null}
              {match ? (
                <Link
                  to={match[2]}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center rounded-xl bg-[#e2231a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c41e17]"
                >
                  {match[1]}
                </Link>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  React.useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  const ensureConversation = async () => {
    if (conversation) return conversation;
    const created = await base44.agents.createConversation({
      agent_name: 'product_assistant',
      metadata: {
        name: 'Support Agent',
        description: 'Global broker help chat',
      },
    });
    setConversation(created);
    setMessages(created.messages || []);
    return created;
  };

  const handleOpen = async () => {
    setOpen(true);
    await ensureConversation();
  };

  const handleClose = () => {
    setOpen(false);
    setHidden(true);
    setConversation(null);
    setMessages([]);
    setInput('');
    setLoading(false);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const currentConversation = await ensureConversation();
    setLoading(true);
    setInput('');
    await base44.agents.addMessage(currentConversation, {
      role: 'user',
      content: trimmed,
    });
  };

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed bottom-5 right-5 z-[90] inline-flex h-12 items-center gap-2 rounded-full bg-[#e2231a] px-4 text-sm font-semibold text-white shadow-2xl shadow-[#e2231a]/30 hover:bg-[#c41e17]"
      >
        <MessageSquare className="w-4 h-4" />
        Show Agent
      </button>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-[90] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-900">Support Agent</p>
              <p className="text-xs text-slate-500">Ask for help from anywhere</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                <Minus className="w-4 h-4" />
              </button>
              <button onClick={handleClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Need help finding products, building a quote, or framing a recommendation for your buyer? Ask here.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.role === 'user' ? 'ml-auto bg-[#e2231a] text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  {renderMessageContent(message.content)}
                </div>
              ))
            )}
            {loading && <div className="text-xs text-slate-400">Agent is typing...</div>}
          </div>

          <div className="border-t border-slate-200 p-3 bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about products, quotes, or client positioning..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/20"
              />
              <button
                onClick={handleSend}
                className="rounded-xl bg-[#e2231a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c41e17]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleOpen}
        className="fixed bottom-5 right-5 z-[90] inline-flex h-12 items-center gap-2 rounded-full bg-[#e2231a] px-4 text-sm font-semibold text-white shadow-2xl shadow-[#e2231a]/30 hover:bg-[#c41e17]"
      >
        <MessageSquare className="w-4 h-4" />
        Agent Help
      </button>
    </>
  );
}