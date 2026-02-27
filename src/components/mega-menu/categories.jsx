export const categories = [
  {
    name: "Portable Displays",
    slug: "portable-displays",
    icon: "📱",
    subcategories: [
      {
        name: "Banner Stands",
        slug: "banner-stands",
        children: [
          { name: "Retractable", slug: "retractable", productCount: 10, description: "Classic roll-up banners" },
          { name: "Telescopic", slug: "telescopic", productCount: 5, description: "Adjustable height stands" },
          { name: "Spring Back", slug: "spring-back", productCount: 7, description: "Tension-based displays" },
          { name: "Fabric Banners", slug: "fabric-banners", productCount: 84, description: "Fabric display systems" },
          { name: "Light Boxes", slug: "light-boxes", productCount: 17, description: "Backlit fabric displays" }
        ]
      },
      {
        name: "Accessories",
        slug: "accessories",
        children: [
          { name: "Display Lighting", slug: "lighting", productCount: 6, description: "LED lights & spotlights" },
          { name: "Shipping Cases", slug: "cases", productCount: 1, description: "Hard & soft cases" },
          { name: "Sign Stands", slug: "signs", productCount: 25, description: "Directional signs & frames" },
          { name: "Table Covers", slug: "table-covers", productCount: 1, description: "Branded table throws" }
        ]
      },
      {
        name: "Display Elements",
        slug: "display-elements",
        children: [
          { name: "Counters", slug: "counters", productCount: 13, description: "Portable display counters" },
          { name: "Info Centers", slug: "info-centers", productCount: 9, description: "Kiosks & literature racks" }
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
        name: "All Hanging Structures",
        slug: "all",
        productCount: 51,
        description: "Overhead fabric displays"
      },
      {
        name: "Ring Structures",
        slug: "ring",
        productCount: 20,
        description: "Circular hanging displays"
      },
      {
        name: "Square Structures",
        slug: "square",
        productCount: 15,
        description: "Rectangular hanging displays"
      },
      {
        name: "Backlit Structures",
        slug: "backlit",
        productCount: 16,
        description: "Illuminated hanging displays"
      }
    ]
  },
  {
    name: "Flags & Outdoor",
    slug: "outdoor",
    icon: "🏁",
    subcategories: [
      { name: "Flags", slug: "flags", productCount: 10, description: "Feather & teardrop flags" },
      { name: "Outdoor Signs", slug: "outdoor-signs", description: "Weather-resistant signage" },
      { name: "Tents & Canopies", slug: "tents", description: "Event tents & shelters" }
    ]
  },
  {
    name: "Custom Booths",
    slug: "custom-booths",
    icon: "🏗️",
    subcategories: [
      { name: "10x10 Displays", slug: "10x10", description: "100 sq ft inline booths" },
      { name: "10x20 Displays", slug: "10x20", description: "200 sq ft inline booths" },
      { name: "20x20 Displays", slug: "20x20", description: "Island booth displays" },
      { name: "Custom Design", slug: "custom", description: "Fully custom exhibits" }
    ]
  },
  {
    name: "By Budget",
    slug: "by-budget",
    icon: "💰",
    subcategories: [
      { name: "Under $500", slug: "budget", description: "Economy options" },
      { name: "$500 - $2,000", slug: "mid-range", description: "Standard quality" },
      { name: "$2,000+", slug: "premium", description: "Premium displays" }
    ]
  }
];

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