import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (user?.role !== 'admin') { 
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 }); 
        }

        const products = await base44.asServiceRole.entities.Product.list(undefined, 1000);
        let updatedCount = 0;

        for (const product of products) {
            const name = (product.name || '').toLowerCase();
            const sku = (product.sku || '').toUpperCase();
            
            let category = 'Uncategorized';
            let subcategory = 'Other';

            // 1. Portable Displays
            if (name.includes('retractable') || name.includes('roll up') || name.includes('rollup')) {
                if (!name.includes('telescopic') && !name.includes('light box')) {
                    category = 'Portable Displays';
                    subcategory = 'Retractable';
                }
            } else if (name.includes('telescopic') || sku.startsWith('PGSUS') || sku.startsWith('TAURUS')) {
                category = 'Portable Displays';
                subcategory = 'Telescopic';
            } else if (name.includes('spring back') || name.includes('spring-back') || sku.startsWith('X-TEND') || sku.startsWith('L-MINI') || sku.startsWith('LTNG')) {
                category = 'Portable Displays';
                subcategory = 'Spring Back';
            } 
            // 2. Hanging Structures
            else if (sku.startsWith('RNG-') || sku.startsWith('ESS-RNG-') || (name.includes('ring') && name.includes('hanging'))) {
                category = 'Hanging Structures';
                subcategory = 'Ring Structures';
            } else if (sku.startsWith('SQU-') || (name.includes('square') && name.includes('hanging'))) {
                category = 'Hanging Structures';
                subcategory = 'Square Structures';
            } else if (name.includes('hanging') || name.includes('tower') || name.includes('cylinder') || name.includes('triangle') || name.includes('shield')) {
                if (name.includes('hanging') || sku.startsWith('TRI-') || sku.startsWith('CYL-') || sku.startsWith('SHD-') || sku.startsWith('TOWER-')) {
                    category = 'Hanging Structures';
                    subcategory = 'Other Hanging';
                } else if (name.includes('tower')) {
                    category = 'Fabric Displays';
                    subcategory = 'Fabric Banners';
                }
            } 
            // 3. Fabric Displays
            else if (name.includes('light box') || name.includes('lightbox') || sku.includes('-LB-') || sku.includes('BLZ-') || sku.startsWith('CL-')) {
                category = 'Fabric Displays';
                subcategory = 'Light Boxes';
            } else if (sku.startsWith('FMLT') || sku.startsWith('ARCH') || sku.startsWith('HOP') || sku.startsWith('EMB') || name.includes('fabric') || name.includes('formulate') || name.includes('hopup') || name.includes('embrace') || name.includes('arch') || name.includes('wall') || name.includes('waveline')) {
                if (!name.includes('counter') && !name.includes('kiosk') && !name.includes('case')) {
                    category = 'Fabric Displays';
                    subcategory = 'Fabric Banners';
                } else if (name.includes('counter') || name.includes('podium') || sku.match(/^W-\d+-C/)) {
                    category = 'Display Components';
                    subcategory = 'Counters';
                } else if (name.includes('kiosk')) {
                    category = 'Display Components';
                    subcategory = 'Info Centers';
                }
            } 
            // 4. Counters
            else if (name.includes('counter') || name.includes('podium') || sku.match(/^W-\d+-C/) || sku.startsWith('HPC-')) {
                category = 'Display Components';
                subcategory = 'Counters';
            } 
            // 5. Info Centers
            else if (name.includes('kiosk') || name.includes('literature rack') || name.includes('brochure holder') || sku.includes('KIOSK') || sku.startsWith('TABLET') || sku.startsWith('ZD-')) {
                category = 'Display Components';
                subcategory = 'Info Centers';
            } 
            // 6. Accessories
            else if ((name.includes('led') || name.includes('light') || name.includes('spotlight') || name.includes('flood')) && !name.includes('light box') && !name.includes('kiosk')) {
                category = 'Accessories';
                subcategory = 'Display Lighting';
            } else if (name.includes('case') || name.includes('crate') || name.includes('bag') || name.includes('trolley') || sku.includes('CRATE') || sku.includes('-BG') || sku.startsWith('OC')) {
                category = 'Accessories';
                subcategory = 'Shipping Cases';
            } else if (name.includes('sign') || name.includes('frame') || name.includes('snap') || name.includes('a-frame') || sku.startsWith('ACE') || sku.startsWith('APEX') || sku.startsWith('ADVOCATE') || sku.startsWith('CONTOUR') || sku.startsWith('SNAP')) {
                category = 'Display Components';
                subcategory = 'Sign Stands';
            } else if (name.includes('table cover') || name.includes('table throw') || name.includes('table runner') || sku.startsWith('TBL-')) {
                category = 'Accessories';
                subcategory = 'Table Covers';
            } else if ((name.includes('flag') || name.includes('feather') || name.includes('teardrop') || sku.startsWith('ZOOM-FLX')) && !sku.startsWith('TNT') && !sku.includes('TNT')) {
                category = 'Outdoor';
                subcategory = 'Flags';
            } else if (name.includes('tent') || name.includes('canopy') || name.includes('popup') || sku.startsWith('TNT-') || sku.startsWith('ZOOM-FLX-TNT')) {
                category = 'Outdoor';
                subcategory = 'Tents';
            } else if (sku.startsWith('HP-K-') || sku.startsWith('CFAB-K-') || sku.startsWith('MFY-') || name.includes('hybrid pro')) {
                category = 'Modular Displays';
                if (sku.startsWith('MFY-')) subcategory = 'Retail Displays';
                else if (name.includes('20x20') || name.includes('20 x 20')) subcategory = '20x20 Kits';
                else subcategory = '10x10 Kits';
            } else if (sku.startsWith('AKIT-') || sku.includes('-AKIT-')) {
                category = 'Accessories';
                subcategory = 'Hardware Kits';
            }

            // Fallback for some products
            if (category === 'Uncategorized') {
                if (sku.startsWith('FMLT-DS-') || sku.startsWith('VF-K-') || sku.startsWith('VF-')) {
                    category = 'Fabric Displays';
                    subcategory = 'Fabric Banners';
                }
            }

            if (product.category !== category || product.subcategory !== subcategory) {
                updates.push({ id: product.id, category, subcategory });
            }
        }

        const batchSize = 10;
        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            await Promise.all(batch.map(u => 
                base44.asServiceRole.entities.Product.update(u.id, { category: u.category, subcategory: u.subcategory })
            ));
            updatedCount += batch.length;
        }

        return Response.json({ success: true, updatedCount });
    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});