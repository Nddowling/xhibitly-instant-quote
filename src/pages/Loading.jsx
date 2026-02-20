import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, CheckCircle, Palette, Layers, Lightbulb, ShieldCheck } from 'lucide-react';
import { enforceAllDesigns } from '../components/utils/boothRulesEngine';

// ═══════════════════════════════════════════════════════════════
// BRAND EXTRACTION — VALIDATION UTILITIES
// Fixes: legacy names, platform color bleed, weak logos,
//        near-duplicate colors, broken logo URLs
// ═══════════════════════════════════════════════════════════════

// Xhibitly platform reds — NEVER allow these into a client brand
const PLATFORM_COLORS = [
  "#e2231a", "#b01b13", "#0f1d2e", "#ff0000", "#cc0000",
  "#ee2222", "#dd1111", "#bb1111", "#aa0000", "#990000",
  "#ff1111", "#ee0000", "#dd0000", "#c0392b", "#e74c3c"
];

// Known government agency rebrandings
const LEGACY_NAMES = {
  "deo": "FloridaCommerce",
  "florida department of economic opportunity": "FloridaCommerce",
  "department of economic opportunity": "FloridaCommerce",
  "enterprise florida": "FloridaCommerce",
};

const DOMAIN_NAME_MAP = {
  "floridajobs.org": "FloridaCommerce",
  "floridacommerce.com": "FloridaCommerce",
};

function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") return null;
  let h = hex.replace(/^#/, "").toLowerCase().trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return "#" + h;
}

function hexToRgb(hex) {
  const h = (normalizeHex(hex) || "#000000").replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + [r, g, b].map(c => clamp(c).toString(16).padStart(2, "0")).join("");
}

function colorDistance(hex1, hex2) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function isPlatformColorBleed(hex, threshold = 45) {
  const n = normalizeHex(hex);
  if (!n) return true;
  return PLATFORM_COLORS.some(pc => colorDistance(n, pc) < threshold);
}

function areColorsTooSimilar(hex1, hex2, threshold = 30) {
  if (!hex1 || !hex2) return false;
  return colorDistance(hex1, hex2) < threshold;
}

function darkenColor(hex, amount = 40) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.r - amount, rgb.g - amount, rgb.b - amount);
}

function lightenColor(hex, amount = 40) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.r + amount, rgb.g + amount, rgb.b + amount);
}

function validateCompanyName(brand, websiteUrl) {
  const result = { ...brand };
  const nameLower = (result.company_name || "").toLowerCase().trim();

  for (const [legacy, current] of Object.entries(LEGACY_NAMES)) {
    if (nameLower === legacy || nameLower.includes(legacy)) {
      console.log(`[Brand] Name correction: "${result.company_name}" → "${current}"`);
      result.company_name_former = result.company_name;
      result.company_name = current;
      break;
    }
  }

  for (const [domain, expectedName] of Object.entries(DOMAIN_NAME_MAP)) {
    if (websiteUrl.includes(domain) && result.company_name !== expectedName) {
      const currentLower = result.company_name.toLowerCase();
      if (currentLower.includes("economic opportunity") || currentLower.includes("deo") || !currentLower) {
        console.log(`[Brand] Domain-based correction: "${result.company_name}" → "${expectedName}"`);
        if (result.company_name) result.company_name_former = result.company_name;
        result.company_name = expectedName;
      }
    }
  }

  return result;
}

function validateColors(brand) {
  const result = { ...brand };
  const fields = ["primary_color", "secondary_color", "accent_color_1", "accent_color_2"];
  const issues = [];

  // Pass 1: Normalize and flag problems
  fields.forEach(field => {
    const normalized = normalizeHex(result[field]);
    if (!normalized) {
      issues.push({ field, issue: "invalid_format", original: result[field] });
      result[field] = null;
      return;
    }
    if (isPlatformColorBleed(normalized)) {
      issues.push({ field, issue: "platform_bleed", original: normalized });
      result[field] = null;
      return;
    }
    result[field] = normalized;
  });

  // Pass 2: Deduplicate near-identical colors
  const validFields = fields.filter(f => result[f] !== null);
  for (let i = 0; i < validFields.length; i++) {
    for (let j = i + 1; j < validFields.length; j++) {
      if (areColorsTooSimilar(result[validFields[i]], result[validFields[j]])) {
        issues.push({ field: validFields[j], issue: "too_similar", original: result[validFields[j]] });
        result[validFields[j]] = null;
      }
    }
  }

  // Pass 3: Repair nulled colors from surviving palette
  const surviving = fields.filter(f => result[f] !== null);
  if (surviving.length === 0) {
    console.log("[Brand] WARNING: All colors failed. Applying neutral defaults.");
    result.primary_color = "#003b71";
    result.secondary_color = "#0066b3";
    result.accent_color_1 = "#f7941d";
    result.accent_color_2 = "#ffffff";
  } else {
    const baseColor = result[surviving[0]];
    const repairs = [lightenColor(baseColor, 50), darkenColor(baseColor, 50), lightenColor(baseColor, 100), "#ffffff"];
    let repairIdx = 0;
    fields.forEach(field => {
      if (result[field] === null) {
        let repairColor = null;
        while (repairIdx < repairs.length) {
          const candidate = repairs[repairIdx++];
          const tooClose = fields.some(f => result[f] !== null && areColorsTooSimilar(result[f], candidate));
          if (!tooClose && !isPlatformColorBleed(candidate)) { repairColor = candidate; break; }
        }
        result[field] = repairColor || "#ffffff";
        console.log(`[Brand] Repaired ${field}: ${result[field]}`);
      }
    });
  }

  if (issues.length > 0) console.log("[Brand] Color issues fixed:", issues);
  return result;
}

