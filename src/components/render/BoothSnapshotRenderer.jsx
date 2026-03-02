import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function BoothSnapshotRenderer({ 
    sceneJson, 
    brandIdentity, 
    boothSize = '10x10', 
    onSnapshotReady,
    width = 1280,
    height = 720
}) {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!sceneJson || !containerRef.current) return;

        let sceneData;
        try {
            sceneData = typeof sceneJson === 'string' ? JSON.parse(sceneJson) : sceneJson;
        } catch (e) {
            setError('Invalid scene data');
            return;
        }

        // Setup Three.js Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0); // Light gray background
        
        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        scene.add(dirLight);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;
        
        // Clear previous
        while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
        }
        containerRef.current.appendChild(renderer.domElement);

        // Parse Booth Size
        const parts = boothSize.toLowerCase().split('x');
        const boothW = parseInt(parts[0]) || 10;
        const boothD = parseInt(parts[1]) || 10;

        // Floor
        const floorGeo = new THREE.PlaneGeometry(boothW, boothD);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid Helper
        const gridHelper = new THREE.GridHelper(Math.max(boothW, boothD), Math.max(boothW, boothD), 0x888888, 0xdddddd);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);

        // Brand Texture Generation
        const createBrandTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // Background color
            ctx.fillStyle = brandIdentity?.primary_color || '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Text
            ctx.fillStyle = brandIdentity?.primary_color ? '#ffffff' : '#000000';
            ctx.font = 'bold 80px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(brandIdentity?.company_name || brandIdentity?.name || 'Your Brand', canvas.width / 2, canvas.height / 2);
            
            return new THREE.CanvasTexture(canvas);
        };

        const brandTexture = createBrandTexture();

        // Add Items
        if (sceneData.items && Array.isArray(sceneData.items)) {
            sceneData.items.forEach(item => {
                const itemW = item.w || 3;
                const itemD = item.d || 2;
                const itemH = item.h || 8; // Default height 8ft

                // Coordinate mapping:
                // 2D (0,0) is front-left. X right, Y back.
                // 3D: X right, Z back (but Three.js usually has Z forward, so we map Y to -Z or adjust camera)
                // Let's map: 3D origin (0,0,0) is center of booth.
                // 2D origin (0,0) is front-left.
                // worldX = x - boothW/2
                // worldZ = y - boothD/2
                
                const worldX = item.x - boothW / 2;
                const worldZ = item.y - boothD / 2;
                const worldY = itemH / 2;

                const geo = new THREE.BoxGeometry(itemW, itemH, itemD);
                
                // Materials: Apply brand texture to front face, others plain
                const materials = [
                    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // right
                    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // left
                    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // top
                    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // bottom
                    new THREE.MeshStandardMaterial({ map: brandTexture }), // front
                    new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // back
                ];

                const mesh = new THREE.Mesh(geo, materials);
                mesh.position.set(worldX, worldY, worldZ);
                
                // Rotation (item.rot is in degrees around Y axis)
                if (item.rot) {
                    mesh.rotation.y = -THREE.MathUtils.degToRad(item.rot);
                }
                
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);

                // Add Label
                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 256;
                labelCanvas.height = 64;
                const lctx = labelCanvas.getContext('2d');
                lctx.fillStyle = 'rgba(0,0,0,0.7)';
                lctx.fillRect(0, 0, 256, 64);
                lctx.fillStyle = 'white';
                lctx.font = '24px Arial';
                lctx.textAlign = 'center';
                lctx.textBaseline = 'middle';
                lctx.fillText(item.name || item.sku, 128, 32);
                
                const labelTex = new THREE.CanvasTexture(labelCanvas);
                const labelMat = new THREE.SpriteMaterial({ map: labelTex });
                const label = new THREE.Sprite(labelMat);
                label.position.set(worldX, itemH + 0.5, worldZ);
                label.scale.set(itemW, itemW * 0.25, 1);
                scene.add(label);
            });
        }

        // Position Camera
        // Positioned in front and slightly above
        camera.position.set(0, Math.max(boothW, boothD) * 0.8, boothD * 1.2);
        camera.lookAt(0, 2, 0);

        // Render
        renderer.render(scene, camera);

        // Capture Snapshot
        setTimeout(() => {
            try {
                const dataUrl = renderer.domElement.toDataURL('image/png');
                if (onSnapshotReady) {
                    onSnapshotReady(dataUrl);
                }
            } catch (e) {
                console.error("Failed to capture snapshot (possible CORS issue):", e);
                setError("Failed to capture snapshot. " + e.message);
            }
        }, 500);

        return () => {
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
        };
    }, [sceneJson, brandIdentity, boothSize, width, height]);

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden">
            {error ? (
                <div className="text-red-500 p-4 text-center">{error}</div>
            ) : (
                <div ref={containerRef} className="w-full h-full [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:object-contain" />
            )}
        </div>
    );
}