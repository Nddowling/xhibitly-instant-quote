"""
Orbus / The Exhibitors' Handbook - Product Catalog Scraper
==========================================================
Crawls theexhibitorshandbook.com, downloads all available assets per product
(images, PDFs, artwork templates, setup guides), and builds a structured
products.json database.

Requirements:
    pip install playwright beautifulsoup4 requests tqdm
    playwright install chromium

Usage:
    python orbus_scraper.py

Output:
    ./orbus_catalog/
        products.json          ← full product database
        /images/               ← product images by category
        /templates/            ← artwork template ZIPs/PDFs
        /setup_guides/         ← assembly instruction PDFs
        /brochures/            ← marketing PDFs
        scrape_log.txt         ← errors and skips
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
DELAY_BETWEEN_REQUESTS = 1.5   # seconds — be polite
MAX_CONCURRENT_DOWNLOADS = 4
HEADLESS = True                # set False to watch the browser

CATEGORY_URLS = [
    "/products-by-category/portable-displays",
    "/products-by-category/portable-displays/banner-stands",
    "/products-by-category/portable-displays/banner-stands/retractable",
    "/products-by-category/portable-displays/banner-stands/telescopic",
    "/products-by-category/portable-displays/banner-stands/spring-back",
    "/products-by-category/portable-displays/banner-stands/fabric-banners",
    "/products-by-category/portable-displays/banner-stands/fabric-light-boxes",
    "/products-by-category/portable-displays/table-covers",
    "/products-by-category/portable-displays/table-covers/printed",
    "/products-by-category/portable-displays/table-covers/table-runners",
    "/products-by-category/portable-displays/collapsible-displays",
    "/products-by-category/portable-displays/collapsible-displays/hopup-tension-fabric",
    "/products-by-category/portable-displays/collapsible-displays/embrace-tension-fabric",
    "/products-by-category/portable-displays/collapsible-displays/xclaim-fabric-popup",
    "/products-by-category/portable-displays/collapsible-displays/vector-fast-frame",
    "/products-by-category/portable-displays/hanging-signs",
    "/products-by-category/portable-displays/counters",
    "/products-by-category/portable-displays/info-centers",
    "/products-by-category/portable-displays/display-lighting",
    "/products-by-category/portable-displays/shipping-cases",
    "/products-by-category/outdoor-displays",
    "/products-by-category/outdoor-displays/tents",
    "/products-by-category/outdoor-displays/banners-flags",
    "/products-by-category/outdoor-displays/signs",
    "/products-by-category/outdoor-displays/bar-counter",
    "/products-by-category/formulate-fabric-structures",
    "/products-by-category/formulate-fabric-structures/fabric-backwalls",
    "/products-by-category/formulate-fabric-structures/fabric-backwalls/essential-lite",
    "/products-by-category/formulate-fabric-structures/fabric-backwalls/master",
    "/products-by-category/formulate-fabric-structures/fabric-backwalls/designer",
    "/products-by-category/formulate-fabric-structures/fabric-backwalls/modulate",
    "/products-by-category/formulate-fabric-structures/island-exhibits",
    "/products-by-category/formulate-fabric-structures/hanging-structures",
    "/products-by-category/formulate-fabric-structures/architectural-structures",
    "/products-by-category/formulate-fabric-structures/architectural-structures/towers",
    "/products-by-category/formulate-fabric-structures/architectural-structures/arches",
    "/products-by-category/formulate-fabric-structures/fabric-counters",
    "/products-by-category/formulate-fabric-structures/fabric-kiosks",
    "/products-by-category/portable-displays/fabric-light-boxes",
    "/products-by-category/portable-displays/fabric-light-boxes/blaze-wall-mounted",
    "/products-by-category/portable-displays/fabric-light-boxes/freestanding",
    "/products-by-category/modular-displays",
    "/products-by-category/modular-displays/hybrid-pro-modular-displays",
    "/products-by-category/modular-displays/hybrid-pro-modular-exhibits/10-inline",
    "/products-by-category/modular-displays/hybrid-pro-modular-exhibits/20-inline",
    "/products-by-category/modular-displays/vector-frame-modular-displays",
    "/products-by-category/modular-displays/orbital-express-truss-exhibits",
    "/products-by-category/modular-displays/modular-counters",
    "/products-by-category/modular-displays/modular-kiosks",
    "/products-by-category/retail-displays",
    "/products-by-category/rental-displays",
    "/displays-by-size/tabletop-displays",
    "/displays-by-size/8-inline-displays",
    "/displays-by-size/10-inline-displays",
    "/displays-by-size/20-inline-displays",
    "/displays-by-size/island-exhibits",
]

# ─── Data Model ────────────────────────────────────────────────────────────────

@dataclass
class ProductAsset:
    asset_type: str        # 'image', 'template', 'setup_guide', 'brochure', 'video', 'other'
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
    images: list = field(default_factory=list)       # list of ProductAsset dicts
    downloads: list = field(default_factory=list)    # templates, guides, etc.
    raw_attributes: dict = field(default_factory=dict)

# ─── Setup ─────────────────────────────────────────────────────────────────────

def setup_dirs():
    # Create output directory first
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for d in ["images", "templates", "setup_guides", "brochures", "other"]:
        (OUTPUT_DIR / d).mkdir(parents=True, exist_ok=True)

# Create directories before setting up logging
setup_dirs()

# Set up logging to both file and console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.FileHandler(str(OUTPUT_DIR / "scrape_log.txt")),
        logging.StreamHandler()  # Also print to console
    ]
)

def slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '_', text.lower()).strip('_')[:80]

def guess_asset_type(url: str, link_text: str = "") -> str:
    url_lower = url.lower()
    text_lower = link_text.lower()
    if any(x in text_lower for x in ["template", "artwork", "art file"]):
        return "template"
    if any(x in text_lower for x in ["setup", "instruction", "assembly", "guide"]):
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
    if dest_path.exists():
        logging.debug(f"⏭️  Skipped (exists): {dest_path.name}")
        return True  # already downloaded
    try:
        logging.info(f"⬇️  Downloading: {dest_path.name}")
        r = session.get(url, timeout=30, stream=True)
        r.raise_for_status()
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with open(dest_path, "wb") as f:
            for chunk in r.iter_content(65536):
                f.write(chunk)
        logging.info(f"✅ Downloaded: {dest_path.name} ({dest_path.stat().st_size // 1024}KB)")
        return True
    except Exception as e:
        logging.warning(f"❌ Failed to download {url}: {e}")
        return False

# ─── Page Parser ───────────────────────────────────────────────────────────────

def parse_product_page(html: str, product_url: str, category: str) -> Optional[Product]:
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
            # Get the highest-res version (strip resize params)
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

    # --- Downloads (PDFs, ZIPs, etc.) ---
    downloads = []
    download_section = soup.find(class_=re.compile("downloads|product-downloads|additional"))
    search_scope = download_section if download_section else soup

    for link in search_scope.find_all("a", href=True):
        href = link["href"]
        text = link.get_text(strip=True)
        if not href:
            continue
        # Only grab actual file links
        if not any(ext in href.lower() for ext in [".pdf", ".zip", ".ai", ".eps", ".psd", ".png", ".jpg"]):
            continue
        # Skip navigation images
        if "/nav/" in href or "/logo/" in href:
            continue
        full_url = urljoin(BASE_URL, href)
        asset_type = guess_asset_type(full_url, text)
        filename = Path(urlparse(full_url).path).name or slugify(text) + ".pdf"
        downloads.append({
            "url": full_url,
            "filename": filename,
            "link_text": text,
            "asset_type": asset_type
        })

    # Also check the dedicated downloads page link pattern
    # Orbus download links often live at /downloads/downloadable-resources#product-sku
    for link in soup.find_all("a", href=True):
        if "download" in link["href"].lower() and link["href"] not in [d["url"] for d in downloads]:
            text = link.get_text(strip=True)
            if any(kw in text.lower() for kw in ["download", "template", "setup", "guide", "instructions"]):
                full_url = urljoin(BASE_URL, link["href"])
                downloads.append({
                    "url": full_url,
                    "filename": slugify(text) + ".pdf",
                    "link_text": text,
                    "asset_type": guess_asset_type(full_url, text)
                })

    # --- Attributes (sizes, colors, features) ---
    sizes, colors, features = [], [], []
    for row in soup.find_all(["tr", "li"]):
        text = row.get_text(" ", strip=True).lower()
        if "size" in text or "dimension" in text:
            sizes.append(row.get_text(" ", strip=True))
        if "color" in text or "colour" in text:
            colors.append(row.get_text(" ", strip=True))

    # Pull from table attributes
    raw_attrs = {}
    for row in soup.find_all("tr"):
        cells = row.find_all(["th", "td"])
        if len(cells) == 2:
            key = cells[0].get_text(strip=True)
            val = cells[1].get_text(strip=True)
            if key and val:
                raw_attrs[key] = val

    # Derive category from URL path
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
        sizes=sizes[:10],
        colors=colors[:10],
        images=unique_images[:20],
        downloads=downloads,
        raw_attributes=raw_attrs,
    )

# ─── Main Scraper ──────────────────────────────────────────────────────────────

async def get_product_links_from_category(page, category_url: str) -> list[str]:
    """Returns all product page URLs from a category listing."""
    full_url = urljoin(BASE_URL, category_url)
    product_links = set()

    try:
        logging.info(f"📂 Crawling category: {category_url}")
        await page.goto(full_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Scroll to trigger lazy loads
        for _ in range(3):
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
            await page.wait_for_timeout(800)

        # Click "load more" if present
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

        # Standard Magento product grid links
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = urljoin(BASE_URL, href)
            # Product pages typically end with .html or have no file extension
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


async def scrape_product(page, url: str, category: str) -> Optional[Product]:
    try:
        logging.info(f"🔍 Scraping: {url}")
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(1500)

        # Try to expand any "Downloads" accordion sections
        for selector in ["[data-role='collapsible']", ".block-collapsible-nav", ".fieldset"]:
            try:
                elements = page.locator(selector)
                count = await elements.count()
                for i in range(count):
                    el = elements.nth(i)
                    text = (await el.inner_text()).lower()
                    if "download" in text or "template" in text or "guide" in text:
                        await el.click()
                        await page.wait_for_timeout(500)
            except Exception:
                pass

        html = await page.content()
        product = parse_product_page(html, url, category)
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

    print("🚀 Starting Orbus catalog scraper...")
    print(f"   Output: {OUTPUT_DIR.absolute()}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        # ── Phase 1: Collect all product URLs ──
        print("\n📂 Phase 1: Crawling category pages...")
        product_queue: dict[str, str] = {}  # url -> category name

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
        total_products = len(product_queue)
        for idx, (url, category) in enumerate(product_queue.items(), 1):
            if url in seen_product_urls:
                continue
            seen_product_urls.add(url)

            logging.info(f"[{idx}/{total_products}] Processing product from {category}")
            product = await scrape_product(page, url, category)
            if product:
                # Deduplicate by SKU if present
                if product.sku and product.sku in seen_skus:
                    logging.info(f"⏭️  Skipped duplicate SKU: {product.sku}")
                    continue
                if product.sku:
                    seen_skus.add(product.sku)
                all_products.append(product)
                logging.info(f"✅ Added: {product.name} ({product.sku or 'no SKU'})")

            await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        await browser.close()

    print(f"\n✅ Scraped {len(all_products)} products")

    # ── Phase 3: Download assets ──
    print("\n⬇️  Phase 3: Downloading assets...")
    download_tasks = []

    for product in all_products:
        prod_slug = slugify(product.name or product.sku or "unknown")

        # Images
        for asset in product.images[:5]:  # limit to 5 images per product for POC
            subdir = OUTPUT_DIR / "images" / slugify(product.category)
            filename = f"{prod_slug}_{asset['filename']}"
            dest = subdir / filename
            download_tasks.append((asset["url"], dest, asset, "local_path"))

        # Downloads (templates, guides, etc.)
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

    # Also save a lightweight index for quick lookups
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
    print(f"   Index:         {OUTPUT_DIR / 'product_index.json'}")
    print(f"   Images:        {OUTPUT_DIR / 'images'}")
    print(f"   Templates:     {OUTPUT_DIR / 'templates'}")
    print(f"   Setup Guides:  {OUTPUT_DIR / 'setup_guides'}")
    print(f"   Log:           {OUTPUT_DIR / 'scrape_log.txt'}")


if __name__ == "__main__":
    asyncio.run(main())
