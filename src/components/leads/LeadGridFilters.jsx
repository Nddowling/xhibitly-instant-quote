import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

const operatorOptions = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
];

export default function LeadGridFilters({ fields, filters, onChange, onAdd, onRemove, onClear }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          <p className="text-xs text-slate-500">Filter leads by any field and operator.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClear}>Clear</Button>
          <Button type="button" size="sm" onClick={onAdd} className="bg-[#e2231a] hover:bg-[#c61d16]">
            <Plus className="w-4 h-4 mr-1" />
            Add Filter
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {filters.map((filter, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_180px_1fr_auto] gap-2">
            <Select value={filter.field} onValueChange={(value) => onChange(index, 'field', value)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filter.operator} onValueChange={(value) => onChange(index, 'operator', value)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={filter.value}
              onChange={(e) => onChange(index, 'value', e.target.value)}
              placeholder="Value"
              disabled={filter.operator === 'is_empty' || filter.operator === 'is_not_empty'}
              className="bg-white"
            />

            <Button type="button" variant="outline" size="icon" onClick={() => onRemove(index)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}