import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Info, RotateCcw, Camera, ZoomIn } from 'lucide-react';

const GEOMETRY_BUILDERS = {
  backwall: (dims, brandColor) => {
    const group = new THREE.Group();
    // Main wall panel
    const wallGeo = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    const wallMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.3, metalness: 0.1 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = dims.height / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    // Top header bar
    const headerGeo = new THREE.BoxGeometry(dims.width + 0.3, 0.4, dims.depth + 0.2);
    const headerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.7 });
    const header = new THREE.Mesh(headerGeo, headerMat);
    header.position.y = dims.height + 0.2;
    header.castShadow = true;
    group.add(header);
    // Vertical support poles
    for (let x of [-dims.width/2 + 0.1, dims.width/2 - 0.1]) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, dims.height + 0.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, (dims.height + 0.5) / 2, 0);
      pole.castShadow = true;
      group.add(pole);
    }
    return group;
  },
  counter: (dims, brandColor) => {
    const group = new THREE.Group();
    // Main body
    const bodyGeo = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    const bodyMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x475569, roughness: 0.4, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = dims.height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    // Countertop surface
    const topGeo = new THREE.BoxGeometry(dims.width + 0.2, 0.15, dims.depth + 0.2);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = dims.height + 0.075;
    top.castShadow = true;
    group.add(top);
    return group;
  },
  popup_bar: (dims, brandColor) => {
    const group = new THREE.Group();
    // Counter section
    const counterGeo = new THREE.BoxGeometry(dims.width, dims.height * 0.5, dims.depth);
    const counterMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x475569, roughness: 0.4, metalness: 0.3 });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.y = dims.height * 0.25;
    counter.castShadow = true;
    group.add(counter);
    // Header sign pole
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, dims.height * 0.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, dims.height * 0.5 + dims.height * 0.25, 0);
    group.add(pole);
    // Header sign
    const signGeo = new THREE.BoxGeometry(dims.width * 0.9, dims.height * 0.2, 0.1);
    const signMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.3 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.y = dims.height * 0.85;
    sign.castShadow = true;
    group.add(sign);
    return group;
  },
  table: (dims, brandColor) => {
    const group = new THREE.Group();
    // Tabletop
    const topGeo = new THREE.BoxGeometry(dims.width, 0.15, dims.depth);
    const topMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x475569, roughness: 0.3 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = dims.height;
    top.castShadow = true;
    group.add(top);
    // Table cloth drape
    const clothGeo = new THREE.BoxGeometry(dims.width + 0.1, dims.height * 0.3, dims.depth + 0.1);
    const clothMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.6, metalness: 0.05 });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.y = dims.height - 0.15;
    group.add(cloth);
    // Legs
    for (let x of [-dims.width/2 + 0.15, dims.width/2 - 0.15]) {
      for (let z of [-dims.depth/2 + 0.15, dims.depth/2 - 0.15]) {
        const legGeo = new THREE.CylinderGeometry(0.06, 0.06, dims.height - 0.3, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, (dims.height - 0.3) / 2, z);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    return group;
  },
  banner_stand: (dims, brandColor) => {
    const group = new THREE.Group();
    // Base
    const baseGeo = new THREE.BoxGeometry(dims.width * 0.8, 0.1, 0.8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.05;
    group.add(base);
    // Banner panel
    const bannerGeo = new THREE.BoxGeometry(dims.width, dims.height, 0.05);
    const bannerMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.4 });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.y = dims.height / 2 + 0.1;
    banner.castShadow = true;
    group.add(banner);
    // Support pole
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, dims.height, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, dims.height / 2 + 0.1, -0.05);
    group.add(pole);
    return group;
  },
  tent: (dims, brandColor) => {
    const group = new THREE.Group();
    const legH = dims.height * 0.7;
    // 4 Legs
    for (let x of [-dims.width/2 + 0.2, dims.width/2 - 0.2]) {
      for (let z of [-dims.depth/2 + 0.2, dims.depth/2 - 0.2]) {
        const legGeo = new THREE.CylinderGeometry(0.08, 0.08, legH, 8);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(x, legH / 2, z);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    // Canopy
    const canopyGeo = new THREE.ConeGeometry(dims.width * 0.75, dims.height * 0.3, 4);
    const canopyMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.5, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = legH + dims.height * 0.15;
    canopy.rotation.y = Math.PI / 4;
    canopy.castShadow = true;
    group.add(canopy);
    // Valance trim
    const valanceGeo = new THREE.BoxGeometry(dims.width, 0.3, dims.depth);
    const valanceMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.5 });
    const valance = new THREE.Mesh(valanceGeo, valanceMat);
    valance.position.y = legH;
    group.add(valance);
    return group;
  },
  billboard: (dims, brandColor) => {
    const group = new THREE.Group();
    // A-frame legs
    const legAngle = 0.15;
    for (let side of [-1, 1]) {
      const legGeo = new THREE.BoxGeometry(dims.width, 0.08, dims.height * 0.8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.rotation.x = side * legAngle;
      leg.position.set(0, dims.height * 0.4, side * 0.3);
      group.add(leg);
    }
    // Front panel
    const panelGeo = new THREE.BoxGeometry(dims.width, dims.height * 0.7, 0.05);
    const panelMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155, roughness: 0.4 });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, dims.height * 0.45, 0.25);
    panel.rotation.x = -legAngle;
    panel.castShadow = true;
    group.add(panel);
    return group;
  },
  monitor_stand: (dims, brandColor) => {
    const group = new THREE.Group();
    // Base
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.15, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    group.add(base);
    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, dims.height - 1.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = (dims.height - 1.5) / 2 + 0.15;
    group.add(pole);
    // Screen
    const screenGeo = new THREE.BoxGeometry(dims.width, dims.width * 0.6, 0.1);
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.3 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.y = dims.height - 0.6;
    screen.castShadow = true;
    group.add(screen);
    // Base branding panel
    const brandGeo = new THREE.BoxGeometry(dims.width * 0.8, 1.5, 0.1);
    const brandMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x334155 });
    const brandPanel = new THREE.Mesh(brandGeo, brandMat);
    brandPanel.position.set(0, 1, 0.15);
    group.add(brandPanel);
    return group;
  },
  kiosk: (dims, brandColor) => {
    const group = new THREE.Group();
    // Body
    const bodyGeo = new THREE.CylinderGeometry(dims.width * 0.4, dims.width * 0.45, dims.height, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: brandColor || 0x475569, roughness: 0.3, metalness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = dims.height / 2;
    body.castShadow = true;
    group.add(body);
    // Top surface
    const topGeo = new THREE.CylinderGeometry(dims.width * 0.42, dims.width * 0.42, 0.1, 16);
    const topMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = dims.height + 0.05;
    group.add(top);
    return group;
  }
};

