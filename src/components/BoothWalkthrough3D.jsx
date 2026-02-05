import React, { useEffect, useRef } from 'react';
import { X, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

export default function BoothWalkthrough3D({ isOpen, onClose, design, brandIdentity }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 4, 5);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight1.position.set(10, 10, 5);
    directionalLight1.castShadow = true;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-10, 10, -5);
    scene.add(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    // Parse booth dimensions
    const [width, depth] = design.booth_size.split('x').map(d => parseInt(d));
    const w = width * 0.3;
    const d = depth * 0.3;
    const wallHeight = 2.5;

    const primaryColor = brandIdentity?.primary_color || '#e2231a';
    const secondaryColor = brandIdentity?.secondary_color || '#0F1D2E';

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(w, d);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xf5f5f5, 
      roughness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Back wall
    const backWallGeometry = new THREE.BoxGeometry(w, wallHeight, 0.1);
    const backWallMaterial = new THREE.MeshStandardMaterial({ color: primaryColor });
    const backWall = new THREE.Mesh(backWallGeometry, backWallMaterial);
    backWall.position.set(0, wallHeight / 2, -d / 2);
    backWall.castShadow = true;
    scene.add(backWall);

    // Left wall
    const leftWallGeometry = new THREE.BoxGeometry(d, wallHeight, 0.1);
    const leftWallMaterial = new THREE.MeshStandardMaterial({ color: secondaryColor });
    const leftWall = new THREE.Mesh(leftWallGeometry, leftWallMaterial);
    leftWall.position.set(-w / 2, wallHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.castShadow = true;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(leftWallGeometry, leftWallMaterial);
    rightWall.position.set(w / 2, wallHeight / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.castShadow = true;
    scene.add(rightWall);

    // Display counter
    const counterGeometry = new THREE.BoxGeometry(w * 0.4, 1, 0.6);
    const counterMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      metalness: 0.1, 
      roughness: 0.6 
    });
    const counter = new THREE.Mesh(counterGeometry, counterMaterial);
    counter.position.set(0, 0.5, d / 3);
    counter.castShadow = true;
    scene.add(counter);

    // Custom tier features
    if (design.tier === 'Custom') {
      const bannerGeometry = new THREE.BoxGeometry(w * 0.6, 0.05, 1);
      const bannerMaterial = new THREE.MeshStandardMaterial({ color: primaryColor });
      const banner = new THREE.Mesh(bannerGeometry, bannerMaterial);
      banner.position.set(0, wallHeight + 0.5, 0);
      scene.add(banner);
    }

    // Hybrid/Custom tier stands
    if (design.tier === 'Hybrid' || design.tier === 'Custom') {
      const standGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.6, 32);
      const standMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc, 
        metalness: 0.5 
      });
      
      const leftStand = new THREE.Mesh(standGeometry, standMaterial);
      leftStand.position.set(-w * 0.3, 0.8, 0);
      leftStand.castShadow = true;
      scene.add(leftStand);

      const rightStand = new THREE.Mesh(standGeometry, standMaterial);
      rightStand.position.set(w * 0.3, 0.8, 0);
      rightStand.castShadow = true;
      scene.add(rightStand);
    }

    // Lighting poles
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 16);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    
    const pole1 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole1.position.set(-w * 0.4, 1.5, -d * 0.4);
    scene.add(pole1);

    const pole2 = new THREE.Mesh(poleGeometry, poleMaterial);
    pole2.position.set(w * 0.4, 1.5, -d * 0.4);
    scene.add(pole2);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a, 
      roughness: 0.9 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Simple orbit controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotation = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      rotation.y += deltaX * 0.005;
      rotation.x += deltaY * 0.005;
      rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.x));

      const radius = 8;
      camera.position.x = radius * Math.sin(rotation.y) * Math.cos(rotation.x);
      camera.position.y = radius * Math.sin(rotation.x) + 2;
      camera.position.z = radius * Math.cos(rotation.y) * Math.cos(rotation.x);
      camera.lookAt(0, 1, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const delta = e.deltaY * zoomSpeed;
      
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      camera.position.addScaledVector(direction, -delta * 5);
      
      const minDistance = 2;
      const maxDistance = 15;
      const distance = camera.position.length();
      if (distance < minDistance || distance > maxDistance) {
        camera.position.normalize().multiplyScalar(
          Math.max(minDistance, Math.min(maxDistance, distance))
        );
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sceneRef.current = null;
    };
  }, [isOpen, design, brandIdentity]);

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

            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

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