import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SKU_BRANDING_PROFILES } from '@/data/skuBrandingProfiles';

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

function makeDrapeTex(sz = 512) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz * 3; // Tall canvas for vertical fold pattern
  const ctx = c.getContext('2d');
  const h = sz * 3;
  ctx.fillStyle = '#181818';
  ctx.fillRect(0, 0, sz, h);

  // Vertical fabric folds — each fold is dark→highlight→dark
  const foldCount = 16;
  const foldW = sz / foldCount;
  for (let i = 0; i < foldCount; i++) {
    const x = i * foldW;
    const g = ctx.createLinearGradient(x, 0, x + foldW, 0);
    g.addColorStop(0,   'rgba(0,0,0,0.35)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.07)');
    g.addColorStop(0.5,  'rgba(255,255,255,0.10)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.05)');
    g.addColorStop(1,   'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, foldW, h);
  }
  // Subtle weave grain (horizontal)
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.012})`;
    ctx.fillRect(0, y, sz, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeConcreteFloorTex(sz = 512) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c4c6c4';
  ctx.fillRect(0, 0, sz, sz);
  const id = ctx.getImageData(0, 0, sz, sz);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    id.data[i]   = Math.max(175, Math.min(215, id.data[i]   + n));
    id.data[i+1] = Math.max(175, Math.min(213, id.data[i+1] + n));
    id.data[i+2] = Math.max(172, Math.min(210, id.data[i+2] + n));
  }
  ctx.putImageData(id, 0, 0);
  // Concrete slab joints (every ~4ft equiv)
  ctx.strokeStyle = 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= sz; x += sz / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sz); ctx.stroke(); }
  for (let y = 0; y <= sz; y += sz / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sz, y); ctx.stroke(); }
  // Subtle specular highlight streak
  const sheen = ctx.createLinearGradient(0, 0, sz, sz);
  sheen.addColorStop(0,   'rgba(255,255,255,0)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, sz, sz);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeHallCeilingTex(sz = 512) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d8d2';
  ctx.fillRect(0, 0, sz, sz);
  // Ceiling tile grid
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 2;
  const ts = sz / 4;
  for (let x = 0; x <= sz; x += ts) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sz); ctx.stroke(); }
  for (let y = 0; y <= sz; y += ts) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sz, y); ctx.stroke(); }
  // Light panels (bright tiles at intervals)
  ctx.fillStyle = 'rgba(245,248,255,0.65)';
  [[1, 1], [3, 1], [1, 3], [3, 3]].forEach(([col, row]) => {
    ctx.fillRect(col * ts + ts * 0.08, row * ts + ts * 0.08, ts * 0.84, ts * 0.84);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeHallWallTex(sz = 512) {
  const c = document.createElement('canvas');
  c.width = sz; c.height = sz;
  const ctx = c.getContext('2d');
  // Convention center block/drywall — slightly warm white
  ctx.fillStyle = '#dcdcd5';
  ctx.fillRect(0, 0, sz, sz);
  // Horizontal bands (panels)
  for (let y = 0; y < sz; y += sz / 6) {
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sz, y); ctx.stroke();
  }
  // Vertical seams
  for (let x = 0; x < sz; x += sz / 4) {
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, sz); ctx.stroke();
  }
  // Slight noise
  const id = ctx.getImageData(0, 0, sz, sz);
  for (let i = 0; i < id.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    id.data[i]   = Math.max(190, Math.min(240, id.data[i]   + n));
    id.data[i+1] = Math.max(190, Math.min(240, id.data[i+1] + n));
    id.data[i+2] = Math.max(185, Math.min(235, id.data[i+2] + n));
  }
  ctx.putImageData(id, 0, 0);
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
  onRotateItem,
  onRemoveItem,
  onToggleWallMount,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const sceneRef = useRef(null);
  const boothDimsRef = useRef({ w: 10, d: 10 });
  // Track placed product groups by item ID for incremental position updates
  const itemGroupMapRef = useRef(new Map()); // Map<id, THREE.Group>
  // Snapshot of the last fully-rendered scene items for diffing
  const prevSceneItemsRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState(null);
  const [cameraMode, setCameraMode] = useState('catalog'); // catalog, front, top, walkthrough
  const [selectedItem, setSelectedItem] = useState(null); // { id, name }
  // Stable ref so pointer handlers (in useEffect) can call React setters
  const setSelectedItemRef = useRef(setSelectedItem);

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

    // ── INCREMENTAL UPDATE (no full rebuild on drag) ──────────────────
    // If the booth dimensions + item list are unchanged, only update positions
    // This eliminates flicker on every drag/rotate without rebuilding the scene.
    const prevItems = prevSceneItemsRef.current;
    const newItems = sceneData.items || [];
    if (
      prevItems !== null &&
      sceneRef.current &&
      rendererRef.current &&
      sceneData.booth.w_ft === boothDimsRef.current.w &&
      sceneData.booth.d_ft === boothDimsRef.current.d &&
      prevItems.length === newItems.length &&
      prevItems.every((pi, idx) => pi.id === newItems[idx]?.id && pi.sku === newItems[idx]?.sku)
    ) {
      // Same items — just sync positions & rotations for any that moved
      const bW = boothDimsRef.current.w;
      const bD = boothDimsRef.current.d;
      let anyMoved = false;
      for (const item of newItems) {
        const group = itemGroupMapRef.current.get(item.id);
        if (!group || item.isFlooring || (item.mountType && item.mountType !== 'floor')) continue;
        const wx = item.x - bW / 2;
        const wz = -(item.y - bD / 2);
        if (Math.abs(group.position.x - wx) > 0.001 || Math.abs(group.position.z - wz) > 0.001) {
          group.position.x = wx;
          group.position.z = wz;
          anyMoved = true;
        }
        const newRot = item.rot ? -THREE.MathUtils.degToRad(item.rot) : 0;
        if (Math.abs(group.rotation.y - newRot) > 0.001) {
          group.rotation.y = newRot;
          anyMoved = true;
        }
      }
      if (anyMoved) prevSceneItemsRef.current = newItems;
      return; // Skip full scene rebuild
    }

    const bW = sceneData.booth.w_ft || 10;
    const bD = sceneData.booth.d_ft || 10;
    const brand = brandIdentity || {};

    // ── CONVENTION CENTER SCENE ──
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    boothDimsRef.current = { w: bW, d: bD };
    // Dark hall atmosphere — booths pop against the dark background
    scene.background = new THREE.Color(0x1a1c1e);
    scene.fog = new THREE.FogExp2(0x1a1c1e, 0.015); // Exponential fog: dramatic near falloff

    // ── Booth type flags (needed for camera + structure) ──
    const isIsland = boothType === 'island';
    const isPeninsula = boothType === 'peninsula';
    const isCorner = boothType === 'corner';
    const isInline = !isIsland && !isPeninsula && !isCorner;

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
    renderer.toneMappingExposure = 1.45; // Brighter trade show look
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

    // ══════════════════════════════════════════════════════════
    // TRADE SHOW LIGHTING RIG
    // Dark hall + focused booth spotlights = professional look
    // ══════════════════════════════════════════════════════════

    // Very low ambient — only the booth area is lit
    scene.add(new THREE.AmbientLight(0x3a4560, 1.0));
    scene.add(new THREE.HemisphereLight(0x506080, 0x202020, 0.6));

    // Main overhead key — warm white, directional shadow
    const mainLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
    mainLight.position.set(bW * 0.2, CEILING_Y * 0.85, bD * 0.5);
    mainLight.target.position.set(0, 0, -bD * 0.1);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.near = 1;
    mainLight.shadow.camera.far = 60;
    mainLight.shadow.camera.left  = -(bW + 4);
    mainLight.shadow.camera.right  =  (bW + 4);
    mainLight.shadow.camera.top    =  (bD + 6);
    mainLight.shadow.camera.bottom = -(bD + 2);
    mainLight.shadow.bias = -0.001;
    scene.add(mainLight);
    scene.add(mainLight.target);

    // Fill from front-left — fills facial/product shadows
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5);
    fill.position.set(-bW * 0.6, 12, bD * 1.2);
    scene.add(fill);

    // Rim from behind — product separation from backwall
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(bW * 0.4, 14, -bD * 1.5);
    scene.add(rim);

    // Truss spotlights (PointLights over the booth, warm color temp)
    const trussPositions = [
      [-bW * 0.3, CEILING_Y - 2, -bD * 0.15],
      [ bW * 0.3, CEILING_Y - 2, -bD * 0.15],
      [0,         CEILING_Y - 2,  bD * 0.2],
    ];
    trussPositions.forEach(([tx, ty, tz]) => {
      const spot = new THREE.PointLight(0xffe8b0, 1.0, bW * 2.5, 1.8);
      spot.position.set(tx, ty, tz);
      scene.add(spot);
    });

    // ══════════════════════════════════════════════════════════
    // ENVIRONMENT MAP (dark hall — metallic surfaces reflect hall)
    // ══════════════════════════════════════════════════════════

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512; envCanvas.height = 256;
    const envCtx = envCanvas.getContext('2d');
    const envGrad = envCtx.createLinearGradient(0, 0, 0, 256);
    envGrad.addColorStop(0,    '#2a3040'); // Dark overhead
    envGrad.addColorStop(0.25, '#1e2530');
    envGrad.addColorStop(0.5,  '#151820');
    envGrad.addColorStop(0.75, '#0e1015');
    envGrad.addColorStop(1,    '#080808'); // Dark ground bounce
    envCtx.fillStyle = envGrad;
    envCtx.fillRect(0, 0, 512, 256);
    // Add 3 bright light patches (simulating overhead fixtures)
    [[128, 30], [256, 25], [384, 30]].forEach(([x, y]) => {
      const g = envCtx.createRadialGradient(x, y, 0, x, y, 40);
      g.addColorStop(0, 'rgba(255,240,180,0.9)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      envCtx.fillStyle = g;
      envCtx.fillRect(x - 40, 0, 80, 70);
    });
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const envScene2 = new THREE.Scene();
    const envGeo2 = new THREE.SphereGeometry(20, 32, 16);
    const envMat2 = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
    envScene2.add(new THREE.Mesh(envGeo2, envMat2));
    scene.environment = pmremGenerator.fromScene(envScene2, 0.04).texture;
    envScene2.clear();
    pmremGenerator.dispose();

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

    // ── Ground Plane (convention hall polished epoxy floor) ──
    // Light gray, slightly reflective — contrasts with dark hall walls
    const concreteTex = makeConcreteFloorTex();
    concreteTex.repeat.set(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({
      map: concreteTex,
      roughness: 0.55,  // Polished epoxy is smoother than raw concrete
      metalness: 0.18,  // Slight reflectivity
    });
    const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
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

    // ── Aisle floor (in front of booth) — same polished epoxy ──
    const aisleW = bW + 16;
    const aisleD = AISLE_DEPTH + 2;
    const aisleTex = makeConcreteFloorTex();
    aisleTex.repeat.set(aisleW / 4, aisleD / 4);
    const aisleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(aisleW, aisleD),
      new THREE.MeshStandardMaterial({ map: aisleTex, roughness: 0.55, metalness: 0.15 })
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

    // ══════════════════════════════════════════════════════════
    // CONVENTION CENTER HALL — dark curtain walls + truss rig
    // ══════════════════════════════════════════════════════════
    const HALL_W = 130;
    const HALL_D = 130;
    const HALL_H = 26;

    // ── Hall curtain walls — black pipe-and-drape backdrop ──
    const hallDrapeTex = makeDrapeTex(512);
    hallDrapeTex.repeat.set(8, 1);
    const hallDrapeMat = new THREE.MeshStandardMaterial({
      map: hallDrapeTex,
      color: 0x111418,   // Very dark charcoal, like show draping
      roughness: 0.97,
      metalness: 0,
      side: THREE.FrontSide,
    });

    const makeHallWall = (w, h, px, py, pz, ry) => {
      const t = hallDrapeTex.clone();
      t.repeat.set(w / 5, 1);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: t, color: 0x111418, roughness: 0.97, metalness: 0 })
      );
      m.rotation.y = ry;
      m.position.set(px, py, pz);
      return m;
    };

    scene.add(makeHallWall(HALL_W, HALL_H, 0,          HALL_H / 2, -HALL_D / 2,  0));
    scene.add(makeHallWall(HALL_D, HALL_H, -HALL_W / 2, HALL_H / 2, 0,            Math.PI / 2));
    scene.add(makeHallWall(HALL_D, HALL_H,  HALL_W / 2, HALL_H / 2, 0,           -Math.PI / 2));
    // Front "back of hall" wall (behind camera viewpoint)
    scene.add(makeHallWall(HALL_W, HALL_H, 0, HALL_H / 2, HALL_D / 2, Math.PI));

    // ── Industrial ceiling — dark steel/truss above ──
    const ceilingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(HALL_W, HALL_D),
      new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 1, metalness: 0.3 })
    );
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(0, HALL_H, 0);
    scene.add(ceilingMesh);

    // ── Overhead Lighting Truss ──
    // Steel tube truss spanning across the booth
    const trussY = HALL_H - 1.5;
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.2 });
    const tubeR = 0.07;

    // Two main horizontal bars (left-right)
    [-bD * 0.2, -bD * 0.55].forEach(tz => {
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(tubeR, tubeR, bW + 4, 8),
        trussMat
      );
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, trussY, tz);
      scene.add(bar);

      // Vertical drops to the floor (truss legs)
      [-bW / 2 - 1.5, bW / 2 + 1.5].forEach(tx => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(tubeR * 0.7, tubeR * 0.7, trussY, 6),
          trussMat
        );
        leg.position.set(tx, trussY / 2, tz);
        scene.add(leg);
      });

      // Spotlight heads hanging from the bar
      const numSpots = Math.max(2, Math.round(bW / 4));
      for (let i = 0; i < numSpots; i++) {
        const sx = -bW / 2 + (bW / (numSpots - 1)) * i;
        // Fixture body (small cone pointing down)
        const head = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.35, 8),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 })
        );
        head.position.set(sx, trussY - 0.4, tz);
        head.rotation.x = Math.PI; // Point down
        scene.add(head);

        // Bright circle where light hits floor (emissive glow disc)
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(0.12, 10),
          new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.8 })
        );
        glow.rotation.x = Math.PI / 2;
        glow.position.set(sx, trussY - 0.01, tz);
        scene.add(glow);
      }
    });

    // ── Neighboring booth ghost silhouettes (in the dark bg) ──
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0x1e2530, roughness: 1, metalness: 0, transparent: true, opacity: 0.55
    });
    [[-bW - 12, 0], [bW + 12, 0]].forEach(([nx, nz]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(10, WALL_H * 0.9, 0.3), ghostMat);
      wall.position.set(nx, WALL_H * 0.45, nz - bD * 0.1);
      scene.add(wall);
    });

    // ── Drape texture (shared) ──
    const dTex = makeDrapeTex();
    dTex.repeat.set(1, 2);

    const makeDrape = (length, posX, posZ, rotY) => {
      const dt = dTex.clone();
      dt.repeat.set(length / 4, 1.2); // Scale folds relative to drape width
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(length, DRAPE_H),
        new THREE.MeshStandardMaterial({
          map: dt,
          roughness: 0.95,
          metalness: 0,
          side: THREE.DoubleSide,
        })
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
        new THREE.MeshStandardMaterial({
          map: bwTex,
          roughness: 0.75,   // fabric backwall is matte/satin, not glossy
          metalness: 0,
          side: THREE.DoubleSide
        })
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

    // Helper: position and orient a product group based on mountType
    // floorY = the y-offset for floor items (centers the box at correct height)
    // size   = { x, y, z } of the item's bounding box in world units
    const placeItemGroup = (group, item, floorWX, floorWZ, floorY, size, isWallMounted, boothW, boothD) => {
      const wallGap = 0.04; // small gap between wall surface and item

      if (!isWallMounted) {
        group.position.set(floorWX, floorY, floorWZ);
        if (item.rot) group.rotation.y = -THREE.MathUtils.degToRad(item.rot);
        return;
      }

      const mountH = item.mountHeight ?? 3;
      // wallOffset is measured from the left/front edge in booth-space (like x in 2D)
      // Convert to centered 3D coords
      const offsetAlongWall = (item.wallOffset ?? boothW / 2) - boothW / 2;
      const offsetAlongSide = (item.wallOffset ?? boothD / 2) - boothD / 2;

      switch (item.mountType) {
        case 'wall_back':
          // Back wall at z = -boothD/2, item faces viewer (+z)
          group.position.set(offsetAlongWall, mountH + size.y / 2, -boothD / 2 + size.z / 2 + wallGap);
          group.rotation.y = 0;
          break;
        case 'wall_left':
          // Left wall at x = -boothW/2, item faces right (+x)
          group.position.set(-boothW / 2 + size.z / 2 + wallGap, mountH + size.y / 2, -offsetAlongSide);
          group.rotation.y = -Math.PI / 2;
          break;
        case 'wall_right':
          // Right wall at x = +boothW/2, item faces left (-x)
          group.position.set(boothW / 2 - size.z / 2 - wallGap, mountH + size.y / 2, -offsetAlongSide);
          group.rotation.y = Math.PI / 2;
          break;
        case 'ceiling':
          // Hang from ceiling, item faces down
          group.position.set(offsetAlongWall, WALL_H - size.y / 2, floorWZ);
          group.rotation.y = item.rot ? -THREE.MathUtils.degToRad(item.rot) : 0;
          break;
        default:
          group.position.set(floorWX, floorY, floorWZ);
          if (item.rot) group.rotation.y = -THREE.MathUtils.degToRad(item.rot);
      }
    };

    // Full rebuild — clear item group tracking and snapshot
    itemGroupMapRef.current.clear();
    prevSceneItemsRef.current = null;

    const items = sceneData.items || [];

    const productPromises = items.filter(i => !i.isFlooring).map(async (item) => {
      const itemH = guessHeight(item);
      const iW = item.w || 3;
      const iD = item.d || 1;
      const isWallMounted = item.mountType && item.mountType !== 'floor';

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
        // 3D MODEL BRANDING PIPELINE v2
        //
        // Classification priority (highest → lowest):
        //   1. BRAND_* / STRUCT_* mesh name prefix (explicit tagging)
        //   2. item.brandingConfig.brandMeshTags / hwMeshTags (DB config)
        //   3. item.brandingConfig.isBrandable (product-level flag)
        //   4. Category/name keywords → derive isBrandable
        //   5. Geometry heuristics → detect structural vs graphic meshes
        // ══════════════════════════════════════════════════════════

        // ── Step 0: Detect and correct Z-up model orientation ──
        // GLBs converted from OBJ/CAD (AutoCAD/Z-up sources) have their height along
        // the Z axis. In Three.js (Y-up) these models appear flat on the floor, and
        // wall-mounted items stick out perpendicular because Z (height) becomes depth.
        // Fix: rotate -90° around X so Z (height) maps to Y (up).
        {
          const preBox = new THREE.Box3().setFromObject(modelMesh);
          const preSize = preBox.getSize(new THREE.Vector3());
          if (preSize.z > preSize.y * 1.1) {
            modelMesh.rotation.x = -Math.PI / 2;
          }
        }

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

        // ── Step 2: Determine product-level brandability ──
        // Priority: DB branding_config > SKU profile > keyword heuristics
        const cfg = item.brandingConfig || {};
        const skuProfile = SKU_BRANDING_PROFILES[item.sku] || null;

        const productIsBrandable =
          cfg.isBrandable !== undefined ? cfg.isBrandable :
          skuProfile !== null ? (skuProfile.canBrand === true) :
          true; // default: brand if unknown

        // brandSurface drives how aggressively we brand:
        //   'full'  → brand ALL non-glass meshes (e.g. tension fabric towers, arches)
        //   'front' → brand largest flat panel only (banner stands, lightboxes)
        //   'panel' → use geometry heuristics to find flat panels (modular backwalls)
        //   'none'  → no branding (pure hardware/accessories)
        const brandSurface = cfg.brandSurface || skuProfile?.brandSurface || 'panel';

        const customBrandTags = (cfg.brandMeshTags || []).map(t => t.toLowerCase());
        const customHwTags    = (cfg.hwMeshTags    || []).map(t => t.toLowerCase());

        const brandPrimary   = new THREE.Color(brand.primary_color   || '#1a1a2e');
        const brandSecondary = new THREE.Color(brand.secondary_color || '#16213e');

        const meshCandidates = []; // for logo placement

        modelMesh.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;

          const geo      = child.geometry;
          const matName  = (child.material?.name || '').toLowerCase();
          const meshName = (child.name || '').toLowerCase();

          const meshBox  = new THREE.Box3().setFromObject(child);
          const meshSize = meshBox.getSize(new THREE.Vector3());
          const surfaceArea = meshSize.x * meshSize.y * 2
                            + meshSize.y * meshSize.z * 2
                            + meshSize.x * meshSize.z * 2;

          // ── PRIORITY 1: Explicit naming convention ──
          // New GLBs tagged with BRAND_* / STRUCT_* during conversion
          const forceBrand  = meshName.startsWith('brand_');
          const forceStruct = meshName.startsWith('struct_');

          // ── PRIORITY 2: Custom tags from DB branding_config ──
          const taggedBrand = customBrandTags.length > 0 &&
            customBrandTags.some(t => meshName.includes(t) || matName.includes(t));
          const taggedHw = customHwTags.length > 0 &&
            customHwTags.some(t => meshName.includes(t) || matName.includes(t));

          // ── PRIORITY 3: Name/material keyword heuristics ──
          const nameIsHw =
            matName.includes('metal') || matName.includes('steel') ||
            matName.includes('aluminum') || matName.includes('chrome') ||
            meshName.includes('pole') || meshName.includes('frame') ||
            meshName.includes('leg')  || meshName.includes('foot') ||
            meshName.includes('base') || meshName.includes('rod') ||
            meshName.includes('bolt') || meshName.includes('tube') ||
            meshName.includes('pipe') || meshName.includes('bracket') ||
            meshName.includes('rail') || meshName.includes('hinge') ||
            meshName.includes('clamp');

          const isGlass =
            matName.includes('glass') || matName.includes('acrylic') ||
            matName.includes('clear') ||
            (child.material?.opacity != null && child.material.opacity < 0.75);

          // ── PRIORITY 4: Geometry heuristic ──
          // A thin/long mesh (tube ratio) = structural, not a graphic panel
          const dims = [meshSize.x, meshSize.y, meshSize.z].sort((a, b) => a - b);
          const isTubeShape = dims[0] < 0.12 && dims[2] > 0.4; // thin in 2 axes

          // Flat panel (large face): good logo candidate
          const isFlatPanel =
            !isGlass && surfaceArea > 0.2 && !isTubeShape &&
            (meshSize.x > meshSize.z * 3 || meshSize.y > meshSize.z * 3 ||
             (meshSize.x > 0.4 && meshSize.y > 0.4 && meshSize.z < 0.3));

          // ── Final classification ──
          // 'full' surface: brand everything except glass (tension fabric, arches, towers)
          // 'none' surface: nothing is brandable (pure hardware)
          // 'front'/'panel': use geometry heuristics to find flat panels
          const isHardware = brandSurface === 'none' ? true :
            brandSurface === 'full' ? false :
            forceStruct || taggedHw ||
              (!forceBrand && !taggedBrand && (nameIsHw || isTubeShape));

          const isBrandable = !isGlass && (
            brandSurface === 'full' ? productIsBrandable :
            brandSurface === 'none' ? false :
            !isHardware && (forceBrand || taggedBrand || productIsBrandable)
          );

          // Track logo candidates
          if (isBrandable && isFlatPanel) {
            let dominantNormal = new THREE.Vector3(0, 0, 1);
            if (geo.attributes?.normal) {
              const nAttr = geo.attributes.normal;
              const avg = new THREE.Vector3();
              for (let ni = 0; ni < nAttr.count; ni++) {
                avg.x += Math.abs(nAttr.getX(ni));
                avg.y += Math.abs(nAttr.getY(ni));
                avg.z += Math.abs(nAttr.getZ(ni));
              }
              dominantNormal = avg.normalize();
            }
            meshCandidates.push({ mesh: child, area: surfaceArea, normal: dominantNormal, size: meshSize });
          }

          // ── Apply material ──
          let newMat;
          if (isGlass) {
            newMat = new THREE.MeshPhysicalMaterial({
              color: 0xffffff, roughness: 0.05, metalness: 0,
              transmission: 0.9, thickness: 0.5,
              transparent: true, opacity: 0.25,
            });
          } else if (isHardware) {
            newMat = new THREE.MeshStandardMaterial({
              color: 0xb8b8b8, roughness: 0.35, metalness: 0.85, envMapIntensity: 1.2,
            });
          } else if (isBrandable) {
            // Large flat surfaces → primary brand color, smaller → secondary
            const usePrimary = surfaceArea >= 0.5 || isFlatPanel;
            newMat = new THREE.MeshStandardMaterial({
              color: usePrimary ? brandPrimary : brandSecondary,
              roughness: 0.6, metalness: 0.05, envMapIntensity: 0.5,
            });
            // Preserve original texture if present (don't obliterate printed graphics)
            if (child.material?.map) {
              newMat.map = child.material.map;
              newMat.color.set(0xffffff);
            }
          } else {
            // Not brandable but not hardware — keep original look
            if (child.material) {
              child.material.needsUpdate = true;
              return; // keep as-is
            }
            newMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.7 });
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
        group.userData = { id: item.id, hasGLB: true, isWallMounted };
        itemGroupMapRef.current.set(item.id, group);
        group.add(modelMesh);

        placeItemGroup(group, item, wx, wz, 0, { x: scaledSize.x, y: scaledSize.y, z: scaledSize.z }, isWallMounted, bW, bD);

        scene.add(group);
        if (!isWallMounted) interactableObjects.push(group);

        // Selection indicator (hidden by default)
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        // Product label (follows group world position)
        if (!isWallMounted) {
          const lTex = makeLabelTex(item.name || item.sku);
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
          const ls = Math.min(dispW * 1.1, 4.5);
          label.scale.set(ls, ls * 0.11, 1);
          label.position.set(wx, scaledSize.y + 0.35, wz);
          scene.add(label);
          addContactShadow(scene, contactShadowTex, wx, wz, dispW, dispD);
        }
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
        group.userData = { id: item.id, hasImage: true, isWallMounted };
        itemGroupMapRef.current.set(item.id, group);
        group.add(box);

        placeItemGroup(group, item, wx, wz, pH / 2, { x: pW, y: pH, z: boxDepth }, isWallMounted, bW, bD);

        // Selection indicator
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        scene.add(group);
        if (!isWallMounted) interactableObjects.push(group);

        if (!isWallMounted) {
          const lTex = makeLabelTex(item.name || item.sku);
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
          const ls = Math.min(pW * 1.1, 4.5);
          label.scale.set(ls, ls * 0.11, 1);
          label.position.set(wx, pH + 0.35, wz);
          scene.add(label);
          addContactShadow(scene, contactShadowTex, wx, wz, pW, boxDepth);
        }
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
        group.userData = { id: item.id, isPlaceholder: true, isWallMounted };
        itemGroupMapRef.current.set(item.id, group);
        group.add(box);
        box.castShadow = true;
        box.receiveShadow = true;

        placeItemGroup(group, item, wx, wz, itemH / 2, { x: dispW, y: itemH, z: boxDepth }, isWallMounted, bW, bD);

        // Selection indicator
        const boxHelper = new THREE.BoxHelper(group, 0x3b82f6);
        boxHelper.visible = false;
        group.add(boxHelper);

        scene.add(group);
        if (!isWallMounted) interactableObjects.push(group);

        if (!isWallMounted) {
          const lTex = makeLabelTex(item.name || item.sku);
          const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: lTex, transparent: true, opacity: 0.95 }));
          const ls = Math.min(dispW * 1.1, 4.5);
          label.scale.set(ls, ls * 0.11, 1);
          label.position.set(wx, itemH + 0.35, wz);
          scene.add(label);
          addContactShadow(scene, contactShadowTex, wx, wz, dispW, Math.max(0.5, dispD));
        }
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
        // Stamp the rendered items so subsequent position-only changes use incremental path
        prevSceneItemsRef.current = sceneData.items || [];
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
      controls.zoomSpeed = 3.5; // Much faster scroll zoom
      // Zoom limits — can zoom in close but not through the floor
      controls.minDistance = 2;
      controls.maxDistance = Math.max(bW, bD) * 4;
      // Angle limits — don't go below floor or straight up
      controls.minPolarAngle = 0.1; // Just above horizon
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
      controls.update();

      // ── DRAG & DROP SYSTEM ──
      // pendingObj: candidate for drag or click (decided after movement threshold)
      let pendingObj = null;
      let pointerDownPos = { x: 0, y: 0 };
      let draggedObject = null;
      let dragOffset = new THREE.Vector3();
      const DRAG_THRESHOLD = 6; // px — under this = click, over = drag
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let hoveredObject = null;
      // Currently selected object (persists after click)
      let selectedObject = null;

      const el = renderer.domElement;

      const getNDC = (e) => {
        const rect = el.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1
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

      const selectObject = (obj) => {
        hideAllBoxHelpers();
        selectedObject = obj;
        if (obj) {
          showBoxHelper(obj, 0x3b82f6);
          const id = obj.userData.id;
          const item = sceneData.items?.find(i => i.id === id);
          setSelectedItemRef.current({
            id,
            name: item?.name || item?.sku || id,
            mountType: item?.mountType || 'floor',
          });
        } else {
          setSelectedItemRef.current(null);
        }
      };

      // ── POINTER DOWN ──
      const onDown = (e) => {
        const ndc = getNDC(e);
        const obj = findInteractable(ndc);
        if (obj) {
          pendingObj = obj;
          pointerDownPos = { x: e.clientX, y: e.clientY };
          controls.enabled = false;
          el.style.cursor = 'grabbing';
          // Pre-compute drag offset for if this becomes a drag
          mouse.set(ndc.x, ndc.y);
          raycaster.setFromCamera(mouse, camera);
          const hit = new THREE.Vector3();
          raycaster.ray.intersectPlane(dragPlane, hit);
          dragOffset.copy(hit.lengthSq() > 0 ? hit.sub(obj.position) : new THREE.Vector3());
        } else {
          // Clicked empty space — deselect
          selectObject(null);
        }
      };

      // ── POINTER MOVE ──
      const onMove = (e) => {
        if (pendingObj && !draggedObject) {
          const dx = Math.abs(e.clientX - pointerDownPos.x);
          const dy = Math.abs(e.clientY - pointerDownPos.y);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            // Threshold crossed — commit to drag
            draggedObject = pendingObj;
            showBoxHelper(draggedObject, 0x22c55e); // Green while dragging
          }
        }

        if (draggedObject) {
          const ndc = getNDC(e);
          mouse.set(ndc.x, ndc.y);
          raycaster.setFromCamera(mouse, camera);
          const hit = new THREE.Vector3();
          raycaster.ray.intersectPlane(dragPlane, hit);
          if (hit.lengthSq() > 0) {
            const newPos = hit.sub(dragOffset);
            const halfW = bW / 2 - 0.5;
            const halfD = bD / 2 - 0.5;
            draggedObject.position.x = Math.max(-halfW, Math.min(halfW, newPos.x));
            draggedObject.position.z = Math.max(-halfD, Math.min(halfD, newPos.z));
          }
          return;
        }

        // Hover highlight (only when nothing pressed)
        if (!e.buttons && !pendingObj) {
          const ndc = getNDC(e);
          const obj = findInteractable(ndc);
          if (obj !== hoveredObject) {
            // Restore selected item highlight, then apply hover
            hideAllBoxHelpers();
            if (selectedObject) showBoxHelper(selectedObject, 0x3b82f6);
            hoveredObject = obj;
            if (obj && obj !== selectedObject) {
              showBoxHelper(obj, 0x94a3b8); // Muted blue hover
              el.style.cursor = 'grab';
            } else {
              el.style.cursor = obj === selectedObject ? 'grab' : 'default';
            }
          }
        }
      };

      // ── POINTER UP ──
      const onUp = (e) => {
        if (pendingObj && !draggedObject) {
          // It was a click — select (or deselect if same item)
          if (selectedObject === pendingObj) {
            selectObject(null);
          } else {
            selectObject(pendingObj);
          }
        } else if (draggedObject) {
          // Drop — fire move callback
          if (onMoveItem) {
            const newX = draggedObject.position.x + bW / 2;
            const newY = -draggedObject.position.z + bD / 2;
            onMoveItem(draggedObject.userData.id, newX, newY);
          }
          // Keep selection on the dragged item
          if (draggedObject !== selectedObject) {
            selectObject(draggedObject);
          } else {
            showBoxHelper(draggedObject, 0x3b82f6);
          }
        }

        pendingObj = null;
        draggedObject = null;
        controls.enabled = true;
        el.style.cursor = hoveredObject ? 'grab' : 'default';
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
      if (scene && scene.environment) scene.environment.dispose();
      window.removeEventListener('keydown', () => {});
      window.removeEventListener('keyup', () => {});
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
  }, [sceneJson, brandIdentity, boothSize, boothType, width, height, interactive, autoSnapshot]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden" style={{ touchAction: 'none' }}>
      {status === 'error' ? (
        <div className="text-red-500 dark:text-red-400 p-6 text-center text-sm">
          <p className="font-semibold mb-1">Render Error</p>
          <p className="text-slate-500">{errorMsg}</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="w-full h-full [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:block" />

          {/* ── Selected Item Controls ── */}
          {interactive && status === 'ready' && selectedItem && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl px-3 py-2 shadow-xl border border-blue-200 dark:border-blue-700 z-40 animate-in slide-in-from-top-2 duration-150">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[160px]">
                {selectedItem.name}
              </span>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1" />
              {selectedItem.mountType === 'floor' && (
                <button
                  onClick={() => onRotateItem?.(selectedItem.id, 90)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Rotate 90°"
                >
                  ↻ Rotate
                </button>
              )}
              <button
                onClick={() => {
                  const next = selectedItem.mountType === 'floor' ? 'wall_back' : 'floor';
                  onToggleWallMount?.(selectedItem.id, next);
                  setSelectedItem(s => s ? { ...s, mountType: next } : null);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedItem.mountType !== 'floor'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={selectedItem.mountType !== 'floor' ? 'Move to floor' : 'Mount to back wall'}
              >
                {selectedItem.mountType !== 'floor' ? '⬇ Floor' : '⬆ Wall'}
              </button>
              <button
                onClick={() => { onRemoveItem?.(selectedItem.id); setSelectedItem(null); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="Remove from booth"
              >
                ✕ Remove
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                className="ml-1 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs transition-colors"
                title="Deselect"
              >
                ×
              </button>
            </div>
          )}

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