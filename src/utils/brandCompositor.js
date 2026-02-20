/**
 * XHIBITLY Brand Compositor v1.0
 * 
 * Composites real logos and text onto AI-generated booth renders.
 * 
 * STRATEGY:
 * 1. Image gen renders booth with solid-color MARKER ZONES where logos go
 * 2. This module detects those markers in the rendered image
 * 3. Extracts the quadrilateral shape of each marker (perspective-projected rectangle)
 * 4. Warps the real logo to fit that quadrilateral shape
 * 5. Composites the warped logo onto the render
 * 
 * MARKER COLORS (chosen to never appear in realistic renders):
 * - Backwall main logo:  #FF00FF (magenta)
 * - Counter logo:        #00FFFF (cyan)
 * - Left banner:         #FFFF00 (yellow)
 * - Right banner:        #FF8800 (orange)
 */

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const MARKER_ZONES = {
  BACKWALL:      { color: '#FF00FF', label: 'Backwall Main Logo',  r: 255, g: 0,   b: 255 },
  COUNTER:       { color: '#00FFFF', label: 'Counter Logo',        r: 0,   g: 255, b: 255 },
  LEFT_BANNER:   { color: '#FFFF00', label: 'Left Banner Logo',    r: 255, g: 255, b: 0   },
  RIGHT_BANNER:  { color: '#FF8800', label: 'Right Banner Logo',   r: 255, g: 136, b: 0   },
};

// How close a pixel needs to be to a marker color (euclidean RGB distance)
// JPEG compression and AI rendering introduce color drift — keep this generous
const DETECTION_THRESHOLD = 65;

// Minimum marker area as fraction of total image area (reject tiny noise)
const MIN_MARKER_AREA_RATIO = 0.002;

// Mesh subdivision for perspective warp (higher = smoother but slower)
const WARP_GRID_SIZE = 12;

// ═══════════════════════════════════════════════════════════════
// IMAGE LOADING
// ═══════════════════════════════════════════════════════════════

/**
 * Load an image into an HTMLImageElement with CORS support.
 * Returns a promise that resolves to the loaded Image.
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Draw an image to a Canvas and return the ImageData (pixel array).
 */
function imageToPixels(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return {
    canvas,
    ctx,
    imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
    width: canvas.width,
    height: canvas.height
  };
}

// ═══════════════════════════════════════════════════════════════
// MARKER DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Scan the image for pixels matching a marker color.
 * Returns a binary mask (Uint8Array) where 1 = marker pixel.
 */
function detectMarkerPixels(imageData, markerR, markerG, markerB, width, height) {
  const data = imageData.data; // RGBA flat array
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const ri = i * 4;
    const dr = data[ri] - markerR;
    const dg = data[ri + 1] - markerG;
    const db = data[ri + 2] - markerB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < DETECTION_THRESHOLD) {
      mask[i] = 1;
    }
  }

  return mask;
}

/**
 * Morphological operations to clean up the mask.
 * Erode removes single-pixel noise, dilate fills small gaps.
 */
function cleanMask(mask, width, height) {
  // Erode (3x3) — remove isolated pixels
  const eroded = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Pixel survives erosion if it and its 4 cardinal neighbors are set
      if (mask[idx] &&
          mask[idx - 1] && mask[idx + 1] &&
          mask[idx - width] && mask[idx + width]) {
        eroded[idx] = 1;
      }
    }
  }

  // Dilate (3x3) — fill small holes
  const dilated = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (eroded[idx] ||
          eroded[idx - 1] || eroded[idx + 1] ||
          eroded[idx - width] || eroded[idx + width]) {
        dilated[idx] = 1;
      }
    }
  }

  return dilated;
}

/**
 * Find connected components in a binary mask using flood fill.
 * Returns array of components, each with: { pixels: Set<index>, area, bounds }.
 */
