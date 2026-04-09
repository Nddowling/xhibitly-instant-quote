import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Zap, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from './StoreCartContext';
import CartDrawer from './components/CartDrawer';

export default function StoreLayout({ children }) {
  const { itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/8 px-6 md:px-12 h-16 flex items-center justify-between">
        <Link to="/store" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-[#00c9a7] rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-black" />
          </div>
          <span className="font-bold text-base tracking-tight">RecoverEdge</span>
          <span className="hidden sm:block text-xs text-white/40 border border-white/15 rounded-full px-2.5 py-0.5">Biohacking Store</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <Link to="/store/products" className="hover:text-white transition-colors">Shop</Link>
          <Link to="/store" className="hover:text-white transition-colors">Free Guide</Link>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-lg hover:bg-white/8 transition-colors"
            aria-label="Open cart"
          >
            <ShoppingCart className="w-5 h-5 text-white/70" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#00c9a7] text-black text-xs font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
          <Button
            onClick={() => navigate('/store/products')}
            className="hidden sm:flex bg-[#00c9a7] hover:bg-[#00b396] text-black font-semibold h-9 px-5 text-sm rounded-lg"
          >
            Shop Now
          </Button>
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/8"
            onClick={() => setMobileMenuOpen(o => !o)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#111] border-b border-white/8 px-6 py-4 flex flex-col gap-4 text-sm">
          <Link to="/store/products" className="text-white/70 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Shop All Products</Link>
          <Link to="/store" className="text-white/70 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Free Biohacking Guide</Link>
          <Button onClick={() => { navigate('/store/products'); setMobileMenuOpen(false); }} className="bg-[#00c9a7] hover:bg-[#00b396] text-black font-semibold w-full">Shop Now</Button>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] border-t border-white/8 px-6 md:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-[#00c9a7] rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-bold text-sm">RecoverEdge</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <Link to="/store/products" className="hover:text-white/60 transition-colors">Shop</Link>
            <Link to="/store" className="hover:text-white/60 transition-colors">Free Guide</Link>
            <span>Free shipping on orders over $75</span>
          </div>
          <p className="text-xs text-white/20">© {new Date().getFullYear()} RecoverEdge. All rights reserved.</p>
        </div>
      </footer>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
