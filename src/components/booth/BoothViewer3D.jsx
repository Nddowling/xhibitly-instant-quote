import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, RefreshCw, Maximize2, Info } from 'lucide-react';

export default function BoothViewer3D({ products, brandIdentity, onProductClick }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedModels, setLoadedModels] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 10, 15);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(30, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xe2e8f0,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Load 3D models
    loadProducts();

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const loadProducts = async () => {
    const loader = new GLTFLoader();
    const models = [];

    // Position products in the booth space
    const positions = [
      { x: -5, z: -5 }, // Back left
      { x: 0, z: -5 },  // Back center
      { x: 5, z: -5 },  // Back right
      { x: -3, z: 0 },  // Middle left
      { x: 3, z: 0 },   // Middle right
      { x: 0, z: 3 },   // Front center
    ];

    for (let i = 0; i < products.length && i < positions.length; i++) {
      const product = products[i];
      
      // If product has 3D model URL, load it
      if (product.model_3d_url) {
        try {
          const gltf = await new Promise((resolve, reject) => {
            loader.load(product.model_3d_url, resolve, undefined, reject);
          });
          
          const model = gltf.scene;
          model.position.set(positions[i].x, 0, positions[i].z);
          model.castShadow = true;
          model.receiveShadow = true;

          // Apply brand colors if customizable
          if (product.customizable && brandIdentity) {
            applyBranding(model, brandIdentity);
          }

          // Make model clickable
          model.userData = { product, index: i };
          model.traverse((child) => {
            if (child.isMesh) {
              child.userData = { product, index: i };
            }
          });

          sceneRef.current.add(model);
          models.push({ product, model });
        } catch (error) {
          console.log('Failed to load model:', product.name);
          // Create placeholder box
          createPlaceholder(positions[i], product, i, models);
        }
      } else {
        // Create placeholder box
        createPlaceholder(positions[i], product, i, models);
      }
    }

    setLoadedModels(models);
    setIsLoading(false);
  };

  const createPlaceholder = (position, product, index, models) => {
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({ 
      color: brandIdentity?.primary_color ? new THREE.Color(brandIdentity.primary_color) : 0x666666,
      roughness: 0.5,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, 1, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { product, index };
    
    sceneRef.current.add(mesh);
    models.push({ product, model: mesh });
  };

  const applyBranding = (model, brandIdentity) => {
    model.traverse((child) => {
      if (child.isMesh) {
        // Apply primary color to main surfaces
        if (brandIdentity.primary_color) {
          child.material = child.material.clone();
          child.material.color = new THREE.Color(brandIdentity.primary_color);
        }
      }
    });
  };

  const handleCanvasClick = (event) => {
    if (!cameraRef.current || !sceneRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    
    if (intersects.length > 0) {
      const userData = intersects[0].object.userData;
      if (userData.product) {
        setSelectedProduct(userData.product);
        if (onProductClick) {
          onProductClick(userData.product);
        }
      }
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(15, 10, 15);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative">
      <div 
        ref={mountRef} 
        className="w-full h-[600px] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border-2 border-slate-200"
        onClick={handleCanvasClick}
      />
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#e2231a] animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Loading 3D Booth Experience...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={resetCamera}
          className="bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset View
        </Button>
      </div>

      {/* Instructions */}
      <Card className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm shadow-lg border-0 p-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Info className="w-4 h-4 text-[#e2231a]" />
          <span>Click products to swap • Drag to rotate • Scroll to zoom</span>
        </div>
      </Card>

      {/* Selected Product Info */}
      {selectedProduct && (
        <Card className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm shadow-lg border-0 p-4 max-w-xs">
          <div className="flex items-start justify-between mb-2">
            <Badge className="bg-[#e2231a] text-white">{selectedProduct.category}</Badge>
            <button 
              onClick={() => setSelectedProduct(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
          <h3 className="font-semibold text-slate-800 mb-1">{selectedProduct.name}</h3>
          <p className="text-sm text-slate-600">{selectedProduct.description}</p>
        </Card>
      )}
    </div>
  );
}