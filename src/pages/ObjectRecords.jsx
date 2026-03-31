import React from 'react';
import ObjectListPage from '@/components/objects/ObjectListPage';

export default function ObjectRecords() {
  const pathParts = window.location.pathname.split('/');
  const objectApiName = pathParts[pathParts.length - 1];
  const title = objectApiName === 'LineItem' ? 'Quote Line Items' : `${objectApiName}s`;

  return <ObjectListPage objectApiName={objectApiName} title={title} />;
}