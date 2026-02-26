#!/usr/bin/env python3
"""
Clean up corrupted SKUs in the products database
================================================
Removes "In stockSKU^^" prefix and "^^" suffix from SKUs.
"""

import json
import re
from pathlib import Path

PRODUCTS_JSON = Path("orbus_catalog/products.json")
BACKUP_JSON = Path("orbus_catalog/products.json.backup")

def clean_sku(sku):
    """Clean up a corrupted SKU"""
    if not sku:
        return ""

    # Remove common corruption patterns
    cleaned = sku

    # Remove "In stockSKU^^" prefix
    cleaned = re.sub(r'^In\s*stock\s*SKU\s*\^\^', '', cleaned, flags=re.IGNORECASE)

    # Remove "^^" suffix
    cleaned = re.sub(r'\^\^$', '', cleaned)

    # Remove "In stock" prefix
    cleaned = re.sub(r'^In\s*stock\s*', '', cleaned, flags=re.IGNORECASE)

    # Remove "SKU" prefix if standalone
    cleaned = re.sub(r'^SKU\s*:?\s*', '', cleaned, flags=re.IGNORECASE)

    # Remove any remaining ^^ markers
    cleaned = cleaned.replace('^^', '')

    # Clean up whitespace
    cleaned = cleaned.strip()

    return cleaned

def main():
    print("🔧 Cleaning up corrupted SKUs in products database...\n")

    # Load products
    print(f"📦 Loading: {PRODUCTS_JSON}")
    with open(PRODUCTS_JSON, 'r') as f:
        data = json.load(f)

    products = data.get('products', [])
    print(f"   Found {len(products)} products")

    # Create backup
    print(f"\n💾 Creating backup: {BACKUP_JSON}")
    with open(BACKUP_JSON, 'w') as f:
        json.dump(data, f, indent=2)

    # Clean SKUs
    print("\n🧹 Cleaning SKUs...")
    cleaned_count = 0

    for product in products:
        original_sku = product.get('sku', '')
        if original_sku:
            cleaned_sku = clean_sku(original_sku)
            if cleaned_sku != original_sku:
                product['sku'] = cleaned_sku
                cleaned_count += 1
                if cleaned_count <= 10:  # Show first 10 examples
                    print(f"   {original_sku[:50]}")
                    print(f"   → {cleaned_sku}")

    print(f"\n✅ Cleaned {cleaned_count} SKUs")

    # Save cleaned data
    print(f"\n💾 Saving cleaned data to: {PRODUCTS_JSON}")
    with open(PRODUCTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("\n✅ Done! SKUs cleaned.")

    # Show some examples of cleaned SKUs
    print("\n📋 Sample cleaned SKUs:")
    count = 0
    for product in products:
        if product.get('sku') and count < 5:
            print(f"   {product.get('name', 'Unknown')[:40]}")
            print(f"      SKU: {product['sku']}")
            count += 1

if __name__ == "__main__":
    main()
