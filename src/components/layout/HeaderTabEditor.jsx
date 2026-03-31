import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import ObjectTabsManager from '@/components/setup/ObjectTabsManager';

export default function HeaderTabEditor({ brokerInstanceId }) {
  const [open, setOpen] = useState(false);

  if (!brokerInstanceId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-white/50 hover:text-white hover:bg-white/8">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Header Tabs</DialogTitle>
          <DialogDescription>Customize tabs for this org only.</DialogDescription>
        </DialogHeader>
        <ObjectTabsManager brokerInstanceId={brokerInstanceId} compact />
      </DialogContent>
    </Dialog>
  );
}