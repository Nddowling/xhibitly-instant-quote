import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { LogOut, FileText, Users, Menu, X, LayoutDashboard, Settings as SettingsIcon, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ErrorBoundary from './components/ErrorBoundary';


export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    initDarkMode();
  }, [currentPageName]);

  // Close mobile menu on page change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPageName]);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    }
    setIsLoading(false);
  };

  const initDarkMode = () => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  };

  const handleLogout = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  const handleBack = () => {
    navigate(-1);
  };

  const noHeaderPages = ['Loading', 'Home', 'Landing', 'UserTypeSelection'];
  const showHeader = !noHeaderPages.includes(currentPageName) && user;
  const rootPages = ['SalesDashboard', 'Contacts', 'CatalogQuote'];
  const showBackButton = showHeader && !rootPages.includes(currentPageName);

  const navItems = [
    { page: 'SalesDashboard', label: 'Dashboard', icon: LayoutDashboard },
    { page: 'Contacts', label: 'Clients', icon: Users },
    { page: 'CatalogQuote', label: 'Catalog Quote', icon: BookOpen },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        body { overscroll-behavior: none; }
        button, a, [role="button"] {
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }
      `}</style>

      {showHeader && (
        <header className="bg-[#1a1a1a] text-white shadow-xl fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14 md:h-16">

              {/* Left: Logo + back */}
              <div className="flex items-center gap-2 min-w-0">
                {showBackButton && (
                  <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors mr-1 flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <Link to={createPageUrl('SalesDashboard')} className="flex items-center gap-2.5 shrink-0">
                  <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0">EH</div>
                  <span className="text-sm font-bold tracking-tight whitespace-nowrap hidden sm:block">The Exhibitors' Handbook</span>
                  <span className="text-xs text-white/30 border border-white/10 rounded-full px-2 py-0.5 hidden lg:block">Dealer Portal</span>
                </Link>
              </div>

              {/* Center: Main nav (desktop) */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(({ page, label, icon: Icon }) => (
                  <Link key={page} to={createPageUrl(page)}>
                    <button className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentPageName === page
                        ? 'bg-[#e2231a] text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  </Link>
                ))}
              </nav>

              {/* Right: User + actions */}
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="hidden sm:block text-xs text-white/40 mr-1">
                  {user?.full_name?.split(' ')[0] || 'Dealer'}
                </span>
                <Link to={createPageUrl('Settings')}>
                  <button className="p-2 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors">
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors hidden sm:block"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile slide-down */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-[#111] border-t border-white/5">
              <div className="px-4 py-3 space-y-1">
                {navItems.map(({ page, label, icon: Icon }) => (
                  <Link key={page} to={createPageUrl(page)} onClick={() => setMobileMenuOpen(false)}>
                    <div className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                      currentPageName === page ? 'bg-[#e2231a]/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{label}</span>
                      {currentPageName === page && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#e2231a]" />}
                    </div>
                  </Link>
                ))}
                <div className="h-px bg-white/5 my-2" />
                <Link to={createPageUrl('Settings')} onClick={() => setMobileMenuOpen(false)}>
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white">
                    <SettingsIcon className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
                  </div>
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Log Out</span>
                </button>
              </div>
            </div>
          )}
        </header>
      )}

      <main className={showHeader ? 'pt-14 md:pt-16' : ''}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Nav */}
      {showHeader && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-white/8 z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-around h-14">
            {navItems.map(({ page, label, icon: Icon }) => (
              <Link key={page} to={createPageUrl(page)} className="flex-1">
                <button className={`w-full h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  currentPageName === page ? 'text-[#e2231a]' : 'text-white/35'
                }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-medium">{label}</span>
                </button>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}