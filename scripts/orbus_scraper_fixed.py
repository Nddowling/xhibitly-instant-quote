"""
Orbus / The Exhibitors' Handbook - Product Catalog Scraper (FIXED)
====================================================================
Properly extracts direct S3 CDN URLs for PDFs instead of HTML error pages.

Key fix: Fetches the downloads page table and extracts actual PDF URLs.

Requirements:
    pip install playwright beautifulsoup4 requests tqdm
    playwright install chromium

Usage:
    python orbus_scraper_fixed.py
"""

import asyncio
import json
import os
import re
import time
import logging
from pathlib import Path
from urllib.parse import urljoin, urlparse
from dataclasses import dataclass, field, asdict
from typing import Optional

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

try:
    from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print("Run: pip install playwright beautifulsoup4 requests tqdm && playwright install chromium")
    raise

# ─── Config ────────────────────────────────────────────────────────────────────

BASE_URL = "https://www.theexhibitorshandbook.com"
DOWNLOADS_URL = f"{BASE_URL}/downloads/downloadable-resources"
OUTPUT_DIR = Path("./orbus_catalog")
DELAY_BETWEEN_REQUESTS = 1.5
MAX_CONCURRENT_DOWNLOADS = 4
HEADLESS = True

CATEGORY_URLS = [
    "/products-by-category/portable-displays/banner-stands/retractable",
    "/products-by-category/portable-displays/banner-stands/telescopic",
    "/products-by-category/portable-displays/banner-stands/spring-back",
]

# ─── Data Model ────────────────────────────────────────────────────────────────

@dataclass
class ProductAsset:
    asset_type: str
    url: str
    filename: str
    local_path: str = ""
    downloaded: bool = False

@dataclass
class Product:
    sku: str = ""
    name: str = ""
    url: str = ""
    category: str = ""
    subcategory: str = ""
    description: str = ""
    price: str = ""
    sizes: list = field(default_factory=list)
    colors: list = field(default_factory=list)
    features: list = field(default_factory=list)
    images: list = field(default_factory=list)
    downloads: list = field(default_factory=list)
    raw_attributes: dict = field(default_factory=dict)

# ─── Setup ─────────────────────────────────────────────────────────────────────

def setup_dirs():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for d in ["images", "templates", "setup_guides", "brochures", "other"]:
        (OUTPUT_DIR / d).mkdir(parents=True, exist_ok=True)

setup_dirs()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(str(OUTPUT_DIR / "scrape_log.txt")),
        logging.StreamHandler()
    ]
)

def slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_')[:80]

def guess_asset_type(url: str, link_text: str = "") -> str:
    url_lower = url.lower()
    text_lower = link_text.lower()
    if "graphictemplates" in url_lower or any(x in text_lower for x in ["template", "artwork", "art file"]):
        return "template"
    if "instructionsheets" in url_lower or any(x in text_lower for x in ["setup", "instruction", "assembly", "guide"]):
        return "setup_guide"
    if any(x in text_lower for x in ["brochure", "catalog", "sell sheet"]):
        return "brochure"
    if any(x in url_lower for x in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
        return "image"
    if ".pdf" in url_lower:
        return "brochure"
    if ".zip" in url_lower:
        return "template"
    return "other"

def get_local_subdir(asset_type: str) -> Path:
    mapping = {
        "template": OUTPUT_DIR / "templates",
        "setup_guide": OUTPUT_DIR / "setup_guides",
        "brochure": OUTPUT_DIR / "brochures",
        "image": OUTPUT_DIR / "images",
    }
    return mapping.get(asset_type, OUTPUT_DIR / "other")

# ─── Downloader ────────────────────────────────────────────────────────────────

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)"
})

