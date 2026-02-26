#!/usr/bin/env python3
"""
Repair Broken PDFs - Fixes HTML error pages that were saved as PDFs
===================================================================
Finds all broken PDF files (that are actually HTML), fetches the correct
URLs from the downloads page, and re-downloads them properly.

Usage:
    python repair_broken_pdfs.py
"""

import os
import re
import time
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from tqdm import tqdm

# ─── Config ────────────────────────────────────────────────────────────────────

CATALOG_DIR = Path("./orbus_catalog")
DOWNLOADS_URL = "https://www.theexhibitorshandbook.com/downloads/downloadable-resources"
DRY_RUN = False  # Set to True to see what would be fixed without downloading

# ─── Setup ─────────────────────────────────────────────────────────────────────

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)"
})

def slugify(text: str) -> str:
    """Convert text to URL-safe slug"""
    return re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_')[:80]

def is_broken_pdf(file_path: Path) -> bool:
    """Check if a PDF file is actually an HTML error page"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(100)
            # Check for HTML markers
            if any(marker in header for marker in [b'<!doctype', b'<html', b' <!doctype', b'<!DOCTYPE']):
                return True
            # Valid PDFs start with %PDF
            if not header.startswith(b'%PDF'):
                return True
    except Exception:
        return False
    return False

def fetch_downloads_map() -> dict:
    """Fetch the downloads page and build a map of product -> S3 URLs"""
    print("📥 Fetching downloads page...")

    try:
        r = session.get(DOWNLOADS_URL, timeout=60)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, 'html.parser')

        products_map = {}

        # Parse the table
        for row in soup.find_all('tr'):
            name_cell = row.find('td', class_='name')
            if not name_cell:
                continue

            product_name = name_cell.get_text(strip=True)
            product_key = slugify(product_name)

            downloads = []

            # Extract S3 CDN links
            for link in row.find_all('a', href=True):
                href = link['href']
                text = link.get_text(strip=True)

                # Only direct S3 file links
                if 's3cdn.theexhibitorshandbook.com' in href:
                    filename = Path(href).name
                    downloads.append({
                        'url': href,
                        'filename': filename,
                        'text': text
                    })

            if downloads:
                products_map[product_key] = {
                    'name': product_name,
                    'downloads': downloads
                }

        print(f"✅ Found {len(products_map)} products with downloads")
        return products_map

    except Exception as e:
        print(f"❌ Error fetching downloads page: {e}")
        return {}

def extract_product_name(filename: str) -> str:
    """Extract product name from filename"""
    # Remove common prefixes/suffixes
    name = filename.replace('.pdf', '').replace('.zip', '')

    # Remove common patterns
    patterns_to_remove = [
        r'_downloadable_resources$',
        r'_graphic_templates$',
        r'_templates_instructions$',
        r'^[a-z]+_',  # Remove category prefix
    ]

    for pattern in patterns_to_remove:
        name = re.sub(pattern, '', name, flags=re.IGNORECASE)

    return name

def find_matching_download(product_name: str, downloads_map: dict) -> list:
    """Find matching downloads for a product name"""
    product_slug = slugify(product_name)

    # Try exact match
    if product_slug in downloads_map:
        return downloads_map[product_slug]['downloads']

    # Try partial match
    for key, data in downloads_map.items():
        if product_slug in key or key in product_slug:
            return data['downloads']

    # Try word-by-word match
    product_words = set(product_slug.split('_'))
    best_match = None
    best_score = 0

    for key, data in downloads_map.items():
        key_words = set(key.split('_'))
        score = len(product_words & key_words)
        if score > best_score and score >= 2:
            best_score = score
            best_match = data['downloads']

    return best_match or []

def download_file(url: str, dest_path: Path) -> bool:
    """Download file and verify it's valid"""
    try:
        r = session.get(url, timeout=30, stream=True)
        r.raise_for_status()

        # Read content
        content = b""
        for chunk in r.iter_content(65536):
            content += chunk

        # Verify it's not HTML
        if content.startswith(b'<!doctype') or content.startswith(b'<html'):
            print(f"    ❌ Still getting HTML error page")
            return False

        # Verify PDFs
        if dest_path.suffix.lower() == '.pdf' and not content.startswith(b'%PDF'):
            print(f"    ❌ Not a valid PDF")
            return False

        # Save file
        with open(dest_path, 'wb') as f:
            f.write(content)

        size_kb = len(content) // 1024
        print(f"    ✅ Downloaded {size_kb}KB")
        return True

    except Exception as e:
        print(f"    ❌ Download failed: {e}")
        return False

def main():
    if not CATALOG_DIR.exists():
        print(f"❌ Catalog directory not found: {CATALOG_DIR}")
        return

    print("🔍 Scanning for broken PDFs...")

    # Find all broken PDFs
    broken_files = []
    for pdf_file in CATALOG_DIR.rglob("*.pdf"):
        if is_broken_pdf(pdf_file):
            broken_files.append(pdf_file)

    print(f"📊 Found {len(broken_files)} broken PDF files")

    if not broken_files:
        print("✅ No broken files found!")
        return

    # Fetch downloads map
    downloads_map = fetch_downloads_map()
    if not downloads_map:
        print("❌ Could not fetch downloads map")
        return

    # Repair each broken file
    print(f"\n🔧 Repairing broken files...")
    repaired = 0
    skipped = 0
    failed = 0

    for broken_file in tqdm(broken_files, desc="Repairing"):
        # Extract product name from path
        product_name = extract_product_name(broken_file.stem)

        # Find matching downloads
        downloads = find_matching_download(product_name, downloads_map)

        if not downloads:
            print(f"\n⏭️  {broken_file.name}")
            print(f"    No match found for: {product_name}")
            skipped += 1
            continue

        # Try to match by filename
        matched = False
        for download in downloads:
            # Check if this is the right file type
            if broken_file.name.endswith('_graphic_templates.pdf'):
                if 'GT_' in download['filename'] or 'template' in download['text'].lower():
                    matched = True
            elif broken_file.name.endswith('_templates_instructions.pdf'):
                if 'IS_' in download['filename'] or 'instruction' in download['text'].lower():
                    matched = True
            elif broken_file.name.endswith('_downloadable_resources.pdf'):
                # Try first PDF in the list
                matched = download['filename'].endswith('.pdf')
            else:
                # Generic match
                matched = True

            if matched:
                print(f"\n🔧 {broken_file.name}")
                print(f"    → {download['url']}")

                if DRY_RUN:
                    print(f"    [DRY RUN] Would download")
                    repaired += 1
                else:
                    if download_file(download['url'], broken_file):
                        repaired += 1
                    else:
                        failed += 1

                break

        if not matched:
            print(f"\n⏭️  {broken_file.name}")
            print(f"    No file type match in downloads: {[d['filename'] for d in downloads]}")
            skipped += 1

        time.sleep(0.3)  # Be polite

    # Summary
    print(f"\n{'='*80}")
    print(f"📊 Summary:")
    print(f"   Total broken files:  {len(broken_files)}")
    print(f"   ✅ Repaired:         {repaired}")
    print(f"   ⏭️  Skipped:          {skipped}")
    print(f"   ❌ Failed:           {failed}")
    print(f"{'='*80}")

    if DRY_RUN:
        print("\n💡 This was a dry run. Set DRY_RUN=False to actually download files.")

if __name__ == "__main__":
    main()
