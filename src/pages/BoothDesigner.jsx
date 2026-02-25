import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Send, Box, LayoutTemplate, Image as ImageIcon } from 'lucide-react';
import MessageBubble from '@/components/agents/MessageBubble';

export default function BoothDesigner() {
    const [step, setStep] = useState('setup'); // setup, loading, designing
    const [boothSize, setBoothSize] = useState('10x10');
    const [designName, setDesignName] = useState('');
    const [boothDesign, setBoothDesign] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef(null);

    // Start the design process
    const handleStart = async () => {
        if (!designName) return;
        setStep('loading');
        try {
            const user = await base44.auth.me();
            const design = await base44.entities.BoothDesign.create({
                design_name: designName,
                booth_size: boothSize,
                tier: 'Modular',
                dealer_id: user?.id,
                product_skus: [],
                spatial_layout: []
            });
            setBoothDesign(design);

            const conv = await base44.agents.createConversation({
                agent_name: 'booth_designer',
                metadata: {
                    name: `Design Session: ${designName}`,
                    booth_design_id: design.id,
                    booth_size: boothSize
                }
            });
            setConversation(conv);
            
            await base44.agents.addMessage(conv, {
                role: 'user',
                content: `Hi! Let's design my ${boothSize} booth. The BoothDesign entity ID is ${design.id}. I am looking for ideas and products from the catalog to add to my booth.`
            });

            setStep('designing');
        } catch (error) {
            console.error(error);
            alert('Failed to start session');
            setStep('setup');
        }
    };

    // Subscribe to chat messages
    useEffect(() => {
        if (conversation && step === 'designing') {
            const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
                setMessages(data.messages || []);
                // Auto scroll to bottom
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            });
            return () => unsub();
        }
    }, [conversation, step]);

    // Subscribe to the booth design entity to see added products live
    useEffect(() => {
        if (boothDesign && step === 'designing') {
            const unsub = base44.entities.BoothDesign.subscribe((event) => {
                if (event.type === 'update' && event.id === boothDesign.id) {
                    setBoothDesign(event.data);
                }
            });
            return () => unsub();
        }
    }, [boothDesign, step]);

    // Handle user sending a chat message
    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || isSending) return;
        const msg = input.trim();
        setInput('');
        await sendMessage(msg);
    };

    const sendMessage = async (text) => {
        if (isSending) return;
        setIsSending(true);
        try {
            await base44.agents.addMessage(conversation, {
                role: 'user',
                content: text
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsSending(false);
        }
    };

    // SETUP SCREEN
    if (step === 'setup' || step === 'loading') {
        return (
            <div className="max-w-md mx-auto mt-20 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 text-primary rounded-2xl flex items-center justify-center shadow-inner border border-primary/20 rotate-3 transition-transform hover:rotate-6">
                        <LayoutTemplate className="w-8 h-8" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-2 text-slate-900 dark:text-white">AI Booth Designer</h1>
                <p className="text-slate-500 text-center mb-8">Set up your space and let our AI agent help you furnish it with catalog products.</p>
                
                <div className="space-y-4 text-slate-900 dark:text-white">
                    <div>
                        <label className="block text-sm font-medium mb-1">Project Name</label>
                        <Input value={designName} onChange={e => setDesignName(e.target.value)} placeholder="e.g. CES 2026 Booth" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Booth Size</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['10x10', '10x20', '20x20'].map(size => (
                                <Button 
                                    key={size} 
                                    variant={boothSize === size ? 'default' : 'outline'}
                                    onClick={() => setBoothSize(size)}
                                    className={cn("w-full transition-all", boothSize === size ? "bg-primary hover:bg-primary/90 text-white shadow-md" : "hover:border-primary/50 hover:bg-primary/5 hover:text-primary")}
                                >
                                    {size}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <Button 
                        className="w-full mt-6 bg-gradient-to-r from-primary to-red-500 hover:from-primary/90 hover:to-red-500/90 text-white shadow-lg transition-all" 
                        onClick={handleStart}
                        disabled={!designName || step === 'loading'}
                    >
                        {step === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Designing'}
                    </Button>
                </div>
            </div>
        );
    }

    // MAIN DESIGNER SCREEN
    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Left Column: Chat Interface */}
            <div className="w-full md:w-1/3 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 z-10 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shrink-0 shadow-inner border border-primary/20">
                        <Box className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-semibold text-sm text-slate-900 dark:text-white truncate">Design Agent</h2>
                        <p className="text-xs text-slate-500 truncate">Designing {designName}</p>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.map(msg => (
                        <MessageBubble key={msg.id || Math.random()} message={msg} />
                    ))}
                    {isSending && (
                        <div className="flex gap-2 items-center text-slate-400 text-sm pl-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {messages.length <= 3 && !isSending && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <Button variant="outline" size="sm" className="text-xs rounded-full h-8 border-slate-200 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/50" onClick={() => sendMessage("Show me some 10ft fabric backwalls.")}>
                                Show me backwalls
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs rounded-full h-8 border-slate-200 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/50" onClick={() => sendMessage("What flooring or carpet options do you have?")}>
                                Flooring options
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs rounded-full h-8 border-slate-200 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/50" onClick={() => sendMessage("Suggest a reception counter with my logo.")}>
                                Reception counters
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs rounded-full h-8 border-slate-200 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/50" onClick={() => sendMessage("What lighting and accessory options are there?")}>
                                Lighting & Accessories
                            </Button>
                        </div>
                    )}
                    <form onSubmit={handleSend} className="flex gap-2">
                        <Input 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            placeholder="Ask for backwalls, counters, branding..." 
                            disabled={isSending}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={isSending || !input.trim()} className="bg-primary hover:bg-primary/90 shadow-sm transition-all">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right Column: Booth Space Visualization */}
            <div className="hidden md:flex w-2/3 p-6 flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20 shadow-sm">
                            <LayoutTemplate className="w-5 h-5" />
                        </div>
                        Set Space: {boothSize}
                    </h2>
                    <div className="text-sm font-medium text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 shadow-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {boothDesign?.product_skus?.length || 0} Products Added
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 overflow-y-auto relative flex flex-col">
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-40 rounded-2xl" />
                    
                    <div className="relative z-10 flex-1 flex flex-col">
                        {/* 3D Render Visualization Area */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 border border-slate-200 dark:border-slate-700 overflow-hidden relative group shrink-0">
                            {boothDesign?.design_image_url ? (
                                <div className="relative w-full aspect-[16/9]">
                                    <img src={boothDesign.design_image_url} alt="Booth Render" className="w-full h-full object-cover" />
                                    <div className="absolute top-4 right-4">
                                        <GenerateRenderButton boothDesignId={boothDesign.id} skus={boothDesign?.product_skus} />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full aspect-[16/9] flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                                    <LayoutTemplate className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-medium text-slate-500 mb-4">No 3D render generated yet.</p>
                                    <GenerateRenderButton boothDesignId={boothDesign?.id} skus={boothDesign?.product_skus} />
                                </div>
                            )}
                        </div>

                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Included Products</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                            {boothDesign?.product_skus?.map((sku, idx) => (
                                <BoothProductCard key={idx} sku={sku} />
                            ))}
                            
                            {(!boothDesign?.product_skus || boothDesign.product_skus.length === 0) && (
                                <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    <p className="text-sm font-medium">No products added yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function GenerateRenderButton({ boothDesignId, skus }) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!boothDesignId || !skus || skus.length === 0) return;
        setIsGenerating(true);
        try {
            await base44.functions.invoke('generateBoothRender', { booth_design_id: boothDesignId });
        } catch (error) {
            console.error("Failed to generate render:", error);
            alert("Failed to generate render. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !skus || skus.length === 0}
            className="bg-primary hover:bg-primary/90 text-white shadow-md"
            size="sm"
        >
            {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering...</>
            ) : (
                <><ImageIcon className="w-4 h-4 mr-2" /> Generate 3D Render</>
            )}
        </Button>
    );
}

function BoothProductCard({ sku }) {
    const [product, setProduct] = useState(null);

    useEffect(() => {
        async function fetchProduct() {
            try {
                const res = await base44.entities.Product.filter({ sku });
                if (res.length > 0) setProduct(res[0]);
            } catch (e) {}
        }
        fetchProduct();
    }, [sku]);

    if (!product) return (
        <Card className="animate-pulse bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="p-4 aspect-square flex items-center justify-center text-slate-400 text-sm">
                Loading...
            </CardContent>
        </Card>
    );

    return (
        <Card className="overflow-hidden hover:shadow-md transition-shadow bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-slate-200 dark:border-slate-700">
            <div className="aspect-square bg-white dark:bg-slate-950 flex items-center justify-center p-4 relative group">
                {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-105" />
                ) : (
                    <Box className="w-12 h-12 text-slate-200 dark:text-slate-700" />
                )}
            </div>
            <CardContent className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold text-primary mb-0.5 truncate">{product.sku}</div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">{product.name}</h3>
                {product.category && <div className="text-[10px] text-slate-500 mt-1 truncate">{product.category}</div>}
            </CardContent>
        </Card>
    );
}