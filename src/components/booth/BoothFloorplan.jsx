import React, { useState, useRef, useEffect } from 'react';
import { Box, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BoothFloorplan({ scene, onMoveItem, onRotateItem, onRemoveItem, brandName }) {
    const containerRef = useRef(null);
    const [dragging, setDragging] = useState(null); // { id, startX, startY, startMouseX, startMouseY }
    const [hoveredItem, setHoveredItem] = useState(null);

    // Pixels per foot for rendering
    const [pixelsPerFoot, setPixelsPerFoot] = useState(30);

    useEffect(() => {
        if (!containerRef.current || !scene?.booth) return;
        
        const updateScale = () => {
            const { clientWidth, clientHeight } = containerRef.current;
            // Leave some padding
            const padding = 40;
            const availableW = clientWidth - padding * 2;
            const availableH = clientHeight - padding * 2;
            
            const scaleW = availableW / scene.booth.w_ft;
            const scaleH = availableH / scene.booth.d_ft;
            setPixelsPerFoot(Math.min(scaleW, scaleH));
        };
        
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [scene?.booth]);

    if (!scene || !scene.booth) return <div className="text-slate-500 text-center p-8">No scene data</div>;

    const pxW = scene.booth.w_ft * pixelsPerFoot;
    const pxD = scene.booth.d_ft * pixelsPerFoot;

    const handlePointerDown = (e, item) => {
        e.preventDefault();
        setDragging({
            id: item.id,
            startX: item.x,
            startY: item.y,
            startMouseX: e.clientX,
            startMouseY: e.clientY
        });
    };

    const handlePointerMove = (e) => {
        if (!dragging) return;
        
        // Calculate diff in feet
        const dxFt = (e.clientX - dragging.startMouseX) / pixelsPerFoot;
        const dyFt = -(e.clientY - dragging.startMouseY) / pixelsPerFoot; // Invert Y because screen Y goes down

        onMoveItem(dragging.id, dragging.startX + dxFt, dragging.startY + dyFt);
    };

    const handlePointerUp = () => {
        setDragging(null);
    };

    return (
        <div 
            ref={containerRef}
            className="w-full h-full min-h-[300px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative cursor-crosshair select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {/* The Booth Canvas */}
            <div 
                className="relative bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 shadow-sm"
                style={{
                    width: pxW,
                    height: pxD,
                    backgroundImage: `
                        linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                        linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
                    `,
                    backgroundSize: `${pixelsPerFoot/2}px ${pixelsPerFoot/2}px`, // 0.5ft grid
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)'
                }}
            >
                {/* Entrance Indicator */}
                <div className="absolute -bottom-6 left-0 right-0 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Front / Aisle
                </div>

                {/* Items */}
                {scene.items.map(item => {
                    const isRotated = item.rot === 90 || item.rot === 270;
                    const wFt = isRotated ? item.d : item.w;
                    const dFt = isRotated ? item.w : item.d;

                    const leftPx = (item.x - wFt / 2) * pixelsPerFoot;
                    // Y in scene is bottom-up. CSS top is top-down.
                    const bottomPx = (item.y - dFt / 2) * pixelsPerFoot;
                    const topPx = pxD - bottomPx - (dFt * pixelsPerFoot);

                    const isHovered = hoveredItem === item.id;
                    const isDragging = dragging?.id === item.id;

                    return (
                        <div
                            key={item.id}
                            className={`absolute border-2 transition-colors duration-150 flex flex-col items-center justify-center ${
                                isDragging ? 'border-primary bg-primary/20 cursor-grabbing z-50' : 
                                isHovered ? 'border-primary/70 bg-primary/10 cursor-grab z-40' : 
                                'border-slate-800 bg-slate-800/10 cursor-grab z-10'
                            }`}
                            style={{
                                left: leftPx,
                                top: topPx,
                                width: wFt * pixelsPerFoot,
                                height: dFt * pixelsPerFoot,
                                touchAction: 'none'
                            }}
                            onPointerDown={(e) => handlePointerDown(e, item)}
                            onPointerEnter={() => setHoveredItem(item.id)}
                            onPointerLeave={() => setHoveredItem(null)}
                        >
                            {item.imageUrl && (
                                <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" />
                            )}
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate px-1 text-center leading-tight select-none pointer-events-none drop-shadow-sm bg-white/80 dark:bg-black/80 rounded backdrop-blur-sm z-10">
                                {item.name || item.sku}
                            </span>
                            
                            {/* Controls */}
                            {isHovered && !isDragging && (
                                <div className="absolute -top-8 -right-8 flex gap-1 bg-white dark:bg-slate-800 shadow-lg rounded-md p-1 border border-slate-200 dark:border-slate-700 z-50">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-600 hover:text-primary"
                                        onClick={(e) => { e.stopPropagation(); onRotateItem(item.id, 90); }}
                                        title="Rotate 90°"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-600 hover:text-red-500"
                                        onClick={(e) => { e.stopPropagation(); onRemoveItem(item.id); }}
                                        title="Remove"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}