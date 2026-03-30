import { PAGE_PRODUCTS, MAX_PAGE } from '@/data/catalogPageMapping';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';

export function normalizeHotspot(spot) {
  const groupedSkus = Array.from(new Set((spot.groupedSkus?.length ? spot.groupedSkus : [spot.sku]).filter(Boolean)));
  return { ...spot, groupedSkus, sku: groupedSkus[0] || spot.sku };
}

function getImageAudit(product) {
  const imageUrl = product?.primary_image_url || product?.image_cached_url || product?.image_url || SKU_TO_IMAGE[product?.sku] || '';
  const lower = String(imageUrl || '').toLowerCase();
  const hasImage = Boolean(imageUrl);
  const isDefaultImage = lower.includes('/placeholder/') || lower.includes('product_can_be_recycled') || lower.includes('exhb-catalog-cover-spread-26') || lower.includes('hqdefault');
  const isCatalogPageFallback = lower.includes('/catalog/pages/page-');
  const hasRealProductImage = hasImage && !isDefaultImage && !isCatalogPageFallback;

  return {
    imageUrl,
    hasImage,
    hasRealProductImage,
    isDefaultImage,
    isCatalogPageFallback,
  };
}

export function buildPageAudit(pageNumber, hotspots = []) {
  const knownProducts = PAGE_PRODUCTS[pageNumber] || [];
  const normalizedHotspots = hotspots.map(normalizeHotspot);
  const coveredSkuSet = new Set(normalizedHotspots.flatMap((spot) => spot.groupedSkus));
  const missingProducts = knownProducts.filter((product) => !coveredSkuSet.has(product.sku));
  const productsWithImageIssues = knownProducts
    .map((product) => ({ ...product, ...getImageAudit(product) }))
    .filter((product) => !product.hasRealProductImage);

  const skuCounts = {};
  normalizedHotspots.forEach((spot) => {
    spot.groupedSkus.forEach((sku) => {
      skuCounts[sku] = (skuCounts[sku] || 0) + 1;
    });
  });

  const duplicateCoverage = Object.entries(skuCounts)
    .filter(([, count]) => count > 1)
    .map(([sku, count]) => ({ sku, reason: `Shown in ${count} hotspot lists on this page.` }));

  const mismatchedHotspots = normalizedHotspots.flatMap((spot) => {
    const issues = [];
    const pageSkuMatches = spot.groupedSkus.filter((sku) => knownProducts.some((p) => p.sku === sku));
    if (spot.groupedSkus.length > 0 && pageSkuMatches.length === 0) {
      issues.push({ ...spot, reason: 'None of the hotspot SKUs match the known products mapped to this page.' });
    }
    if (spot.groupedSkus.length === 0) {
      issues.push({ ...spot, reason: 'This hotspot has no SKU list for the click popup.' });
    }
    return issues;
  });

  return {
    pageNumber,
    hotspots: normalizedHotspots,
    missingProducts,
    mismatchedHotspots,
    duplicateCoverage,
    productsWithImageIssues,
    hasIssues:
      missingProducts.length > 0 ||
      mismatchedHotspots.length > 0 ||
      duplicateCoverage.length > 0 ||
      productsWithImageIssues.length > 0,
  };
}

export function summarizeCatalogAudit(pageAudits = []) {
  const pagesNeedingUpdates = pageAudits.filter((page) => page.hasIssues);
  return {
    totalPagesScanned: MAX_PAGE,
    pagesNeedingUpdates,
    issueCount: pagesNeedingUpdates.length,
  };
}

export function buildSuggestedHotspots(pageAudit) {
  if (!pageAudit?.missingProducts?.length) return pageAudit?.hotspots || [];
  const existing = pageAudit.hotspots || [];
  const additions = pageAudit.missingProducts.map((product, index) => ({
    sku: product.sku,
    name: product.name,
    groupedSkus: [product.sku],
    x: 0.04,
    y: Math.min(0.9, 0.08 + (index * 0.05)),
    width: 0.92,
    height: 0.035,
  }));
  return [...existing, ...additions];
}