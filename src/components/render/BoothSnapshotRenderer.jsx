import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ═══════════════════════════════════════════════════════════════
// XHIBITLY Booth Renderer v2.0
//
// Deterministic 3D booth rendering using actual product images
// and brand identity. Zero AI hallucination. Zero API calls.
//
// Input:  sceneJson (from BoothEngine), brandIdentity, boothSize
// Output: 3/4 perspective render with real product textures,
//         brand-colored surfaces, and logo placement.
// ═══════════════════════════════════════════════════════════════

const WALL_H = 8;
const DRAPE_H = 8;
const AISLE_DEPTH = 5;
const CEILING_Y = 16;

// Product type → default 3D height
const H_MAP = {
  backwall: 8, wall: 8, display: 7, banner: 7, banner_stand: 7,
  retractable: 7, telescopic: 7, counter: 3.5, podium: 3.5,
  table: 2.5, monitor: 5, kiosk: 5, tent: 10,
  lighting: 1, flooring: 0.05, accessory: 2,
};

function guessHeight(item) {
  const s = `${(item.name || '')} ${(item.category || '')} ${(item.sku || '')}`.toLowerCase();
  for (const [k, h] of Object.entries(H_MAP)) {
    if (s.includes(k)) return h;
  }
  if (item.isFlooring) return 0.05;
  if (item.d <= 1 && item.w <= 4) return 7;
  if (item.w >= 8) return 8;
  if (item.w <= 3 && item.d <= 2) return 3.5;
  return 5;
}

// ═══════════════════════════════════════════════════════════════
// TEXTURE GENERATORS
// ═══════════════════════════════════════════════════════════════

function makeCarpetTex(color, sz = 512) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, sz, sz);
  const id = ctx.getImageData(0, 0, sz, sz);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    id.data[i]   = Math.max(0, Math.min(255, id.data[i] + n));
    id.data[i+1] = Math.max(0, Math.min(255, id.data[i+1] + n));
    id.data[i+2] = Math.max(0, Math.min(255, id.data[i+2] + n));
  }
  ctx.putImageData(id, 0, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 1;
  const ts = sz / 4;
  for (let x = ts; x < sz; x += ts) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,sz); ctx.stroke(); }
  for (let y = ts; y < sz; y += ts) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(sz,y); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeAisleTex(sz = 512) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, sz, sz);
  const id = ctx.getImageData(0, 0, sz, sz);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    id.data[i] = Math.max(0, Math.min(255, id.data[i]+n));
    id.data[i+1] = Math.max(0, Math.min(255, id.data[i+1]+n));
    id.data[i+2] = Math.max(0, Math.min(255, id.data[i+2]+n));
  }
  ctx.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeBackwallTex(brand, bW) {
  const pxFt = 128;
  const c = document.createElement('canvas');
  c.width = bW * pxFt;
  c.height = WALL_H * pxFt;
  const ctx = c.getContext('2d');
  const w = c.width, h = c.height;

  const p = brand?.primary_color || '#1a1a2e';
  const s = brand?.secondary_color || '#16213e';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p); g.addColorStop(0.75, p); g.addColorStop(1, s);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Edge accent strips
  const acc = brand?.accent_color_1 || '#ffffff';
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = acc;
  ctx.fillRect(0, 0, 6, h);
  ctx.fillRect(w - 6, 0, 6, h);
  // Bottom accent bar
  ctx.fillRect(0, h - 8, w, 8);
  ctx.globalAlpha = 1;

  // Company name text (fallback if no logo)
  const name = brand?.company_name || '';
  if (name) {
    const fs = Math.min(w * 0.075, 110);
    ctx.font = `bold ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillText(name, w/2 + 2, h * 0.45 + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, w/2, h * 0.45);
  }

  return new THREE.CanvasTexture(c);
}

function makeDrapeTex(sz = 256) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, sz, sz);
  for (let x = 0; x < sz; x += sz / 12) {
    const fw = sz / 24;
    const g = ctx.createLinearGradient(x, 0, x + fw * 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0.04)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, fw * 2, sz);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeLabelTex(name, tw = 512, th = 72) {
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  const r = 8;
  ctx.beginPath();
  ctx.roundRect(3, 3, tw - 6, th - 6, r);
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const fs = Math.min(30, (tw - 24) / Math.max(name.length * 0.5, 1));
  ctx.font = `600 ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let d = name;
  if (ctx.measureText(d).width > tw - 20) {
    while (ctx.measureText(d + '…').width > tw - 20 && d.length > 3) d = d.slice(0, -1);
    d += '…';
  }
  ctx.fillText(d, tw / 2, th / 2);
  return new THREE.CanvasTexture(c);
}

