import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LeadCaptureForm({ source = 'store_landing', ctaLabel = 'Send Me the Free Guide' }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    setError('');
    setLoading(true);
    try {
      await base44.entities.Lead.create({
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
        source,
        lead_magnet: 'biohacking-starter-guide',
        status: 'new',
      });
      navigate('/store/thank-you');
    } catch (err) {
      console.error(err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        placeholder="First name (optional)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="bg-white/8 border-white/15 text-white placeholder:text-white/30 h-12 rounded-xl focus:border-[#00c9a7] focus:ring-[#00c9a7]/20"
      />
      <Input
        type="email"
        placeholder="Your email address *"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="bg-white/8 border-white/15 text-white placeholder:text-white/30 h-12 rounded-xl focus:border-[#00c9a7] focus:ring-[#00c9a7]/20"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-[#00c9a7] hover:bg-[#00b396] text-black font-bold h-12 text-base rounded-xl transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
        ) : (
          <>{ctaLabel} <ArrowRight className="w-4 h-4 ml-2" /></>
        )}
      </Button>
      <p className="text-center text-xs text-white/25">No spam. Unsubscribe anytime.</p>
    </form>
  );
}