def download_file(url: str, dest_path: Path) -> bool:
    """Download file and verify it's not an HTML error page"""
    if dest_path.exists():
        # Check if existing file is valid
        with open(dest_path, 'rb') as f:
            header = f.read(20)
            # If it starts with HTML, it's broken - re-download
            if header.startswith(b'<!doctype') or header.startswith(b'<html') or header.startswith(b' <!doctype'):
                logging.info(f"🔄 Re-downloading broken file: {dest_path.name}")
            else:
                logging.debug(f"⏭️  Skipped (exists): {dest_path.name}")
                return True

    try:
        logging.info(f"⬇️  Downloading: {dest_path.name}")
        r = session.get(url, timeout=30, stream=True)
        r.raise_for_status()

        # Read first chunk to verify it's not HTML
        content = b""
        for chunk in r.iter_content(65536):
            content += chunk

        # Check if it's an HTML error page
        if content.startswith(b'<!doctype') or content.startswith(b'<html') or content.startswith(b' <!doctype'):
            logging.warning(f"❌ Skipped HTML error page: {url}")
            return False

        # Check if it's a valid PDF
        if dest_path.suffix.lower() == '.pdf' and not content.startswith(b'%PDF'):
            logging.warning(f"❌ Not a valid PDF: {url}")
            return False

        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(content)

        logging.info(f"✅ Downloaded: {dest_path.name} ({len(content) // 1024}KB)")
        return True
    except Exception as e:
        logging.warning(f"❌ Failed to download {url}: {e}")
        return False

# ─── Downloads Page Parser ─────────────────────────────────────────────────────

DOWNLOADS_CACHE = {}

