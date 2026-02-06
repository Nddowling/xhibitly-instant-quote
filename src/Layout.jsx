import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { LogOut, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
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

  const handleLogout = () => {
    base44.auth.logout(createPageUrl('Home'));
  };

  // Pages that don't need the header
  const noHeaderPages = ['Loading', 'Home', 'Landing', 'UserTypeSelection'];
  const showHeader = !noHeaderPages.includes(currentPageName) && user;

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
        :root {
          --primary: #e2231a;
          --primary-light: #f04238;
          --primary-dark: #b01b13;
        }
      `}</style>

      {showHeader && (
        <header className="bg-[#e2231a] text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <Link to={createPageUrl('QuoteRequest')} className="flex items-center gap-3">
                  <img
                    src="/assets/orbus-logo.png"
                    alt="Orbus"
                    className="h-8"
                  />
                  <span className="text-xl font-semibold tracking-tight">Instant Quote</span>
                </Link>
              </div>
              
              <nav className="flex items-center gap-2">
                {user?.is_sales_rep ? (
                  <Link to={createPageUrl('SalesDashboard')}>
                    <Button 
                      variant="ghost"
                      className={`text-white hover:bg-white/20 ${currentPageName === 'SalesDashboard' ? 'border border-white/30' : ''}`}
                    >
                      Dashboard
                    </Button>
                  </Link>
                ) : null}
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
                <div className="h-6 w-px bg-white/20 mx-2" />
                <div className="text-sm text-white/80 mr-2">
                  Hello, {user?.full_name?.split(' ')[0] || user?.contact_name?.split(' ')[0]}
                </div>
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
      
      <main className={showHeader ? '' : ''}>
        {children}
      </main>
    </div>
  );
}