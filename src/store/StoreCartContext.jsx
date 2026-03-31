import React, { createContext, useContext, useEffect, useState } from 'react';

const CART_KEY = 'xhibitly_store_cart';

const StoreCartContext = createContext(null);

export function StoreCartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] ?? null,
        slug: product.slug,
        quantity,
      }];
    });
  };

  const removeItem = (product_id) => {
    setItems(prev => prev.filter(i => i.product_id !== product_id));
  };

  const updateQuantity = (product_id, quantity) => {
    if (quantity < 1) { removeItem(product_id); return; }
    setItems(prev => prev.map(i =>
      i.product_id === product_id ? { ...i, quantity } : i
    ));
  };

  const clearCart = () => setItems([]);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <StoreCartContext.Provider value={{ items, itemCount, subtotal, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </StoreCartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(StoreCartContext);
  if (!ctx) throw new Error('useCart must be used inside StoreCartProvider');
  return ctx;
}
