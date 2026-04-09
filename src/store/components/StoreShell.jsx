import React from 'react';
import { StoreCartProvider } from '../StoreCartContext';
import StoreLayout from '../StoreLayout';

export default function StoreShell({ children }) {
  return (
    <StoreCartProvider>
      <StoreLayout>{children}</StoreLayout>
    </StoreCartProvider>
  );
}