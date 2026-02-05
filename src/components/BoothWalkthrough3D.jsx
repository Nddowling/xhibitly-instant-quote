import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, PerspectiveCamera } from '@react-three/drei';
import { X, Maximize2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FallbackBoothGeometry from './FallbackBoothGeometry';

// 3D Model Component with error handling
function BoothModel({ modelPath, brandColors, boothSize }) {
  const [useFallback, setUseFallback] = useState(false);
  const meshRef = useRef();

  // Try to load the GLB model, fallback to procedural geometry if it fails
  let gltf;
  try {
    gltf = useGLTF(modelPath, true);
  } catch (error) {
    console.warn('GLB model not available, using fallback geometry');
    if (!useFallback) setUseFallback(true);
  }

  const scene = gltf?.scene;

  // Apply brand colors to materials if model loaded successfully
  useEffect(() => {
    if (brandColors && scene && !useFallback) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          // Apply primary color to main surfaces
          if (child.name.includes('wall') || child.name.includes('panel')) {
            child.material.color.set(brandColors.primary || '#e2231a');
          }
        }
      });
    }
  }, [scene, brandColors, useFallback]);

  // Use fallback geometry if model failed to load or doesn't exist
  if (useFallback || !scene) {
    return <FallbackBoothGeometry brandColors={brandColors} boothSize={boothSize} />;
  }

  return <primitive ref={meshRef} object={scene} scale={1} />;
}

// Loading fallback - shows procedural booth while model loads
function Loader({ brandColors, boothSize }) {
  return <FallbackBoothGeometry brandColors={brandColors} boothSize={boothSize} />;
}

// Main 3D Viewer Component
export default function BoothWalkthrough3D({
  isOpen,
  onClose,
  design,
  brandIdentity
}) {
  const controlsRef = useRef();

  if (!isOpen) return null;

  const modelPath = design?.walkthroughAsset?.modelUrl || '/assets/models/booth-sample-1.glb';
  const brandColors = {
    primary: brandIdentity?.primary_color || '#e2231a',
    secondary: brandIdentity?.secondary_color || '#ffffff'
  };
  const boothSize = design?.booth_size || '10x10';

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-2xl font-bold">{design?.tier} Booth Experience</h2>
            <p className="text-white/70 mt-1">Interactive 3D Walkthrough</p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 2, 8], fov: 50 }}
        className="w-full h-full"
      >
        <Suspense fallback={<Loader brandColors={brandColors} boothSize={boothSize} />}>
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, 10, -10]} intensity={0.3} />

          {/* Environment */}
          <Environment preset="warehouse" />

          {/* 3D Model */}
          <BoothModel
            modelPath={modelPath}
            brandColors={brandColors}
            boothSize={boothSize}
          />

          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="#555555" />
          </mesh>

          {/* Camera Controls */}
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2}
          />
        </Suspense>
      </Canvas>

      {/* Controls Panel */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-black/60 backdrop-blur-md rounded-full px-6 py-3 flex items-center gap-4">
          <div className="text-white/70 text-sm font-medium">
            Click + Drag to Rotate • Scroll to Zoom • Right-Click to Pan
          </div>
          <div className="h-6 w-px bg-white/20" />
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            <RotateCw className="w-4 h-4 mr-2" />
            Reset View
          </Button>
        </div>
      </div>

      {/* Brand Info Panel */}
      <div className="absolute bottom-6 right-6 z-10 bg-black/60 backdrop-blur-md rounded-lg p-4 max-w-xs">
        <h3 className="text-white font-semibold mb-2">Your Brand</h3>
        <div className="space-y-2 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-white/30"
              style={{ backgroundColor: brandColors.primary }}
            />
            <span>Primary Color</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border border-white/30"
              style={{ backgroundColor: brandColors.secondary }}
            />
            <span>Secondary Color</span>
          </div>
          {brandIdentity?.brand_personality && (
            <p className="mt-2 text-xs">
              {brandIdentity.brand_personality}
            </p>
          )}
        </div>
      </div>

      {/* Design Info Panel */}
      <div className="absolute top-24 left-6 z-10 bg-black/60 backdrop-blur-md rounded-lg p-4 max-w-sm">
        <h3 className="text-white font-semibold mb-2">{design?.tier} Tier</h3>
        <p className="text-white/80 text-sm mb-3">{design?.experience_story}</p>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-white/60">
            Size: <span className="text-white font-medium">{design?.booth_size}</span>
          </div>
          <div className="text-white/60">
            Price: <span className="text-white font-medium">${design?.total_cost?.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Preload GLB models
useGLTF.preload('/assets/models/booth-sample-1.glb');