function makePlaceholderTex(name, color, tw = 512, th = 512) {
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color || '#334155';
  ctx.fillRect(0, 0, tw, th);
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < tw; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,th); ctx.stroke(); }
  for (let y = 0; y < th; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(tw,y); ctx.stroke(); }
  // Box icon
  const cx = tw / 2, cy = th * 0.38, bs = Math.min(tw, th) * 0.22;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - bs/2, cy - bs/2, bs, bs);
  ctx.beginPath();
  ctx.moveTo(cx - bs/2, cy - bs/2);
  ctx.lineTo(cx - bs*0.65, cy - bs*0.75);
  ctx.lineTo(cx + bs*0.65, cy - bs*0.75);
  ctx.lineTo(cx + bs/2, cy - bs/2);
  ctx.stroke();
  // Name
  const fs = Math.min(32, (tw - 36) / Math.max(name.length * 0.5, 1));
  ctx.font = `600 ${fs}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let d = name;
  if (ctx.measureText(d).width > tw - 36) {
    while (ctx.measureText(d + '…').width > tw - 36 && d.length > 3) d = d.slice(0, -1);
    d += '…';
  }
  ctx.fillText(d, cx, th * 0.72);
  return new THREE.CanvasTexture(c);
}

// ═══════════════════════════════════════════════════════════════
// TEXTURE LOADER
// ═══════════════════════════════════════════════════════════════

function getProxiedUrl(url) {
  if (!url) return null;
  if (url.includes('supabase.co') || url.includes('base44') || url.startsWith('data:')) return url;
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

function loadTex(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const proxied = getProxiedUrl(url);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      proxied,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => { console.warn('[BoothRenderer] Texture load failed:', proxied); resolve(null); }
    );
  });
}

function loadGLTF(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const proxied = getProxiedUrl(url);
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      proxied,
      (gltf) => { resolve(gltf.scene); },
      undefined,
      (err) => { console.warn('[BoothRenderer] GLTF load failed:', proxied, err); resolve(null); }
    );
  });
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function BoothSnapshotRenderer({
  sceneJson,
  brandIdentity,
  boothSize = '10x10',
  boothType = 'inline',
  onSnapshotReady,
  width = 1280,
  height = 720,
  autoSnapshot = true,
  interactive = false,
  onMoveItem,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!sceneJson || !containerRef.current) return;

    let sceneData;
    try {
      sceneData = typeof sceneJson === 'string' ? JSON.parse(sceneJson) : sceneJson;
    } catch {
      setErrorMsg('Invalid scene data');
      setStatus('error');
      return;
    }
    if (!sceneData.booth) {
      setErrorMsg('No booth dimensions');
      setStatus('error');
      return;
    }

    const bW = sceneData.booth.w_ft || 10;
    const bD = sceneData.booth.d_ft || 10;
    const brand = brandIdentity || {};

    // ── PROFESSIONAL SCENE (Clean studio look) ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0); // Lighter, cleaner background (like your reference)
    scene.fog = new THREE.Fog(0xf0f0f0, 50, 100); // Subtle depth fog

    // ── PROFESSIONAL CAMERA ANGLE (Like the reference image) ──
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200); // Slightly wider FOV for dramatic look

    // Professional 3/4 view - matches trade show catalog photography
    const maxDim = Math.max(bW, bD);
    const distZ = maxDim * 1.4 + AISLE_DEPTH + 6; // Closer for more dramatic perspective
    const heightY = Math.max(14, maxDim * 0.7); // Higher angle for professional overview

    if (boothType === 'island') {
        // Island booth - dramatic corner view
        camera.position.set(-maxDim * 0.9, heightY * 1.3, maxDim * 0.9 + AISLE_DEPTH);
        camera.lookAt(0, WALL_H * 0.25, 0);
    } else {
        // Inline/corner - professional front-angled view (like your reference image)
        camera.position.set(-bW * 0.4, heightY, distZ); // More side angle for depth
        camera.lookAt(0, WALL_H * 0.35, -bD * 0.15);
    }

    // ── INTERACTION STATE ──
    const interactableObjects = [];

    // ── PROFESSIONAL RENDERER (Catalog-quality output) ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false, // Solid background for clean look
      powerPreference: 'high-performance' // Use GPU for smooth interactions
    });
    
    const initW = containerRef.current?.clientWidth || width;
    const initH = containerRef.current?.clientHeight || height;
    renderer.setSize(initW, initH);
    camera.aspect = initW / initH;
    camera.updateProjectionMatrix();
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows like your reference
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic color grading
    renderer.toneMappingExposure = 1.1; // Slightly brighter for trade show appeal
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    while (containerRef.current.firstChild) containerRef.current.removeChild(containerRef.current.firstChild);
    containerRef.current.appendChild(renderer.domElement);

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w && h && rendererRef.current) {
          rendererRef.current.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // ── ENHANCED PBR LIGHTING ──
    // Trade show lighting: bright, professional, makes products pop
    scene.add(new THREE.AmbientLight(0xffffff, 0.5)); // Slightly brighter ambient
    scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 0.4)); // Sky/ground lighting

    // Main Key Light - simulates overhead trade show lights
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2); // Brighter for product visibility
    mainLight.position.set(bW * 0.3, CEILING_Y, bD * 0.2);
    mainLight.target.position.set(0, 0, -bD * 0.2);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -bW;
    mainLight.shadow.camera.right = bW;
    mainLight.shadow.camera.top = bD * 2;
    mainLight.shadow.camera.bottom = -bD;
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);
    scene.add(mainLight.target);

    // Fill Light - warm, softer, fills shadows
    const fill = new THREE.DirectionalLight(0xfff5e6, 0.45); // Warmer and slightly brighter
    fill.position.set(bW * 0.5, 10, bD * 0.8);
    scene.add(fill);

    // Rim/Back Light - cooler, adds depth and separation
    const rim = new THREE.DirectionalLight(0xe6f2ff, 0.35); // Cooler blue rim
    rim.position.set(-bW * 0.3, 12, -bD * 1.2);
    scene.add(rim);

    // Front spotlight - highlights products from visitor view
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.4);
    frontLight.position.set(0, 8, bD * 1.5); // From front/aisle
    scene.add(frontLight);

    // ══════════════════════════════════════════════════════════
    // BOOTH STRUCTURE
    // ══════════════════════════════════════════════════════════

    const isIsland = boothType === 'island';
    const isPeninsula = boothType === 'peninsula';
    const isCorner = boothType === 'corner';
    const isInline = boothType === 'inline';

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
    const pr = 0.04;

    const makeUpright = (x, z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, DRAPE_H, 8), pipeMat.clone());
      pole.position.set(x, DRAPE_H / 2, z);
      return pole;
    };

    // Infinite ground plane
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 1, metalness: 0 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Booth carpet
    const carpetTex = makeCarpetTex(brand.primary_color || '#1a1a2e');
    carpetTex.repeat.set(bW / 4, bD / 4);
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bW, bD),
      new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Aisle
    const aisleTex = makeAisleTex();
    aisleTex.repeat.set((bW + 10) / 4, (AISLE_DEPTH + 4) / 4);
    const aisleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bW + 10, AISLE_DEPTH + 4),
      new THREE.MeshStandardMaterial({ map: aisleTex, roughness: 0.9 })
    );
    aisleMesh.rotation.x = -Math.PI / 2;
    aisleMesh.position.set(0, -0.005, bD / 2 + AISLE_DEPTH / 2 + 0.5);
    aisleMesh.receiveShadow = true;
    scene.add(aisleMesh);

    // Back wall
    if (!isIsland) {
      const bwTex = makeBackwallTex(brand, bW);
      const bwMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(bW, WALL_H),
        new THREE.MeshStandardMaterial({ map: bwTex, roughness: 0.4 })
      );
      bwMesh.position.set(0, WALL_H / 2, -bD / 2);
      bwMesh.receiveShadow = true;
      scene.add(bwMesh);

      // Back rail
      const backRail = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, bW, 8), pipeMat);
      backRail.rotation.z = Math.PI / 2;
      backRail.position.set(0, DRAPE_H, -bD / 2);
      scene.add(backRail);

      scene.add(makeUpright(-bW/2, -bD/2));
      scene.add(makeUpright(bW/2, -bD/2));
    }

    // Pipe & drape sides
    const dTex = makeDrapeTex();
    dTex.repeat.set(1, 2);
    const makeDrape = (xPos, side) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(bD, DRAPE_H),
        new THREE.MeshStandardMaterial({ map: dTex.clone(), roughness: 0.9, side: THREE.DoubleSide })
      );
      m.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
      m.position.set(xPos, DRAPE_H / 2, 0);
      m.receiveShadow = true;
      return m;
    };

    if (isInline) {
      scene.add(makeDrape(-bW / 2, 'left'));
      scene.add(makeDrape(bW / 2, 'right'));

      const leftRail = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, bD, 8), pipeMat.clone());
      leftRail.rotation.x = Math.PI / 2;
      leftRail.position.set(-bW / 2, DRAPE_H, 0);
      scene.add(leftRail);

      const rightRail = leftRail.clone();
      rightRail.position.set(bW / 2, DRAPE_H, 0);
      scene.add(rightRail);

      scene.add(makeUpright(-bW/2, bD/2));
      scene.add(makeUpright(bW/2, bD/2));
    } else if (isCorner) {
      scene.add(makeDrape(bW / 2, 'right'));
      const rightRail = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, bD, 8), pipeMat.clone());
      rightRail.rotation.x = Math.PI / 2;
      rightRail.position.set(bW / 2, DRAPE_H, 0);
      scene.add(rightRail);
      scene.add(makeUpright(bW/2, bD/2));
    }

    // ══════════════════════════════════════════════════════════
    // LOGO ON BACK WALL
    // ══════════════════════════════════════════════════════════

    const logoPromise = (async () => {
      if (isIsland) return;
      const logoUrl = brand.logo_cached_url || brand.logo_url;
      if (!logoUrl) return;
      const tex = await loadTex(logoUrl);
      if (!tex) return;

      const aspect = tex.image.width / tex.image.height;
      const maxW = bW * 0.45;
      const maxH = WALL_H * 0.22;
      let lW = maxW, lH = lW / aspect;
      if (lH > maxH) { lH = maxH; lW = lH * aspect; }

      const logo = new THREE.Mesh(
        new THREE.PlaneGeometry(lW, lH),
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.3 })
      );
      logo.position.set(0, WALL_H * 0.68, -bD / 2 + 0.02);
      scene.add(logo);
    })();

    // ══════════════════════════════════════════════════════════
    // PLACE PRODUCTS
    // ══════════════════════════════════════════════════════════

    const items = sceneData.items || [];

    const productPromises = items.filter(i => !i.isFlooring).map(async (item) => {
      const itemH = guessHeight(item);
      const iW = item.w || 3;
      const iD = item.d || 1;

      // 2D scene → 3D world coord transform
      // 2D: (0,0) = front-left, x→right, y→back
      // 3D: (0,0,0) = center, x→right, +z→front, -z→back
      const wx = item.x - bW / 2;
      const wz = -(item.y - bD / 2);

      const isRot = item.rot === 90 || item.rot === 270;
      const dispW = isRot ? iD : iW;
      const dispD = isRot ? iW : iD;

      let productTex = null;
      let modelMesh = null;
      
      if (item.modelUrl) {
        modelMesh = await loadGLTF(item.modelUrl);
      }
      if (!modelMesh && item.imageUrl) {
        productTex = await loadTex(item.imageUrl);
      }

      if (modelMesh) {
        // ── 3D Model (GLB/GLTF) ── ENHANCED FOR PBR MATERIALS
        const box = new THREE.Box3().setFromObject(modelMesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Reset position to center
        modelMesh.position.x -= center.x;
        modelMesh.position.y -= center.y;
        modelMesh.position.z -= center.z;

        // Scale and position based on product dimensions
        const targetW = dispW || 2;
        const scale = targetW / (size.x || 1);
        modelMesh.scale.set(scale, scale, scale);

        // Enhanced material handling for PBR models
        modelMesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Enhance PBR materials for better appearance
            if (child.material) {
              const mat = child.material;
              if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                // Ensure materials respond correctly to lighting
                mat.needsUpdate = true;
                // If too dark, slightly increase roughness
                if (mat.roughness < 0.3) mat.roughness = 0.4;
                // Slightly boost metalness for trade show appeal
                if (mat.metalness && mat.metalness > 0.1) mat.metalness = Math.min(1, mat.metalness * 1.2);
              }
            }
          }
        });

        const group = new THREE.Group();
        group.userData = { id: item.id, hasGLB: true }; // Mark as GLB for special handling
        group.add(modelMesh);

        // Position group - bottom of model sits on floor
        // Since we centered the mesh, its bottom is at -(size.y * scale) / 2
        group.position.set(wx, (size.y * scale) / 2, wz);
        if (item.rot) group.rotation.y = -THREE.MathUtils.degToRad(item.rot);

        scene.add(group);
        interactableObjects.push(group);

        // Add selection indicator (hidden by default)
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        // Professional label for 3D models
        const lTex = makeLabelTex(item.name || item.sku);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
        const ls = Math.min(dispW * 1.1, 4.5);
        label.scale.set(ls, ls * 0.11, 1);
        label.position.set(wx, (size.y * scale) + 0.35, wz);
        scene.add(label);
      } else if (productTex) {
        // ── PROFESSIONAL 3D Display from Product Image ──
        const aspect = productTex.image.width / productTex.image.height;
        let pW = dispW, pH = itemH;
        const ta = pW / pH;
        if (aspect > ta) { pH = pW / aspect; }
        else { pW = pH * aspect; }

        // Give it realistic depth based on catalog dimensions
        const boxDepth = Math.max(0.5, dispD);

        // BRANDED SIDE MATERIALS - Use brand colors for professional look
        const brandColor = brand.primary_color || brand.secondary_color || '#334155';
        const sideMat = new THREE.MeshStandardMaterial({
          color: brandColor,
          roughness: 0.7,
          metalness: 0.1 // Slight sheen for trade show appeal
        });

        // FRONT MATERIAL - High-quality product image display
        const frontMat = new THREE.MeshStandardMaterial({
          map: productTex,
          transparent: true,
          roughness: 0.4, // Slight gloss for professional finish
          metalness: 0,
          alphaTest: 0.1, // Clean PNG transparency
          emissive: 0xffffff,
          emissiveIntensity: 0.05, // Subtle glow so image pops
          emissiveMap: productTex // Apply glow to image areas only
        });

        const box = new THREE.Mesh(
          new THREE.BoxGeometry(pW, pH, boxDepth),
          [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]
        );
        box.castShadow = true;
        box.receiveShadow = true;

        const group = new THREE.Group();
        group.userData = { id: item.id, hasImage: true };
        group.add(box);

        // Position group so it sits on the floor
        group.position.set(wx, pH / 2, wz);
        if (item.rot) group.rotation.y = -THREE.MathUtils.degToRad(item.rot);

        // Selection indicator
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        scene.add(group);
        interactableObjects.push(group);

        // Professional label
        const lTex = makeLabelTex(item.name || item.sku);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
        const ls = Math.min(pW * 1.1, 4.5);
        label.scale.set(ls, ls * 0.11, 1);
        label.position.set(wx, pH + 0.35, wz);
        scene.add(label);
      } else {
        // ── PROFESSIONAL BRANDED PLACEHOLDER ──
        const boxDepth = Math.max(0.5, dispD);
        const placeholderTex = makePlaceholderTex(item.name || item.sku, brand.primary_color || '#334155');

        // Create professional looking placeholder with brand colors
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(dispW, itemH, boxDepth),
          new THREE.MeshStandardMaterial({
            map: placeholderTex,
            roughness: 0.65,
            metalness: 0.05,
            emissive: brand.primary_color ? new THREE.Color(brand.primary_color) : 0x000000,
            emissiveIntensity: 0.03 // Very subtle glow for brand color
          })
        );

        const group = new THREE.Group();
        group.userData = { id: item.id, isPlaceholder: true };
        group.add(box);
        group.position.set(wx, itemH / 2, wz);
        if (item.rot) group.rotation.y = -THREE.MathUtils.degToRad(item.rot);

        // Selection indicator
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        box.castShadow = true;
        box.receiveShadow = true;

        scene.add(group);
        interactableObjects.push(group);

        // Professional label
        const lTex = makeLabelTex(item.name || item.sku);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
        const ls = Math.min(dispW * 1.1, 4.5);
        label.scale.set(ls, ls * 0.11, 1);
        label.position.set(wx, itemH + 0.35, wz);
        scene.add(label);
      }
    });

    // Flooring items
    const flooringPromises = items.filter(i => i.isFlooring).map(async (item) => {
      if (!item.imageUrl) return;
      const tex = await loadTex(item.imageUrl);
      if (!tex) return;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(bW / 4, bD / 4);
      const overlay = new THREE.Mesh(
        new THREE.PlaneGeometry(bW - 0.1, bD - 0.1),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, transparent: true, opacity: 0.85 })
      );
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.y = 0.01;
      overlay.receiveShadow = true;
      scene.add(overlay);
    });

    // ══════════════════════════════════════════════════════════
    // RENDER + SNAPSHOT
    // ══════════════════════════════════════════════════════════

    // Initial render (shows booth structure immediately)
    renderer.render(scene, camera);

    // Wait for all async textures, then final render + snapshot
    Promise.all([logoPromise, ...productPromises, ...flooringPromises])
      .then(() => {
        renderer.render(scene, camera);
        setStatus('ready');
        if (autoSnapshot && onSnapshotReady) {
          setTimeout(() => {
            renderer.render(scene, camera);
            onSnapshotReady(renderer.domElement.toDataURL('image/png'));
          }, 200);
        }
      })
      .catch((err) => {
        console.error('[BoothRenderer] Asset load error:', err);
        renderer.render(scene, camera);
        setStatus('ready');
        if (autoSnapshot && onSnapshotReady) {
          setTimeout(() => {
            onSnapshotReady(renderer.domElement.toDataURL('image/png'));
          }, 200);
        }
      });

    // ── Optional interactive orbit & drag ──
    if (interactive) {
      let isOrbiting = false;
      let draggedObject = null;
      let dragOffset = new THREE.Vector3();
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      let prev = { x: 0, y: 0 };
      let theta = Math.atan2(camera.position.x, camera.position.z);
      let phi = Math.acos(camera.position.y / camera.position.length());
      const rad = camera.position.length();

      const el = renderer.domElement;

      const getMousePos = (e) => {
        const rect = el.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1
        };
      };

      const onDown = (e) => { 
        const m = getMousePos(e);
        mouse.x = m.x;
        mouse.y = m.y;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, true);
        
        if (intersects.length > 0) {
          let obj = intersects[0].object;
          while (obj && !obj.userData.id && obj.parent) {
            obj = obj.parent;
          }
          if (obj && obj.userData.id) {
            draggedObject = obj;
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(dragPlane, intersectPoint);
            if (intersectPoint) {
                dragOffset.copy(intersectPoint).sub(obj.position);
            } else {
                dragOffset.set(0, 0, 0);
            }
            el.style.cursor = 'grabbing';
            return;
          }
        }

        isOrbiting = true; 
        prev = { x: e.clientX, y: e.clientY }; 
        el.style.cursor = 'grabbing';
      };

      const onMove = (e) => {
        if (draggedObject) {
          const m = getMousePos(e);
          mouse.x = m.x;
          mouse.y = m.y;
          raycaster.setFromCamera(mouse, camera);
          const intersectPoint = new THREE.Vector3();
          raycaster.ray.intersectPlane(dragPlane, intersectPoint);

          if (intersectPoint) {
            const newPos = intersectPoint.sub(dragOffset);
            draggedObject.position.x = newPos.x;
            draggedObject.position.z = newPos.z;

            // Show selection box while dragging for visual feedback
            draggedObject.children.forEach(child => {
                if (child.type === 'LineSegments') {
                    child.visible = true;
                    child.material.color.setHex(0x22c55e); // Green while dragging
                }
            });

            renderer.render(scene, camera);
          }
          return;
        }

        if (!isOrbiting) {
          // PROFESSIONAL HOVER EFFECT (Like your reference image)
          const m = getMousePos(e);
          mouse.x = m.x;
          mouse.y = m.y;
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(interactableObjects, true);

          // Hide all box helpers first
          interactableObjects.forEach(obj => {
              obj.children.forEach(child => {
                  if (child.type === 'LineSegments') {
                      child.visible = false;
                      child.material.color.setHex(0x3b82f6); // Reset to blue
                  }
              });
          });

          if (intersects.length > 0) {
            el.style.cursor = 'grab';
            // Show box helper for hovered object with professional highlight
            let obj = intersects[0].object;
            while (obj && !obj.userData.id && obj.parent) {
                obj = obj.parent;
            }
            if (obj && obj.userData.id) {
                obj.children.forEach(child => {
                    if (child.type === 'LineSegments') {
                        child.visible = true;
                        child.material.color.setHex(0x3b82f6); // Blue highlight
                    }
                });
                renderer.render(scene, camera);
            }
          } else {
            el.style.cursor = 'default';
            renderer.render(scene, camera);
          }
          return;
        }

        // SMOOTH ORBIT CONTROLS
        theta -= (e.clientX - prev.x) * 0.005;
        phi = Math.max(0.3, Math.min(Math.PI * 0.45, phi + (e.clientY - prev.y) * 0.005));
        camera.position.set(
          rad * Math.sin(phi) * Math.sin(theta),
          rad * Math.cos(phi),
          rad * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(0, WALL_H * 0.28, -bD * 0.12);
        renderer.render(scene, camera);
        prev = { x: e.clientX, y: e.clientY };
      };

      const onUp = () => {
        if (draggedObject) {
          // Hide selection box after drag completes
          draggedObject.children.forEach(child => {
              if (child.type === 'LineSegments') {
                  child.visible = false;
                  child.material.color.setHex(0x3b82f6); // Reset to blue
              }
          });

          if (onMoveItem) {
            const newX = draggedObject.position.x + bW / 2;
            const newY = -draggedObject.position.z + bD / 2;
            onMoveItem(draggedObject.userData.id, newX, newY);
          }

          renderer.render(scene, camera);
        }
        draggedObject = null;
        isOrbiting = false;
        el.style.cursor = 'default';
      };

      el.addEventListener('mousedown', onDown);
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseup', onUp);
      el.addEventListener('mouseleave', onUp);

      const animate = () => { frameRef.current = requestAnimationFrame(animate); renderer.render(scene, camera); };
      animate();
    }

    // ── Cleanup ──
    return () => {
      resizeObserver.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
  }, [sceneJson, brandIdentity, boothSize, width, height, interactive, autoSnapshot]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
      {status === 'error' ? (
        <div className="text-red-500 dark:text-red-400 p-6 text-center text-sm">
          <p className="font-semibold mb-1">Render Error</p>
          <p className="text-slate-500">{errorMsg}</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full h-full [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:block" />
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-[3px] border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Building booth…</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}