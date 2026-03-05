import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

// Contact shadow — soft circular shadow blob under products
function makeContactShadowTex(sz = 128) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  const cx = sz / 2, cy = sz / 2, r = sz * 0.45;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(0.4, 'rgba(0,0,0,0.2)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Measurement grid overlay for the booth floor
function makeGridTex(widthFt, depthFt, pxPerFt = 64) {
  const w = widthFt * pxPerFt;
  const h = depthFt * pxPerFt;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // 1-foot grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= widthFt; x++) {
    const px = x * pxPerFt;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  for (let y = 0; y <= depthFt; y++) {
    const py = y * pxPerFt;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }

  // 5-foot grid lines (bolder)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= widthFt; x += 5) {
    const px = x * pxPerFt;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  for (let y = 0; y <= depthFt; y += 5) {
    const py = y * pxPerFt;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }

  // Dimension labels along bottom and left edges
  ctx.font = `bold ${Math.max(10, pxPerFt * 0.2)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Bottom edge (width)
  for (let x = 0; x <= widthFt; x += 5) {
    if (x > 0) ctx.fillText(`${x}'`, x * pxPerFt, h - pxPerFt * 0.35);
  }
  // Left edge (depth)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let y = 0; y <= depthFt; y += 5) {
    if (y > 0) ctx.fillText(`${y}'`, pxPerFt * 0.1, h - y * pxPerFt);
  }

  const t = new THREE.CanvasTexture(c);
  return t;
}