export default function BoothScene3D({ 
  products, 
  brandIdentity, 
  spatialLayout, 
  boothSize, 
  onProductClick, 
  selectedProductId 
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const productMeshesRef = useRef([]);
  const animationRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredProduct, setHoveredProduct] = useState(null);

  const boothDims = boothSize === '10x10' ? { w: 10, d: 10 } : boothSize === '10x20' ? { w: 20, d: 10 } : { w: 20, d: 20 };

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 30, 60);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(boothDims.w * 0.8, boothDims.w * 0.6, boothDims.d * 0.8);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 5;
    controls.maxDistance = 40;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // Ambient
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    // Key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(15, 25, 10);
    keyLight.castShadow = true;
    keyLight.shadow.camera.left = -25;
    keyLight.shadow.camera.right = 25;
    keyLight.shadow.camera.top = 25;
    keyLight.shadow.camera.bottom = -25;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);
    // Fill light
    const fillLight = new THREE.DirectionalLight(0x8ecae6, 0.3);
    fillLight.position.set(-10, 8, -10);
    scene.add(fillLight);
    // Rim light
    const rimLight = new THREE.PointLight(0xffffff, 0.4);
    rimLight.position.set(0, 15, -15);
    scene.add(rimLight);

    // Exhibition floor
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.9, metalness: 0.05 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Booth boundary carpet
    const carpetGeo = new THREE.PlaneGeometry(boothDims.w, boothDims.d);
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.95, metalness: 0 });
    const carpet = new THREE.Mesh(carpetGeo, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    scene.add(carpet);

    // Booth outline
    const borderMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 2 });
    const borderPts = [
      new THREE.Vector3(-boothDims.w/2, 0.02, -boothDims.d/2),
      new THREE.Vector3(boothDims.w/2, 0.02, -boothDims.d/2),
      new THREE.Vector3(boothDims.w/2, 0.02, boothDims.d/2),
      new THREE.Vector3(-boothDims.w/2, 0.02, boothDims.d/2),
      new THREE.Vector3(-boothDims.w/2, 0.02, -boothDims.d/2)
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    scene.add(new THREE.Line(borderGeo, borderMat));

    buildProducts(scene);

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (container && renderer.domElement) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [products, spatialLayout, brandIdentity]);

  const buildProducts = (scene) => {
    productMeshesRef.current = [];

    if (!products || products.length === 0) {
      setIsLoading(false);
      return;
    }

    const primaryColor = brandIdentity?.primary_color ? new THREE.Color(brandIdentity.primary_color) : null;
    const secondaryColor = brandIdentity?.secondary_color ? new THREE.Color(brandIdentity.secondary_color) : null;

    products.forEach((product, i) => {
      const layout = spatialLayout?.find(l => 
        l.product_sku === product.manufacturer_sku || l.product_sku === product.sku
      );
      const pos = layout?.position || { x: (i % 4) * 3 - 4.5, y: 0, z: Math.floor(i / 4) * 3 - 3 };
      const rot = layout?.rotation || { x: 0, y: 0, z: 0 };
      const scale = layout?.scale || 1;

      const geoType = product.geometry_type || 'counter';
      const dims = product.dimensions || { width: 3, height: 4, depth: 2 };

      let color = primaryColor;
      if (layout?.branding?.apply_brand_color && layout?.branding?.color) {
        color = new THREE.Color(layout.branding.color);
      } else if (i % 3 === 1 && secondaryColor) {
        color = secondaryColor;
      }

      const builder = GEOMETRY_BUILDERS[geoType] || GEOMETRY_BUILDERS.counter;
      const mesh = builder(dims, color);

      mesh.position.set(pos.x, pos.y || 0, pos.z);
      mesh.rotation.set(
        (rot.x || 0) * Math.PI / 180,
        (rot.y || 0) * Math.PI / 180,
        (rot.z || 0) * Math.PI / 180
      );
      mesh.scale.set(scale, scale, scale);

      mesh.userData = { product, index: i };
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.userData = { product, index: i };
        }
      });

      scene.add(mesh);
      productMeshesRef.current.push({ product, mesh });
    });

    setIsLoading(false);
  };

  const handleClick = useCallback((event) => {
    if (!cameraRef.current || !sceneRef.current || !mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    for (const hit of intersects) {
      if (hit.object.userData?.product) {
        onProductClick?.(hit.object.userData.product);
        return;
      }
    }
  }, [onProductClick]);

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(boothDims.w * 0.8, boothDims.w * 0.6, boothDims.d * 0.8);
      controlsRef.current.target.set(0, 2, 0);
      controlsRef.current.update();
    }
  };

  const setFrontView = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 4, boothDims.d * 1.2);
      controlsRef.current.target.set(0, 3, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100">
      <div
        ref={mountRef}
        className="w-full h-[500px] md:h-[600px] cursor-grab active:cursor-grabbing"
        onClick={handleClick}
      />

      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-[#e2231a] animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Building your booth...</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 flex gap-2">
        <Button size="sm" variant="secondary" onClick={resetCamera} className="bg-white/90 backdrop-blur shadow-md hover:bg-white">
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
        <Button size="sm" variant="secondary" onClick={setFrontView} className="bg-white/90 backdrop-blur shadow-md hover:bg-white">
          <Camera className="w-4 h-4 mr-1" /> Front
        </Button>
      </div>

      <Card className="absolute bottom-4 left-4 bg-white/90 backdrop-blur shadow-md border-0 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Info className="w-3.5 h-3.5 text-[#e2231a]" />
          <span>Click products to swap • Drag to rotate • Scroll to zoom</span>
        </div>
      </Card>

      <div className="absolute top-4 left-4">
        <Badge className="bg-slate-900/80 text-white backdrop-blur text-xs">
          {boothSize} Booth
        </Badge>
      </div>
    </div>
  );
}