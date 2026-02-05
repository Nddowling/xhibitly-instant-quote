import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Fallback procedural booth geometry
 * Renders a simple booth structure when GLB model fails to load
 */
export default function FallbackBoothGeometry({ brandColors, boothSize = '10x10' }) {
  const groupRef = useRef();

  // Parse booth dimensions
  const [width, depth] = boothSize.split('x').map(d => parseInt(d) / 3); // Scale down for view

  const primaryColor = brandColors?.primary || '#e2231a';
  const secondaryColor = brandColors?.secondary || '#ffffff';

  // Gentle rotation animation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Back wall */}
      <mesh position={[0, 1.5, -depth / 2]} castShadow>
        <boxGeometry args={[width, 3, 0.1]} />
        <meshStandardMaterial color={primaryColor} metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-width / 2, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[depth, 3, 0.1]} />
        <meshStandardMaterial color={primaryColor} metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Right wall (partial) */}
      <mesh position={[width / 2, 1.5, -depth / 4]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[depth / 2, 3, 0.1]} />
        <meshStandardMaterial color={primaryColor} metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Display counter */}
      <mesh position={[width / 3, 0.6, depth / 4]} castShadow>
        <boxGeometry args={[width / 2, 1.2, 0.6]} />
        <meshStandardMaterial color={secondaryColor} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Counter top accent */}
      <mesh position={[width / 3, 1.21, depth / 4]} castShadow>
        <boxGeometry args={[width / 2 + 0.1, 0.05, 0.7]} />
        <meshStandardMaterial color={primaryColor} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Monitor/screen */}
      <mesh position={[0, 2, -depth / 2 + 0.15]} castShadow>
        <boxGeometry args={[1.5, 0.8, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Screen bezel */}
      <mesh position={[0, 2, -depth / 2 + 0.12]}>
        <planeGeometry args={[1.3, 0.65]} />
        <meshStandardMaterial color="#0066cc" emissive="#0044aa" emissiveIntensity={0.3} />
      </mesh>

      {/* Product displays (small pedestals) */}
      {[
        [-width / 3, -depth / 4],
        [0, -depth / 4],
        [width / 3, -depth / 4]
      ].map((pos, i) => (
        <group key={i} position={[pos[0], 0, pos[1]]}>
          {/* Pedestal */}
          <mesh castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.8, 8]} />
            <meshStandardMaterial color={secondaryColor} metalness={0.4} roughness={0.6} />
          </mesh>
          {/* Product placeholder */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[0.2, 0.2, 0.2]} />
            <meshStandardMaterial color={primaryColor} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Ceiling lights */}
      {[
        [-width / 4, depth / 4],
        [width / 4, depth / 4],
        [-width / 4, -depth / 4],
        [width / 4, -depth / 4]
      ].map((pos, i) => (
        <group key={`light-${i}`} position={[pos[0], 3, pos[1]]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.15, 0.1, 6]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffeeaa"
              emissiveIntensity={0.5}
            />
          </mesh>
          <pointLight intensity={0.3} distance={4} color="#ffffee" />
        </group>
      ))}

      {/* Floor carpet/mat */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 0.9, depth * 0.9]} />
        <meshStandardMaterial
          color={secondaryColor}
          metalness={0}
          roughness={0.9}
        />
      </mesh>

      {/* Brand accent bars */}
      <mesh position={[0, 0.05, depth / 2 - 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, 0.2]} />
        <meshStandardMaterial
          color={primaryColor}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}