function validateLogo(brand) {
  const result = { ...brand };
  const url = result.logo_url || "";
  const isValidImageUrl = url.startsWith("http") && /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(url);
  const isPageUrl = url.includes("/about") || url.includes("/contact") || url.endsWith("/") || url.endsWith(".html");
  if (!isValidImageUrl || isPageUrl) {
    console.log(`[Brand] Invalid logo URL rejected: "${url}"`);
    result.logo_url = null;
  }
  return result;
}

function validateLogoDescription(brand) {
  const result = { ...brand };
  const desc = result.logo_description || "";
  const hasDetail = /text|word|letter|font|color|blue|red|green|black|white|gold|navy|shape|icon|outline|silhouette|seal|circle|map/i.test(desc);
  if (desc.length < 30 || !hasDetail) {
    result.logo_description = `Logo for "${result.company_name}". Text displays the company name in a professional sans-serif font. Primary brand color: ${result.primary_color}. ${desc}`;
    console.log("[Brand] Logo description enriched");
  }
  if (result.company_name_former && result.logo_description.includes(result.company_name_former)) {
    result.logo_description = result.logo_description.replace(new RegExp(result.company_name_former, "gi"), result.company_name);
    console.log("[Brand] Logo description: replaced legacy name");
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// BRAND EXTRACTION — MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════

const BRAND_SCHEMA = {
  type: "object",
  properties: {
    logo_url:             { type: "string" },
    logo_description:     { type: "string" },
    company_name:         { type: "string" },
    company_name_former:  { type: "string" },
    primary_color:        { type: "string" },
    secondary_color:      { type: "string" },
    accent_color_1:       { type: "string" },
    accent_color_2:       { type: "string" },
    typography_primary:   { type: "string" },
    typography_secondary: { type: "string" },
    brand_personality:    { type: "string" },
    industry:             { type: "string" },
    target_audience:      { type: "string" },
    design_style:         { type: "array", items: { type: "string" } },
    brand_essence:        { type: "string" }
  }
};

function buildBrandPrompt(websiteUrl) {
  return `Analyze this company website and extract their CURRENT brand identity.

URL: ${websiteUrl}

RULES — FOLLOW EXACTLY:

COMPANY NAME:
- Return the name EXACTLY as displayed on the CURRENT live website header/footer.
- Government agencies rebrand. If the URL says "floridajobs.org" but the site now says "FloridaCommerce", return "FloridaCommerce" — NOT any predecessor name.
- If you find a former/legacy name, put it in company_name_former. company_name must be the CURRENT name only.
- Check the <title> tag, header logo text, footer, and about page. The most recently updated source wins.

COLORS:
- Extract exactly 4 DISTINCT hex colors from the website's own CSS, logo, headers, buttons, and branded elements.
- "Distinct" means each color must be visibly different. Minimum RGB distance of 60 between any two colors.
- primary_color = dominant color in their logo and/or site header.
- secondary_color = second most prominent brand color.
- accent_color_1 and accent_color_2 = supporting colors from buttons, links, highlights.
- NEVER return pure red (#ff0000), bright red (#e2231a, #cc0000, #ee2222), or any red within RGB distance 45 of #e2231a UNLESS red is genuinely the client's primary brand color (e.g., Coca-Cola, Target). Red is our platform UI color and must not contaminate client brands.
- If the brand is government/institutional and primarily blue, all 4 colors should come from their blue/gold/gray/white palette — not red.
- Return hex format (#RRGGBB), lowercase.

LOGO:
- logo_url: direct absolute URL to the actual logo image file (.png, .jpg, .svg) from the website. Not a page URL — the image file itself.
- logo_description: describe with enough detail to RECREATE it — exact text shown, font style, icon/symbol shape and color, arrangement. This will be rendered on a trade show booth.

TYPOGRAPHY:
- Extract from CSS font-family declarations or Google Fonts imports. Return the actual font name.

Return only data from the CURRENT live website.`;
}

// ═══════════════════════════════════════════════════════════════
// BRANDFETCH API INTEGRATION
// ═══════════════════════════════════════════════════════════════

const BRANDFETCH_API_KEY = 'QgFqwUYE61C7nVi0BM2zSifQWKrTA3-Uto7zpoJ4BGf5M_9DjWUyDCc8a6LbkT-OdUjt9b5Sxskug3pZ2MhpJg';

function extractDomain(url) {
  try {
    const cleanUrl = url.replace(/^https?:\/\/(www\.)?/, '');
    const domain = cleanUrl.split('/')[0].split('?')[0];
    return domain;
  } catch {
    return url;
  }
}

async function fetchBrandfetchData(websiteUrl) {
  const domain = extractDomain(websiteUrl);
  console.log(`[Brandfetch] Fetching brand data for: ${domain}`);

  try {
    const url = `https://api.brandfetch.io/v2/brands/${domain}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BRANDFETCH_API_KEY}`
      }
    });

    if (!response.ok) {
      console.log(`[Brandfetch] API returned ${response.status}, falling back to LLM`);
      return null;
    }

    const data = await response.json();
    console.log('[Brandfetch] Successfully fetched brand data');
    return data;
  } catch (err) {
    console.error('[Brandfetch] API error:', err.message);
    return null;
  }
}

