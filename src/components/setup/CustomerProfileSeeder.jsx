import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CustomerProfileSeeder() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreate = async () => {
    setLoading(true);
    setMessage('');

    const existing = await base44.entities.Profile.filter({ name: 'Customer Portal' }, 'created_date', 1);
    if ((existing || []).length > 0) {
      setMessage('Customer Portal profile already exists.');
      setLoading(false);
      return;
    }

    await base44.entities.Profile.create({
      name: 'Customer Portal',
      description: 'Customer access limited to customer quote pages.',
      object_permissions: {
        Order: { read: true, create: false, edit: false, delete: false },
        Contact: { read: true, create: false, edit: false, delete: false },
        QuoteRevision: { read: true, create: false, edit: false, delete: false }
      },
      field_permissions: {},
      page_access: ['XhibitlyStart', 'CustomerOrders'],
      default_landing_page: 'CustomerOrders'
    });

    setMessage('Customer Portal profile created.');
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Portal Profile</CardTitle>
        <CardDescription>Create a simple profile for customer-only access.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">This keeps customer users on XhibitlyStart and CustomerOrders only.</p>
          <Button onClick={handleCreate} disabled={loading} className="bg-[#e2231a] hover:bg-[#c41e17] text-white">
            {loading ? 'Creating...' : 'Create Customer Profile'}
          </Button>
        </div>
        {message && <p className="text-sm text-slate-600 mt-3">{message}</p>}
      </CardContent>
    </Card>
  );
}