import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import KanbanDealCard from './KanbanDealCard';

const stageAccents = {
  Prospecting:  { dot: 'bg-blue-500',   border: 'border-blue-500' },
  Quoted:       { dot: 'bg-amber-500',  border: 'border-amber-500' },
  Negotiating:  { dot: 'bg-purple-500', border: 'border-purple-500' },
  'Closed-Won': { dot: 'bg-green-500',  border: 'border-green-500' },
  'Closed-Lost':{ dot: 'bg-red-500',    border: 'border-red-500' },
};

export default function KanbanColumn({ stageName, orders }) {
  const accent = stageAccents[stageName] || { dot: 'bg-slate-500', border: 'border-slate-500' };

  const totalValue = orders.reduce((sum, o) => sum + (o.final_price || o.quoted_price || 0), 0);
  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  }).format(totalValue);

  return (
    <div className={`flex-shrink-0 w-72 md:w-80 flex flex-col bg-slate-100/80 dark:bg-slate-900/50 rounded-xl border-t-2 ${accent.border}`}>
      {/* Column Header */}
      <div className="p-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white">{stageName}</h3>
            <span className="text-xs font-medium text-slate-500 bg-white dark:bg-slate-800 rounded-full px-2 py-0.5">
              {orders.length}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500 font-medium">{formattedTotal}</p>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stageName}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 px-2 pb-2 min-h-[120px] transition-colors rounded-b-xl ${
              snapshot.isDraggingOver ? 'bg-slate-200/60 dark:bg-slate-800/40' : ''
            }`}
          >
            {orders.map((order, index) => (
              <Draggable draggableId={order.id} index={index} key={order.id}>
                {(provided, snapshot) => (
                  <KanbanDealCard order={order} provided={provided} snapshot={snapshot} />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}