function parseBrandfetchResponse(brandfetchData) {
  if (!brandfetchData) return null;

  try {
    const result = {
      company_name: brandfetchData.name || null,
      primary_color: null,
      secondary_color: null,
      accent_color_1: null,
      accent_color_2: null,
      logo_url: null,
      logo_options: [], // NEW: Store all logo options for user selection
      logo_description: null,
      brand_personality: null,
      industry: null
    };

    // Extract colors from Brandfetch
    if (brandfetchData.colors && brandfetchData.colors.length > 0) {
      const colors = brandfetchData.colors
        .filter(c => c.hex && c.hex.startsWith('#'))
        .map(c => c.hex.toLowerCase())
        .slice(0, 4);

      if (colors[0]) result.primary_color = colors[0];
      if (colors[1]) result.secondary_color = colors[1];
      if (colors[2]) result.accent_color_1 = colors[2];
      if (colors[3]) result.accent_color_2 = colors[3];
    }

    // Extract ALL logo options from Brandfetch for user selection
    if (brandfetchData.logos && brandfetchData.logos.length > 0) {
      brandfetchData.logos.forEach(logo => {
        if (logo.formats && logo.formats.length > 0) {
          logo.formats.forEach(format => {
            if (format.src && (format.format === 'svg' || format.format === 'png')) {
              result.logo_options.push({
                url: format.src,
                format: format.format,
                width: format.width,
                height: format.height,
                type: logo.type || 'logo'
              });
            }
          });
        }
      });

      // Set default logo_url to first option
      if (result.logo_options.length > 0) {
        result.logo_url = result.logo_options[0].url;
      }
    }

    // Generate logo description from company name
    if (result.company_name) {
      result.logo_description = `Logo for ${result.company_name}. Professional corporate branding.`;
    }

    // Extract industry if available
    if (brandfetchData.industries && brandfetchData.industries.length > 0) {
      result.industry = brandfetchData.industries[0];
    }

    console.log('[Brandfetch] Parsed brand data:', {
      name: result.company_name,
      colors: [result.primary_color, result.secondary_color, result.accent_color_1, result.accent_color_2].filter(Boolean).length,
      hasLogo: !!result.logo_url,
      logoOptions: result.logo_options.length
    });

    return result;
  } catch (err) {
    console.error('[Brandfetch] Parse error:', err.message);
    return null;
  }
}

