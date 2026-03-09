import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 3D Booth Editor - "The TV"
 *
 * Interactive 3D canvas where users can:
 * - Drag and drop products from catalog
 * - Position, rotate, and arrange items
 * - Preview in real-time
 * - Export booth layout
 *
 * This is the primary interface. AI suggestions are applied here.
 */
export default function BoothEditor3D({
  boothSize = '10x10',
  brandIdentity = {},
  onLayoutChange,
  aiSuggestions = []
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parse booth dimensions
  const [boothW, boothD] = boothSize.split('x').map(n => parseInt(n) || 10);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(boothW * 0.8, boothW * 1.2, boothD * 1.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    containerRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(boothW, boothW * 2, boothD);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(boothW, boothD);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const gridHelper = new THREE.GridHelper(
      Math.max(boothW, boothD),
      Math.max(boothW, boothD),
      0xcccccc,
      0xe0e0e0
    );
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Booth Boundary
    const boundaryGeo = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(boothW, boothD)
    );
    const boundaryMat = new THREE.LineBasicMaterial({
      color: 0x0066cc,
      linewidth: 2
    });
    const boundary = new THREE.LineSegments(boundaryGeo, boundaryMat);
    boundary.rotation.x = -Math.PI / 2;
    boundary.position.y = 0.02;
    scene.add(boundary);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
    };
  }, [boothSize]);

  // Add product to scene
  const addProduct = (product, position = { x: 0, z: 0 }) => {
    if (!sceneRef.current) return;

    const newProduct = {
      id: Date.now(),
      ...product,
      position,
      rotation: 0
    };

    // Create 3D representation
    const mesh = createProductMesh(product, brandIdentity);
    mesh.userData.productId = newProduct.id;

    // Position mesh
    const worldX = position.x - boothW / 2;
    const worldZ = position.z - boothD / 2;
    const worldY = (product.height_ft || 4) / 2;
    mesh.position.set(worldX, worldY, worldZ);

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    sceneRef.current.add(mesh);

    setProducts(prev => [...prev, newProduct]);
    onLayoutChange?.([...products, newProduct]);
  };

  // Create 3D mesh based on product type
  const createProductMesh = (product, brand) => {
    const w = product.footprint_w_ft || 2;
    const h = product.height_ft || 6;
    const d = product.footprint_d_ft || 1;

    switch (product.render_kind) {
      case 'billboard': {
        // Thin display with product image
        const geometry = new THREE.BoxGeometry(w, h, 0.1);
        const materials = [
          new THREE.MeshStandardMaterial({ color: 0xcccccc }), // sides
          new THREE.MeshStandardMaterial({ color: 0xcccccc }),
          new THREE.MeshStandardMaterial({ color: 0xcccccc }),
          new THREE.MeshStandardMaterial({ color: 0xcccccc }),
          new THREE.MeshStandardMaterial({ color: 0x4a90e2 }), // front - could load image
          new THREE.MeshStandardMaterial({ color: 0xcccccc })
        ];
        return new THREE.Mesh(geometry, materials);
      }

      case 'box':
      default: {
        // Standard box display
        const geometry = new THREE.BoxGeometry(w, h, d);

        // Apply brand color to front face
        const brandColor = brand?.primary_color || '#4a90e2';
        const materials = [
          new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // right
          new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // left
          new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // top
          new THREE.MeshStandardMaterial({ color: 0xeeeeee }), // bottom
          new THREE.MeshStandardMaterial({ color: brandColor }), // front
          new THREE.MeshStandardMaterial({ color: 0xeeeeee })  // back
        ];

        return new THREE.Mesh(geometry, materials);
      }
    }
  };

  // Remove product
  const removeProduct = (productId) => {
    if (!sceneRef.current) return;

    // Find and remove mesh from scene
    const mesh = sceneRef.current.children.find(
      child => child.userData?.productId === productId
    );
    if (mesh) {
      sceneRef.current.remove(mesh);
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material?.dispose();
      }
    }

    const updated = products.filter(p => p.id !== productId);
    setProducts(updated);
    onLayoutChange?.(updated);
  };

  // Apply AI suggestion
  const applyAISuggestion = (suggestion) => {
    // AI suggestion format:
    // { product, position: { x, z }, rotation }
    addProduct(suggestion.product, suggestion.position);
  };

  return (
    <div className="flex h-screen">
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="w-full h-full"
        />

        {/* Editor Controls Overlay */}
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm text-gray-700">Booth: {boothSize}</h3>
          <div className="text-xs text-gray-500">
            {products.length} products
          </div>
        </div>

        {/* Export Button */}
        <div className="absolute bottom-4 right-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700"
            onClick={() => onLayoutChange?.(products)}
          >
            Save Layout
          </button>
        </div>
      </div>

      {/* Right Sidebar - Product Library & AI */}
      <div className="w-80 bg-gray-50 border-l border-gray-200 overflow-y-auto">
        <div className="p-4 space-y-4">
          <h2 className="text-lg font-bold">Booth Editor</h2>

          {/* AI Suggestions Section */}
          {aiSuggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <span className="text-blue-600">🤖</span>
                AI Suggestions
              </h3>
              {aiSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  className="w-full text-left text-sm p-2 hover:bg-blue-100 rounded"
                  onClick={() => applyAISuggestion(suggestion)}
                >
                  {suggestion.description}
                </button>
              ))}
            </div>
          )}

          {/* Current Products */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Products in Booth</h3>
            {products.length === 0 ? (
              <p className="text-xs text-gray-500">
                No products yet. Start by asking AI or dragging from library.
              </p>
            ) : (
              <div className="space-y-1">
                {products.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 bg-white rounded text-xs hover:bg-gray-50"
                  >
                    <span>{product.name}</span>
                    <button
                      onClick={() => removeProduct(product.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}