function findConnectedComponents(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let i = 0; i < width * height; i++) {
    if (mask[i] && !visited[i]) {
      // BFS flood fill
      const component = { pixels: new Set(), area: 0, bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity } };
      const queue = [i];
      visited[i] = 1;

      while (queue.length > 0) {
        const idx = queue.shift();
        const x = idx % width;
        const y = Math.floor(idx / width);

        component.pixels.add(idx);
        component.area++;
        component.bounds.minX = Math.min(component.bounds.minX, x);
        component.bounds.minY = Math.min(component.bounds.minY, y);
        component.bounds.maxX = Math.max(component.bounds.maxX, x);
        component.bounds.maxY = Math.max(component.bounds.maxY, y);

        // Check 4 neighbors
        const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
        for (const n of neighbors) {
          if (n >= 0 && n < width * height && mask[n] && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }

      components.push(component);
    }
  }

  return components;
}

/**
 * Extract the 4 corners of a quadrilateral from a component's pixel mask.
 * 
 * Strategy: scan the top row and bottom row of the component's bounding box
 * to find the leftmost/rightmost marker pixels. These give us the 4 corners
 * of the perspective-projected rectangle.
 */
function extractQuadCorners(component, mask, width) {
  const { bounds } = component;
  const { minX, minY, maxX, maxY } = bounds;
  const h = maxY - minY;

  // Find leftmost and rightmost marker pixels in the top ~10% of rows
  const topBand = Math.max(1, Math.floor(h * 0.1));
  let topLeft = { x: Infinity, y: minY };
  let topRight = { x: -Infinity, y: minY };

  for (let y = minY; y <= minY + topBand; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * width + x]) {
        if (x < topLeft.x) { topLeft = { x, y }; }
        if (x > topRight.x) { topRight = { x, y }; }
      }
    }
  }

  // Find leftmost and rightmost marker pixels in the bottom ~10% of rows
  let bottomLeft = { x: Infinity, y: maxY };
  let bottomRight = { x: -Infinity, y: maxY };

  for (let y = maxY - topBand; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * width + x]) {
        if (x < bottomLeft.x) { bottomLeft = { x, y }; }
        if (x > bottomRight.x) { bottomRight = { x, y }; }
      }
    }
  }

  // Refine: walk down left edge to find actual top-left and bottom-left
  // This handles non-rectangular shapes better
  const refinedTopLeft = refineCorner(mask, width, minX, maxX, minY, maxY, 'top-left');
  const refinedTopRight = refineCorner(mask, width, minX, maxX, minY, maxY, 'top-right');
  const refinedBottomLeft = refineCorner(mask, width, minX, maxX, minY, maxY, 'bottom-left');
  const refinedBottomRight = refineCorner(mask, width, minX, maxX, minY, maxY, 'bottom-right');

  return {
    topLeft: refinedTopLeft || topLeft,
    topRight: refinedTopRight || topRight,
    bottomLeft: refinedBottomLeft || bottomLeft,
    bottomRight: refinedBottomRight || bottomRight,
  };
}

