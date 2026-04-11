import React from 'react';
import ObjectListPage from '@/components/objects/ObjectListPage';
import RecentQuotes from './RecentQuotes';

export default function ObjectRecords() {
  const pathParts = window.location.pathname.split('/');
  const objectApiName = pathParts[pathParts.length - 1];

  if (objectApiName === 'Order') {
    return <RecentQuotes />;
  }

  if (objectApiName === 'Lead') {
    return <ObjectListPage objectApiName="Lead" title="Leads" />;
  }

  const title = objectApiName === 'LineItem' ? 'Quote Line Items' : `${objectApiName}s`;
  return <ObjectListPage objectApiName={objectApiName} title={title} />;
}