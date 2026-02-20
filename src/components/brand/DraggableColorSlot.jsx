import React from 'react';
import { X, GripVertical } from 'lucide-react';

export default function DraggableColorSlot({ 
  label, 
  color, 
  slotIndex,
  onRemove, 
  onColorChange,
  onDragStart, 
  onDragOver, 
  onDrop 
}) {
  return (
    <div
      draggable={!!color}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(slotIndex)); onDragStart?.(slotIndex); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(slotIndex); }}
      onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain')); onDrop?.(from, slotIndex); }}
      className="group"
    >
      <label className="block text-slate-500 text-xs font-medium mb-1.5 uppercase tracking-wide">{label}</label>
      {color ? (
        <div className="relative">
          <div
            className="w-full h-20 rounded-xl border-2 border-slate-200 cursor-grab active:cursor-grabbing relative overflow-hidden transition-shadow hover:shadow-md"
            style={{ backgroundColor: color }}
          >
            <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/25 text-white backdrop-blur-sm">
                {color}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = color;
                input.onchange = (e) => onColorChange?.(e.target.value);
                input.click();
              }}
              className="text-xs text-slate-500 hover:text-[#e2231a] transition-colors"
            >
              Edit
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => onRemove?.()}
              className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = '#666666';
            input.onchange = (e) => onColorChange?.(e.target.value);
            input.click();
          }}
          className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-[#e2231a] hover:bg-red-50/50 transition-all"
        >
          <span className="text-slate-400 text-sm">+ Add color</span>
        </div>
      )}
    </div>
  );
}