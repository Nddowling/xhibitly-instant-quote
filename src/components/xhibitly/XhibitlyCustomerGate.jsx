import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowRight, ShieldCheck, Sparkles, Users } from 'lucide-react';
import useCustomerBootstrap from '@/components/xhibitly/useCustomerBootstrap';

export default function XhibitlyCustomerGate() {
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userName, setUserName] = useState('');

  useCustomerBootstrap(true);

  useEffect(() => {
    base44.auth.isAuthenticated()
      .then(async (authed) => {
        setIsAuthed(authed);
        if (authed) {
          const me = await base44.auth.me();
          setUserName(me?.full_name?.split(' ')[0] || 'there');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = () => {
    base44.auth.redirectToLogin('/XhibitlyStart2');
  };

  const handleContinue = () => {
    window.location.href = '/CustomerOrders';
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#041a44] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(24,195,248,0.35),transparent_28%),radial-gradient(circle_at_top_right,rgba(38,99,235,0.28),transparent_26%),linear-gradient(180deg,#041a44_0%,#072f7a_55%,#0a4fb3_100%)]" />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />

      <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex justify-center mb-10">
            <div className="rounded-2xl overflow-hidden">
              <img
                src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/f3c8fd783_IMG_1062.png"
                alt="Xhibitly"
                className="h-12 md:h-14 w-auto object-contain block"
              />
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.9fr] items-center">
            <section className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur">
                <Sparkles className="w-4 h-4 text-[#18C3F8]" />
                Customer Quote Portal
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
                  Build your next
                  <span className="block text-[#6ddcff]">Exhibitly booth quote</span>
                </h1>
                <p className="max-w-2xl text-base md:text-lg text-white/80 leading-relaxed">
                  Log in to review your own quotes, start a new booth project, and work directly inside the Exhibitly customer experience.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <ShieldCheck className="w-5 h-5 text-[#6ddcff] mb-3" />
                  <p className="text-sm font-bold">Secure login</p>
                  <p className="text-xs text-white/70 mt-1">Use the same auth methods already enabled in the app.</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <Users className="w-5 h-5 text-[#6ddcff] mb-3" />
                  <p className="text-sm font-bold">Your own data</p>
                  <p className="text-xs text-white/70 mt-1">Customers only see their own contact details and quotes.</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <Sparkles className="w-5 h-5 text-[#6ddcff] mb-3" />
                  <p className="text-sm font-bold">Fast quoting</p>
                  <p className="text-xs text-white/70 mt-1">Start a new quote and move straight into the live catalog flow.</p>
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-white/15 bg-white/12 p-6 md:p-8 backdrop-blur-xl shadow-[0_30px_80px_rgba(2,8,23,0.35)]">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9adfff]">Welcome</p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight">
                    {loading ? 'Checking your access…' : isAuthed ? `Welcome back, ${userName}` : 'Sign in to continue'}
                  </h2>
                  <p className="mt-3 text-sm text-white/75 leading-relaxed">
                    {loading
                      ? 'Please wait while we verify your session.'
                      : isAuthed
                        ? 'You are signed in. Continue into your customer quote workspace.'
                        : 'Use any active login method already enabled in the app to access your Exhibitly quote workspace.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#02112f]/45 p-4 text-sm text-white/75">
                  After login, you will go directly into the Exhibitly quote workspace and only see your own information and quotes.
                </div>

                <Button
                  onClick={isAuthed ? handleContinue : handleLogin}
                  disabled={loading}
                  className="w-full h-12 rounded-2xl bg-[#18C3F8] hover:bg-[#0fb2e4] text-white font-bold text-base"
                >
                  {loading ? 'Loading…' : isAuthed ? 'Enter Quote Workspace' : 'Log In / Sign Up'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}