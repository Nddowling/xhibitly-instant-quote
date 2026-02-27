export const categories = [
  {
    name: "Hanging Structures",
    slug: "hanging-structures",
    icon: "🎪",
    subcategories: [
      {
        name: "Ring Structures",
        children: [
          { name: "Essential Rings", slug: "essential-ring", count: 12 },
          { name: "Backlit Rings", slug: "backlit-ring", count: 8 },
          { name: "Large Rings", slug: "large-ring", count: 5 }
        ]
      },
      {
        name: "Square & Rectangular",
        children: [
          { name: "Square Structures", slug: "square-structure", count: 10 },
          { name: "Backlit Squares", slug: "backlit-square", count: 6 },
          { name: "Custom Shapes", slug: "custom-shape", count: 8 }
        ]
      },
      {
        name: "Specialty Hanging",
        children: [
          { name: "Tapered Structures", slug: "tapered", count: 4 },
          { name: "Wave Structures", slug: "wave", count: 3 }
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
          { name: "Formulate Backwalls", slug: "formulate-backwall", count: 45 },
          { name: "Vector Frame", slug: "vector-frame", count: 18 },
          { name: "Waveline", slug: "waveline", count: 22 },
          { name: "Hopup", slug: "hopup", count: 15 }
        ]
      },
      {
        name: "Backlit Displays",
        children: [
          { name: "Backlit Frames", slug: "backlit-frame", count: 20 },
          { name: "SEG Light Boxes", slug: "seg-lightbox", count: 12 }
        ]
      },
      {
        name: "Modular Systems",
        children: [
          { name: "Hybrid Pro", slug: "hybrid-pro", count: 16 },
          { name: "MODify", slug: "modify", count: 8 }
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
          { name: "Fabric Counters", slug: "fabric-counter", count: 14 },
          { name: "Hard Top Counters", slug: "hardtop-counter", count: 8 },
          { name: "Charging Stations", slug: "charging-counter", count: 4 }
        ]
      },
      {
        name: "Pedestals & Kiosks",
        children: [
          { name: "Display Pedestals", slug: "pedestal", count: 10 },
          { name: "Literature Racks", slug: "literature-rack", count: 6 },
          { name: "Kiosks", slug: "kiosk", count: 5 }
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
          { name: "Standard Retractable", slug: "retractable-standard", count: 15 },
          { name: "Premium Retractable", slug: "retractable-premium", count: 8 },
          { name: "Wide Format", slug: "retractable-wide", count: 6 }
        ]
      },
      {
        name: "Backlit Banners",
        children: [
          { name: "Backlit Retractable", slug: "backlit-retractable", count: 10 },
          { name: "SEG Banners", slug: "seg-banner", count: 5 }
        ]
      },
      {
        name: "Specialty Stands",
        children: [
          { name: "Telescopic", slug: "telescopic", count: 7 },
          { name: "Spring Back", slug: "spring-back", count: 4 },
          { name: "X-Banner", slug: "x-banner", count: 3 }
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
          { name: "Standard Feather", slug: "feather-flag", count: 8 },
          { name: "Large Feather", slug: "large-feather", count: 5 }
        ]
      },
      {
        name: "Teardrop Flags",
        children: [
          { name: "Standard Teardrop", slug: "teardrop-flag", count: 6 },
          { name: "Large Teardrop", slug: "large-teardrop", count: 4 }
        ]
      },
      {
        name: "Tents & Canopies",
        children: [
          { name: "Pop-Up Tents", slug: "popup-tent", count: 8 },
          { name: "Frame Tents", slug: "frame-tent", count: 5 }
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
          { name: "LED Lights", slug: "led-light", count: 12 },
          { name: "Spotlights", slug: "spotlight", count: 8 }
        ]
      },
      {
        name: "Furniture & Cases",
        children: [
          { name: "Table Covers", slug: "table-cover", count: 6 },
          { name: "Shipping Cases", slug: "shipping-case", count: 10 },
          { name: "Monitor Mounts", slug: "monitor-mount", count: 5 }
        ]
      },
      {
        name: "Graphics & Prints",
        children: [
          { name: "Graphic Replacements", slug: "graphic-replacement", count: 0 },
          { name: "Custom Prints", slug: "custom-print", count: 0 }
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