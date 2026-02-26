export const BoothEngine = {
    createScene: (widthFt = 10, depthFt = 10) => ({
        booth: { w_ft: widthFt, d_ft: depthFt },
        items: []
    }),

    isValidPlacement: (scene, x, y, rot, w, d, itemIdToIgnore = null) => {
        const isRotated = rot === 90 || rot === 270;
        const actualW = isRotated ? d : w;
        const actualD = isRotated ? w : d;

        const left = x - actualW / 2;
        const right = x + actualW / 2;
        const top = y + actualD / 2;
        const bottom = y - actualD / 2;

        if (left < 0 || right > scene.booth.w_ft || bottom < 0 || top > scene.booth.d_ft) {
            return { valid: false, reason: 'Out of bounds' };
        }

        for (const item of scene.items) {
            if (item.id === itemIdToIgnore) continue;

            const itemRotated = item.rot === 90 || item.rot === 270;
            const itemW = itemRotated ? item.d : item.w;
            const itemD = itemRotated ? item.w : item.d;

            const iLeft = item.x - itemW / 2;
            const iRight = item.x + itemW / 2;
            const iTop = item.y + itemD / 2;
            const iBottom = item.y - itemD / 2;

            if (left < iRight && right > iLeft && bottom < iTop && top > iBottom) {
                return { valid: false, reason: `Collision with another item` };
            }
        }

        return { valid: true };
    },

    addItem: (scene, sku, name, imageUrl, w = 3, d = 1, near = 'center') => {
        const item = {
            id: Math.random().toString(36).substring(2, 9),
            sku,
            name,
            imageUrl,
            x: scene.booth.w_ft / 2,
            y: scene.booth.d_ft / 2,
            rot: 0,
            w,
            d
        };

        const step = 0.5; // 6 inch snap
        let placed = false;
        
        let startX = scene.booth.w_ft / 2;
        let startY = scene.booth.d_ft / 2;

        if (near === 'back_wall') {
            startY = scene.booth.d_ft - item.d / 2;
        } else if (near === 'front') {
            startY = item.d / 2;
        }

        // Radial search outward
        for (let radius = 0; radius < Math.max(scene.booth.w_ft, scene.booth.d_ft); radius += step) {
            for (let dx = -radius; dx <= radius; dx += step) {
                for (let dy = -radius; dy <= radius; dy += step) {
                    const testX = startX + dx;
                    const testY = startY + dy;
                    if (BoothEngine.isValidPlacement(scene, testX, testY, item.rot, item.w, item.d).valid) {
                        item.x = testX;
                        item.y = testY;
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            if (placed) break;
        }

        if (placed) {
            return { success: true, scene: { ...scene, items: [...scene.items, item] }, item };
        }
        return { success: false, reason: 'No valid placement found. Booth might be full.' };
    },

    moveItem: (scene, itemId, newX, newY) => {
        const itemIndex = scene.items.findIndex(i => i.id === itemId);
        if (itemIndex < 0) return { success: false, reason: 'Item not found' };
        
        const item = scene.items[itemIndex];
        
        // Snap to 0.5 grid
        newX = Math.round(newX * 2) / 2;
        newY = Math.round(newY * 2) / 2;

        const check = BoothEngine.isValidPlacement(scene, newX, newY, item.rot, item.w, item.d, itemId);
        if (check.valid) {
            const newItems = [...scene.items];
            newItems[itemIndex] = { ...item, x: newX, y: newY };
            return { success: true, scene: { ...scene, items: newItems } };
        }
        return { success: false, reason: check.reason };
    },
    
    rotateItem: (scene, itemId, degrees = 90) => {
        const itemIndex = scene.items.findIndex(i => i.id === itemId);
        if (itemIndex < 0) return { success: false, reason: 'Item not found' };
        
        const item = scene.items[itemIndex];
        const newRot = (item.rot + degrees) % 360;

        const check = BoothEngine.isValidPlacement(scene, item.x, item.y, newRot, item.w, item.d, itemId);
        if (check.valid) {
            const newItems = [...scene.items];
            newItems[itemIndex] = { ...item, rot: newRot };
            return { success: true, scene: { ...scene, items: newItems } };
        }
        return { success: false, reason: check.reason };
    },
    
    removeItem: (scene, itemId) => {
        const newItems = scene.items.filter(i => i.id !== itemId);
        return { success: true, scene: { ...scene, items: newItems } };
    }
};