import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CalendarDays, Percent } from 'lucide-react';

export default function KanbanDealCard({ order, provided, snapshot }) {
  const navigate = useNavigate();

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = order.expected_close_date && new Date(order.expected_close_date) < new Date();

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => navigate(createPageUrl('OrderDetail') + `?id=${order.id}`)}
    >
      <Card className={`mb-3 cursor-pointer transition-all duration-150 hover:shadow-md ${snapshot.isDragging ? 'shadow-xl ring-2 ring-[#e2231a]/50 rotate-1' : ''}`}>
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                {order.dealer_company || 'Unnamed'}
              </h4>
              <p className="text-xs text-slate-500 truncate">{order.dealer_name}</p>
            </div>
            {order.booth_size && (
              <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded ml-2 shrink-0">
                {order.booth_size}
              </span>
            )}
          </div>

          {/* Deal value — prominent */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <DollarSign className="w-3.5 h-3.5 text-green-600" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatPrice(order.final_price || order.quoted_price)}
            </span>
          </div>

          {/* Expected close + probability */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <CalendarDays className="w-3 h-3" />
              <span>{formatDate(order.expected_close_date || order.show_date)}</span>
            </div>
            {order.probability != null && (
              <div className="flex items-center gap-1">
                <Percent className="w-3 h-3" />
                <span>{order.probability}%</span>
              </div>
            )}
          </div>

          {/* Probability bar */}
          <div className="mt-2 bg-slate-200 dark:bg-slate-700 rounded-full h-1">
            <div
              className="h-1 rounded-full transition-all bg-[#e2231a]"
              style={{ width: `${order.probability || 0}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}