// Helper: add contact shadow under a product group
function addContactShadow(scene, shadowTex, x, z, radiusW, radiusD) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(radiusW * 1.4, radiusD * 1.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.7,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, 0.008, z);
  shadow.renderOrder = -1;
  scene.add(shadow);
  return shadow;
}

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
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const sceneRef = useRef(null);
  const boothDimsRef = useRef({ w: 10, d: 10 });
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState(null);
  const [cameraMode, setCameraMode] = useState('catalog'); // catalog, front, top, walkthrough

  // ── Camera Preset Definitions ──
  const applyCameraPreset = useCallback((preset) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const { w: bW, d: bD } = boothDimsRef.current;
    const maxDim = Math.max(bW, bD);

    setCameraMode(preset);

    switch (preset) {
      case 'catalog': {
        // Classic 3/4 trade show catalog angle
        cam.position.set(-bW * 0.35, maxDim * 0.65 + 4, maxDim * 1.1 + 7);
        ctrl.target.set(0, WALL_H * 0.25, -bD * 0.1);
        cam.fov = 45;
        break;
      }
      case 'front': {
        // Straight-on front view (what an attendee sees walking up)
        cam.position.set(0, WALL_H * 0.5, bD / 2 + maxDim * 0.9 + 5);
        ctrl.target.set(0, WALL_H * 0.35, 0);
        cam.fov = 45;
        break;
      }
      case 'top': {
        // Top-down plan view
        cam.position.set(0, maxDim * 2.2 + 8, 0.01);
        ctrl.target.set(0, 0, 0);
        cam.fov = 50;
        break;
      }
      case 'walkthrough': {
        // Eye-level inside the booth (5'6" = ~1.67m ≈ 5.5ft)
        cam.position.set(0, 5.5, bD * 0.3);
        ctrl.target.set(0, 5.5, -bD * 0.4);
        cam.fov = 65; // Wider FOV for immersive feel
        break;
      }
      default: break;
    }
    cam.updateProjectionMatrix();
    ctrl.update();
  }, []);

  // ── Screenshot Export ──
  const captureScreenshot = useCallback((scale = 2) => {
    const ren = rendererRef.current;
    const cam = cameraRef.current;
    const sc = sceneRef.current;
    if (!ren || !cam || !sc) return null;

    // Save current size
    const origW = ren.domElement.width;
    const origH = ren.domElement.height;
    const origPixelRatio = ren.getPixelRatio();

    // Render at high res
    const exportW = origW * scale;
    const exportH = origH * scale;
    ren.setSize(exportW, exportH, false);
    ren.setPixelRatio(1);
    cam.aspect = exportW / exportH;
    cam.updateProjectionMatrix();
    ren.render(sc, cam);

    const dataUrl = ren.domElement.toDataURL('image/png');

    // Restore original size
    ren.setSize(origW, origH, false);
    ren.setPixelRatio(origPixelRatio);
    cam.aspect = origW / origH;
    cam.updateProjectionMatrix();
    ren.render(sc, cam);

    return dataUrl;
  }, []);

  const downloadScreenshot = useCallback(() => {
    const dataUrl = captureScreenshot(2);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `booth-render-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [captureScreenshot]);

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
    sceneRef.current = scene;
    boothDimsRef.current = { w: bW, d: bD };
    scene.background = new THREE.Color(0xf0f0f0); // Lighter, cleaner background (like your reference)
    scene.fog = new THREE.Fog(0xf0f0f0, 80, 250); // Subtle depth fog

    // ── CAMERA — Adaptive for booth size & type ──
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500);

    const maxDim = Math.max(bW, bD);
    // Distance scales with booth size — bigger booths need to be further away
    const baseDist = maxDim * 1.3 + 8;

    if (isIsland) {
      // Island: elevated corner view showing all 4 open sides
      camera.position.set(-maxDim * 0.7, maxDim * 0.9, maxDim * 0.7 + AISLE_DEPTH);
      camera.lookAt(0, WALL_H * 0.2, 0);
    } else if (isCorner) {
      // Corner: angled to show the open front and open left side
      camera.position.set(-bW * 0.6, maxDim * 0.65, baseDist * 0.7);
      camera.lookAt(0, WALL_H * 0.3, -bD * 0.1);
    } else if (isPeninsula) {
      // Peninsula: front-angled to show open sides
      camera.position.set(-bW * 0.5, maxDim * 0.7, baseDist * 0.75);
      camera.lookAt(0, WALL_H * 0.25, 0);
    } else {
      // Inline: classic trade show catalog 3/4 view from front
      camera.position.set(-bW * 0.35, maxDim * 0.65 + 4, baseDist * 0.85);
      camera.lookAt(0, WALL_H * 0.3, -bD * 0.1);
    }

    cameraRef.current = camera;

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
    // ENVIRONMENT MAP (makes PBR/metallic materials look real)
    // ══════════════════════════════════════════════════════════

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Generate a simple studio-style environment from a gradient
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(20, 32, 16);
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512; envCanvas.height = 256;
    const envCtx = envCanvas.getContext('2d');
    const envGrad = envCtx.createLinearGradient(0, 0, 0, 256);
    envGrad.addColorStop(0, '#ffffff');
    envGrad.addColorStop(0.3, '#e8ecf0');
    envGrad.addColorStop(0.6, '#c0c8d0');
    envGrad.addColorStop(1, '#a0a8b0');
    envCtx.fillStyle = envGrad;
    envCtx.fillRect(0, 0, 512, 256);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const envMat = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();
    envScene.clear();

    // ══════════════════════════════════════════════════════════
    // BOOTH STRUCTURE — Inline / Corner / Peninsula / Island
    //
    // Trade show convention:
    //   Inline:    Back wall + both side drapes (open front only)
    //   Corner:    Back wall + one side drape (open front + one side)
    //   Peninsula: Back wall only (open front + both sides)
    //   Island:    No walls (open all 4 sides)
    //
    // Coordinate system:
    //   Center of booth = (0, 0, 0)
    //   Front/aisle = +Z,  Back = -Z
    //   Left = -X,  Right = +X
    // ══════════════════════════════════════════════════════════

    const isIsland = boothType === 'island';
    const isPeninsula = boothType === 'peninsula';
    const isCorner = boothType === 'corner';
    const isInline = !isIsland && !isPeninsula && !isCorner;

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
    const pr = 0.05; // pipe radius

    const makeUpright = (x, z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, DRAPE_H, 8), pipeMat.clone());
      pole.position.set(x, DRAPE_H / 2, z);
      pole.castShadow = true;
      return pole;
    };

    const makeRail = (x1, z1, x2, z2, y) => {
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(pr * 0.8, pr * 0.8, len, 8), pipeMat.clone());
      rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      rail.rotation.z = Math.PI / 2;
      // Align along the direction
      if (Math.abs(dz) > Math.abs(dx)) {
        rail.rotation.z = 0;
        rail.rotation.x = Math.PI / 2;
      }
      rail.castShadow = true;
      return rail;
    };

    // ── Ground Plane (convention hall floor) ──
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xd5d5d5, roughness: 1, metalness: 0 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // ── Booth Carpet ──
    const carpetTex = makeCarpetTex(brand.primary_color || '#1a1a2e');
    carpetTex.repeat.set(bW / 4, bD / 4);
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bW, bD),
      new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.001;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // ── Measurement Grid Overlay ──
    const gridTex = makeGridTex(bW, bD);
    const gridMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bW, bD),
      new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, depthWrite: false })
    );
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = 0.003;
    scene.add(gridMesh);

    // Dimension labels at booth edges (3D text sprites)
    const makeDimLabel = (text, x, y, z) => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 48;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 128, 48);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(4, 4, 120, 40, 6); ctx.fill();
      ctx.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 24);
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7 }));
      sprite.scale.set(2, 0.75, 1);
      sprite.position.set(x, y, z);
      scene.add(sprite);
    };
    // Width label (front edge, centered)
    makeDimLabel(`${bW}' wide`, 0, 0.3, bD / 2 + 0.8);
    // Depth label (left edge, centered)  
    makeDimLabel(`${bD}' deep`, -bW / 2 - 1.2, 0.3, 0);

    // ── Contact shadow texture (shared) ──
    const contactShadowTex = makeContactShadowTex();

    // ── Booth boundary lines (subtle floor tape) ──
    const tapeColor = 0x666666;
    const tapeMat = new THREE.MeshBasicMaterial({ color: tapeColor, transparent: true, opacity: 0.4 });
    const tapeW = 0.06;
    // Front edge
    const frontTape = new THREE.Mesh(new THREE.PlaneGeometry(bW, tapeW), tapeMat);
    frontTape.rotation.x = -Math.PI / 2;
    frontTape.position.set(0, 0.005, bD / 2);
    scene.add(frontTape);
    // Back edge
    const backTape = new THREE.Mesh(new THREE.PlaneGeometry(bW, tapeW), tapeMat.clone());
    backTape.rotation.x = -Math.PI / 2;
    backTape.position.set(0, 0.005, -bD / 2);
    scene.add(backTape);
    // Left edge
    const leftTape = new THREE.Mesh(new THREE.PlaneGeometry(tapeW, bD), tapeMat.clone());
    leftTape.rotation.x = -Math.PI / 2;
    leftTape.position.set(-bW / 2, 0.005, 0);
    scene.add(leftTape);
    // Right edge
    const rightTape = new THREE.Mesh(new THREE.PlaneGeometry(tapeW, bD), tapeMat.clone());
    rightTape.rotation.x = -Math.PI / 2;
    rightTape.position.set(bW / 2, 0.005, 0);
    scene.add(rightTape);

    // ── Aisle floor (in front of booth) ──
    const aisleW = bW + 16;
    const aisleD = AISLE_DEPTH + 2;
    const aisleTex = makeAisleTex();
    aisleTex.repeat.set(aisleW / 4, aisleD / 4);
    const aisleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(aisleW, aisleD),
      new THREE.MeshStandardMaterial({ map: aisleTex, roughness: 0.9 })
    );
    aisleMesh.rotation.x = -Math.PI / 2;
    aisleMesh.position.set(0, -0.01, bD / 2 + aisleD / 2 + 0.3);
    aisleMesh.receiveShadow = true;
    scene.add(aisleMesh);

    // For island/peninsula, also place aisle behind
    if (isIsland || isPeninsula) {
      const backAisle = aisleMesh.clone();
      backAisle.position.set(0, -0.01, -(bD / 2 + aisleD / 2 + 0.3));
      scene.add(backAisle);
    }
    // For island/corner, also place aisle on open sides
    if (isIsland) {
      const leftAisle = new THREE.Mesh(
        new THREE.PlaneGeometry(AISLE_DEPTH + 2, bD + aisleD * 2 + 1),
        new THREE.MeshStandardMaterial({ map: aisleTex.clone(), roughness: 0.9 })
      );
      leftAisle.rotation.x = -Math.PI / 2;
      leftAisle.position.set(-bW / 2 - AISLE_DEPTH / 2 - 1.3, -0.01, 0);
      scene.add(leftAisle);
      const rightAisle = leftAisle.clone();
      rightAisle.position.set(bW / 2 + AISLE_DEPTH / 2 + 1.3, -0.01, 0);
      scene.add(rightAisle);
    }

    // ── Drape texture (shared) ──
    const dTex = makeDrapeTex();
    dTex.repeat.set(1, 2);

    const makeDrape = (length, posX, posZ, rotY) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(length, DRAPE_H),
        new THREE.MeshStandardMaterial({ map: dTex.clone(), roughness: 0.9, side: THREE.DoubleSide })
      );
      m.rotation.y = rotY;
      m.position.set(posX, DRAPE_H / 2, posZ);
      m.receiveShadow = true;
      m.castShadow = true;
      return m;
    };

    // ── BACK WALL (everyone except island) ──
    if (!isIsland) {
      const bwTex = makeBackwallTex(brand, bW);
      const bwMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(bW, WALL_H),
        new THREE.MeshStandardMaterial({ map: bwTex, roughness: 0.4, side: THREE.DoubleSide })
      );
      bwMesh.position.set(0, WALL_H / 2, -bD / 2);
      bwMesh.receiveShadow = true;
      bwMesh.castShadow = true;
      scene.add(bwMesh);

      // Back rail + uprights
      scene.add(makeRail(-bW / 2, -bD / 2, bW / 2, -bD / 2, DRAPE_H));
      scene.add(makeUpright(-bW / 2, -bD / 2));
      scene.add(makeUpright(bW / 2, -bD / 2));
    }

    // ── SIDE WALLS (depends on booth type) ──
    // Inline: both sides closed
    if (isInline) {
      // Left drape
      scene.add(makeDrape(bD, -bW / 2, 0, Math.PI / 2));
      scene.add(makeRail(-bW / 2, -bD / 2, -bW / 2, bD / 2, DRAPE_H));
      scene.add(makeUpright(-bW / 2, bD / 2));

      // Right drape
      scene.add(makeDrape(bD, bW / 2, 0, -Math.PI / 2));
      scene.add(makeRail(bW / 2, -bD / 2, bW / 2, bD / 2, DRAPE_H));
      scene.add(makeUpright(bW / 2, bD / 2));
    }

    // Corner: one side closed (right side), left open
    if (isCorner) {
      scene.add(makeDrape(bD, bW / 2, 0, -Math.PI / 2));
      scene.add(makeRail(bW / 2, -bD / 2, bW / 2, bD / 2, DRAPE_H));
      scene.add(makeUpright(bW / 2, bD / 2));
    }

    // Peninsula: both sides open, only back wall (already added above)
    // Island: nothing (already handled — no back wall either)

    // ── Neighbor booth hints (for inline, show adjacent booth drapes) ──
    if (isInline) {
      const neighborMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.8, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      // Left neighbor
      const leftNeighborWall = new THREE.Mesh(new THREE.PlaneGeometry(8, DRAPE_H * 0.9), neighborMat);
      leftNeighborWall.position.set(-bW / 2 - 4, DRAPE_H * 0.45, 0);
      leftNeighborWall.rotation.y = Math.PI / 2;
      scene.add(leftNeighborWall);
      // Right neighbor
      const rightNeighborWall = new THREE.Mesh(new THREE.PlaneGeometry(8, DRAPE_H * 0.9), neighborMat.clone());
      rightNeighborWall.position.set(bW / 2 + 4, DRAPE_H * 0.45, 0);
      rightNeighborWall.rotation.y = -Math.PI / 2;
      scene.add(rightNeighborWall);
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
      let logoTex = null;
      
      if (item.modelUrl) {
        modelMesh = await loadGLTF(item.modelUrl);
        // Pre-load logo for GLB branding
        const logoUrl = brand.logo_cached_url || brand.logo_url;
        if (logoUrl && modelMesh) {
          logoTex = await loadTex(logoUrl);
        }
      }
      if (!modelMesh && item.imageUrl) {
        productTex = await loadTex(item.imageUrl);
      }

      if (modelMesh) {
        // ══════════════════════════════════════════════════════════
        // 3D MODEL BRANDING PIPELINE
        // 
        // 1. Scale & position (fix CAD origin offsets)
        // 2. Classify meshes (structural vs brandable)
        // 3. Apply brand colors to brandable surfaces
        // 4. Place logo on the largest front-facing panel
        // 5. Professional material tuning
        // ══════════════════════════════════════════════════════════

        // ── Step 1: Scale & Position ──
        const origBox = new THREE.Box3().setFromObject(modelMesh);
        const origSize = origBox.getSize(new THREE.Vector3());

        const targetW = dispW || 2;
        const scaleFactor = targetW / (origSize.x || 1);
        modelMesh.scale.setScalar(scaleFactor);

        const scaledBox = new THREE.Box3().setFromObject(modelMesh);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        const scaledSize = scaledBox.getSize(new THREE.Vector3());

        modelMesh.position.x = -scaledCenter.x;
        modelMesh.position.y = -scaledBox.min.y;
        modelMesh.position.z = -scaledCenter.z;

        // ── Step 2: Classify & Brand Meshes ──
        const brandPrimary = new THREE.Color(brand.primary_color || '#1a1a2e');
        const brandSecondary = new THREE.Color(brand.secondary_color || '#16213e');
        const brandAccent = new THREE.Color(brand.accent_color_1 || '#ffffff');

        // Collect meshes with their surface areas for logo placement
        const meshCandidates = [];

        modelMesh.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;

          const geo = child.geometry;
          const matName = (child.material?.name || '').toLowerCase();
          const meshName = (child.name || '').toLowerCase();

          // Classify: is this structural hardware or a brandable panel?
          const isHardware = 
            matName.includes('metal') || matName.includes('steel') || matName.includes('aluminum') ||
            matName.includes('chrome') || matName.includes('iron') ||
            meshName.includes('pole') || meshName.includes('frame') || meshName.includes('leg') ||
            meshName.includes('bolt') || meshName.includes('hinge') || meshName.includes('clamp') ||
            meshName.includes('base_plate') || meshName.includes('foot');

          const isGlass =
            matName.includes('glass') || matName.includes('acrylic') || matName.includes('clear') ||
            (child.material?.opacity != null && child.material.opacity < 0.8);

          // Compute approximate surface area from bounding box
          const meshBox = new THREE.Box3().setFromObject(child);
          const meshSize = meshBox.getSize(new THREE.Vector3());
          const surfaceArea = 2 * (meshSize.x * meshSize.y + meshSize.y * meshSize.z + meshSize.x * meshSize.z);

          // Compute dominant face normal (which direction does the biggest face point?)
          let dominantNormal = new THREE.Vector3(0, 0, 1); // default: forward
          if (geo.attributes.normal && geo.attributes.position) {
            const normals = geo.attributes.normal;
            const avgNormal = new THREE.Vector3();
            for (let i = 0; i < normals.count; i++) {
              avgNormal.x += Math.abs(normals.getX(i));
              avgNormal.y += Math.abs(normals.getY(i));
              avgNormal.z += Math.abs(normals.getZ(i));
            }
            avgNormal.normalize();
            dominantNormal = avgNormal;
          }

          // Is this a large, flat panel facing forward or up? → logo candidate
          const isFlatPanel = (
            surfaceArea > 0.1 &&
            !isHardware && !isGlass &&
            (dominantNormal.z > 0.4 || dominantNormal.y > 0.6 || // faces forward or up
             (meshSize.x > meshSize.z * 2 && meshSize.y > meshSize.z * 2)) // or is very flat
          );

          if (isFlatPanel) {
            meshCandidates.push({ mesh: child, area: surfaceArea, normal: dominantNormal, size: meshSize });
          }

          // ── Apply Materials ──
          let newMat;

          if (isHardware) {
            // Keep hardware looking like hardware — brushed metal
            newMat = new THREE.MeshStandardMaterial({
              color: 0xb0b0b0,
              roughness: 0.35,
              metalness: 0.85,
              envMapIntensity: 1.2,
            });
          } else if (isGlass) {
            // Transparent/acrylic panels
            newMat = new THREE.MeshPhysicalMaterial({
              color: 0xffffff,
              roughness: 0.05,
              metalness: 0,
              transmission: 0.9,
              thickness: 0.5,
              transparent: true,
              opacity: 0.3,
            });
          } else {
            // Brandable surface — apply brand color
            const originalColor = child.material?.color;
            const isVeryLight = originalColor && originalColor.r > 0.85 && originalColor.g > 0.85 && originalColor.b > 0.85;
            const isVeryDark = originalColor && originalColor.r < 0.15 && originalColor.g < 0.15 && originalColor.b < 0.15;

            // Largest surfaces get primary, smaller get secondary
            const usePrimary = surfaceArea > 0.5 || isVeryLight || isVeryDark;
            const brandColor = usePrimary ? brandPrimary : brandSecondary;

            newMat = new THREE.MeshStandardMaterial({
              color: brandColor,
              roughness: 0.55,
              metalness: 0.05,
              envMapIntensity: 0.6,
            });

            // If the original material had a texture, keep it but tint it
            if (child.material?.map) {
              newMat.map = child.material.map;
              newMat.color.set(0xffffff); // Let texture show through
            }
          }

          child.material = newMat;
          child.material.needsUpdate = true;
        });

        // ── Step 3: Place Logo on Best Candidate ──
        if (logoTex && meshCandidates.length > 0) {
          // Sort by area, pick the largest flat panel
          meshCandidates.sort((a, b) => b.area - a.area);
          const target = meshCandidates[0];

          // Create a logo decal plane positioned on the target surface
          const logoAspect = logoTex.image.width / logoTex.image.height;
          const targetMeshCenter = new THREE.Vector3();
          new THREE.Box3().setFromObject(target.mesh).getCenter(targetMeshCenter);

          // Size logo to ~60% of the target panel width
          const panelW = target.size.x;
          const panelH = target.size.y;
          let logoW = panelW * 0.55;
          let logoH = logoW / logoAspect;
          if (logoH > panelH * 0.45) {
            logoH = panelH * 0.45;
            logoW = logoH * logoAspect;
          }

          // Ensure minimum visible size
          if (logoW < 0.3) { logoW = 0.3; logoH = logoW / logoAspect; }

          const logoPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(logoW, logoH),
            new THREE.MeshStandardMaterial({
              map: logoTex,
              transparent: true,
              alphaTest: 0.05,
              roughness: 0.3,
              metalness: 0,
              emissive: 0xffffff,
              emissiveIntensity: 0.08, // Subtle glow so logo pops
              depthWrite: true,
              polygonOffset: true,
              polygonOffsetFactor: -1,
            })
          );

          // Position logo on the front face of the target panel
          // Convert target center to model-local coords
          const localCenter = modelMesh.worldToLocal(targetMeshCenter.clone());

          // Determine which face to place on based on dominant normal
          if (target.normal.z > target.normal.y && target.normal.z > target.normal.x) {
            // Forward-facing panel
            logoPlane.position.set(localCenter.x, localCenter.y, localCenter.z + target.size.z * 0.51);
          } else if (target.normal.y > target.normal.x) {
            // Upward-facing (table top, etc.)
            logoPlane.position.set(localCenter.x, localCenter.y + target.size.y * 0.51, localCenter.z);
            logoPlane.rotation.x = -Math.PI / 2;
          } else {
            // Side-facing
            logoPlane.position.set(localCenter.x + target.size.x * 0.51, localCenter.y, localCenter.z);
            logoPlane.rotation.y = Math.PI / 2;
          }

          modelMesh.add(logoPlane);
        }

        // ── Step 4: If no logo, add brand accent stripe ──
        if (!logoTex && meshCandidates.length > 0) {
          const target = meshCandidates[0];
          const targetMeshCenter = new THREE.Vector3();
          new THREE.Box3().setFromObject(target.mesh).getCenter(targetMeshCenter);
          const localCenter = modelMesh.worldToLocal(targetMeshCenter.clone());

          // Accent stripe across the top of the main panel
          const stripeW = target.size.x * 0.9;
          const stripeH = target.size.y * 0.06;
          const stripe = new THREE.Mesh(
            new THREE.PlaneGeometry(stripeW, stripeH),
            new THREE.MeshStandardMaterial({
              color: brandAccent,
              roughness: 0.3,
              metalness: 0.1,
              emissive: brandAccent,
              emissiveIntensity: 0.15,
              polygonOffset: true,
              polygonOffsetFactor: -1,
            })
          );
          stripe.position.set(localCenter.x, localCenter.y + target.size.y * 0.35, localCenter.z + target.size.z * 0.51);
          modelMesh.add(stripe);

          // Company name text texture on the panel
          const companyName = brand.company_name;
          if (companyName) {
            const nameCanvas = document.createElement('canvas');
            nameCanvas.width = 1024; nameCanvas.height = 256;
            const nctx = nameCanvas.getContext('2d');
            nctx.clearRect(0, 0, 1024, 256);
            const fontSize = Math.min(120, 900 / Math.max(companyName.length * 0.55, 1));
            nctx.font = `bold ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
            nctx.textAlign = 'center';
            nctx.textBaseline = 'middle';
            nctx.fillStyle = '#ffffff';
            nctx.fillText(companyName, 512, 128);

            const nameTex = new THREE.CanvasTexture(nameCanvas);
            nameTex.colorSpace = THREE.SRGBColorSpace;

            const nameW = target.size.x * 0.7;
            const nameH = nameW * 0.25;
            const namePlane = new THREE.Mesh(
              new THREE.PlaneGeometry(nameW, nameH),
              new THREE.MeshStandardMaterial({
                map: nameTex,
                transparent: true,
                alphaTest: 0.05,
                roughness: 0.4,
                emissive: 0xffffff,
                emissiveIntensity: 0.05,
                polygonOffset: true,
                polygonOffsetFactor: -2,
              })
            );
            namePlane.position.set(localCenter.x, localCenter.y, localCenter.z + target.size.z * 0.52);
            modelMesh.add(namePlane);
          }
        }

        // ── Step 5: Assemble Group & Place ──
        const group = new THREE.Group();
        group.userData = { id: item.id, hasGLB: true };
        group.add(modelMesh);

        group.position.set(wx, 0, wz);
        if (item.rot) group.rotation.y = -THREE.MathUtils.degToRad(item.rot);

        scene.add(group);
        interactableObjects.push(group);

        // Selection indicator (hidden by default)
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        // Product label above model
        const lTex = makeLabelTex(item.name || item.sku);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
        const ls = Math.min(dispW * 1.1, 4.5);
        label.scale.set(ls, ls * 0.11, 1);
        label.position.set(wx, scaledSize.y + 0.35, wz);
        scene.add(label);

        // Contact shadow
        addContactShadow(scene, contactShadowTex, wx, wz, dispW, dispD);
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

        // Contact shadow
        addContactShadow(scene, contactShadowTex, wx, wz, pW, boxDepth);
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

        // Contact shadow
        addContactShadow(scene, contactShadowTex, wx, wz, dispW, Math.max(0.5, dispD));
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

    // ── Interactive Controls: OrbitControls + Raycast Drag ──
    let controls = null;

    if (interactive) {
      // ── ORBIT CONTROLS (zoom, pan, rotate) ──
      controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.target.set(0, WALL_H * 0.25, -bD * 0.1);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.panSpeed = 0.8;
      controls.rotateSpeed = 0.6;
      // Zoom limits — can zoom in close but not through the floor
      controls.minDistance = 3;
      controls.maxDistance = Math.max(bW, bD) * 4;
      // Angle limits — don't go below floor or straight up
      controls.minPolarAngle = 0.1; // Just above horizon
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
      controls.update();

      // ── DRAG & DROP SYSTEM ──
      let draggedObject = null;
      let dragOffset = new THREE.Vector3();
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let hoveredObject = null;

      const el = renderer.domElement;

      const getNDC = (e) => {
        const rect = el.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        return {
          x: ((clientX - rect.left) / rect.width) * 2 - 1,
          y: -((clientY - rect.top) / rect.height) * 2 + 1
        };
      };

      const findInteractable = (ndc) => {
        mouse.set(ndc.x, ndc.y);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(interactableObjects, true);
        if (hits.length === 0) return null;
        let obj = hits[0].object;
        while (obj && !obj.userData.id && obj.parent) obj = obj.parent;
        return (obj && obj.userData.id) ? obj : null;
      };

      const showBoxHelper = (obj, color) => {
        if (!obj) return;
        obj.children.forEach(child => {
          if (child.type === 'LineSegments') {
            child.visible = true;
            child.material.color.setHex(color);
          }
        });
      };

      const hideAllBoxHelpers = () => {
        interactableObjects.forEach(obj => {
          obj.children.forEach(child => {
            if (child.type === 'LineSegments') {
              child.visible = false;
              child.material.color.setHex(0x3b82f6);
            }
          });
        });
      };

      // ── POINTER DOWN ──
      const onDown = (e) => {
        const ndc = getNDC(e);
        const obj = findInteractable(ndc);

        if (obj) {
          // Start dragging — disable orbit
          draggedObject = obj;
          controls.enabled = false;
          el.style.cursor = 'grabbing';

          mouse.set(ndc.x, ndc.y);
          raycaster.setFromCamera(mouse, camera);
          const hit = new THREE.Vector3();
          const result = raycaster.ray.intersectPlane(dragPlane, hit);
          if (result) {
            dragOffset.copy(hit).sub(obj.position);
          } else {
            dragOffset.set(0, 0, 0);
          }

          showBoxHelper(obj, 0x22c55e); // Green while dragging
        }
        // If no object hit, OrbitControls handles orbit/zoom naturally
      };

      // ── POINTER MOVE ──
      const onMove = (e) => {
        if (draggedObject) {
          // Dragging an item
          const ndc = getNDC(e);
          mouse.set(ndc.x, ndc.y);
          raycaster.setFromCamera(mouse, camera);
          const hit = new THREE.Vector3();
          const result = raycaster.ray.intersectPlane(dragPlane, hit);

          if (result) {
            const newPos = hit.sub(dragOffset);
            // Clamp to booth bounds
            const halfW = bW / 2 - 0.5;
            const halfD = bD / 2 - 0.5;
            draggedObject.position.x = Math.max(-halfW, Math.min(halfW, newPos.x));
            draggedObject.position.z = Math.max(-halfD, Math.min(halfD, newPos.z));
          }
          return;
        }

        // Hover detection (only when not dragging)
        if (!e.buttons) {
          const ndc = getNDC(e);
          const obj = findInteractable(ndc);

          if (obj !== hoveredObject) {
            hideAllBoxHelpers();
            hoveredObject = obj;
            if (obj) {
              showBoxHelper(obj, 0x3b82f6); // Blue hover
              el.style.cursor = 'grab';
            } else {
              el.style.cursor = 'default';
            }
          }
        }
      };

      // ── POINTER UP ──
      const onUp = () => {
        if (draggedObject) {
          // Convert 3D position back to 2D scene coords and fire callback
          if (onMoveItem) {
            const newX = draggedObject.position.x + bW / 2;
            const newY = -draggedObject.position.z + bD / 2;
            onMoveItem(draggedObject.userData.id, newX, newY);
          }

          hideAllBoxHelpers();
          draggedObject = null;
          controls.enabled = true;
          el.style.cursor = 'default';
        }
      };

      // Pointer events (handles both mouse and touch)
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('pointerleave', onUp);

      // ── WASD WALKTHROUGH CONTROLS ──
      const keysDown = new Set();
      const WALK_SPEED = 0.15;

      const onKeyDown = (e) => keysDown.add(e.code);
      const onKeyUp = (e) => keysDown.delete(e.code);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      const updateWalkthrough = () => {
        if (keysDown.size === 0) return;
        const cam = cameraRef.current;
        const ctrl = controlsRef.current;
        if (!cam || !ctrl) return;

        // Get camera forward/right vectors (on XZ plane)
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const move = new THREE.Vector3();
        if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) move.add(forward);
        if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) move.sub(forward);
        if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) move.add(right);
        if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) move.sub(right);

        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(WALK_SPEED);
          cam.position.add(move);
          ctrl.target.add(move);
        }
      };

      // ── RENDER LOOP ──
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        updateWalkthrough();
        controls.update(); // Required for damping
        renderer.render(scene, camera);
      };
      animate();
    } else {
      // Non-interactive: single render after assets load
    }

    // ── Cleanup ──
    return () => {
      resizeObserver.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (controls) controls.dispose();
      if (envMap) envMap.dispose();
      window.removeEventListener('keydown', () => {});
      window.removeEventListener('keyup', () => {});
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
  }, [sceneJson, brandIdentity, boothSize, boothType, width, height, interactive, autoSnapshot]);

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

          {/* ── Camera Toolbar ── */}
          {interactive && status === 'ready' && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-xl px-2 py-1.5 shadow-lg border border-slate-200 dark:border-slate-700 z-30">
              {[
                { id: 'catalog', label: '3/4 View', icon: '📐' },
                { id: 'front', label: 'Front', icon: '👤' },
                { id: 'top', label: 'Top', icon: '🔽' },
                { id: 'walkthrough', label: 'Walk', icon: '🚶' },
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyCameraPreset(preset.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    cameraMode === preset.id 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title={preset.label}
                >
                  <span className="text-sm">{preset.icon}</span>
                  <span className="hidden sm:inline">{preset.label}</span>
                </button>
              ))}

              <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1" />

              <button
                onClick={downloadScreenshot}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 transition-all"
                title="Export high-res screenshot"
              >
                <span className="text-sm">📸</span>
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          )}

          {/* ── Walkthrough hint ── */}
          {interactive && status === 'ready' && cameraMode === 'walkthrough' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs font-medium px-4 py-2 rounded-full backdrop-blur-sm z-30 animate-pulse">
              WASD or Arrow Keys to walk · Mouse to look around
            </div>
          )}

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