async def fetch_downloads_page(page) -> dict:
    """Fetch and parse the downloads page to get direct S3 URLs"""
    if DOWNLOADS_CACHE:
        return DOWNLOADS_CACHE

    logging.info("📥 Fetching downloads page table...")

    try:
        await page.goto(DOWNLOADS_URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(3000)

        # Expand all collapsible sections
        for _ in range(10):
            try:
                buttons = page.locator("[data-role='trigger']")
                count = await buttons.count()
                for i in range(count):
                    try:
                        await buttons.nth(i).click()
                        await page.wait_for_timeout(200)
                    except:
                        pass
            except:
                break

        html = await page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # Parse the downloads table
        products_map = {}

        for row in soup.find_all('tr'):
            name_cell = row.find('td', class_='name')
            if not name_cell:
                continue

            product_name = name_cell.get_text(strip=True)
            product_key = slugify(product_name)

            downloads = []

            # Extract all PDF/ZIP links from this row
            for link in row.find_all('a', href=True):
                href = link['href']
                text = link.get_text(strip=True)

                # Only S3 CDN links (direct file downloads)
                if 's3cdn.theexhibitorshandbook.com' in href:
                    asset_type = guess_asset_type(href, text)
                    filename = Path(urlparse(href).path).name

                    downloads.append({
                        'url': href,
                        'filename': filename,
                        'link_text': text,
                        'asset_type': asset_type
                    })

            if downloads:
                products_map[product_key] = {
                    'name': product_name,
                    'downloads': downloads
                }

        logging.info(f"✅ Found {len(products_map)} products with downloads")
        DOWNLOADS_CACHE.update(products_map)
        return products_map

    except Exception as e:
        logging.error(f"Error fetching downloads page: {e}")
        return {}

def match_product_to_downloads(product_name: str, downloads_map: dict) -> list:
    """Match a product name to downloads using fuzzy matching"""
    product_slug = slugify(product_name)

    # Try exact match first
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
        if score > best_score and score >= 3:  # At least 3 words match
            best_score = score
            best_match = data['downloads']

    return best_match or []

# ─── Page Parser ───────────────────────────────────────────────────────────────

def parse_product_page(html: str, product_url: str, category: str, downloads_map: dict) -> Optional[Product]:
    soup = BeautifulSoup(html, "html.parser")

    # --- Name ---
    name_tag = (
        soup.find("h1", class_=re.compile("product.*title|page-title")) or
        soup.find("h1")
    )
    if not name_tag:
        return None
    name = name_tag.get_text(strip=True)
    if not name or len(name) < 2:
        return None

    # --- SKU ---
    sku = ""
    sku_tag = soup.find(class_=re.compile("product.*sku|sku")) or \
              soup.find("div", {"itemprop": "sku"}) or \
              soup.find("span", {"itemprop": "sku"})
    if sku_tag:
        sku = sku_tag.get_text(strip=True).replace("SKU:", "").replace("Item #:", "").strip()

    # --- Price ---
    price = ""
    price_tag = soup.find(class_=re.compile("price")) or \
                soup.find({"itemprop": "price"})
    if price_tag:
        price = price_tag.get_text(strip=True)

    # --- Description ---
    desc = ""
    desc_tag = soup.find(class_=re.compile("product.*description|description")) or \
               soup.find("div", {"itemprop": "description"})
    if desc_tag:
        desc = desc_tag.get_text(" ", strip=True)[:1000]

    # --- Images ---
    images = []
    for img in soup.find_all("img"):
        src = img.get("data-src") or img.get("src") or ""
        if not src:
            continue
        if any(x in src for x in ["/nav/", "/logo/", "/template/", "placeholder"]):
            continue
        if any(ext in src.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
            full_url = urljoin(BASE_URL, src)
            clean_url = re.sub(r'/\d+x\d+/', '/', full_url)
            filename = Path(urlparse(clean_url).path).name
            images.append({"url": clean_url, "filename": filename, "asset_type": "image"})

    # Deduplicate images
    seen = set()
    unique_images = []
    for img in images:
        if img["url"] not in seen:
            seen.add(img["url"])
            unique_images.append(img)

    # --- Downloads: Use the downloads_map instead of page links ---
    downloads = match_product_to_downloads(name, downloads_map)

    # --- Attributes ---
    sizes, colors = [], []
    raw_attrs = {}
    for row in soup.find_all("tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) == 2:
            key = cells[0].get_text(strip=True)
            val = cells[1].get_text(strip=True)
            if key and val:
                raw_attrs[key] = val

    path_parts = urlparse(product_url).path.strip("/").split("/")
    subcat = " > ".join(p.replace("-", " ").title() for p in path_parts[1:-1]) if len(path_parts) > 2 else category

    return Product(
        sku=sku,
        name=name,
        url=product_url,
        category=category,
        subcategory=subcat,
        description=desc,
        price=price,
        sizes=sizes,
        colors=colors,
        images=unique_images[:20],
        downloads=downloads,
        raw_attributes=raw_attrs,
    )

# ─── Main Scraper ──────────────────────────────────────────────────────────────

async def get_product_links_from_category(page, category_url: str) -> list[str]:
    full_url = urljoin(BASE_URL, category_url)
    product_links = set()

    try:
        logging.info(f"📂 Crawling category: {category_url}")
        await page.goto(full_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        for _ in range(3):
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
            await page.wait_for_timeout(800)

        for _ in range(5):
            try:
                btn = page.locator("button.action.tocart, a.action.next, button:has-text('Load More'), button:has-text('Show More')")
                if await btn.count() > 0:
                    await btn.first.click()
                    await page.wait_for_timeout(1500)
            except Exception:
                break

        html = await page.content()
        soup = BeautifulSoup(html, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(BASE_URL, href)
            parsed = urlparse(href)
            path = parsed.path
            if (
                "theexhibitorshandbook.com" in href
                and not any(x in path for x in ["/products-by-category/", "/displays-by-size/", "/downloads/", "/media/", "/static/"])
                and path.count("/") >= 1
                and not path.endswith("/")
                and len(path) > 5
            ):
                product_links.add(href)

    except PlaywrightTimeout:
        logging.warning(f"Timeout on category: {category_url}")
    except Exception as e:
        logging.error(f"Error on category {category_url}: {e}")

    return list(product_links)


async def scrape_product(page, url: str, category: str, downloads_map: dict) -> Optional[Product]:
    try:
        logging.info(f"🔍 Scraping: {url}")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)

        html = await page.content()
        product = parse_product_page(html, url, category, downloads_map)
        return product

    except PlaywrightTimeout:
        logging.warning(f"Timeout on product: {url}")
    except Exception as e:
        logging.error(f"Error scraping product {url}: {e}")
    return None


async def main():
    setup_dirs()
    all_products: list[Product] = []
    seen_product_urls: set[str] = set()
    seen_skus: set[str] = set()

    print("🚀 Starting Orbus catalog scraper (FIXED VERSION)...")
    print(f"   Output: {OUTPUT_DIR.absolute()}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        # ── Phase 0: Fetch downloads page ──
        print("\n📥 Phase 0: Fetching downloads database...")
        downloads_map = await fetch_downloads_page(page)

        # ── Phase 1: Collect all product URLs ──
        print("\n📂 Phase 1: Crawling category pages...")
        product_queue: dict[str, str] = {}

        for cat_path in tqdm(CATEGORY_URLS, desc="Categories"):
            cat_name = cat_path.split("/")[-1].replace("-", " ").title()
            links = await get_product_links_from_category(page, cat_path)
            for link in links:
                if link not in product_queue:
                    product_queue[link] = cat_name
            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        print(f"   Found {len(product_queue)} unique product URLs")

        # ── Phase 2: Scrape each product ──
        print("\n🔍 Phase 2: Scraping product pages...")
        for idx, (url, category) in enumerate(product_queue.items(), 1):
            if url in seen_product_urls:
                continue
            seen_product_urls.add(url)

            logging.info(f"[{idx}/{len(product_queue)}] Processing product from {category}")
            product = await scrape_product(page, url, category, downloads_map)
            if product:
                if product.sku and product.sku in seen_skus:
                    logging.info(f"⏭️  Skipped duplicate SKU: {product.sku}")
                    continue
                if product.sku:
                    seen_skus.add(product.sku)
                all_products.append(product)
                logging.info(f"✅ Added: {product.name} ({product.sku or 'no SKU'}) - {len(product.downloads)} downloads")

            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        await browser.close()

    print(f"\n✅ Scraped {len(all_products)} products")

    # ── Phase 3: Download assets ──
    print("\n⬇️  Phase 3: Downloading assets...")
    download_tasks = []

    for product in all_products:
        prod_slug = slugify(product.name or product.sku or "unknown")

        # Images
        for asset in product.images[:5]:
            subdir = OUTPUT_DIR / "images" / slugify(product.category)
            filename = f"{prod_slug}_{asset['filename']}"
            dest = subdir / filename
            download_tasks.append((asset["url"], dest, asset, "local_path"))

        # Downloads
        for asset in product.downloads:
            subdir = get_local_subdir(asset["asset_type"]) / slugify(product.category)
            filename = f"{prod_slug}_{asset['filename']}"
            dest = subdir / filename
            download_tasks.append((asset["url"], dest, asset, "local_path"))

    print(f"   {len(download_tasks)} files to download...")
    for url, dest, asset_dict, path_key in tqdm(download_tasks, desc="Downloading"):
        ok = download_file(url, dest)
        if ok:
            asset_dict["local_path"] = str(dest.relative_to(OUTPUT_DIR))
            asset_dict["downloaded"] = True
        time.sleep(0.3)

    # ── Phase 4: Save database ──
    print("\n💾 Phase 4: Saving database...")
    db = {
        "metadata": {
            "source": BASE_URL,
            "scraped_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "total_products": len(all_products),
            "categories": list({p.category for p in all_products}),
        },
        "products": [asdict(p) for p in all_products]
    }

    db_path = OUTPUT_DIR / "products.json"
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

    index = []
    for p in all_products:
        index.append({
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "subcategory": p.subcategory,
            "url": p.url,
            "price": p.price,
            "image_count": len(p.images),
            "download_count": len(p.downloads),
        })
    with open(OUTPUT_DIR / "product_index.json", "w") as f:
        json.dump(index, f, indent=2)

    print(f"\n🎉 Done!")
    print(f"   Products:      {len(all_products)}")
    print(f"   Database:      {db_path}")
    print(f"   Valid PDFs:    {sum(1 for url, dest, _, _ in download_tasks if dest.exists())}")

if __name__ == "__main__":
    asyncio.run(main())
