import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export default function BrokerWorkspaceSwitcher({ brokerInstances, activeBrokerId, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <Building2 className="w-4 h-4 text-slate-400" />
      <Select value={activeBrokerId || ''} onValueChange={onChange}>
        <SelectTrigger className="border-0 shadow-none h-auto p-0 focus:ring-0 min-w-[220px]">
          <SelectValue placeholder="Select broker workspace" />
        </SelectTrigger>
        <SelectContent>
          {(brokerInstances || []).map((broker) => (
            <SelectItem key={broker.id} value={broker.id}>
              {broker.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}