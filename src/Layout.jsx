import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  LogOut, Users, Menu, X, LayoutDashboard, Settings as SettingsIcon,
  ArrowLeft, BookOpen, ClipboardList, Tag, BarChart2, ChevronDown, Settings2, ShieldCheck
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const analyticsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { checkAuth(); initDarkMode(); }, [currentPageName]);
  useEffect(() => { setMobileMenuOpen(false); }, [currentPageName]);

  useEffect(() => {
    const handler = (e) => {
      if (analyticsRef.current && !analyticsRef.current.contains(e.target)) {
        setAnalyticsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    if (isDark) document.documentElement.classList.add('dark');
  };

  const handleLogout = () => base44.auth.logout(createPageUrl('Home'));

  const noHeaderPages = ['Loading', 'Home', 'Landing', 'UserTypeSelection', 'QuoteView'];
  const showHeader = !noHeaderPages.includes(currentPageName) && user;
  const rootPages = ['SalesDashboard', 'Contacts', 'CatalogQuote', 'PricingRules', 'Reports', 'Dashboards', 'Setup', 'ReportBuilder', 'ReportView', 'DashboardView'];
  const showBackButton = showHeader && !rootPages.includes(currentPageName);

  // Primary nav (always visible on desktop)
  const primaryNav = [
    { page: 'SalesDashboard', label: 'Dashboard', icon: LayoutDashboard },
    { page: 'Contacts',       label: 'Clients',   icon: Users },
    { page: 'CatalogQuote',   label: 'Catalog',   icon: BookOpen },
    { page: 'RecentQuotes',   label: 'Quotes',    icon: ClipboardList },
    { page: 'PricingRules',   label: 'Pricing',   icon: Tag },
  ];

  // Analytics dropdown items
  const analyticsNav = [
    { page: 'Reports',       label: 'Reports',    icon: BarChart2 },
    { page: 'Dashboards',    label: 'Dashboards', icon: LayoutDashboard },
  ];

  const adminNav = [
    { page: 'ExecutiveDashboard', label: 'Executive', icon: ShieldCheck },
  ];

  const analyticsActive = analyticsNav.some(n => n.page === currentPageName) ||
    ['ReportBuilder','ReportView','DashboardView'].includes(currentPageName);

  // Mobile: all nav items flat
  const allMobileNav = [
    ...primaryNav,
    ...analyticsNav,
    ...(user?.role === 'admin' ? adminNav : []),
    { page: 'Setup', label: 'Setup', icon: Settings2 },
  ];

  // Bottom mobile nav (5 max)
  const bottomNav = [
    { page: 'SalesDashboard', label: 'Dashboard', icon: LayoutDashboard },
    { page: 'Contacts',       label: 'Clients',   icon: Users },
    { page: 'CatalogQuote',   label: 'Catalog',   icon: BookOpen },
    { page: 'RecentQuotes',   label: 'Quotes',    icon: ClipboardList },
    { page: 'Reports',        label: 'Reports',   icon: BarChart2 },
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
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-14 md:h-16">

              {/* Left: Logo + back */}
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                {showBackButton && (
                  <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors mr-1 flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <Link to={createPageUrl('SalesDashboard')} className="flex items-center gap-2.5 shrink-0">
                  <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0">EH</div>
                  <span className="text-sm font-bold tracking-tight whitespace-nowrap hidden sm:block">The Exhibitors' Handbook</span>
                  <span className="text-xs text-white/30 border border-white/10 rounded-full px-2 py-0.5 hidden xl:block">Dealer Portal</span>
                </Link>
              </div>

              {/* Center: Main nav (desktop) */}
              <nav className="hidden md:flex items-center gap-0.5 flex-1 min-w-0 justify-center">
                {primaryNav.map(({ page, label, icon: Icon }) => (
                  <Link key={page} to={createPageUrl(page)}>
                    <button className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      currentPageName === page ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  </Link>
                ))}

                {/* Analytics dropdown */}
                <div className="relative" ref={analyticsRef}>
                  <button
                    onClick={() => setAnalyticsOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      analyticsActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    Analytics
                    <ChevronDown className={`w-3 h-3 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {analyticsOpen && (
                    <div className="absolute top-full left-0 mt-1 w-44 bg-[#222] rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50">
                      {analyticsNav.map(({ page, label, icon: Icon }) => (
                        <Link key={page} to={createPageUrl(page)} onClick={() => setAnalyticsOpen(false)}>
                          <div className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                            currentPageName === page ? 'bg-[#e2231a]/20 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'
                          }`}>
                            <Icon className="w-4 h-4" />
                            {label}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {user?.role === 'admin' && adminNav.map(({ page, label, icon: Icon }) => (
                  <Link key={page} to={createPageUrl(page)}>
                    <button className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      currentPageName === page ? 'bg-[#e2231a] text-white' : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  </Link>
                ))}

                {/* Setup */}
                {user?.role === 'admin' && (
                  <Link to={createPageUrl('Setup')}>
                    <button className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      currentPageName === 'Setup' ? 'bg-[#e2231a] text-white' : 'text-white/60 hover:text-white hover:bg-white/8'
                    }`}>
                      <Settings2 className="w-4 h-4" />
                      Setup
                    </button>
                  </Link>
                )}
              </nav>

              {/* Right: User + actions */}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
                <span className="hidden xl:block text-xs text-white/40 mr-1 max-w-[96px] truncate">
                  {user?.full_name?.split(' ')[0] || 'Dealer'}
                </span>
                <Link to={createPageUrl('Settings')}>
                  <button className="p-2 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors">
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                </Link>
                <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/8 text-white/50 hover:text-white transition-colors hidden sm:block">
                  <LogOut className="w-4 h-4" />
                </button>
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile slide-down */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-[#111] border-t border-white/5">
              <div className="px-4 py-3 space-y-1">
                {allMobileNav.map(({ page, label, icon: Icon }) => (
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
            {bottomNav.map(({ page, label, icon: Icon }) => (
              <Link key={page} to={createPageUrl(page)} className="flex-1">
                <button className={`w-full h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  currentPageName === page || (page === 'Reports' && analyticsActive) ? 'text-[#e2231a]' : 'text-white/55'
                }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-medium leading-tight">{label}</span>
                </button>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}