import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Send, Box, LayoutTemplate, ArrowLeft, Mic, MicOff, X } from 'lucide-react';
import MessageBubble from '@/components/agents/MessageBubble';
import ProjectSelector from '@/components/booth/ProjectSelector';
import { BoothEngine } from '@/components/booth/BoothEngine';
import BoothSnapshotRenderer from '@/components/render/BoothSnapshotRenderer';
import { BOOTH_KITS, KIT_SIZES } from '@/data/boothKits';
import { SKU_BRANDING_PROFILES } from '@/data/skuBrandingProfiles';


export default function BoothDesigner() {
    const navigate = useNavigate();
    const [step, setStep] = useState('selector'); // selector, setup, loading, designing
    const [boothSize, setBoothSize] = useState('10x10');
    const [boothType, setBoothType] = useState('inline');
    const [designName, setDesignName] = useState('');
    const [boothDesign, setBoothDesign] = useState(null);
    const [brandUrl, setBrandUrl] = useState('');
    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef(null);
    
    // Scene Engine State
    const [scene, setScene] = useState(null);
    const sceneRef = useRef(null);
    const scrollRef = useRef(null);

    // Catalog Sidebar State
    const [showCatalog, setShowCatalog] = useState(false);
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState('All');
    const [catalogTab, setCatalogTab] = useState('kits');
    const [catalogKitSize, setCatalogKitSize] = useState('all');

    useEffect(() => {
        sceneRef.current = scene;
    }, [scene]);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;

            recognitionRef.current.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                if (finalTranscript) {
                    setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
                }
            };

            recognitionRef.current.onend = () => {
                setIsRecording(false);
            };
        }
    }, []);

    const toggleRecording = () => {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
        } else {
            setInput(''); // Clear input on new recording
            recognitionRef.current?.start();
            setIsRecording(true);
        }
    };

    const fetchProductDetails = async (sku) => {
        try {
            let product = null;
            let res = await base44.entities.Product.filter({ sku });
            if (res.length > 0) product = res[0];
            else {
                res = await base44.entities.Product.filter({ name: sku });
                if (res.length > 0) product = res[0];
            }
            
            if (!product) {
                let pvRes = await base44.entities.ProductVariant.filter({ manufacturer_sku: sku });
                if (pvRes.length > 0) {
                    product = {
                        name: pvRes[0].display_name,
                        sku: pvRes[0].manufacturer_sku,
                        category: pvRes[0].category_name,
                        image_url: pvRes[0].thumbnail_url || pvRes[0].image_url,
                        image_cached_url: pvRes[0].thumbnail_url || pvRes[0].image_url
                    };
                }
            }

            if (!product) {
                product = { sku, name: sku, category: 'Product' };
            }

            // Fetch Supabase assets
            try {
                // Fetch images
                const imgRes = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}/image` });
                if (imgRes.data && imgRes.data.files && imgRes.data.files.length > 0) {
                    const validFiles = imgRes.data.files.filter(f => f.name.match(/\.(png|jpe?g|gif|webp)$/i));
                    if (validFiles.length > 0) {
                        // Prefer files with 'front' or 'main' in the name, avoid 'cover' or 'spread'
                        let imgFile = validFiles.find(f => f.name.toLowerCase().includes('front')) ||
                                      validFiles.find(f => f.name.toLowerCase().includes('main')) ||
                                      validFiles.find(f => !f.name.toLowerCase().includes('cover') && !f.name.toLowerCase().includes('spread')) ||
                                      validFiles[0];
                        if (imgFile) {
                            product.image_url = imgFile.publicUrl;
                            product.image_cached_url = imgFile.publicUrl;
                        }
                    }
                }

                // Fetch 3D models (other or model_3d)
                let modelFile = null;
                const modelRes = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}/model_3d` });
                if (modelRes.data && modelRes.data.files && modelRes.data.files.length > 0) {
                    modelFile = modelRes.data.files.find(f => f.name.match(/\.(glb|gltf)$/i));
                }
                
                if (!modelFile) {
                    const otherRes = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}/other` });
                    if (otherRes.data && otherRes.data.files && otherRes.data.files.length > 0) {
                        modelFile = otherRes.data.files.find(f => f.name.match(/\.(glb|gltf)$/i));
                    }
                }

                if (modelFile && (modelFile.publicUrl || modelFile.url)) {
                    product.model_url = modelFile.publicUrl || modelFile.url;
                    product.model_glb_url = modelFile.publicUrl || modelFile.url;
                }
            } catch (e) {
                console.warn("Failed to fetch Supabase assets for SKU:", sku, e);
            }

            return product;
        } catch (e) {
            console.error("Error fetching product details", e);
        }
        return null;
    };

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');
        if (projectId && step === 'selector') {
            base44.entities.BoothDesign.get(projectId).then(project => {
                if (project) {
                    handleSelectProject(project);
                }
            }).catch(console.error);
        }
    }, []);



    // Start the design process
    const handleCreateQuote = async () => {
        try {
            const user = await base44.auth.me();
            const order = await base44.entities.Order.create({
                reference_number: 'XQ-' + Date.now(),
                dealer_email: user?.email || '',
                dealer_id: user?.id,
                dealer_company: user?.company_name || 'Unknown',
                dealer_name: user?.contact_name || user?.full_name || 'Unknown',
                dealer_phone: user?.phone || '000-000-0000',
                booth_size: boothDesign.booth_size || '10x10',
                show_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
                selected_booth_design_id: boothDesign.id,
                selected_tier: boothDesign.tier || 'Modular',
                status: 'Quoted'
            });
            
            const skuCounts = (boothDesign.product_skus || []).reduce((acc, sku) => {
                acc[sku] = (acc[sku] || 0) + 1;
                return acc;
            }, {});

            let total = 0;
            const lineItems = [];
            for(const [sku, quantity] of Object.entries(skuCounts)) {
                const res = await base44.entities.Product.filter({sku});
                if(res.length > 0) {
                   const p = res[0];
                   const price = p.base_price || 0;
                   const lineTotal = price * quantity;
                   lineItems.push({
                       order_id: order.id,
                       product_name: p.name,
                       category: p.category || 'Structures',
                       quantity: quantity,
                       unit_price: price,
                       total_price: lineTotal,
                       sku: p.sku
                   });
                   total += lineTotal;
                }
            }

            if (lineItems.length > 0) {
                await base44.entities.LineItem.bulkCreate(lineItems);
            }

            await base44.entities.Order.update(order.id, {
                quoted_price: total,
                final_price: total
            });
            
            navigate(createPageUrl('OrderDetail') + '?id=' + order.id);
        } catch (e) {
            console.error(e);
            alert("Failed to create quote.");
        }
    };

    const parseBoothSize = (sizeStr) => {
        const parts = sizeStr.toLowerCase().split('x');
        if (parts.length === 2) {
            const a = parseInt(parts[0]) || 10;
            const b = parseInt(parts[1]) || 10;
            // Trade show booths are usually wider than they are deep (e.g., 10x20 means 20 wide, 10 deep)
            return { w: Math.max(a, b), d: Math.min(a, b) };
        }
        return { w: 10, d: 10 };
    };

    const initializeScene = (project) => {
        if (project.scene_json) {
            try {
                return JSON.parse(project.scene_json);
            } catch (e) {
                console.warn('Failed to parse scene_json', e);
            }
        }
        const { w, d } = parseBoothSize(project.booth_size || '10x10');
        return BoothEngine.createScene(w, d);
    };

    const saveScene = async (newScene) => {
        setScene(newScene);
        if (!boothDesign) return;
        
        const skus = newScene.items.map(i => i.sku);
        const updateData = {
            scene_json: JSON.stringify(newScene),
            product_skus: skus
        };
        
        try {
            await base44.entities.BoothDesign.update(boothDesign.id, updateData);
            // setBoothDesign will update via subscription, but we can do optimistic update:
            setBoothDesign(prev => ({ ...prev, ...updateData }));
        } catch (e) {
            console.error("Failed to save scene", e);
        }
    };

    const handleStart = async () => {
        if (!designName) return;
        setStep('loading');
        setMessages([]);
        try {
            const user = await base44.auth.me();
            const { w, d } = parseBoothSize(boothSize);
            const initScene = BoothEngine.createScene(w, d);
            
            let brandIdentity = null;
            if (brandUrl && brandUrl.trim()) {
                try {
                    const res = await base44.functions.invoke('fetchBrandData', { website_url: brandUrl.trim() });
                    if (res.data && res.data.brand) {
                        brandIdentity = res.data.brand;
                    }
                } catch (e) {
                    console.warn("Failed to fetch brand data", e);
                }
            }
            
            const design = await base44.entities.BoothDesign.create({
                design_name: designName,
                booth_size: boothSize,
                booth_type: boothType,
                brand_url: brandUrl ? brandUrl.trim() : '',
                brand_identity: brandIdentity,
                tier: 'Modular',
                dealer_id: user?.id,
                product_skus: [],
                spatial_layout: [],
                scene_json: JSON.stringify(initScene)
            });
            setBoothDesign(design);
            setScene(initScene);

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
                content: `Hi! Let's design my ${boothSize} booth. The BoothDesign entity ID is ${design.id}. I am looking for ideas and products from the catalog to add to my booth.${brandUrl ? ` My brand website is ${brandUrl.trim()}.` : ''}`
            });

            setStep('designing');
        } catch (error) {
            console.error(error);
            alert('Failed to start session');
            setStep('setup');
        }
    };

    const reconcileSceneWithSkus = async (initialScene, design) => {
        if (!design.product_skus || design.product_skus.length === 0) return initialScene;
        
        let updatedScene = { ...initialScene, items: [...initialScene.items] };
        let changed = false;
        
        const dbCounts = design.product_skus.reduce((acc, s) => { acc[s] = (acc[s]||0)+1; return acc; }, {});
        const sceneCounts = updatedScene.items.map(i => i.sku).reduce((acc, s) => { acc[s] = (acc[s]||0)+1; return acc; }, {});
        
        for (const [sku, count] of Object.entries(dbCounts)) {
            const currentCount = sceneCounts[sku] || 0;
            if (count > currentCount) {
                // Fetch product for details
                let product = await fetchProductDetails(sku);

                const { w: bW, d: bD } = parseBoothSize(design.booth_size || boothSize);
                const { w, d, isFlooring, near } = getProductDimensions(product, sku, bW, bD);

                for(let i=0; i < (count - currentCount); i++) {
                    const mountType = getMountType(product);
                    const res = BoothEngine.addItem(
                        updatedScene,
                        sku,
                        product?.name || sku,
                        product?.image_cached_url || product?.image_url || null,
                        w,
                        d,
                        mountType !== 'floor' ? 'center' : near,
                        isFlooring,
                        product?.model_url || product?.model_glb_url || null,
                        { category: product?.category || '', brandingConfig: deriveBrandingConfig(product), mountType }
                    );
                    if (res.success) {
                        updatedScene = res.scene;
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            // Update the DB in the background
            base44.entities.BoothDesign.update(design.id, { scene_json: JSON.stringify(updatedScene) });
        }
        
        return updatedScene;
    };

    // Load existing project
    const handleSelectProject = async (project) => {
        setStep('loading');
        setMessages([]); // Clear previous messages
        try {
            setBoothDesign(project);
            setDesignName(project.design_name);
            setBoothSize(project.booth_size);
            setBoothType(project.booth_type || 'inline');
            setBrandUrl(project.brand_url || '');
            
            const initialScene = initializeScene(project);
            const reconciledScene = await reconcileSceneWithSkus(initialScene, project);
            setScene(reconciledScene);
            
            // Try to find existing conversation for this project
            const existingConvs = await base44.agents.listConversations({
                agent_name: 'booth_designer'
            });
            const projectConv = existingConvs.find(c => c.metadata?.booth_design_id === project.id);
            
            if (projectConv) {
                setConversation(projectConv);
                // The useEffect will subscribe and load the existing messages
            } else {
                const conv = await base44.agents.createConversation({
                    agent_name: 'booth_designer',
                    metadata: {
                        name: `Design Session: ${project.design_name}`,
                        booth_design_id: project.id,
                        booth_size: project.booth_size
                    }
                });
                setConversation(conv);
                
                await base44.agents.addMessage(conv, {
                    role: 'user',
                    content: `Hi! Let's design my ${project.booth_size} booth. The BoothDesign entity ID is ${project.id}. I am looking for ideas and products from the catalog to add to my booth.`
                });
            }
            
            setStep('designing');
        } catch (error) {
            console.error("Error loading project:", error);
            alert("Failed to load project");
            setStep('selector');
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



    // Load catalog products when the drawer is opened (lazy)
    useEffect(() => {
        if (!showCatalog || catalogProducts.length > 0) return;
        setCatalogLoading(true);
        base44.entities.Product.list().then(products => {
            setCatalogProducts(products || []);
        }).catch(console.error).finally(() => setCatalogLoading(false));
    }, [showCatalog]);

    // Determines how a product mounts using researched SKU branding profiles.
    // Falls back to keyword heuristics for products not in the profile.
    const getMountType = (product) => {
        const profile = SKU_BRANDING_PROFILES[product?.sku];
        if (profile?.defaultMountType) return profile.defaultMountType;
        // Fallback keyword heuristics for non-catalogued products
        const cat = (product?.category || '').toLowerCase();
        const name = (product?.name || '').toLowerCase();
        if (['ceiling', 'hanging overhead', 'suspended ceiling'].some(k => cat.includes(k) || name.includes(k))) return 'ceiling';
        if (['wall mount', 'wall-mount', 'wall sign', 'blaze wall'].some(k => cat.includes(k) || name.includes(k))) return 'wall_back';
        return 'floor';
    };

    // Derive branding config from product metadata using researched SKU profiles.
    const deriveBrandingConfig = (product) => {
        if (product?.branding_config) return product.branding_config;

        const profile = SKU_BRANDING_PROFILES[product?.sku];
        if (profile) {
            return {
                isBrandable: profile.canBrand === true,
                brandSurface: profile.brandSurface,
                brandMeshTags: [],
                hwMeshTags: [],
            };
        }

        // Fallback heuristics for products not in the profile
        const cat = (product?.category || '').toLowerCase();
        const name = (product?.name || '').toLowerCase();
        const BRANDABLE_KEYWORDS = ['backwall', 'banner', 'display', 'sign', 'lightbox',
            'light box', 'fabric', 'graphic', 'kiosk', 'counter', 'exhibit', 'wall', 'tower'];
        const HARDWARE_KEYWORDS = ['flooring', 'carpet', 'pole', 'hardware', 'stand base',
            'foot', 'bracket', 'clamp', 'base plate', 'accessory'];
        const isBrandable =
            BRANDABLE_KEYWORDS.some(k => cat.includes(k) || name.includes(k)) ? true :
            HARDWARE_KEYWORDS.some(k => cat.includes(k) || name.includes(k)) ? false : true;
        return { isBrandable, brandSurface: 'panel', brandMeshTags: [], hwMeshTags: [] };
    };

    // Helper to extract numeric dimensions or defaults
    const getProductDimensions = (product, sku, boothW = 10, boothD = 10) => {
        const cat = (product?.category || '').toLowerCase();
        const name = (product?.name || sku || '').toLowerCase();
        let w = 3;
        let d = 2;
        let isFlooring = false;

        // Is it flooring?
        if (cat.includes('flooring') || cat.includes('carpet') || name.includes('flooring') || name.includes('carpet')) {
            return { w: boothW, d: boothD, isFlooring: true };
        }

        // Try to find sizes like "20ft", "10ft", "20'", "10'", "20-ft"
        let extractedW = null;
        const ftMatch = name.match(/(\d+)[-\s]*(ft|')/);
        if (ftMatch) {
            extractedW = parseInt(ftMatch[1]);
        }
        // Also look for "10x20" etc
        const dimMatch = name.match(/(\d+)\s*x\s*(\d+)/);
        if (dimMatch) {
            extractedW = parseInt(dimMatch[1]); // Usually width is first
        }

        // Apply width, depth, and smart placement hint based on type
        // Inline/fabric exhibit display categories — all go at back wall
        const isInlineExhibit = cat.includes('inline') || cat.includes('master') ||
            cat.includes('designer') || cat.includes('essential lite') ||
            cat.includes('hopup') || cat.includes('hop-up') || cat.includes('embrace') ||
            cat.includes('formulate') || cat.includes('modulate') || cat.includes('vector fast');
        let near = 'center';
        if (cat.includes('backwall') || cat.includes('display') || name.includes('backwall') || isInlineExhibit) {
            w = extractedW || 10;
            d = 2;
            near = 'back_wall';
        } else if (cat.includes('counter') || cat.includes('podium') || name.includes('counter')) {
            w = extractedW || 3;
            d = 2;
            near = 'front';
        } else if (cat.includes('banner') || name.includes('banner')) {
            w = extractedW || 3;
            d = 1;
            near = 'back_wall';
        } else if (cat.includes('tower') || cat.includes('kiosk') || name.includes('kiosk')) {
            w = extractedW || 3;
            d = 3;
            near = 'center';
        } else if (extractedW) {
            w = extractedW;
        }

        return { w, d, isFlooring, near };
    };

    // Subscribe to the booth design entity to see added products live
    useEffect(() => {
        if (boothDesign?.id && step === 'designing') {
            const unsub = base44.entities.BoothDesign.subscribe(async (event) => {
                if (event.type === 'update' && event.id === boothDesign.id) {
                    const newData = event.data;
                    setBoothDesign(newData);

                    // Sync AI-added products into our scene
                    const currentScene = sceneRef.current;
                    if (currentScene && newData.product_skus) {
                        const sceneSkus = currentScene.items.map(i => i.sku);
                        if (newData.product_skus.length > sceneSkus.length) {
                            let updatedScene = { ...currentScene };
                            let changed = false;
                            
                            const dbCounts = newData.product_skus.reduce((acc, s) => { acc[s] = (acc[s]||0)+1; return acc; }, {});
                            const sceneCounts = sceneSkus.reduce((acc, s) => { acc[s] = (acc[s]||0)+1; return acc; }, {});
                            
                            for (const [sku, count] of Object.entries(dbCounts)) {
                                const currentCount = sceneCounts[sku] || 0;
                                if (count > currentCount) {
                                    // Fetch product to get name/image/dimensions
                                    let product = await fetchProductDetails(sku);
                                    
                                    const { w: bW, d: bD } = parseBoothSize(newData.booth_size || '10x10');
                                    const { w, d, isFlooring, near } = getProductDimensions(product, sku, bW, bD);

                                    const mountType = getMountType(product);
                                    for(let i=0; i < (count - currentCount); i++) {
                                        const res = BoothEngine.addItem(
                                            updatedScene,
                                            sku,
                                            product?.name || sku,
                                            product?.image_cached_url || product?.image_url || null,
                                            w,
                                            d,
                                            mountType !== 'floor' ? 'center' : near,
                                            isFlooring,
                                            product?.model_url || product?.model_glb_url || null,
                                            { category: product?.category || '', brandingConfig: deriveBrandingConfig(product), mountType }
                                        );
                                        if (res.success) {
                                            updatedScene = res.scene;
                                            changed = true;
                                        }
                                    }
                                }
                            }
                            
                            if (changed) {
                                // IMPORTANT: Use boothDesign.id directly from closure since it never changes
                                // and update the sceneRef immediately so subsequent events see it
                                sceneRef.current = updatedScene;
                                setScene(updatedScene);
                                
                                const skus = updatedScene.items.map(i => i.sku);
                                const updateData = {
                                    scene_json: JSON.stringify(updatedScene),
                                    product_skus: skus
                                };
                                
                                try {
                                    await base44.entities.BoothDesign.update(boothDesign.id, updateData);
                                } catch (e) {
                                    console.error("Failed to save scene", e);
                                }
                            }
                        }
                    }
                }
            });
            return () => unsub();
        }
    }, [boothDesign?.id, step]);

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

    const handleAddProductFromChat = async (sku) => {
        console.log("handleAddProductFromChat called with:", sku, "boothDesign:", boothDesign?.id);
        if (!boothDesign || !sku) {
            const toastModule = await import('sonner');
            toastModule.toast.error('Cannot add product: missing design or SKU');
            return;
        }
        if (!scene) {
            const toastModule = await import('sonner');
            toastModule.toast.error('Scene not initialized');
            return;
        }
        
        try {
            let product = await fetchProductDetails(sku);
            
            const { w: bW, d: bD } = parseBoothSize(boothDesign.booth_size || boothSize);
            const { w, d, isFlooring, near } = getProductDimensions(product, sku, bW, bD);

            let updatedScene = { ...scene, items: [...(scene.items || [])] };
            const mountType = getMountType(product);
            const res = BoothEngine.addItem(
                updatedScene,
                sku,
                product?.name || sku,
                product?.image_cached_url || product?.image_url || null,
                w,
                d,
                mountType !== 'floor' ? 'center' : near,
                isFlooring,
                product?.model_url || product?.model_glb_url || null,
                { category: product?.category || '', brandingConfig: deriveBrandingConfig(product), mountType }
            );

            if (res.success) {
                await saveScene(res.scene);
                const toastModule = await import('sonner');
                toastModule.toast.success(`Product ${sku} added to booth!`);
            } else {
                const toastModule = await import('sonner');
                toastModule.toast.error(`Not enough space in the booth for ${sku}.`);
            }
        } catch (error) {
            console.error('Failed to add product:', error);
            const toastModule = await import('sonner');
            toastModule.toast.error('Failed to add product');
        }
    };

    // Engine UI Handlers
    const handleMoveItem = (id, newX, newY) => {
        if (!scene) return;
        const res = BoothEngine.moveItem(scene, id, newX, newY);
        if (res.success) {
            // Optimistically update scene immediately to prevent lag
            setScene(res.scene);
            // Debounce the save to prevent rate limits
            if (window.saveTimeout) clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => {
                saveScene(res.scene);
            }, 500);
        } else {
            // Force re-render to snap back to original valid position
            setScene({ ...scene });
        }
    };

    const handleRotateItem = (id, degrees) => {
        if (!scene) return;
        const res = BoothEngine.rotateItem(scene, id, degrees);
        if (res.success) saveScene(res.scene);
    };

    const handleRemoveItem = (id) => {
        if (!scene) return;
        const res = BoothEngine.removeItem(scene, id);
        if (res.success) {
            saveScene(res.scene);
        }
    };

    const handleToggleWallMount = (id, newMountType) => {
        if (!scene) return;
        const itemIndex = scene.items.findIndex(i => i.id === id);
        if (itemIndex < 0) return;
        const item = scene.items[itemIndex];
        const newItems = [...scene.items];
        newItems[itemIndex] = {
            ...item,
            mountType: newMountType,
            mountHeight: newMountType !== 'floor' ? 3 : 0,
            wallOffset: newMountType !== 'floor' ? scene.booth.w_ft / 2 : item.x,
        };
        saveScene({ ...scene, items: newItems });
    };

    const handleRemoveProduct = async (skuToRemove) => {
        if (!boothDesign) return;
        
        // Remove one instance of the SKU from product_skus
        const skus = [...(boothDesign.product_skus || [])];
        const idx = skus.indexOf(skuToRemove);
        if (idx > -1) {
            skus.splice(idx, 1);
        }
        
        // Find an item in the scene with this SKU and remove it
        let updatedScene = { ...scene };
        if (scene && scene.items) {
            // Find the last added item with this SKU to remove
            const itemsWithSku = scene.items.filter(i => i.sku === skuToRemove);
            if (itemsWithSku.length > 0) {
                const itemToRemove = itemsWithSku[itemsWithSku.length - 1];
                updatedScene.items = scene.items.filter(i => i.id !== itemToRemove.id);
                setScene(updatedScene);
                sceneRef.current = updatedScene;
            }
        }
        
        const updateData = {
            product_skus: skus,
            scene_json: JSON.stringify(updatedScene)
        };
        
        try {
            await base44.entities.BoothDesign.update(boothDesign.id, updateData);
            setBoothDesign(prev => ({ ...prev, ...updateData }));
        } catch (e) {
            console.error("Failed to remove product", e);
        }
    };

    // SELECTOR / SETUP SCREEN
    if (step === 'selector') {
        return (
            <div className="pt-10 px-4 pb-20">
                <ProjectSelector 
                    onSelectProject={handleSelectProject} 
                    onNewProject={() => setStep('setup')} 
                />
            </div>
        );
    }

    if (step === 'setup' || step === 'loading') {
        return (
            <div className="max-w-md mx-auto mt-20 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mb-4 text-slate-500 hover:text-primary"
                    onClick={() => setStep('selector')}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Projects
                </Button>
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 text-primary rounded-2xl flex items-center justify-center shadow-inner border border-primary/20 rotate-3 transition-transform hover:rotate-6">
                        <LayoutTemplate className="w-8 h-8" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center mb-2 text-slate-900 dark:text-white">New Booth Project</h1>
                <p className="text-slate-500 text-center mb-8">Set up your space and let our AI agent help you furnish it.</p>
                
                <div className="space-y-4 text-slate-900 dark:text-white">
                    <div>
                        <label className="block text-sm font-medium mb-1">Project Name</label>
                        <Input value={designName} onChange={e => setDesignName(e.target.value)} placeholder="e.g. CES 2026 Booth" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Brand URL (Optional)</label>
                        <Input value={brandUrl} onChange={e => setBrandUrl(e.target.value)} placeholder="e.g. nike.com, apple.com" />
                        <p className="text-xs text-slate-500 mt-1">We'll use this to fetch your brand colors and logo for the render.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Booth Size</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['10x10', '10x20', '20x20'].map(size => (
                                <Button 
                                    key={size} 
                                    variant={boothSize === size ? 'default' : 'outline'}
                                    onClick={() => {
                                        setBoothSize(size);
                                        if (size === '20x20') setBoothType('island');
                                        else if (boothType === 'island') setBoothType('inline');
                                    }}
                                    className={cn("w-full transition-all", boothSize === size ? "bg-primary hover:bg-primary/90 text-white shadow-md" : "hover:border-primary/50 hover:bg-primary/5 hover:text-primary")}
                                >
                                    {size}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium mb-2">Booth Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['inline', 'corner', 'island', 'peninsula'].map(type => (
                                <Button 
                                    key={type} 
                                    variant={boothType === type ? 'default' : 'outline'}
                                    onClick={() => setBoothType(type)}
                                    className={cn("w-full transition-all capitalize", boothType === type ? "bg-primary hover:bg-primary/90 text-white shadow-md" : "hover:border-primary/50 hover:bg-primary/5 hover:text-primary")}
                                    disabled={boothSize === '20x20' && (type === 'inline' || type === 'corner')}
                                >
                                    {type}
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
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-500 shrink-0 hover:text-primary" 
                        onClick={() => setStep('selector')}
                        title="Back to Projects"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
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
                        <MessageBubble 
                            key={msg.id || Math.random()} 
                            message={msg} 
                            onAddProduct={handleAddProductFromChat}
                        />
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
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={toggleRecording}
                            className={cn("shrink-0 transition-colors", isRecording ? "bg-red-100 text-red-600 border-red-200 hover:bg-red-200 hover:text-red-700" : "text-slate-500")}
                        >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        <Input 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            placeholder={isRecording ? "Listening..." : "Ask for backwalls, counters, branding..."}
                            disabled={isSending}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={isSending || (!input.trim() && !isRecording)} className="bg-primary hover:bg-primary/90 shadow-sm transition-all">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right Column: Booth Space Visualization */}
            <div className="hidden md:flex w-2/3 flex-col relative bg-slate-100 dark:bg-slate-900">
                {/* Top Bar Overlay */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-20 pointer-events-none">
                    <h2 className="text-xl font-bold flex items-center gap-3 text-slate-900 dark:text-white drop-shadow-md pointer-events-auto">
                        <div className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg text-primary border border-slate-200 dark:border-slate-700 shadow-sm">
                            <LayoutTemplate className="w-5 h-5" />
                        </div>
                        <span className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">Set Space: {boothSize}</span>
                    </h2>
                    <div className="flex items-center gap-3 pointer-events-auto">
                        <Button
                            variant={showCatalog ? 'default' : 'outline'}
                            size="sm"
                            className={cn("h-9 shadow-sm backdrop-blur-sm border-slate-200 dark:border-slate-700", showCatalog ? "bg-primary text-white" : "bg-white/80 dark:bg-slate-800/80")}
                            onClick={() => setShowCatalog(v => !v)}
                        >
                            + Browse Products
                        </Button>

                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 shadow-sm bg-[#e2231a] hover:bg-[#b01b13] text-white"
                            disabled={!boothDesign?.product_skus?.length}
                            onClick={handleCreateQuote}
                        >
                            Create Quote
                        </Button>
                    </div>
                </div>

                {/* 3D Booth Editor */}
                <div className="flex-1 w-full relative overflow-hidden">
                    <BoothSnapshotRenderer
                        sceneJson={scene}
                        brandIdentity={boothDesign?.brand_identity}
                        boothSize={boothSize}
                        boothType={boothDesign?.booth_type || boothType}
                        interactive={true}
                        autoSnapshot={false}
                        onMoveItem={handleMoveItem}
                        onRotateItem={handleRotateItem}
                        onRemoveItem={handleRemoveItem}
                        onToggleWallMount={handleToggleWallMount}
                    />
                </div>

                {/* Catalog Drawer — slides in from the right over the 3D view */}
                {showCatalog && (() => {
                    const categories = ['All', ...Array.from(new Set(catalogProducts.map(p => p.category).filter(Boolean))).sort()];
                    const filtered = catalogProducts.filter(p => {
                        const matchCat = catalogCategory === 'All' || p.category === catalogCategory;
                        const q = catalogSearch.toLowerCase();
                        const matchSearch = !q || (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
                        return matchCat && matchSearch;
                    });
                    const filteredKits = catalogKitSize === 'all' ? BOOTH_KITS : BOOTH_KITS.filter(k => k.size === catalogKitSize);
                    return (
                        <div className="absolute top-0 right-0 bottom-0 w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-30 flex flex-col shadow-2xl">
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Product Catalog</h3>
                                <button onClick={() => setShowCatalog(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg">×</button>
                            </div>
                            {/* Tab Toggle */}
                            <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
                                <button
                                    onClick={() => setCatalogTab('kits')}
                                    className={cn("flex-1 py-2 text-xs font-semibold transition-colors", catalogTab === 'kits' ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
                                >
                                    ✦ Starter Kits
                                </button>
                                <button
                                    onClick={() => setCatalogTab('products')}
                                    className={cn("flex-1 py-2 text-xs font-semibold transition-colors", catalogTab === 'products' ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
                                >
                                    All Products
                                </button>
                            </div>

                            {/* ── KITS TAB ── */}
                            {catalogTab === 'kits' && (
                                <>
                                    {/* Size filter */}
                                    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 border-b border-slate-100 dark:border-slate-800">
                                        {['all', ...KIT_SIZES].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setCatalogKitSize(size)}
                                                className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap", catalogKitSize === size ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")}
                                            >
                                                {size === 'all' ? 'All Sizes' : size}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Kits list */}
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                        {filteredKits.map(kit => (
                                            <CatalogKitCard
                                                key={kit.id}
                                                kit={kit}
                                                onLoad={() => kit.products.forEach(item => handleAddProductFromChat(item.sku))}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* ── PRODUCTS TAB ── */}
                            {catalogTab === 'products' && (
                                <>
                                    {/* Search */}
                                    <div className="px-3 py-2 shrink-0 border-b border-slate-100 dark:border-slate-800">
                                        <Input
                                            value={catalogSearch}
                                            onChange={e => setCatalogSearch(e.target.value)}
                                            placeholder="Search products..."
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    {/* Category Chips */}
                                    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 border-b border-slate-100 dark:border-slate-800">
                                        {categories.map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setCatalogCategory(cat)}
                                                className={cn("shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap", catalogCategory === cat ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Product Grid */}
                                    <div className="flex-1 overflow-y-auto p-3">
                                        {catalogLoading ? (
                                            <div className="flex items-center justify-center h-32 text-slate-400 text-sm gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                                            </div>
                                        ) : filtered.length === 0 ? (
                                            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">No products found</div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {filtered.map(p => (
                                                    <button
                                                        key={p.id || p.sku}
                                                        onClick={() => handleAddProductFromChat(p.sku || p.name)}
                                                        className="group text-left bg-slate-50 dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-primary/10 border border-slate-200 dark:border-slate-700 hover:border-primary/40 rounded-xl p-2 transition-all"
                                                    >
                                                        <div className="aspect-square bg-white dark:bg-slate-700 rounded-lg mb-1.5 overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-600">
                                                            <CatalogProductImage src={p.image_cached_url || p.image_url} alt={p.name} />
                                                        </div>
                                                        <p className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 group-hover:text-primary transition-colors">{p.name}</p>
                                                        {p.sku && <p className="text-[9px] text-slate-400 mt-0.5">{p.sku}</p>}
                                                        <div className="mt-1.5 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">+ Add to Booth</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })()}

                {/* Bottom Products Strip */}
                <div className="h-48 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Included Products</h3>
                        <div className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            {boothDesign?.product_skus?.length || 0} Products
                        </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {Object.entries((boothDesign?.product_skus || []).reduce((acc, sku) => {
                            acc[sku] = (acc[sku] || 0) + 1;
                            return acc;
                        }, {})).map(([sku, count], idx) => (
                            <div key={idx} className="w-48 shrink-0">
                                <BoothProductCard sku={sku} quantity={count} onRemove={() => handleRemoveProduct(sku)} />
                            </div>
                        ))}
                        
                        {(!boothDesign?.product_skus || boothDesign.product_skus.length === 0) && (
                            <div className="flex-1 flex flex-col items-center justify-center py-6 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <p className="text-sm font-medium">No products added yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>


        </div>
    );
}

function CatalogProductImage({ src, alt }) {
    const [error, setError] = useState(false);
    if (!src || error) {
        return <span className="text-slate-300 text-2xl">📦</span>;
    }
    return (
        <img 
            src={src} 
            alt={alt} 
            className="w-full h-full object-contain"
            onError={() => setError(true)}
        />
    );
}

function CatalogKitCard({ kit, onLoad }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            style={{ borderLeft: `4px solid ${kit.accentColor}` }}
        >
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{kit.icon}</span>
                        <div>
                            <h4 className="font-semibold text-xs text-slate-900 dark:text-white">{kit.name}</h4>
                            <p className="text-[10px] text-slate-500">{kit.tagline}</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{kit.tier}</span>
                        <span className="text-[9px] text-slate-400 font-medium">{kit.size}</span>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-2">{kit.description}</p>
                <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">{kit.products.length} products</span>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">{kit.style}</span>
                </div>
            </div>
            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 space-y-1.5">
                    {kit.products.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <span className="text-[9px] font-bold text-slate-400 w-3 shrink-0 mt-0.5">{i + 1}</span>
                            <div className="min-w-0">
                                <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">{item.role}</p>
                                <p className="text-[9px] text-slate-400 leading-snug">{item.sku} — {item.note}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2 px-3 pb-3 pt-1">
                <button
                    onClick={onLoad}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: kit.accentColor }}
                >
                    Load Kit
                </button>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    {expanded ? '▲' : '▼'}
                </button>
            </div>
        </div>
    );
}

function BoothProductCard({ sku, quantity = 1, onRemove }) {
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProduct() {
            setLoading(true);
            try {
                let foundProduct = null;
                // 1. Try finding by SKU directly
                let res = await base44.entities.Product.filter({ sku });
                if (res.length > 0) {
                    foundProduct = res[0];
                } else {
                    // 2. Try finding by name (in case SKU passed is actually the name)
                    res = await base44.entities.Product.filter({ name: sku });
                    if (res.length > 0) {
                        foundProduct = res[0];
                    }
                }

                if (!foundProduct) {
                    // 3. Try ProductVariant by manufacturer_sku
                    let pvRes = await base44.entities.ProductVariant.filter({ manufacturer_sku: sku });
                    if (pvRes.length > 0) {
                        foundProduct = {
                            name: pvRes[0].display_name,
                            sku: pvRes[0].manufacturer_sku,
                            category: pvRes[0].category_name,
                            image_url: pvRes[0].thumbnail_url || pvRes[0].image_url
                        };
                    }
                }

                if (!foundProduct) {
                    // 4. Try heuristic: replace hyphens with spaces for Name lookup
                    const possibleName = sku.replace(/-/g, ' ').trim().toLowerCase();
                    
                    // 5. Client-side partial match as a last resort
                    try {
                        const recentProds = await base44.entities.Product.list('-created_date', 200);
                        const match = recentProds.find(p => 
                            (p.sku && p.sku.toLowerCase() === sku.toLowerCase()) || 
                            (p.name && p.name.toLowerCase() === possibleName) ||
                            (p.name && possibleName && p.name.toLowerCase().includes(possibleName))
                        );
                        
                        if (match) {
                            foundProduct = match;
                        }
                    } catch(e) {}
                }
                
                if (!foundProduct) {
                    // Fallback: Set basic info
                    foundProduct = { name: sku, sku: sku, category: 'Product' };
                }

                // Fetch Supabase image
                try {
                    const imgRes = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}/image` });
                    if (imgRes.data && imgRes.data.files && imgRes.data.files.length > 0) {
                        const validFiles = imgRes.data.files.filter(f => f.name.match(/\.(png|jpe?g|gif|webp)$/i));
                        if (validFiles.length > 0) {
                            let imgFile = validFiles.find(f => f.name.toLowerCase().includes('front')) ||
                                          validFiles.find(f => f.name.toLowerCase().includes('main')) ||
                                          validFiles.find(f => !f.name.toLowerCase().includes('cover') && !f.name.toLowerCase().includes('spread')) ||
                                          validFiles[0];
                            if (imgFile) {
                                foundProduct.image_url = imgFile.publicUrl;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Failed to fetch Supabase image for SKU:", sku, e);
                }

                setProduct(foundProduct);
            } catch (e) {
                console.error("Error fetching product:", e);
                setProduct({ name: sku, sku: sku, category: 'Product' });
            } finally {
                setLoading(false);
            }
        }
        if (sku) fetchProduct();
    }, [sku]);

    if (loading) return (
        <Card className="animate-pulse bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <CardContent className="p-4 aspect-square flex items-center justify-center text-slate-400 text-sm">
                Loading...
            </CardContent>
        </Card>
    );

    return (
        <Card className="overflow-hidden hover:shadow-md transition-shadow bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-slate-200 dark:border-slate-700 relative group/card">
            {onRemove && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="absolute top-2 left-2 z-20 bg-white/80 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-full p-1 opacity-0 group-hover/card:opacity-100 transition-all shadow-sm"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
            {quantity > 1 && (
                <div className="absolute top-2 right-2 z-10 bg-[#e2231a] text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                    x{quantity}
                </div>
            )}
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