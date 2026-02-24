import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { LogOut, FileText, Plus, Home as HomeIcon, Settings as SettingsIcon, ArrowLeft, LayoutDashboard, ChevronDown, User, Users, GraduationCap, Menu, X, Package, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import VoiceActivationProvider from './components/voice/VoiceActivationProvider';

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

  const handleSwitchUserType = async (newType) => {
    setMobileMenuOpen(false);
    try {
      const isSalesRep = newType === 'sales_rep';
      
      await base44.auth.updateMe({
        user_type: newType,
        is_sales_rep: isSalesRep
      });

      if (isSalesRep && !user.is_sales_rep) {
        const existingReps = await base44.entities.SalesRep.filter({ user_id: user.id });
        if (existingReps.length === 0) {
          await base44.entities.SalesRep.create({
            user_id: user.id,
            email: user.email,
            company_name: user.company_name || '',
            contact_name: user.contact_name || user.full_name || '',
            phone: user.phone || ''
          });
        }
      }

      if (isSalesRep) {
        navigate(createPageUrl('SalesDashboard'));
      } else if (newType === 'student') {
        navigate(createPageUrl('StudentHome'));
      } else {
        navigate(createPageUrl('QuoteRequest'));
      }
      window.location.reload();
    } catch (e) {
      console.error('Error switching user type:', e);
    }
  };

  const getUserTypeLabel = () => {
    if (user?.is_sales_rep) return 'Sales Rep';
    if (user?.user_type === 'student') return 'Student';
    return 'Customer';
  };

  const getUserTypeIcon = () => {
    if (user?.is_sales_rep) return Users;
    if (user?.user_type === 'student') return GraduationCap;
    return User;
  };

  // Pages that don't need the header
  const noHeaderPages = ['Loading', 'Home', 'Landing', 'UserTypeSelection'];
  const showHeader = !noHeaderPages.includes(currentPageName) && user;

  // Pages where we hide the bottom nav (full-screen experiences)
  const fullScreenPages = ['DesignConfigurator'];

  // Root dashboard pages (no back button)
  const rootPages = ['SalesDashboard', 'QuoteRequest', 'OrderHistory', 'Contacts', 'StudentHome'];
  const showBackButton = showHeader && !rootPages.includes(currentPageName);

  // Pages where mobile bottom nav is shown
  const showMobileNav = showHeader && !noHeaderPages.includes(currentPageName) && !fullScreenPages.includes(currentPageName);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <VoiceActivationProvider>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{`
        :root {
          --primary: #e2231a;
          --primary-light: #f04238;
          --primary-dark: #b01b13;
        }
        body {
          overscroll-behavior: none;
        }
        button, a, [role="button"] {
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }
      `}</style>

      {showHeader && (
        <header className="bg-[#e2231a] text-white shadow-lg fixed top-0 left-0 right-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 md:h-16">
              <div className="flex items-center gap-2">
                {showBackButton ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="text-white hover:bg-white/20 mr-1"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                ) : null}
                <Link to={createPageUrl(user?.is_sales_rep ? 'SalesDashboard' : 'QuoteRequest')} className="flex items-center gap-2 shrink-0">
                  <span className="text-sm md:text-base font-bold tracking-tight whitespace-nowrap">The Exhibitors' Handbook</span>
                  <span className="text-sm font-normal tracking-tight hidden lg:inline whitespace-nowrap ml-1 text-white/70">Instant Quote</span>
                </Link>
              </div>
              
              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-2">
                {user?.is_sales_rep ? (
                  <>
                    <Link to={createPageUrl('SalesDashboard')}>
                      <Button 
                        variant="ghost"
                        className={`text-white hover:bg-white/20 ${currentPageName === 'SalesDashboard' ? 'border border-white/30' : ''}`}
                      >
                        Dashboard
                      </Button>
                    </Link>
                    <Link to={createPageUrl('Pipeline')}>
                      <Button 
                        variant="ghost"
                        className={`text-white hover:bg-white/20 ${currentPageName === 'Pipeline' ? 'border border-white/30' : ''}`}
                      >
                        Pipeline
                      </Button>
                    </Link>
                    <Link to={createPageUrl('Contacts')}>
                      <Button 
                        variant="ghost"
                        className={`text-white hover:bg-white/20 ${currentPageName === 'Contacts' ? 'border border-white/30' : ''}`}
                      >
                        Contacts
                      </Button>
                    </Link>
                    <Link to={createPageUrl('Product3DManager')}>
                      <Button 
                        variant="ghost"
                        className={`text-white hover:bg-white/20 ${currentPageName === 'Product3DManager' ? 'border border-white/30' : ''}`}
                      >
                        Catalog
                      </Button>
                    </Link>
                    <Link to={createPageUrl('SalesQuoteStart')}>
                      <Button 
                        variant="ghost"
                        className="text-white hover:bg-white/20 border border-white/30"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        New Quote
                      </Button>
                    </Link>
                  </>
                ) : user?.user_type === 'student' ? (
                  <Link to={createPageUrl('StudentHome')}>
                    <Button 
                      variant="ghost"
                      className={`text-white hover:bg-white/20 ${currentPageName === 'StudentHome' ? 'border border-white/30' : ''}`}
                    >
                      My Submissions
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to={createPageUrl('QuoteRequest')}>
                      <Button 
                        variant="ghost"
                        className="text-white hover:bg-white/20 border border-white/30"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        New Quote
                      </Button>
                    </Link>
                    <Link to={createPageUrl('OrderHistory')}>
                      <Button 
                        variant="ghost"
                        className={`text-white hover:bg-white/20 ${currentPageName === 'OrderHistory' ? 'border border-white/30' : ''}`}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Order History
                      </Button>
                    </Link>
                  </>
                )}
                <div className="h-6 w-px bg-white/20 mx-2" />
                <div className="text-sm text-white/80 mr-2">
                  Hello, {user?.full_name?.split(' ')[0] || user?.contact_name?.split(' ')[0]}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-white hover:bg-white/20 gap-2">
                      {React.createElement(getUserTypeIcon(), { className: "w-4 h-4" })}
                      {getUserTypeLabel()}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleSwitchUserType('customer')}>
                      <User className="w-4 h-4 mr-2" />
                      Customer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSwitchUserType('sales_rep')}>
                      <Users className="w-4 h-4 mr-2" />
                      Sales Rep
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSwitchUserType('student')}>
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Student
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link to={createPageUrl('Settings')}>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-white hover:bg-white/10"
                  >
                    <SettingsIcon className="w-5 h-5" />
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleLogout}
                  className="text-white hover:bg-white/10"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </nav>

              {/* Mobile: Role Switcher + Hamburger */}
              <div className="md:hidden flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-1 px-2 text-xs">
                      {React.createElement(getUserTypeIcon(), { className: "w-4 h-4" })}
                      <span className="max-w-[60px] truncate">{getUserTypeLabel()}</span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => handleSwitchUserType('customer')}>
                      <User className="w-4 h-4 mr-2" />
                      Customer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSwitchUserType('sales_rep')}>
                      <Users className="w-4 h-4 mr-2" />
                      Sales Rep
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSwitchUserType('student')}>
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Student
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-white hover:bg-white/20"
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Slide-Down Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-[#b01b13] border-t border-white/10">
              <div className="px-4 py-3 space-y-1">
                <div className="px-3 py-2 text-white/70 text-sm">
                  {user?.full_name?.split(' ')[0] || user?.contact_name?.split(' ')[0]} — {getUserTypeLabel()}
                </div>
                <div className="h-px bg-white/10 my-1" />

                {user?.is_sales_rep ? (
                  <>
                    <Link to={createPageUrl('SalesDashboard')} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'SalesDashboard' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                        <LayoutDashboard className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">Dashboard</span>
                      </div>
                    </Link>
                    <Link to={createPageUrl('Pipeline')} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'Pipeline' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                        <TrendingUp className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">Pipeline</span>
                      </div>
                    </Link>
                    <Link to={createPageUrl('Contacts')} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'Contacts' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                        <FileText className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">Contacts</span>
                      </div>
                    </Link>
                    <Link to={createPageUrl('Product3DManager')} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'Product3DManager' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                        <Package className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">Product Catalog</span>
                      </div>
                    </Link>
                    <Link to={createPageUrl('SalesQuoteStart')} onClick={() => setMobileMenuOpen(false)}>
                      <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10">
                        <Plus className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">New Quote</span>
                      </div>
                    </Link>
                  </>
                ) : user?.user_type === 'student' ? (
                  <Link to={createPageUrl('StudentHome')} onClick={() => setMobileMenuOpen(false)}>
                    <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'StudentHome' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                      <GraduationCap className="w-5 h-5 text-white/80" />
                      <span className="text-white font-medium">My Submissions</span>
                    </div>
                  </Link>
                ) : (
                  <>
                    <Link to={createPageUrl('QuoteRequest')} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'QuoteRequest' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                        <Plus className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">New Quote</span>
                      </div>
                    </Link>
                    <Link to={createPageUrl('OrderHistory')} onClick={() => setMobileMenuOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'OrderHistory' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                        <FileText className="w-5 h-5 text-white/80" />
                        <span className="text-white font-medium">Order History</span>
                      </div>
                    </Link>
                  </>
                )}

                <div className="h-px bg-white/10 my-1" />
                <Link to={createPageUrl('Settings')} onClick={() => setMobileMenuOpen(false)}>
                  <div className={`flex items-center gap-3 px-3 py-3 rounded-lg ${currentPageName === 'Settings' ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                    <SettingsIcon className="w-5 h-5 text-white/80" />
                    <span className="text-white font-medium">Settings</span>
                  </div>
                </Link>

                <div className="h-px bg-white/10 my-1" />
                <div className="px-3 py-2 text-white/60 text-xs font-medium uppercase tracking-wide">Switch Role</div>
                <div className="grid grid-cols-3 gap-2 px-3 pb-1">
                  <button onClick={() => handleSwitchUserType('customer')} className={`py-2.5 rounded-lg text-white text-xs font-medium text-center ${!user?.is_sales_rep && user?.user_type !== 'student' ? 'bg-white/25 ring-1 ring-white/30' : 'bg-white/10'}`}>Customer</button>
                  <button onClick={() => handleSwitchUserType('sales_rep')} className={`py-2.5 rounded-lg text-white text-xs font-medium text-center ${user?.is_sales_rep ? 'bg-white/25 ring-1 ring-white/30' : 'bg-white/10'}`}>Sales Rep</button>
                  <button onClick={() => handleSwitchUserType('student')} className={`py-2.5 rounded-lg text-white text-xs font-medium text-center ${user?.user_type === 'student' ? 'bg-white/25 ring-1 ring-white/30' : 'bg-white/10'}`}>Student</button>
                </div>

                <div className="h-px bg-white/10 my-1" />
                <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/10 w-full">
                  <LogOut className="w-5 h-5 text-white/80" />
                  <span className="text-white font-medium">Log Out</span>
                </button>
              </div>
            </div>
          )}
        </header>
      )}
      
      <main className={showHeader ? 'pt-14 md:pt-16' : ''}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {showMobileNav && (
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-around h-14">
            {user?.is_sales_rep ? (
              <>
                <Link to={createPageUrl('SalesDashboard')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'SalesDashboard' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Home</span>
                  </button>
                </Link>
                <Link to={createPageUrl('Pipeline')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'Pipeline' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Pipeline</span>
                  </button>
                </Link>
                <Link to={createPageUrl('SalesQuoteStart')} className="flex-1">
                  <button className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                    <div className="w-10 h-10 rounded-full bg-[#e2231a] flex items-center justify-center -mt-4 shadow-lg">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 -mt-0.5">Quote</span>
                  </button>
                </Link>
                <Link to={createPageUrl('Contacts')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'Contacts' || currentPageName === 'ContactDetail' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Contacts</span>
                  </button>
                </Link>
                <Link to={createPageUrl('Settings')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'Settings' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">More</span>
                  </button>
                </Link>
              </>
            ) : user?.user_type === 'student' ? (
              <>
                <Link to={createPageUrl('StudentHome')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'StudentHome' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <HomeIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Home</span>
                  </button>
                </Link>
                <Link to={createPageUrl('Settings')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'Settings' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Settings</span>
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link to={createPageUrl('QuoteRequest')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'QuoteRequest' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <HomeIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Home</span>
                  </button>
                </Link>
                <Link to={createPageUrl('QuoteRequest')} className="flex-1">
                  <button className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-slate-500">
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] font-medium">New Quote</span>
                  </button>
                </Link>
                <Link to={createPageUrl('OrderHistory')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'OrderHistory' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span className="text-[10px] font-medium">History</span>
                  </button>
                </Link>
                <Link to={createPageUrl('Settings')} className="flex-1">
                  <button
                    className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${
                      currentPageName === 'Settings' ? 'text-[#e2231a]' : 'text-slate-500'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Settings</span>
                  </button>
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </div>
    </VoiceActivationProvider>
  );
}