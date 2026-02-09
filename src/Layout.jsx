import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { LogOut, FileText, Plus, Home as HomeIcon, Settings as SettingsIcon, ArrowLeft, LayoutDashboard, ChevronDown, User, Users, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    initDarkMode();
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

  // Root dashboard pages (no back button)
  const rootPages = ['SalesDashboard', 'QuoteRequest', 'OrderHistory'];
  const showBackButton = showHeader && !rootPages.includes(currentPageName);

  // Pages where mobile bottom nav is shown
  const showMobileNav = showHeader && !noHeaderPages.includes(currentPageName);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
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
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                {showBackButton ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="text-white hover:bg-white/20 mr-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                ) : null}
                <Link to={createPageUrl(user?.is_sales_rep ? 'SalesDashboard' : 'QuoteRequest')} className="flex items-center gap-3">
                  <img
                    src="/assets/orbus-logo.png"
                    alt="Orbus"
                    className="h-8"
                  />
                  <span className="text-xl font-semibold tracking-tight hidden sm:inline">Instant Quote</span>
                </Link>
              </div>
              
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
                        3D Manager
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
                      <Plus className="w-4 h-4 mr-2" />
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
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleLogout}
                  className="text-white hover:bg-white/10"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </nav>
            </div>
          </div>
        </header>
      )}
      
      <main className={showHeader ? 'pt-16' : ''}>
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {showMobileNav && (
        <nav 
          className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-around h-16">
            {user?.is_sales_rep ? (
              <>
                <Link to={createPageUrl('SalesDashboard')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'SalesDashboard' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <LayoutDashboard className="w-5 h-5" />
                    <span className="text-xs">Dashboard</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('Pipeline')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'Pipeline' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span className="text-xs">Pipeline</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('SalesQuoteStart')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'SalesQuoteStart' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs">New Quote</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('Settings')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'Settings' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-xs">Settings</span>
                  </Button>
                </Link>
              </>
            ) : user?.user_type === 'student' ? (
              <>
                <Link to={createPageUrl('StudentHome')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'StudentHome' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <HomeIcon className="w-5 h-5" />
                    <span className="text-xs">Home</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('StudentHome')} className="flex-1">
                  <Button
                    variant="ghost"
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-400"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs">Upload</span>
                  </Button>
                </Link>
                <div className="flex-1" />
                <Link to={createPageUrl('Settings')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'Settings' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-xs">Settings</span>
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to={createPageUrl('QuoteRequest')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'QuoteRequest' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <HomeIcon className="w-5 h-5" />
                    <span className="text-xs">Home</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('QuoteRequest')} className="flex-1">
                  <Button
                    variant="ghost"
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-600 dark:text-slate-400"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-xs">New Quote</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('OrderHistory')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'OrderHistory' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span className="text-xs">History</span>
                  </Button>
                </Link>
                <Link to={createPageUrl('Settings')} className="flex-1">
                  <Button
                    variant="ghost"
                    className={`w-full h-full flex flex-col items-center justify-center gap-1 ${
                      currentPageName === 'Settings' ? 'text-[#e2231a]' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-xs">Settings</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}