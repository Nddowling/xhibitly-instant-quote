import * as THREE from 'three';

// Contact shadow — soft circular shadow blob under products
export function makeContactShadowTex(sz = 128) {
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
export function makeGridTex(widthFt, depthFt, pxPerFt = 64) {
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

export function makeCarpetTex(color, sz = 512) {
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

export function makeAisleTex(sz = 512) {
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

export function makeBackwallTex(brand, bW, WALL_H = 8) {
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

export function makeDrapeTex(sz = 512) {
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

export function makeConcreteFloorTex(sz = 512) {
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

export function makeHallCeilingTex(sz = 512) {
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

export function makeHallWallTex(sz = 512) {
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

export function makeLabelTex(name, tw = 512, th = 72) {
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

export function makePlaceholderTex(name, color, tw = 512, th = 512) {
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