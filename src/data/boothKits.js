/**
 * Predefined Booth Kits
 *
 * Curated product sets for complete, professionally designed trade show booths.
 * Each kit is a "playlist" — one click loads all products into the booth editor.
 *
 * SKUs are cross-referenced against confirmed GLB models in Supabase.
 * Research basis: professional trade show design standards for 2025-2026.
 */

export const BOOTH_KITS = [

  // ─────────────────────────────────────────────────────────────────────────
  // 10x10 KITS  (Standard inline single booth)
  // ─────────────────────────────────────────────────────────────────────────

  {
    id: 'fabric-starter-10x10',
    name: 'Clean Start',
    tagline: 'Effortless 10×10 fabric booth',
    description: 'The go-to entry kit for first-time exhibitors. Straight fabric backwall, a fabric counter for reception, a banner stand for extra messaging, and accent lighting. Sets up in 30 minutes.',
    size: '10x10',
    style: 'Fabric',
    tier: 'Essential',
    icon: '🟦',
    accentColor: '#3B82F6',
    products: [
      { sku: 'FMLT-WS8-01', role: 'Main Backwall', note: '8ft straight fabric backwall — full brand coverage' },
      { sku: 'W-02-C',       role: 'Reception Counter', note: 'Half Moon fabric counter — welcoming curve shape' },
      { sku: 'BLD-LT-920',  role: 'Side Banner Stand', note: 'Retractable banner stand — secondary messaging' },
      { sku: 'BLZ-0306',    role: 'Accent Light Box', note: '3×6 freestanding light box — product highlight' },
      { sku: 'LED-WRM-WHT-BLAST', role: 'Accent Lighting', note: 'Warm white LED blast — warm, inviting glow' },
    ]
  },

  {
    id: 'backlit-impact-10x10',
    name: 'Backlit Impact',
    tagline: 'Light-forward 10×10 with glow',
    description: 'Built around a fully backlit display — research shows backlit booths attract 30% more foot traffic. Combines an illuminated backwall, a matching kiosk for demos, and a sleek oval counter.',
    size: '10x10',
    style: 'Backlit',
    tier: 'Professional',
    icon: '💡',
    accentColor: '#8B5CF6',
    products: [
      { sku: 'FMLT-BL-WS8-01', role: 'Main Backwall', note: '8ft straight BACKLIT display — hero illuminated graphic' },
      { sku: 'W-05-C',          role: 'Reception Counter', note: 'Oval fabric counter — premium curved silhouette' },
      { sku: 'FMLT-KIOSK-01',  role: 'Demo Kiosk', note: 'Tension fabric kiosk — interactive engagement station' },
      { sku: 'BLZ-0406',       role: 'Product Spotlight', note: '4×6 freestanding light box — product feature display' },
      { sku: 'LUM-LED3-ORL-B', role: 'Spot Lighting', note: 'Slimline LED spot — precise product highlighting' },
    ]
  },

  {
    id: 'tower-statement-10x10',
    name: 'Tower Statement',
    tagline: 'Vertical drama in a 10×10',
    description: 'Uses a tension fabric tower to punch above 8ft and create a landmark visible from across the hall. Pairs with a curved backwall and charging counter to convert foot traffic into leads.',
    size: '10x10',
    style: 'Modular',
    tier: 'Professional',
    icon: '🗼',
    accentColor: '#10B981',
    products: [
      { sku: 'FMLT-WH8-01',  role: 'Main Backwall', note: '8ft horizontal curve backwall — dynamic curved graphic' },
      { sku: 'COL-01',        role: 'Tower Anchor', note: '4-sided fabric tower — visible from across the show floor' },
      { sku: 'FMLT-CHRG-COUNTER-1', role: 'Reception Counter', note: 'Charging counter — attendees stop to charge = more dwell time' },
      { sku: 'TABLET-STD-05', role: 'Digital Kiosk', note: 'iPad kiosk — lead capture or product catalog' },
      { sku: 'LED-COOL-WHT-BLAST', role: 'Accent Lighting', note: 'Cool white LED — clean, modern corporate feel' },
    ]
  },

  {
    id: 'designer-arch-10x10',
    name: 'Arch Entrance',
    tagline: 'Make an entrance at 10×10',
    description: 'An arch overhead creates a defined "room" feeling even in a 10x10 — one of the most effective psychological tricks in booth design. Attendees instinctively walk in.',
    size: '10x10',
    style: 'Architectural',
    tier: 'Premium',
    icon: '🏛️',
    accentColor: '#F59E0B',
    products: [
      { sku: 'ARCH-07',      role: 'Entry Arch', note: '10ft fabric arch — frames your entrance, defines the space' },
      { sku: 'FMLT-DS-10-04', role: 'Back Display', note: 'Designer Series 10ft backwall — sophisticated graphic backdrop' },
      { sku: 'W-04-C',       role: 'Reception Counter', note: 'Bullet counter — sleek modern reception' },
      { sku: 'VF-ESS-LB-R-01', role: 'Side Light Box', note: 'Vector Frame light box — illuminated product feature' },
      { sku: 'LED-RGB-BLAST', role: 'Color Lighting', note: 'RGB LED blast — match your brand colors exactly' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10x20 KITS  (Double inline booth)
  // ─────────────────────────────────────────────────────────────────────────

  {
    id: 'hybrid-inline-10x20',
    name: 'Hybrid Command',
    tagline: 'Modular power across 20 feet',
    description: 'Hybrid Pro panels give you a bulletproof, mix-and-match backwall that holds tension fabric AND hard graphics. Adds a kiosk demo station and flanking tower for a commanding 20ft presence.',
    size: '10x20',
    style: 'Hybrid Modular',
    tier: 'Professional',
    icon: '⚡',
    accentColor: '#EF4444',
    products: [
      { sku: 'HP-K-03',       role: 'Main Backwall Left', note: 'Hybrid Pro 10ft modular — left half of backwall' },
      { sku: 'HP-K-02',       role: 'Main Backwall Right', note: 'Hybrid Pro 10ft modular — right half, matching config' },
      { sku: 'W-06-C-04',     role: 'Reception Counter', note: 'Bar counter — clean reception along the front' },
      { sku: 'FMLT-KIOSK-02', role: 'Demo Station', note: 'Tension fabric kiosk — product demo / lead capture' },
      { sku: 'VF-TWR-01',     role: 'End Cap Tower', note: 'Vector Frame modular tower — aisle-facing anchor' },
      { sku: 'LUM-LED2-ORL',  role: 'Display Lighting', note: 'Lumina 200 LED lights — illuminate graphics cleanly' },
    ]
  },

  {
    id: 'fabric-sweep-10x20',
    name: 'Fabric Sweep',
    tagline: 'Seamless 20ft fabric panorama',
    description: 'A curved backwall across the full 20ft creates a seamless branded panorama — no seam lines, no panels. The vertical curve adds depth. Anchored by a Hop-up display for front-of-booth presence.',
    size: '10x20',
    style: 'Fabric',
    tier: 'Professional',
    icon: '🌊',
    accentColor: '#06B6D4',
    products: [
      { sku: 'FMLT-WV10-01',   role: 'Main Backwall', note: '10ft vertical curve fabric backwall — sweeping graphic' },
      { sku: 'HOP-2-12X3-S',   role: 'Front Display', note: 'Hopup 30ft straight — front-of-booth product wall' },
      { sku: 'W-03-C',         role: 'Reception Counter', note: 'Ellipse counter — organic flowing shape' },
      { sku: 'FMLT-KIOSK-03',  role: 'Engagement Kiosk', note: 'Tension fabric kiosk — engagement zone' },
      { sku: 'BLZ-W-0808',     role: 'Wall Light Box', note: '8×8 wall-mounted light box — product showcase panel' },
      { sku: 'LED-WRM-WHT-BLAST', role: 'Accent Lighting', note: 'Warm LED — inviting atmosphere' },
    ]
  },

  {
    id: 'illuminated-gallery-10x20',
    name: 'Illuminated Gallery',
    tagline: '20ft wall of light and product',
    description: 'For brands that sell visuals — fashion, art, tech. Multiple light boxes in different sizes create a gallery-style display wall. Draws eyes from 50+ feet away under convention hall lighting.',
    size: '10x20',
    style: 'Backlit',
    tier: 'Premium',
    icon: '🖼️',
    accentColor: '#EC4899',
    products: [
      { sku: 'FMLT-BL-WS8-01', role: 'Backlit Left', note: '8ft backlit display — illuminated left section' },
      { sku: 'BLZ-2008',        role: 'Hero Light Box', note: '20×8 freestanding light box — center statement piece' },
      { sku: 'BLZ-0808',        role: 'Side Light Box', note: '8×8 light box — right-side product showcase' },
      { sku: 'FMLT-CHRG-COUNTER-1', role: 'Counter', note: 'Charging counter — high-value attendee magnet' },
      { sku: 'VFF-CT-BL',       role: 'Backlit Counter', note: 'Vector Fast Frame backlit counter — lit reception' },
      { sku: 'LED-RGB-BLAST',   role: 'Color Accent', note: 'RGB LED — dynamic color wash for premium feel' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 20x20 ISLAND KITS  (Four-sided island exhibit)
  // ─────────────────────────────────────────────────────────────────────────

  {
    id: 'fusion-island-20x20',
    name: 'Fusion Island',
    tagline: 'Full 20×20 island presence',
    description: 'Formulate Fusion island kits are engineered specifically for 20x20 island spaces — accessible from all four aisles. A tower anchors the center, two counters create dual reception zones, and a monitor kiosk drives demos.',
    size: '20x20',
    style: 'Island Fabric',
    tier: 'Premium',
    icon: '🏝️',
    accentColor: '#7C3AED',
    products: [
      { sku: 'CFAB-K-05',  role: 'Island Structure', note: 'Formulate Fusion 20x20 island — full perimeter framework' },
      { sku: 'COL-02',     role: 'Center Tower', note: '4-sided fabric tower — center island landmark' },
      { sku: 'W-01-C',     role: 'Entry Counter 1', note: 'Pillar counter — aisle-facing reception point' },
      { sku: 'W-03-C',     role: 'Entry Counter 2', note: 'Ellipse counter — second aisle reception' },
      { sku: 'VF-MK-02',   role: 'Demo Station', note: 'Monitor kiosk — product demo / digital content' },
      { sku: 'LED-RGB-BLAST', role: 'Accent Lighting', note: 'RGB LED — brand color wash throughout island' },
      { sku: 'FMLT-KIOSK-04', role: 'Engagement Zone', note: 'Tension fabric kiosk — lead capture station' },
    ]
  },

  {
    id: 'hybrid-island-20x20',
    name: 'Hybrid Island',
    tagline: 'Hard-hitting modular 20×20',
    description: 'Hybrid Pro panels give you the durability of a custom exhibit with the portability of modular. The 20x20 island config creates defined zones — keynote backwall, product demo area, lounge zone.',
    size: '20x20',
    style: 'Hybrid Modular',
    tier: 'Premium',
    icon: '🏗️',
    accentColor: '#059669',
    products: [
      { sku: 'HP-K-19',    role: 'Island Backwall', note: 'Hybrid Pro 20x20 modular island kit — full perimeter' },
      { sku: 'SHD-TOWER-01', role: 'Feature Tower', note: 'Shield tower — dramatic sculptural anchor' },
      { sku: 'W-06-C-02',  role: 'Reception Counter', note: 'Bar counter — front aisle reception' },
      { sku: 'FMLT-KIOSK-01', role: 'Demo Kiosk 1', note: 'Fabric kiosk — first demo station' },
      { sku: 'FMLT-KIOSK-02', role: 'Demo Kiosk 2', note: 'Fabric kiosk — second demo station' },
      { sku: 'LUM-LED3-ORL-B', role: 'Spot Lights', note: 'Slimline LED spots — focused product lighting' },
      { sku: 'MOD-DOOR-M', role: 'Private Entry', note: 'Modulate door — defines a private meeting zone' },
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SPECIALTY KITS
  // ─────────────────────────────────────────────────────────────────────────

  {
    id: 'tabletop-conference',
    name: 'Conference Ready',
    tagline: 'Tabletop kit for conferences & pop-ups',
    description: 'Perfect for conferences, pop-ups, and smaller events where you only have a 6ft or 8ft table. Full branded presence — tabletop backwall, light box, retractable stand — packs into one carry bag.',
    size: 'Tabletop',
    style: 'Portable',
    tier: 'Essential',
    icon: '💼',
    accentColor: '#64748B',
    products: [
      { sku: 'FMLT-WTT-V03', role: 'Tabletop Backwall', note: 'Tabletop TT3 fabric backwall — full branded backdrop' },
      { sku: 'EMB-2X2-S',    role: 'Table Display', note: 'Embrace 5ft tabletop display — sits on table, adds height' },
      { sku: 'CL-TBLTP-LB-01', role: 'Light Box', note: 'Catchlight tabletop light box — illuminated product feature' },
      { sku: 'BREZ-2',       role: 'Side Banner', note: 'Breeze 2 tabletop retractable — side messaging' },
      { sku: 'AKIT-1S',      role: 'Accessories', note: 'Banner stand accessory kit — complete the setup' },
    ]
  },

  {
    id: 'outdoor-event',
    name: 'Outdoor Event',
    tagline: 'Built for outdoor activations',
    description: 'Designed for outdoor events, festivals, and activations. An arch creates a photogenic entrance, flags add perimeter presence, and outdoor-rated signage survives the elements.',
    size: 'Outdoor',
    style: 'Outdoor',
    tier: 'Professional',
    icon: '🌤️',
    accentColor: '#F97316',
    products: [
      { sku: 'ARCH-01',              role: 'Entry Arch', note: '12ft arch — photogenic entrance, instant landmark' },
      { sku: 'ZOOM-FLX-TNT',         role: 'Overhead Cover', note: 'Zoom Flex tent — weather protection overhead' },
      { sku: 'ZOOM-FLX-D-LG',        role: 'Perimeter Flag', note: 'D-shaped flag large — road-visible perimeter flag' },
      { sku: 'ZM-FLX-FOLDABLE',      role: 'Flag Stand', note: 'Zoom Flex flagpole stand — stable outdoor flag base' },
      { sku: 'CONTOUR-01-PB',        role: 'Wayfinding Sign', note: 'Contour arrow outdoor sign — directional wayfinding' },
      { sku: 'BLD-LT-1200',          role: 'Info Banner', note: 'Blade Lite 1200 retractable — indoor info stand' },
    ]
  },

];

/**
 * Kit lookup helpers
 */
export const getKitsBySize = (size) =>
  BOOTH_KITS.filter(k => k.size === size);

export const getKitById = (id) =>
  BOOTH_KITS.find(k => k.id === id);

export const KIT_SIZES = ['10x10', '10x20', '20x20', 'Tabletop', 'Outdoor'];

export const KIT_TIERS = {
  Essential: { label: 'Essential', color: 'bg-gray-100 text-gray-700', description: 'Budget-friendly, fast setup' },
  Professional: { label: 'Professional', color: 'bg-blue-100 text-blue-700', description: 'Mid-tier, high impact' },
  Premium: { label: 'Premium', color: 'bg-purple-100 text-purple-700', description: 'Top-of-line, fully curated' },
};