async function extractBrandIdentity(websiteUrl) {
  // Try Brandfetch API first
  const brandfetchData = await fetchBrandfetchData(websiteUrl);
  let raw = parseBrandfetchResponse(brandfetchData);

  // If Brandfetch didn't provide complete data, use LLM to fill gaps
  if (!raw || !raw.company_name || !raw.primary_color || !raw.logo_url) {
    console.log('[Brand] Brandfetch incomplete, using LLM for missing fields');

    const llmData = await base44.integrations.Core.InvokeLLM({
      prompt: buildBrandPrompt(websiteUrl),
      add_context_from_internet: true,
      response_json_schema: BRAND_SCHEMA
    });

    // Merge: prefer Brandfetch data, but fill gaps with LLM data
    raw = {
      company_name: raw?.company_name || llmData.company_name,
      primary_color: raw?.primary_color || llmData.primary_color,
      secondary_color: raw?.secondary_color || llmData.secondary_color,
      accent_color_1: raw?.accent_color_1 || llmData.accent_color_1,
      accent_color_2: raw?.accent_color_2 || llmData.accent_color_2,
      logo_url: raw?.logo_url || llmData.logo_url,
      logo_description: raw?.logo_description || llmData.logo_description,
      brand_personality: raw?.brand_personality || llmData.brand_personality,
      industry: raw?.industry || llmData.industry,
      typography_primary: llmData.typography_primary,
      typography_secondary: llmData.typography_secondary,
      target_audience: llmData.target_audience,
      design_style: llmData.design_style,
      brand_essence: llmData.brand_essence
    };
  }

  // Run validation pipeline (same as before)
  let result = validateCompanyName(raw, websiteUrl);
  result = validateColors(result);
  result = validateLogo(result);
  result = validateLogoDescription(result);

  console.log("[Brand] Extraction complete:", result.company_name);
  console.log("[Brand] Colors:", {
    primary: result.primary_color,
    secondary: result.secondary_color,
    accent1: result.accent_color_1,
    accent2: result.accent_color_2
  });
  console.log("[Brand] Logo URL:", result.logo_url);

  return result;
}

// ═══════════════════════════════════════════════════════════════
// DESIGN GENERATION — SCHEMAS & HELPERS
// ═══════════════════════════════════════════════════════════════

const PLACEMENT_GUIDE = `PLACEMENT: Backwall→flush rear. Counter→front-center or right, angled to aisle. Banners→flanking L/R entrance. Monitor/iPad→beside counter or backwall. Lighting→clamped on frame or truss. Flooring→full footprint. Towers→corners. Lit rack→beside counter.`;

const CAMERA_STYLE = `CAMERA: 3/4 elevated angle from front-left aisle. Photorealistic architectural visualization. Clean, well-lit, inviting.`;

const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    designs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tier: { type: "string" },
          design_name: { type: "string" },
          experience_story: { type: "string" },
          visitor_journey: { type: "string" },
          key_moments: { type: "array", items: { type: "string" } },
          product_skus: { type: "array", items: { type: "string" } },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                name: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
                line_total: { type: "number" }
              }
            }
          },
          design_rationale: { type: "string" },
          total_price: { type: "number" },
          spatial_layout: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_sku: { type: "string" },
                position: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } }
                },
                rotation: {
                  type: "object",
                  properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } }
                },
                scale: { type: "number" },
                branding: {
                  type: "object",
                  properties: {
                    apply_brand_color: { type: "boolean" },
                    color_zone: { type: "string" },
                    color: { type: "string" },
                    apply_logo: { type: "boolean" },
                    logo_zone: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function slimCatalog(products) {
  return products.map(p => {
    const d = p.dimensions || {};
    return {
      sku: p.manufacturer_sku || p.sku,
      name: p.display_name || p.name,
      category: p.category_name || p.category,
      geometry: p.geometry_type,
      visual: p.visual_description || p.description || '',
      price_tier: p.price_tier,
      price: p.base_price,
      rental_price: p.rental_price || null,
      is_rental: p.is_rental || false,
      is_kit: p.is_kit || false,
      kit_components: p.kit_components || null,
      dims: d.width ? `${d.width}W×${d.height}H×${d.depth}D ft` : 'standard',
      w: d.width || null,
      h: d.height || null,
      d: d.depth || null,
      style: p.design_style,
      customizable: p.customizable,
      branding_surfaces: p.branding_surfaces,
      thumb: p.thumbnail_url || p.image_url || null
    };
  });
}

function formatProfile(cp) {
  if (!cp) return 'No specific requirements provided.';
  const lines = [];
  if (cp.objectives?.length) lines.push(`Objectives: ${cp.objectives.join(', ')}`);
  lines.push(`Display products: ${cp.display_products ? 'Yes' : 'No'}`);
  lines.push(`Demo space: ${cp.needs_demo_space ? 'Required' : 'No'}`);
  lines.push(`Conference area: ${cp.needs_conference_area ? 'Required' : 'No'}`);
  if (cp.desired_look?.length) lines.push(`Look: ${cp.desired_look.join(', ')}`);
  if (cp.desired_feel?.length) lines.push(`Feel: ${cp.desired_feel.join(', ')}`);
  lines.push(`Logistics: ${cp.needs_logistics ? 'Required' : 'No'}`);
  if (cp.additional_notes) lines.push(`Notes: ${cp.additional_notes}`);
  return lines.join(' | ');
}

function getBoothDims(boothSize) {
  const map = { '10x10': [10, 10], '10x20': [20, 10], '20x20': [20, 20] };
  const [w, d] = map[boothSize] || [10, 10];
  return { width: w, depth: d };
}

function collectReferenceImages(brandAnalysis, products) {
  const urls = [];
  const logoUrl = brandAnalysis.logo_url || '';
  if (logoUrl && /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)(\?|$)/i.test(logoUrl)) {
    urls.push(logoUrl);
  }
  const thumbs = products
    .map(p => p.thumbnail_url || p.image_url)
    .filter(url => url && /\.(png|jpg|jpeg|gif|webp|bmp|tiff|svg)(\?|$)/i.test(url));
  urls.push(...[...new Set(thumbs)].slice(0, 4));
  return urls;
}

// ═══════════════════════════════════════════════════════════════
// LOADING STEPS
// ═══════════════════════════════════════════════════════════════

const COMPANY_RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    company_name: { type: "string" },
    industry: { type: "string" },
    industry_vertical: { type: "string" },
    core_products_or_services: { type: "array", items: { type: "string" } },
    brand_voice: { type: "string" },
    brand_tone: { type: "string" },
    brand_values: { type: "array", items: { type: "string" } },
    target_customers: { type: "string" },
    competitive_positioning: { type: "string" },
    key_messaging: { type: "array", items: { type: "string" } },
    trade_show_goals: { type: "string" },
    booth_atmosphere: { type: "string" },
    physical_products_to_display: { type: "array", items: { type: "string" } },
    industry_specific_booth_elements: { type: "array", items: { type: "string" } }
  }
};