function refineCorner(mask, width, minX, maxX, minY, maxY, corner) {
  const scanSize = Math.max(3, Math.floor((maxY - minY) * 0.15));

  switch (corner) {
    case 'top-left': {
      for (let y = minY; y <= minY + scanSize; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (mask[y * width + x]) return { x, y };
        }
      }
      return null;
    }
    case 'top-right': {
      for (let y = minY; y <= minY + scanSize; y++) {
        for (let x = maxX; x >= minX; x--) {
          if (mask[y * width + x]) return { x, y };
        }
      }
      return null;
    }
    case 'bottom-left': {
      for (let y = maxY; y >= maxY - scanSize; y--) {
        for (let x = minX; x <= maxX; x++) {
          if (mask[y * width + x]) return { x, y };
        }
      }
      return null;
    }
    case 'bottom-right': {
      for (let y = maxY; y >= maxY - scanSize; y--) {
        for (let x = maxX; x >= minX; x--) {
          if (mask[y * width + x]) return { x, y };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// PERSPECTIVE WARP (Mesh Subdivision)
// ═══════════════════════════════════════════════════════════════

/**
 * Bilinear interpolation within a quadrilateral.
 * Given normalized coords (u, v) in [0,1], returns the point
 * inside the quad defined by 4 corners.
 */
function bilinearInterp(tl, tr, bl, br, u, v) {
  const top = { x: tl.x + (tr.x - tl.x) * u, y: tl.y + (tr.y - tl.y) * u };
  const bot = { x: bl.x + (br.x - bl.x) * u, y: bl.y + (br.y - bl.y) * u };
  return {
    x: top.x + (bot.x - top.x) * v,
    y: top.y + (bot.y - top.y) * v
  };
}

/**
 * Draw a source image onto a destination canvas, warped to fit
 * inside a target quadrilateral. Uses mesh subdivision with
 * affine transforms per triangle.
 * 
 * @param {CanvasRenderingContext2D} destCtx - destination canvas context
 * @param {HTMLImageElement} srcImg - source image (logo) to warp
 * @param {Object} quad - { topLeft, topRight, bottomLeft, bottomRight } in dest coords
 * @param {number} gridSize - subdivision level (default WARP_GRID_SIZE)
 * @param {number} padding - inset from quad edges as fraction (0-0.5), gives margin
 */
function perspectiveWarp(destCtx, srcImg, quad, gridSize = WARP_GRID_SIZE, padding = 0.08) {
  const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = quad;
  const sw = srcImg.width;
  const sh = srcImg.height;

  // Apply padding (inset from edges)
  const padTL = bilinearInterp(tl, tr, bl, br, padding, padding);
  const padTR = bilinearInterp(tl, tr, bl, br, 1 - padding, padding);
  const padBL = bilinearInterp(tl, tr, bl, br, padding, 1 - padding);
  const padBR = bilinearInterp(tl, tr, bl, br, 1 - padding, 1 - padding);

  // Calculate aspect ratio of the quad vs the source image
  // Adjust to maintain logo aspect ratio within the quad
  const quadWidth = Math.max(
    Math.sqrt((padTR.x - padTL.x) ** 2 + (padTR.y - padTL.y) ** 2),
    Math.sqrt((padBR.x - padBL.x) ** 2 + (padBR.y - padBL.y) ** 2)
  );
  const quadHeight = Math.max(
    Math.sqrt((padBL.x - padTL.x) ** 2 + (padBL.y - padTL.y) ** 2),
    Math.sqrt((padBR.x - padTR.x) ** 2 + (padBR.y - padTR.y) ** 2)
  );

  const quadAspect = quadWidth / quadHeight;
  const srcAspect = sw / sh;

  // Fit the logo within the quad preserving aspect ratio
  let uMin = 0, uMax = 1, vMin = 0, vMax = 1;
  if (srcAspect > quadAspect) {
    // Logo is wider — shrink vertically, center
    const scale = quadAspect / srcAspect;
    const offset = (1 - scale) / 2;
    vMin = offset;
    vMax = 1 - offset;
  } else {
    // Logo is taller — shrink horizontally, center
    const scale = srcAspect / quadAspect;
    const offset = (1 - scale) / 2;
    uMin = offset;
    uMax = 1 - offset;
  }

  // Use padded quad for actual warping
  const pTL = padTL, pTR = padTR, pBL = padBL, pBR = padBR;

  destCtx.save();

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Normalized coords for this cell
      const u0 = col / gridSize;
      const v0 = row / gridSize;
      const u1 = (col + 1) / gridSize;
      const v1 = (row + 1) / gridSize;

      // Destination points (in the quad)
      const d00 = bilinearInterp(pTL, pTR, pBL, pBR, u0, v0);
      const d10 = bilinearInterp(pTL, pTR, pBL, pBR, u1, v0);
      const d01 = bilinearInterp(pTL, pTR, pBL, pBR, u0, v1);
      const d11 = bilinearInterp(pTL, pTR, pBL, pBR, u1, v1);

      // Source points (in the logo image)
      const su0 = uMin + (uMax - uMin) * u0;
      const sv0 = vMin + (vMax - vMin) * v0;
      const su1 = uMin + (uMax - uMin) * u1;
      const sv1 = vMin + (vMax - vMin) * v1;

      const sx0 = su0 * sw;
      const sy0 = sv0 * sh;
      const sx1 = su1 * sw;
      const sy1 = sv1 * sh;

      // Draw two triangles for this cell
      drawTexturedTriangle(destCtx, srcImg,
        sx0, sy0, sx1, sy0, sx0, sy1,  // source triangle 1
        d00.x, d00.y, d10.x, d10.y, d01.x, d01.y  // dest triangle 1
      );
      drawTexturedTriangle(destCtx, srcImg,
        sx1, sy0, sx1, sy1, sx0, sy1,  // source triangle 2
        d10.x, d10.y, d11.x, d11.y, d01.x, d01.y  // dest triangle 2
      );
    }
  }

  destCtx.restore();
}

/**
 * Draw a textured triangle using Canvas 2D affine transform.
 * Maps source triangle (in image coords) to destination triangle (on canvas).
 */
function drawTexturedTriangle(ctx, img,
  sx0, sy0, sx1, sy1, sx2, sy2,
  dx0, dy0, dx1, dy1, dx2, dy2) {

  ctx.save();

  // Clip to destination triangle
  ctx.beginPath();
  ctx.moveTo(dx0, dy0);
  ctx.lineTo(dx1, dy1);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();

  // Compute affine transform: source triangle → destination triangle
  // | sx0 sy0 1 |   | a c e |   | dx0 dy0 |
  // | sx1 sy1 1 | × | b d f | = | dx1 dy1 |
  // | sx2 sy2 1 |                | dx2 dy2 |

  const denom = (sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1));
  if (Math.abs(denom) < 0.001) {
    ctx.restore();
    return; // Degenerate triangle
  }

  const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
  const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
  const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
  const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
  const e = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / denom;
  const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / denom;

  ctx.setTransform(a, b, c, d, e, f);
  
  // Draw the source image — the transform + clip handles the mapping
  // Add a small bleed to prevent hairline gaps between triangles
  ctx.drawImage(img, 0, 0);

  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// TEXT RENDERING
// ═══════════════════════════════════════════════════════════════

/**
 * Render company name text as an image, suitable for warping.
 * Returns a Canvas element with the text rendered.
 */
function renderTextToCanvas(text, color, fontFamily = 'Arial, Helvetica, sans-serif') {
  // Create a canvas big enough for the text
  const testCanvas = document.createElement('canvas');
  const testCtx = testCanvas.getContext('2d');
  
  const fontSize = 120; // Render at high res, will be scaled by warp
  testCtx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = testCtx.measureText(text);
  
  const padding = fontSize * 0.3;
  const w = Math.ceil(metrics.width + padding * 2);
  const h = Math.ceil(fontSize * 1.4 + padding * 2);
  
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, w, h);
  
  // Draw text
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color || '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  
  return canvas;
}

// ═══════════════════════════════════════════════════════════════
// MARKER ZONE FILL (clean up marker color in final image)
// ═══════════════════════════════════════════════════════════════

/**
 * Replace marker-colored pixels with a blended fill color.
 * This ensures any marker pixels not covered by the logo
 * are filled with the brand color instead of magenta/cyan.
 */
function fillMarkerZone(ctx, mask, width, fillColor) {
  const imageData = ctx.getImageData(0, 0, width, ctx.canvas.height);
  const data = imageData.data;
  
  const rgb = hexToRgbObj(fillColor);
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      const ri = i * 4;
      data[ri] = rgb.r;
      data[ri + 1] = rgb.g;
      data[ri + 2] = rgb.b;
      // Keep alpha
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

function hexToRgbObj(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPOSITOR
// ═══════════════════════════════════════════════════════════════

/**
 * Detect all marker zones in a rendered booth image.
 * 
 * @param {string} imageUrl - URL of the AI-generated booth render
 * @returns {Promise<Object>} - Map of zone name → { quad, mask, area }
 */
export async function detectZones(imageUrl) {
  const img = await loadImage(imageUrl);
  const { imageData, width, height } = imageToPixels(img);
  const totalArea = width * height;
  const minArea = totalArea * MIN_MARKER_AREA_RATIO;

  const zones = {};

  for (const [zoneName, marker] of Object.entries(MARKER_ZONES)) {
    const rawMask = detectMarkerPixels(imageData, marker.r, marker.g, marker.b, width, height);
    const cleanedMask = cleanMask(rawMask, width, height);
    const components = findConnectedComponents(cleanedMask, width, height);

    // Take the largest component that meets minimum area
    const validComponents = components
      .filter(c => c.area >= minArea)
      .sort((a, b) => b.area - a.area);

    if (validComponents.length > 0) {
      const component = validComponents[0];
      const quad = extractQuadCorners(component, cleanedMask, width);

      zones[zoneName] = {
        quad,
        mask: cleanedMask,
        area: component.area,
        bounds: component.bounds,
        label: marker.label,
      };

      console.log(`[Compositor] Found ${marker.label}: ${component.area}px (${(component.area / totalArea * 100).toFixed(1)}%)`);
    }
  }

  return { zones, imageWidth: width, imageHeight: height };
}

/**
 * Composite brand logo and optionally company name onto a booth render.
 * 
 * @param {string} renderUrl - URL of the AI-generated booth render (with marker zones)
 * @param {Object} brandIdentity - { logo_url, company_name, primary_color, secondary_color }
 * @param {Object} options - { renderText: bool, textColor: string, fontFamily: string }
 * @returns {Promise<string>} - Data URL of the composited image
 */
export async function compositeBrand(renderUrl, brandIdentity, options = {}) {
  const {
    renderText = false,
    textColor = '#FFFFFF',
    fontFamily = 'Arial, Helvetica, sans-serif',
  } = options;

  console.log('[Compositor] Starting brand compositing...');

  // 1. Load the rendered booth image
  const renderImg = await loadImage(renderUrl);
  const { canvas, ctx, imageData, width, height } = imageToPixels(renderImg);

  // 2. Detect marker zones
  const { zones } = await detectZones(renderUrl);
  const zoneNames = Object.keys(zones);

  if (zoneNames.length === 0) {
    console.warn('[Compositor] No marker zones detected. Returning original image.');
    return canvas.toDataURL('image/png');
  }

  console.log(`[Compositor] Found ${zoneNames.length} zone(s): ${zoneNames.join(', ')}`);

  // 3. Load the logo (if available)
  let logoImg = null;
  if (brandIdentity.logo_url) {
    try {
      logoImg = await loadImage(brandIdentity.logo_url);
      console.log(`[Compositor] Logo loaded: ${logoImg.width}x${logoImg.height}`);
    } catch (err) {
      console.warn('[Compositor] Could not load logo, will use text fallback:', err.message);
    }
  }

  // 4. Render company name as text image (fallback or supplementary)
  let textImg = null;
  if ((!logoImg || renderText) && brandIdentity.company_name) {
    const textCanvas = renderTextToCanvas(
      brandIdentity.company_name,
      textColor,
      fontFamily
    );
    // Convert canvas to Image for the warp function
    textImg = new Image();
    textImg.src = textCanvas.toDataURL();
    await new Promise(r => { textImg.onload = r; });
  }

  // 5. Fill marker zones with brand color, then warp logo/text on top
  for (const [zoneName, zone] of Object.entries(zones)) {
    const { quad, mask } = zone;

    // Decide which brand color to use for the fill
    const fillColor = (zoneName === 'BACKWALL' || zoneName === 'LEFT_BANNER' || zoneName === 'RIGHT_BANNER')
      ? brandIdentity.primary_color
      : brandIdentity.secondary_color;

    // Fill the marker zone with brand color first (replaces magenta/cyan)
    fillMarkerZone(ctx, mask, width, fillColor);

    // Determine what to warp into this zone
    const sourceImg = logoImg || textImg;
    if (!sourceImg) continue;

    // Warp the logo/text into the quadrilateral
    try {
      perspectiveWarp(ctx, sourceImg, quad, WARP_GRID_SIZE);
      console.log(`[Compositor] Warped ${logoImg ? 'logo' : 'text'} into ${zone.label}`);
    } catch (err) {
      console.error(`[Compositor] Warp failed for ${zone.label}:`, err);
    }

    // If we have both logo and text, and this is the backwall, also add text below
    if (logoImg && textImg && zoneName === 'BACKWALL') {
      // Create a sub-zone in the lower portion for text
      const textQuad = {
        topLeft:     bilinearInterp(quad.topLeft, quad.topRight, quad.bottomLeft, quad.bottomRight, 0.15, 0.72),
        topRight:    bilinearInterp(quad.topLeft, quad.topRight, quad.bottomLeft, quad.bottomRight, 0.85, 0.72),
        bottomLeft:  bilinearInterp(quad.topLeft, quad.topRight, quad.bottomLeft, quad.bottomRight, 0.15, 0.95),
        bottomRight: bilinearInterp(quad.topLeft, quad.topRight, quad.bottomLeft, quad.bottomRight, 0.85, 0.95),
      };
      try {
        perspectiveWarp(ctx, textImg, textQuad, 8, 0.02);
        console.log(`[Compositor] Added text below logo on ${zone.label}`);
      } catch (err) {
        // Text overlay is supplementary, don't fail on it
      }
    }
  }

  // 6. Return the composited image
  const result = canvas.toDataURL('image/jpeg', 0.92);
  console.log('[Compositor] Compositing complete.');
  return result;
}

// ═══════════════════════════════════════════════════════════════
// PROMPT HELPERS — Use these in Loading.jsx image prompt
// ═══════════════════════════════════════════════════════════════

/**
 * Returns the image prompt instructions for marker zone placement.
 * Append this to the existing image generation prompt.
 */
export function getMarkerPromptInstructions() {
  return `
CRITICAL LOGO/TEXT RENDERING INSTRUCTIONS:
Do NOT render any text, letters, words, logos, wordmarks, company names, or signage on ANY surface.
Instead, place FLAT, SOLID COLOR rectangles in the following locations:

1. BACKWALL MAIN LOGO ZONE: Place a solid MAGENTA (#FF00FF) rectangle in the CENTER of the main backwall where a company logo would go. This rectangle should be roughly 40-60% of the backwall width and 20-30% of its height. The rectangle must be perfectly flat solid #FF00FF with no gradients, shadows, or textures.

2. COUNTER LOGO ZONE: Place a solid CYAN (#00FFFF) rectangle on the front face of the reception counter where a logo panel would go. Roughly 60-80% of the counter face. Flat solid #00FFFF.

3. LEFT BANNER (if design includes a left-side banner/retractable stand): Place a solid YELLOW (#FFFF00) rectangle filling the banner graphic area. Flat solid #FFFF00.

4. RIGHT BANNER (if design includes a right-side banner/retractable stand): Place a solid ORANGE (#FF8800) rectangle filling the banner graphic area. Flat solid #FF8800.

ALL other surfaces should be rendered with the brand's actual colors as specified above.
These colored rectangles are placement markers — real logos will be composited programmatically.
The rectangles MUST be flat solid color with clearly defined edges. No gradients, no text, no effects.`;
}

/**
 * Returns the complete set of marker colors as a map for debugging/visualization.
 */
export function getMarkerColorMap() {
  return Object.fromEntries(
    Object.entries(MARKER_ZONES).map(([k, v]) => [k, v.color])
  );
}
