#!/usr/bin/env python3
"""
Map Products to 2026 Exhibitor's Handbook Catalog Pages
========================================================
Extracts text from the catalog PDF and matches products to their page numbers.

Requirements:
    pip install PyPDF2 pdfplumber

Usage:
    python map_products_to_catalog_pages.py
"""

import json
import re
from pathlib import Path
from collections import defaultdict

try:
    import pdfplumber
except ImportError:
    print("Installing pdfplumber...")
    import subprocess
    subprocess.run(["pip3", "install", "pdfplumber"], check=True)
    import pdfplumber

# ─── Config ────────────────────────────────────────────────────────────────────

CATALOG_PDF = Path("orbus_catalog/brochures/portable_displays/catalogs_exhibitors-handbook_catalog.pdf")
PRODUCTS_JSON = Path("orbus_catalog/products.json")
OUTPUT_FILE = Path("orbus_catalog/product_catalog_page_mapping.json")

# ─── Helper Functions ──────────────────────────────────────────────────────────

def normalize_text(text):
    """Normalize text for matching"""
    return re.sub(r'[^a-z0-9]+', '', text.lower())

def extract_catalog_data():
    """Extract text from each page of the catalog"""
    print(f"📖 Reading catalog: {CATALOG_PDF.name}")

    page_data = {}
    product_mentions = defaultdict(list)

    with pdfplumber.open(CATALOG_PDF) as pdf:
        total_pages = len(pdf.pages)
        print(f"   Total pages: {total_pages}")

        for page_num, page in enumerate(pdf.pages, start=1):
            if page_num % 50 == 0:
                print(f"   Processing page {page_num}/{total_pages}...")

            # Extract text
            text = page.extract_text() or ""

            # Store page data
            page_data[page_num] = {
                'text': text,
                'normalized': normalize_text(text)
            }

            # Extract potential SKUs (common patterns)
            skus = re.findall(r'\b[A-Z]{2,5}[-\s]?[A-Z0-9]{2,10}\b', text)
            page_data[page_num]['skus'] = list(set(skus))

    print(f"✅ Extracted text from {total_pages} pages")
    return page_data

def load_products():
    """Load products from the scraped database"""
    if not PRODUCTS_JSON.exists():
        print(f"❌ Products database not found: {PRODUCTS_JSON}")
        return []

    print(f"📦 Loading products from: {PRODUCTS_JSON.name}")

    with open(PRODUCTS_JSON, 'r') as f:
        data = json.load(f)

    products = data.get('products', [])
    print(f"   Found {len(products)} products")
    return products

def match_products_to_pages(products, page_data):
    """Match each product to catalog pages"""
    print(f"\n🔍 Matching products to catalog pages...")

    product_page_map = []
    matched_count = 0

    for idx, product in enumerate(products, 1):
        if idx % 100 == 0:
            print(f"   Processed {idx}/{len(products)} products...")

        name = product.get('name', '')
        sku = product.get('sku', '')

        if not name and not sku:
            continue

        # Normalize for matching
        name_normalized = normalize_text(name)
        sku_normalized = normalize_text(sku) if sku else ""

        # Find matching pages
        matches = []

        for page_num, page_info in page_data.items():
            page_text_normalized = page_info['normalized']

            # Check if product name appears on page
            name_match = False
            if len(name_normalized) > 5:  # Avoid matching very short names
                name_match = name_normalized in page_text_normalized

            # Check if SKU appears on page
            sku_match = False
            if sku_normalized and len(sku_normalized) > 3:
                sku_match = sku_normalized in page_text_normalized

            # Check if any SKU from page matches
            sku_found = None
            for page_sku in page_info.get('skus', []):
                if sku and page_sku.replace('-', '').replace(' ', '').upper() == sku.replace('-', '').replace(' ', '').upper():
                    sku_found = page_sku
                    sku_match = True
                    break

            if name_match or sku_match:
                matches.append({
                    'page': page_num,
                    'matched_by': 'name' if name_match else 'sku',
                    'sku_found': sku_found
                })

        if matches:
            matched_count += 1
            product_page_map.append({
                'product_name': name,
                'product_sku': sku,
                'category': product.get('category', ''),
                'pages': [m['page'] for m in matches],
                'primary_page': matches[0]['page'],  # First match is likely the main page
                'match_details': matches
            })

    print(f"\n✅ Matched {matched_count}/{len(products)} products to catalog pages")
    return product_page_map

def save_mapping(mapping):
    """Save the product-to-page mapping"""
    print(f"\n💾 Saving mapping to: {OUTPUT_FILE}")

    output = {
        'metadata': {
            'catalog_file': str(CATALOG_PDF),
            'total_products_mapped': len(mapping),
            'generated_at': '2026-02-25'
        },
        'product_page_mapping': mapping
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {len(mapping)} product mappings")

    # Print some examples
    print("\n📋 Sample mappings:")
    for item in mapping[:5]:
        print(f"   {item['product_name']}")
        print(f"      → Page(s): {', '.join(map(str, item['pages']))}")

def main():
    print("🚀 Starting product-to-catalog-page mapping...\n")

    # Check if catalog exists
    if not CATALOG_PDF.exists():
        print(f"❌ Catalog not found: {CATALOG_PDF}")
        return

    # Extract catalog text
    page_data = extract_catalog_data()

    # Load products
    products = load_products()
    if not products:
        return

    # Match products to pages
    mapping = match_products_to_pages(products, page_data)

    # Save results
    save_mapping(mapping)

    print(f"\n{'='*80}")
    print("🎉 Done! Product-to-page mapping complete.")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