const loadingSteps = [
  { icon: Search, text: "Scanning your website..." },
  { icon: Palette, text: "Extracting your logo & brand colors..." },
  { icon: Lightbulb, text: "Researching your brand voice & industry..." },
  { icon: Layers, text: "Curating from 500+ products..." },
  { icon: ShieldCheck, text: "Validating design & pricing rules..." },
  { icon: Sparkles, text: "Generating booth visuals with your logo..." },
  { icon: CheckCircle, text: "Finalizing your booth designs..." },
];

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function Loading() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState({
    current: 0,
    total: 6,
    step: 'Initializing...',
    elapsed: 0,
    estimated: 25,
    startTime: null
  });

  useEffect(() => {
    const quoteData = sessionStorage.getItem('quoteRequest');
    if (!quoteData) {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const parsed = JSON.parse(quoteData);
    base44.analytics.track({
      eventName: "quote_started",
      properties: { booth_size: parsed.boothSize }
    });

    generateDesigns(parsed);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  // Timer for elapsed time
  useEffect(() => {
    if (!progress.startTime) return;

    const timer = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        elapsed: Math.floor((Date.now() - prev.startTime) / 1000)
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [progress.startTime]);

  // ── PROGRESS TRACKING ──

  const updateProgress = (step, stepName) => {
    setProgress(prev => ({
      ...prev,
      current: step,
      step: stepName
    }));
  };

  // ── MAIN GENERATION FUNCTION ──

  const generateDesigns = async (quoteData) => {
    const { websiteUrl, boothSize, dealerId, customerProfile } = quoteData;
    const dims = getBoothDims(boothSize);

    try {
      // Start timer
      const startTime = Date.now();
      setProgress(prev => ({ ...prev, startTime, current: 1 }));

      const minLoadTime = new Promise(r => setTimeout(r, 5000));

      // ── STEP 1: Brand analysis + product fetch (parallel) ──
      updateProgress(1, 'Extracting your brand identity...');

      // Check if user has already confirmed their branding
      const confirmedBrandData = sessionStorage.getItem('confirmedBrand');
      let brandAnalysis;

      if (confirmedBrandData) {
        // User has verified their brand, use confirmed data
        console.log('[Brand] Using user-confirmed brand data');
        brandAnalysis = JSON.parse(confirmedBrandData);
        // Clear confirmed brand so user can verify again on next quote
        sessionStorage.removeItem('confirmedBrand');
      } else {
        // Extract brand and navigate to verification page
        try {
          brandAnalysis = await extractBrandIdentity(websiteUrl);
        } catch (err) {
          console.error('[Brand] Extraction failed, using fallback:', err);
          brandAnalysis = {
            company_name: 'Your Company',
            primary_color: '#003b71',
            secondary_color: '#0066b3',
            accent_color_1: '#f7941d',
            accent_color_2: '#ffffff',
            logo_description: 'Company logo',
            brand_personality: 'Professional',
            industry: 'Business Services'
          };
        }

        // Save brand data for verification and navigate to verification page
        console.log('[Brand] Navigating to brand verification page');
        sessionStorage.setItem('brandVerification', JSON.stringify(brandAnalysis));
        navigate(createPageUrl('BrandVerification'));
        return; // Stop here and wait for user verification
      }

      // ── STEP 2: Product catalog ──
      updateProgress(2, 'Loading product catalog...');
      const compatibleProducts = await (async () => {
        const allVariants = await base44.entities.ProductVariant.filter({ is_active: true });
        let products = allVariants.filter(p => p.booth_sizes?.includes(boothSize));
        if (products.length === 0) {
          const allProducts = await base44.entities.Product.filter({ is_active: true });
          products = allProducts.filter(p => p.booth_sizes?.includes(boothSize));
        }
        return products;
      })();
      const catalog = slimCatalog(compatibleProducts);
      const profileStr = formatProfile(customerProfile);

      base44.analytics.track({
        eventName: "design_generated",
        properties: { booth_size: boothSize, website_url: websiteUrl }
      });

      // ── STEP 3: Deep company research (brand voice, industry context) ──
      updateProgress(3, 'Researching your company & industry...');
      const companyResearch = await base44.integrations.Core.InvokeLLM({
        prompt: `Research this company thoroughly: ${websiteUrl}
Company name: ${brandAnalysis.company_name || 'Unknown'}
Industry detected: ${brandAnalysis.industry || 'Unknown'}

Provide a deep analysis focused on how this company should present itself at a trade show booth. Consider:
- What industry are they in? (automotive, electronics, healthcare, food & beverage, tech, etc.)
- What physical products or services do they sell that should be showcased?
- What is their brand voice? (authoritative, playful, technical, luxurious, down-to-earth, etc.)
- What tone do they use in marketing? (formal, casual, inspirational, data-driven, etc.)
- What are their core brand values?
- Who are their target customers visiting a trade show?
- What should the booth atmosphere feel like based on their brand?
- What industry-specific elements belong in their booth? (e.g., automotive → vehicle display area, product demo zones; electronics → interactive screens, charging stations; healthcare → clean/clinical feel, consultation area; food → sampling station, refrigerated display)

Be specific and actionable. This research will directly guide product selection for their trade show booth.`,
        add_context_from_internet: true,
        response_json_schema: COMPANY_RESEARCH_SCHEMA
      });

      // ── STEP 4: AI booth design curation ──
      updateProgress(4, 'Creating booth designs...');
      const designPrompt = `You are an expert trade show booth designer. Create 3 booth designs (Modular, Hybrid, Custom tiers) for a ${boothSize} booth (${dims.width}ft × ${dims.depth}ft).

BRAND: ${JSON.stringify({ name: brandAnalysis.company_name, primary: brandAnalysis.primary_color, secondary: brandAnalysis.secondary_color, accent1: brandAnalysis.accent_color_1, accent2: brandAnalysis.accent_color_2, personality: brandAnalysis.brand_personality, logo: brandAnalysis.logo_description })}

COMPANY CONTEXT (use this to guide product selection and booth storytelling):
- Industry: ${companyResearch.industry} / ${companyResearch.industry_vertical}
- Products/Services: ${(companyResearch.core_products_or_services || []).join(', ')}
- Brand Voice: ${companyResearch.brand_voice} | Tone: ${companyResearch.brand_tone}
- Brand Values: ${(companyResearch.brand_values || []).join(', ')}
- Target Customers: ${companyResearch.target_customers}
- Competitive Position: ${companyResearch.competitive_positioning}
- Key Messaging: ${(companyResearch.key_messaging || []).join('; ')}
- Ideal Booth Atmosphere: ${companyResearch.booth_atmosphere}
- Physical Items to Display: ${(companyResearch.physical_products_to_display || []).join(', ')}
- Industry-Specific Booth Elements: ${(companyResearch.industry_specific_booth_elements || []).join(', ')}

IMPORTANT: Design the booth to reflect this company's actual business. If they sell cars, the booth should have space for vehicle display. If they sell software, emphasize demo stations and screens. If they sell food, include tasting/sampling areas. The experience_story, visitor_journey, and key_moments MUST align with what this company actually does.

CUSTOMER REQUIREMENTS: ${profileStr}

CONSTRAINT: Use ONLY products from the catalog below. Every product_sku must exactly match a catalog "sku". Any fabricated SKU invalidates the output.

FLOORING RULE: ALWAYS select branded carpet for flooring. NEVER select interlocking floor tiles.

CATALOG:
${JSON.stringify(catalog)}

REQUIREMENTS PER TIER:
- Modular: 4-8 items, lower-priced. Hybrid: 6-12 items, mixed. Custom: 8-15+ items, premium.
- Every tier minimum: backwall + counter/kiosk + lighting + branded carpet flooring. Hybrid/Custom add banners, towers, monitor stands, accents.
- total_price = exact sum of selected products' base_price (or rental_price for rentals). Include line_items with sku, name, quantity, unit_price, line_total.
- Booth must look FULLY FURNISHED, not sparse.

KITS: Some products are marked is_kit=true with kit_components listing included items. When selecting a kit, you get all components. Kits offer better value than buying items separately.

RENTALS: Products with is_rental=true and rental_price should use rental_price for pricing. Rentals are great for high-value items clients may not want to own.

SPATIAL FIT: Before selecting, check product dims. Sum of widths along back wall must be ≤ ${dims.width}ft. Items must not overlap. Leave ≥3ft walkway at front.

SPATIAL LAYOUT: For each product provide position {x,y,z} in feet (origin=booth center, x=[-${dims.width / 2},${dims.width / 2}], z=[-${dims.depth / 2},${dims.depth / 2}], y=0=floor), rotation {x,y,z} degrees, scale (usually 1.0).

BRANDING: primary_color on 2-3 structural pieces. secondary_color on 1-2 accents. Logo MUST appear on main backwall + counter (minimum). Only apply colors to customizable products.

FOR EACH DESIGN: include tier, design_name, experience_story, visitor_journey, key_moments[], product_skus[], line_items[], design_rationale, total_price, spatial_layout[].`;

      const designsRaw = await base44.integrations.Core.InvokeLLM({
        prompt: designPrompt,
        response_json_schema: DESIGN_SCHEMA
      });

      // Ensure designs array exists
      const designs = { designs: Array.isArray(designsRaw?.designs) ? designsRaw.designs : (Array.isArray(designsRaw) ? designsRaw : []) };
      if (designs.designs.length === 0) {
        console.error('[Design] LLM returned no designs, raw:', designsRaw);
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      // ── STEP 3: Validate SKUs and FORCE correct catalog prices ──
      const validSkus = new Set(compatibleProducts.map(p => p.manufacturer_sku || p.sku));
      const catalogPriceLookup = {};
      compatibleProducts.forEach(p => {
        const sku = p.manufacturer_sku || p.sku;
        catalogPriceLookup[sku] = {
          base_price: p.base_price,
          rental_price: p.rental_price || null,
          is_rental: p.is_rental || false,
          name: p.display_name || p.name
        };
      });

      for (const design of designs.designs) {
        design.product_skus = design.product_skus.filter(sku => validSkus.has(sku));
        if (design.line_items) {
          design.line_items = design.line_items.filter(li => validSkus.has(li.sku));
        }
        // Force prices from catalog — never trust LLM pricing
        let recalcTotal = 0;
        if (design.line_items) {
          design.line_items = design.line_items.map(li => {
            const entry = catalogPriceLookup[li.sku];
            if (entry) {
              const correctPrice = entry.is_rental && entry.rental_price ? entry.rental_price : entry.base_price;
              const qty = li.quantity || 1;
              const lineTotal = correctPrice * qty;
              recalcTotal += lineTotal;
              return { ...li, unit_price: correctPrice, line_total: lineTotal, name: entry.name };
            }
            return li;
          });
        }
        design.total_price = recalcTotal;
      }

      // ── STEP 5: Rules engine ──
      updateProgress(5, 'Validating designs & pricing...');
      const allServices = await base44.entities.Service.filter({ is_active: true });
      const profileForRules = quoteData.customerProfile || customerProfile || null;

      const validatedDesigns = enforceAllDesigns(
        designs.designs,
        compatibleProducts,
        allServices,
        boothSize,
        profileForRules
      );

      validatedDesigns.forEach(d => {
        if (d.rules_corrections?.length > 0) {
          console.log(`[Rules] ${d.tier}:`, d.rules_corrections);
        }
      });

      designs.designs = validatedDesigns;

      // ── STEP 6: Generate booth images (parallel) ──
      updateProgress(6, 'Generating booth renderings...');
      const imagePromises = designs.designs.map(async (design) => {
        const designProducts = compatibleProducts.filter(p =>
          design.product_skus.includes(p.manufacturer_sku || p.sku)
        );

        const manifest = designProducts.map((p, i) => {
          const d = p.dimensions || {};
          const dimStr = d.width ? `${d.width}W×${d.height}H×${d.depth}D ft` : 'standard';
          return `${i + 1}. "${p.display_name || p.name}" — ${p.category_name || p.category}, ${dimStr}. ${p.visual_description || p.description || ''}`;
        }).join('\n');

        const imagePrompt = `Photorealistic 3D trade show booth rendering for a ${companyResearch.industry || brandAnalysis.industry || ''} company (${brandAnalysis.company_name}).

BOOTH: ${boothSize} (${dims.width}×${dims.depth}ft). Open front facing aisle. Grey carpet aisle, pipe-and-drape neighbors, convention center ceiling.

COMPANY CONTEXT: This is a ${companyResearch.industry || brandAnalysis.industry || ''} company. Brand atmosphere: ${companyResearch.booth_atmosphere || brandAnalysis.brand_personality || 'professional'}. The booth should feel like visiting ${brandAnalysis.company_name}'s showroom.${companyResearch.physical_products_to_display?.length > 0 ? `

INDUSTRY ELEMENTS to suggest in the scene: ${companyResearch.physical_products_to_display.join(', ')}` : ''}

BRAND: Logo="${brandAnalysis.logo_description || brandAnalysis.company_name}" | Primary=${brandAnalysis.primary_color} (backwall, banners) | Secondary=${brandAnalysis.secondary_color} (counter, accents). Logo large+centered on main backwall, smaller on counter.

RENDER EXACTLY these ${designProducts.length} products — NOTHING ELSE. No invented screens, plants, chairs, monitors, or items not listed:
${manifest}

${PLACEMENT_GUIDE}

${CAMERA_STYLE}`;

        const refImages = collectReferenceImages(brandAnalysis, designProducts);
        const params = { prompt: imagePrompt };
        if (refImages.length > 0) params.existing_image_urls = refImages;

        try {
          const result = await base44.integrations.Core.GenerateImage(params);
          return result.url;
        } catch (err) {
          console.error('Image gen failed:', err);
          try {
            return (await base44.integrations.Core.GenerateImage({ prompt: imagePrompt })).url;
          } catch (retryErr) {
            console.error('Image retry failed:', retryErr);
            return null;
          }
        }
      });

      const generatedImages = await Promise.all(imagePromises);

      // ── STEP 6: Save to DB (parallel) ──
      const savePromises = designs.designs.map((design, i) =>
        base44.entities.BoothDesign.create({
          dealer_id: dealerId,
          booth_size: boothSize,
          tier: design.tier,
          design_name: design.design_name,
          brand_identity: brandAnalysis,
          experience_story: design.experience_story,
          visitor_journey: design.visitor_journey,
          key_moments: design.key_moments,
          product_skus: design.product_skus,
          total_price: design.total_price,
          design_rationale: design.design_rationale,
          spatial_layout: design.spatial_layout,
          design_image_url: generatedImages[i],
          line_items: design.line_items
        })
      );
      const savedDesigns = await Promise.all(savePromises);

      await minLoadTime;

      sessionStorage.setItem('boothDesigns', JSON.stringify(savedDesigns));
      sessionStorage.setItem('brandIdentity', JSON.stringify(brandAnalysis));
      sessionStorage.setItem('companyResearch', JSON.stringify(companyResearch));
      navigate(createPageUrl('Results'));

    } catch (error) {
      console.error('Design generation error:', error);
      navigate(createPageUrl('Results'));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e2231a] via-[#b01b13] to-[#0F1D2E] flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}
          className="w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-10 border border-white/20"
        >
          <span className="text-5xl font-bold text-white">X</span>
        </motion.div>

        {/* Progress Tracker */}
        <div className="w-full max-w-md space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="bg-white/10 rounded-full h-3 overflow-hidden">
              <motion.div
                className="bg-white rounded-full h-full"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Current Step */}
          <div className="text-center">
            <p className="text-white text-xl font-light mb-2">{progress.step}</p>
          </div>

          {/* Progress Info */}
          <div className="flex justify-between items-center text-white/60 text-sm">
            <span>Step {progress.current} of {progress.total}</span>
            <span>{progress.elapsed}s elapsed</span>
          </div>

          {/* Estimated Time Remaining */}
          {progress.elapsed > 5 && progress.current < progress.total && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white/40 text-xs text-center"
            >
              Estimated: ~{Math.max(0, progress.estimated - progress.elapsed)}s remaining
            </motion.p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-10">
          {loadingSteps.map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: currentStep === i ? 1.5 : 1, opacity: currentStep === i ? 1 : 0.4 }}
              className="w-2 h-2 bg-white rounded-full"
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-1 mt-12">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ height: [16, 32, 16] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
              className="w-2 bg-white/40 rounded-full"
              style={{ height: 16 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}