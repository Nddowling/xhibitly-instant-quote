export const categories = [
  {
    name: "Portable Displays",
    slug: "portable-displays",
    icon: "🚶",
    subcategories: [
      {
        name: "Banner Stands",
        children: [
          { name: "Retractable", slug: "retractable" },
          { name: "Telescopic", slug: "telescopic" },
          { name: "Spring Back", slug: "spring-back" }
        ]
      }
    ]
  },
  {
    name: "Fabric Displays",
    slug: "fabric-displays",
    icon: "🖼️",
    subcategories: [
      {
        name: "Displays",
        children: [
          { name: "Fabric Banners", slug: "fabric-banners" },
          { name: "Light Boxes", slug: "light-boxes" }
        ]
      }
    ]
  },
  {
    name: "Hanging Structures",
    slug: "hanging-structures",
    icon: "🎪",
    subcategories: [
      {
        name: "Hanging Structures",
        children: [
          { name: "Ring Structures", slug: "ring-structures" },
          { name: "Square Structures", slug: "square-structures" },
          { name: "Other Hanging", slug: "other-hanging" }
        ]
      }
    ]
  },
  {
    name: "Display Components",
    slug: "display-components",
    icon: "🗄️",
    subcategories: [
      {
        name: "Components",
        children: [
          { name: "Counters", slug: "counters" },
          { name: "Info Centers", slug: "info-centers" },
          { name: "Sign Stands", slug: "sign-stands" }
        ]
      }
    ]
  },
  {
    name: "Modular Displays",
    slug: "modular-displays",
    icon: "🏗️",
    subcategories: [
      {
        name: "Kits & Displays",
        children: [
          { name: "10x10 Kits", slug: "10x10-kits" },
          { name: "20x20 Kits", slug: "20x20-kits" },
          { name: "Retail Displays", slug: "retail-displays" }
        ]
      }
    ]
  },
  {
    name: "Outdoor",
    slug: "outdoor",
    icon: "🏁",
    subcategories: [
      {
        name: "Outdoor Displays",
        children: [
          { name: "Flags", slug: "flags" },
          { name: "Tents", slug: "tents" }
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
        name: "Accessories",
        children: [
          { name: "Display Lighting", slug: "display-lighting" },
          { name: "Shipping Cases", slug: "shipping-cases" },
          { name: "Table Covers", slug: "table-covers" },
          { name: "Hardware Kits", slug: "hardware-kits" }
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