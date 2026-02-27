export const categories = [
  {
    name: "Hanging Structures",
    slug: "hanging-structures",
    icon: "🎪",
    subcategories: [
      {
        name: "Ring Structures",
        children: [
          { name: "Essential Rings", slug: "essential-ring" },
          { name: "Backlit Rings", slug: "backlit-ring" },
          { name: "Large Rings", slug: "large-ring" }
        ]
      },
      {
        name: "Square & Rectangular",
        children: [
          { name: "Square Structures", slug: "square-structure" },
          { name: "Backlit Squares", slug: "backlit-square" },
          { name: "Custom Shapes", slug: "custom-shape" }
        ]
      },
      {
        name: "Specialty Hanging",
        children: [
          { name: "Tapered Structures", slug: "tapered" },
          { name: "Wave Structures", slug: "wave" }
        ]
      }
    ]
  },
  {
    name: "Backwalls & Displays",
    slug: "backwalls-displays",
    icon: "🖼️",
    subcategories: [
      {
        name: "Fabric Backwalls",
        children: [
          { name: "Formulate Backwalls", slug: "formulate-backwall" },
          { name: "Vector Frame", slug: "vector-frame" },
          { name: "Waveline", slug: "waveline" },
          { name: "Hopup", slug: "hopup" }
        ]
      },
      {
        name: "Backlit Displays",
        children: [
          { name: "Backlit Frames", slug: "backlit-frame" },
          { name: "SEG Light Boxes", slug: "seg-lightbox" }
        ]
      },
      {
        name: "Modular Systems",
        children: [
          { name: "Hybrid Pro", slug: "hybrid-pro" },
          { name: "MODify", slug: "modify" }
        ]
      }
    ]
  },
  {
    name: "Counters & Pedestals",
    slug: "counters-pedestals",
    icon: "🗄️",
    subcategories: [
      {
        name: "Display Counters",
        children: [
          { name: "Fabric Counters", slug: "fabric-counter" },
          { name: "Hard Top Counters", slug: "hardtop-counter" },
          { name: "Charging Stations", slug: "charging-counter" }
        ]
      },
      {
        name: "Pedestals & Kiosks",
        children: [
          { name: "Display Pedestals", slug: "pedestal" },
          { name: "Literature Racks", slug: "literature-rack" },
          { name: "Kiosks", slug: "kiosk" }
        ]
      }
    ]
  },
  {
    name: "Banner Stands",
    slug: "banner-stands",
    icon: "📋",
    subcategories: [
      {
        name: "Retractable Banners",
        children: [
          { name: "Standard Retractable", slug: "retractable-standard" },
          { name: "Premium Retractable", slug: "retractable-premium" },
          { name: "Wide Format", slug: "retractable-wide" }
        ]
      },
      {
        name: "Backlit Banners",
        children: [
          { name: "Backlit Retractable", slug: "backlit-retractable" },
          { name: "SEG Banners", slug: "seg-banner" }
        ]
      },
      {
        name: "Specialty Stands",
        children: [
          { name: "Telescopic", slug: "telescopic" },
          { name: "Spring Back", slug: "spring-back" },
          { name: "X-Banner", slug: "x-banner" }
        ]
      }
    ]
  },
  {
    name: "Flags & Outdoor",
    slug: "flags-outdoor",
    icon: "🏁",
    subcategories: [
      {
        name: "Feather Flags",
        children: [
          { name: "Standard Feather", slug: "feather-flag" },
          { name: "Large Feather", slug: "large-feather" }
        ]
      },
      {
        name: "Teardrop Flags",
        children: [
          { name: "Standard Teardrop", slug: "teardrop-flag" },
          { name: "Large Teardrop", slug: "large-teardrop" }
        ]
      },
      {
        name: "Tents & Canopies",
        children: [
          { name: "Pop-Up Tents", slug: "popup-tent" },
          { name: "Frame Tents", slug: "frame-tent" }
        ]
      }
    ]
  },
  {
    name: "Accessories",
    slug: "accessories",
    icon: "💡",
    subcategories: [
      {
        name: "Lighting",
        children: [
          { name: "LED Lights", slug: "led-light" },
          { name: "Spotlights", slug: "spotlight" }
        ]
      },
      {
        name: "Furniture & Cases",
        children: [
          { name: "Table Covers", slug: "table-cover" },
          { name: "Shipping Cases", slug: "shipping-case" },
          { name: "Monitor Mounts", slug: "monitor-mount" }
        ]
      },
      {
        name: "Graphics & Prints",
        children: [
          { name: "Graphic Replacements", slug: "graphic-replacement" },
          { name: "Custom Prints", slug: "custom-print" }
        ]
      }
    ]
  }
];

// Mapping of pricing_category values from Nimlok catalog to our menu structure
export const pricingCategoryMap = {
  'hanging_structure': ['hanging-structures'],
  'backwall': ['backwalls-displays'],
  'counter': ['counters-pedestals'],
  'banner_stand': ['banner-stands'],
  'flag': ['flags-outdoor'],
  'tent': ['flags-outdoor'],
  'accessory': ['accessories'],
  'lighting': ['accessories'],
  'case': ['accessories'],
  'pedestal': ['counters-pedestals'],
  'kiosk': ['counters-pedestals']
};

export function getCategoryProducts(categorySlug, subcategorySlug) {
  return fetch(`/api/products?category=${categorySlug}&subcategory=${subcategorySlug}`)
    .then(res => res.json());
}

export function getCategoryBreadcrumb(categorySlug, subcategorySlug) {
  const category = categories.find(c => c.slug === categorySlug);
  if (!category) return [];

  const breadcrumb = [{ name: 'Products', href: '/products' }];
  breadcrumb.push({ name: category.name, href: `/products/${categorySlug}` });

  if (subcategorySlug) {
    const subcategory = category.subcategories
      .flatMap(s => s.children || [s])
      .find(s => s.slug === subcategorySlug);

    if (subcategory) {
      breadcrumb.push({
        name: subcategory.name,
        href: `/products/${categorySlug}/${subcategorySlug}`
      });
    }
  }

  return breadcrumb;
}

export default categories;