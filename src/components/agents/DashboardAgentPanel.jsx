import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Minus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardAgentPanel({
  agentName,
  title,
  subtitle,
  promptHint,
  starterQuestions = []
}) {
  const [conversation, setConversation] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const renderMessageContent = (content) => {
    if (!content) return null;
    const linkMatches = [...content.matchAll(/\[([^\]]+)\]\((\/[^)]+)\)/g)];
    if (linkMatches.length === 0) return <p className="whitespace-pre-wrap">{content}</p>;
    const parts = content.split(/\[[^\]]+\]\(\/[^)]+\)/g);

    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          const match = linkMatches[index];
          return (
            <React.Fragment key={`${part}-${index}`}>
              {part ? <p className="whitespace-pre-wrap">{part}</p> : null}
              {match ? (
                <Link
                  to={match[2]}
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
      agent_name: agentName,
      metadata: {
        name: title,
        description: subtitle,
      },
    });
    setConversation(created);
    setMessages(created.messages || []);
    return created;
  };

  const handleSend = async (messageText = input) => {
    const trimmed = String(messageText || '').trim();
    if (!trimmed) return;
    const currentConversation = await ensureConversation();
    setLoading(true);
    setInput('');
    await base44.agents.addMessage(currentConversation, {
      role: 'user',
      content: trimmed,
    });
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e2231a]/10 text-[#e2231a] flex-shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setCollapsed((value) => !value)}>
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      {!collapsed && (
        <div className="p-5 space-y-4">
          {starterQuestions.length > 0 && messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {starterQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => handleSend(question)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:border-[#e2231a]/30 hover:text-[#e2231a]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {question}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                {promptHint}
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'ml-auto bg-[#e2231a] text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  {renderMessageContent(message.content)}
                </div>
              ))
            )}
            {loading && <div className="text-xs text-slate-400">Agent is thinking...</div>}
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a broker or executive question..."
            />
            <Button onClick={() => handleSend()} className="bg-[#e2231a] hover:bg-[#c41e17] text-white">
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}