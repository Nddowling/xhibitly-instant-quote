import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Html } from '@react-three/drei';
import { X, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

function BoothGeometry({ boothSize, tier, brandColors }) {
  const meshRef = useRef();

  const [width, depth] = boothSize.split('x').map(d => parseInt(d));
  const w = width * 0.3;
  const d = depth * 0.3;
  const wallHeight = 2.5;

  const primaryColor = brandColors?.primary_color || '#e2231a';
  const secondaryColor = brandColors?.secondary_color || '#0F1D2E';

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f5f5f5" roughness={0.8} />
      </mesh>

      <mesh position={[0, wallHeight / 2, -d / 2]}>
        <boxGeometry args={[w, wallHeight, 0.1]} />
        <meshStandardMaterial color={primaryColor} />
      </mesh>

      <mesh position={[-w / 2, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[d, wallHeight, 0.1]} />
        <meshStandardMaterial color={secondaryColor} />
      </mesh>

      <mesh position={[w / 2, wallHeight / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[d, wallHeight, 0.1]} />
        <meshStandardMaterial color={secondaryColor} />
      </mesh>

      <mesh position={[0, 0.5, d / 3]}>
        <boxGeometry args={[w * 0.4, 1, 0.6]} />
        <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.6} />
      </mesh>

      {tier === 'Custom' && (
        <mesh position={[0, wallHeight + 0.5, 0]}>
          <boxGeometry args={[w * 0.6, 0.05, 1]} />
          <meshStandardMaterial color={primaryColor} />
        </mesh>
      )}

      {(tier === 'Hybrid' || tier === 'Custom') && (
        <>
          <mesh position={[-w * 0.3, 0.8, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 1.6, 32]} />
            <meshStandardMaterial color="#cccccc" metalness={0.5} />
          </mesh>
          <mesh position={[w * 0.3, 0.8, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 1.6, 32]} />
            <meshStandardMaterial color="#cccccc" metalness={0.5} />
          </mesh>
        </>
      )}

      <mesh position={[-w * 0.4, 1.5, -d * 0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 16]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      <mesh position={[w * 0.4, 1.5, -d * 0.4]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 16]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
    </group>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="bg-white rounded-lg p-4 shadow-xl">
        <div className="text-slate-600">Loading 3D View...</div>
      </div>
    </Html>
  );
}

export default function BoothWalkthrough3D({ isOpen, onClose, design, brandIdentity }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="absolute inset-4 bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-slate-900 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{design.design_name}</h2>
                  <p className="text-slate-400">{design.booth_size} - {design.tier} Experience</p>
                </div>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>

            <Canvas
              shadows
              camera={{ position: [5, 4, 5], fov: 50 }}
              style={{ width: '100%', height: '100%' }}
            >
              <Suspense fallback={<LoadingFallback />}>
                <PerspectiveCamera makeDefault position={[5, 4, 5]} />
                <OrbitControls
                  enablePan={true}
                  enableZoom={true}
                  enableRotate={true}
                  minDistance={2}
                  maxDistance={15}
                  maxPolarAngle={Math.PI / 2}
                />
                
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
                <directionalLight position={[-10, 10, -5]} intensity={0.5} />
                <pointLight position={[0, 5, 0]} intensity={0.5} />

                <Environment preset="warehouse" />

                <BoothGeometry
                  boothSize={design.booth_size}
                  tier={design.tier}
                  brandColors={brandIdentity}
                />

                <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                  <planeGeometry args={[50, 50]} />
                  <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
                </mesh>
              </Suspense>
            </Canvas>

            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 px-4 py-2 rounded-lg flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-slate-600" />
              <span className="text-sm text-slate-600">Drag to rotate • Scroll to zoom</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}