import React, { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { base44 } from '@/api/base44Client';
import KanbanColumn from './KanbanColumn';

const PIPELINE_STAGES = {
  Prospecting:   ['Pending', 'Contacted'],
  Quoted:        ['Quoted'],
  Negotiating:   ['Negotiating'],
  'Closed-Won':  ['Confirmed', 'In Production', 'Shipped', 'Delivered'],
  'Closed-Lost': ['Cancelled'],
};

// First status for each stage — used when dropping into that column
const STAGE_DEFAULT_STATUS = {
  Prospecting:   'Pending',
  Quoted:        'Quoted',
  Negotiating:   'Negotiating',
  'Closed-Won':  'Confirmed',
  'Closed-Lost': 'Cancelled',
};

function bucketOrders(orders) {
  const columns = {};
  Object.keys(PIPELINE_STAGES).forEach(stage => {
    columns[stage] = orders.filter(o => PIPELINE_STAGES[stage].includes(o.status));
  });
  return columns;
}

export default function SalesPipelineBoard({ orders, onOrderUpdate }) {
  const [columns, setColumns] = useState(() => bucketOrders(orders));

  useEffect(() => {
    setColumns(bucketOrders(orders));
  }, [orders]);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceStage = source.droppableId;
    const destStage = destination.droppableId;

    // Optimistic UI update
    const newColumns = { ...columns };
    const sourceItems = [...newColumns[sourceStage]];
    const [moved] = sourceItems.splice(source.index, 1);
    newColumns[sourceStage] = sourceItems;

    const destItems = sourceStage === destStage ? sourceItems : [...newColumns[destStage]];
    destItems.splice(destination.index, 0, moved);
    newColumns[destStage] = destItems;
    setColumns(newColumns);

    // Persist status change if stage changed
    if (sourceStage !== destStage) {
      const newStatus = STAGE_DEFAULT_STATUS[destStage];
      await base44.entities.Order.update(draggableId, { status: newStatus });
      onOrderUpdate();
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 px-1 -mx-1">
        {Object.keys(PIPELINE_STAGES).map(stageName => (
          <KanbanColumn
            key={stageName}
            stageName={stageName}
            orders={columns[stageName] || []}
          />
        ))}
      </div>
    </DragDropContext>
  );
}