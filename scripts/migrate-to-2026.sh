#!/bin/bash
# =============================================================================
# FULL MIGRATION: 2025 → 2026 Exhibitors' Handbook
# Run from project root: ./scripts/migrate-to-2026.sh
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

PDF_2026="/tmp/exhibitors-handbook-2026.pdf"
CDN_URL="https://s3cdn.theexhibitorshandbook.com/catalogs/exhibitors-handbook_catalog.pdf"
LOG_FILE="$PROJECT_DIR/logs/migrate-2026-$(date +%Y%m%d-%H%M%S).log"
MANIFEST="$PROJECT_DIR/orbus_catalog/page_images_manifest.json"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}✅ $*${NC}" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}" | tee -a "$LOG_FILE"; }
fail() { echo -e "${RED}❌ $*${NC}" | tee -a "$LOG_FILE"; exit 1; }
sep()  { echo -e "${BOLD}══════════════════════════════════════════════════════${NC}" | tee -a "$LOG_FILE"; }

mkdir -p "$PROJECT_DIR/logs"

sep
echo -e "${BOLD}  2025 → 2026 CATALOG MIGRATION${NC}"
sep
echo ""
log "Log: $LOG_FILE"
echo ""

# ── 1. Download PDF ───────────────────────────────────────────────────────────
log "STEP 1/5 — Download 2026 PDF"
if [ -f "$PDF_2026" ] && [ "$(du -m "$PDF_2026" | cut -f1)" -gt 40 ]; then
  ok "Already cached: $(du -sh "$PDF_2026" | cut -f1)"
else
  log "Downloading from CDN..."
  curl -# -L "$CDN_URL" -o "$PDF_2026" || fail "Download failed"
  ok "Downloaded: $(du -sh "$PDF_2026" | cut -f1)"
fi
echo ""

# ── 2. Update PDF path in convertPagesToImages.js ────────────────────────────
log "STEP 2/5 — Patch convertPagesToImages.js to use 2026 PDF"
cp scripts/convertPagesToImages.js scripts/convertPagesToImages.js.bak-2025
sed -i '' "s|PDF_PATH = '[^']*'|PDF_PATH = '$PDF_2026'|g" scripts/convertPagesToImages.js
ok "PDF_PATH updated to $PDF_2026"

# Clear manifest so all pages re-upload
if [ -f "$MANIFEST" ]; then
  cp "$MANIFEST" "${MANIFEST}.bak-2025"
  echo '{}' > "$MANIFEST"
  ok "Page manifest cleared (backed up)"
fi
echo ""

# ── 3. Convert + upload all 220 pages ────────────────────────────────────────
log "STEP 3/5 — Convert all pages to JPEG + upload to Supabase"
log "This will take 20–40 minutes..."
echo ""
node scripts/convertPagesToImages.js --all 2>&1 | tee -a "$LOG_FILE"
ok "Page conversion complete"
echo ""

# ── 4. Re-run hotspot detection on all product pages ─────────────────────────
log "STEP 4/5 — Re-run Claude Vision hotspot detection"

# Backup 2025 hotspots
cp src/data/catalogHotspots.json src/data/catalogHotspots.2025.backup.json
ok "Backed up 2025 hotspots → catalogHotspots.2025.backup.json"

# Get all product pages
MAPPED_PAGES=$(node -e "
const m = require('./orbus_catalog/product_catalog_page_mapping.json');
const pages = [...new Set(m.product_page_mapping.map(p => p.primary_page))].sort((a,b)=>a-b);
process.stdout.write(pages.join(' '));
" 2>/dev/null)
PAGE_COUNT=$(echo "$MAPPED_PAGES" | wc -w | tr -d ' ')
log "Running hotspot detection on $PAGE_COUNT product pages..."
echo ""

FAILED=0
PROCESSED=0
for PAGE in $MAPPED_PAGES; do
  PROCESSED=$((PROCESSED + 1))
  echo -ne "  [${PROCESSED}/${PAGE_COUNT}] Page ${PAGE}... "
  if node scripts/generatePageHotspots.js --page "$PAGE" >> "$LOG_FILE" 2>&1; then
    echo -e "${GREEN}✅${NC}"
  else
    echo -e "${RED}❌${NC}"
    FAILED=$((FAILED + 1))
  fi
  sleep 0.2
done

echo ""
if [ "$FAILED" -gt 0 ]; then
  warn "$FAILED page(s) failed — check $LOG_FILE"
else
  ok "All $PAGE_COUNT pages processed"
fi
echo ""

# ── 5. Validate + commit ──────────────────────────────────────────────────────
log "STEP 5/5 — Validate coverage + commit"

node -e "
const mapping = require('./orbus_catalog/product_catalog_page_mapping.json');
const hotspots = require('./src/data/catalogHotspots.json');
const allSkus = [...new Set(mapping.product_page_mapping.map(p => p.product_sku).filter(Boolean))];
const covered = new Set();
for (const spots of Object.values(hotspots)) {
  for (const s of spots) {
    if (s.sku) covered.add(s.sku);
    if (s.groupedSkus) s.groupedSkus.forEach(x => covered.add(x));
  }
}
const missing = allSkus.filter(s => !covered.has(s));
console.log('  Total SKUs:        ' + allSkus.length);
console.log('  SKUs with hotspot: ' + (allSkus.length - missing.length));
console.log('  SKUs missing:      ' + missing.length);
console.log('  Pages with hotspot:' + Object.keys(hotspots).length);
if (missing.length) { console.log('  Missing:', missing.join(', ')); }
" 2>&1 | tee -a "$LOG_FILE"

echo ""
git add src/data/catalogHotspots.json scripts/convertPagesToImages.js
git commit -m "$(cat <<'EOF'
Migrate catalog to 2026 Exhibitors Handbook (220 pages)

- Re-converted all pages to JPEG, uploaded to Supabase
- Re-ran Claude Vision hotspot detection on all product pages
- Backed up 2025 hotspots as catalogHotspots.2025.backup.json

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git stash 2>/dev/null || true
git pull --rebase origin main 2>&1 | tee -a "$LOG_FILE"
git stash pop 2>/dev/null || true
git push origin main 2>&1 | tee -a "$LOG_FILE"
ok "Pushed to GitHub"
echo ""

sep
echo -e "${BOLD}  MIGRATION COMPLETE${NC}"
sep
echo -e "  Log: ${CYAN}$LOG_FILE${NC}"
echo ""
