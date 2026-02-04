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
  const noHeaderPages = ['Loading', 'Home'];
  const showHeader = !noHeaderPages.includes(currentPageName) && user;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2C5282] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --primary: #2C5282;
          --primary-light: #3D6BA8;
          --primary-dark: #1E3A5F;
        }
      `}</style>
      
      {showHeader && (
        <header className="bg-[#2C5282] text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <Link to={createPageUrl('QuoteRequest')} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold">X</span>
                  </div>
                  <span className="text-xl font-semibold tracking-tight">Xhibitly Instant Quote</span>
                </Link>
              </div>
              
              <nav className="flex items-center gap-2">
                <Link to={createPageUrl('QuoteRequest')}>
                  <Button 
                    variant={currentPageName === 'QuoteRequest' ? 'secondary' : 'ghost'} 
                    className="text-white hover:bg-white/10"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Quote
                  </Button>
                </Link>
                <Link to={createPageUrl('OrderHistory')}>
                  <Button 
                    variant={currentPageName === 'OrderHistory' ? 'secondary' : 'ghost'} 
                    className="text-white hover:bg-white/10"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Order History
                  </Button>
                </Link>
                <div className="h-6 w-px bg-white/20 mx-2" />
                <div className="text-sm text-white/80 mr-2">
                  {user?.company_name || user?.email}
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