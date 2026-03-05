#!/usr/bin/env node

/**
 * Comprehensive Downloadable Resources Scraper
 *
 * Scrapes ALL files from theexhibitorshandbook.com/downloads/downloadable-resources
 * - Expands all dropdowns/accordions
 * - Captures every template, CAD file, PDF, etc.
 * - Organizes by product and file type
 *
 * Usage: node scripts/scrapeDownloadableResources.js
 */

import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URL = 'https://www.theexhibitorshandbook.com/downloads/downloadable-resources';
const OUTPUT_FILE = path.join(__dirname, '../orbus_catalog/downloadable_resources.json');

/**
 * Scrape all downloadable resources
 */
async function scrapeDownloadables() {
  console.log('🚀 Starting comprehensive downloadable resources scrape\n');
  console.log(`📄 URL: ${URL}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('📖 Loading page...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  console.log('✅ Page loaded\n');

  // Wait for content
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Find all expandable elements (accordions, dropdowns, toggles)
  console.log('🔍 Finding expandable sections...');

  // Try to expand everything - common selectors
  const expandSelectors = [
    'button[aria-expanded="false"]',
    '[data-toggle="collapse"]',
    '.accordion-button:not(.collapsed)',
    '.dropdown-toggle',
    '[role="button"]',
    'summary', // <details> elements
    '.toggle',
    '.expand',
    '[data-accordion-toggle]'
  ];

  let expandedCount = 0;

  for (const selector of expandSelectors) {
    try {
      const elements = await page.$$(selector);
      console.log(`   Found ${elements.length} ${selector} elements`);

      for (const element of elements) {
        try {
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 300)); // Wait for animation
          expandedCount++;
        } catch (e) {
          // Element might not be clickable, that's ok
        }
      }
    } catch (e) {
      // Selector might not exist, continue
    }
  }

  console.log(`   Expanded ${expandedCount} sections\n`);

  // Wait for all content to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Extract ALL links to files
  console.log('📦 Extracting all file links...');

  const files = await page.evaluate(() => {
    const results = [];

    // Get all <a> tags
    const links = document.querySelectorAll('a[href]');

    // File extensions we care about
    const fileExtensions = [
      '.pdf', '.ai', '.eps', '.psd', '.indd', // Templates
      '.dwg', '.dxf', '.skp', '.rvt', '.3dm', // CAD
      '.glb', '.gltf', '.obj', '.fbx', '.dae', '.stl', // 3D
      '.zip', '.rar', // Archives
      '.png', '.jpg', '.jpeg', '.gif', '.svg', // Images
      '.mp4', '.mov', '.avi', '.webm' // Videos
    ];

    links.forEach(link => {
      const href = link.href;
      const text = link.textContent?.trim() || '';
      const title = link.title || '';

      // Check if it's a file link
      const isFile = fileExtensions.some(ext =>
        href.toLowerCase().includes(ext)
      );

      if (isFile) {
        // Try to find associated product name
        let productName = '';
        let category = '';

        // Look for parent sections
        let parent = link.closest('[data-product]');
        if (parent) {
          productName = parent.getAttribute('data-product') || '';
        }

        // Try heading above
        if (!productName) {
          const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
          for (const heading of headings) {
            const h = link.closest('section')?.querySelector(heading);
            if (h) {
              productName = h.textContent?.trim() || '';
              break;
            }
          }
        }

        // Try parent section
        const section = link.closest('[class*="product"], [class*="category"], section, .accordion-item');
        if (section) {
          const sectionHeading = section.querySelector('h1, h2, h3, h4, h5, h6');
          if (sectionHeading && !productName) {
            productName = sectionHeading.textContent?.trim() || '';
          }

          // Get category from section class or data attribute
          category = section.className || section.getAttribute('data-category') || '';
        }

        results.push({
          url: href,
          link_text: text,
          title,
          product_name: productName,
          category,
          file_type: getFileType(href)
        });
      }
    });

    function getFileType(url) {
      const lower = url.toLowerCase();
      if (lower.includes('.pdf')) return 'pdf';
      if (lower.includes('.ai') || lower.includes('.eps') || lower.includes('.psd')) return 'template';
      if (lower.includes('.dwg') || lower.includes('.dxf') || lower.includes('.skp')) return 'cad';
      if (lower.includes('.glb') || lower.includes('.gltf') || lower.includes('.obj')) return '3d_model';
      if (lower.includes('.zip') || lower.includes('.rar')) return 'archive';
      if (lower.includes('.png') || lower.includes('.jpg')) return 'image';
      if (lower.includes('.mp4') || lower.includes('.mov')) return 'video';
      return 'other';
    }

    return results;
  });

  console.log(`✅ Found ${files.length} downloadable files\n`);

  // Categorize by file type
  const byType = {};
  files.forEach(file => {
    byType[file.file_type] = (byType[file.file_type] || 0) + 1;
  });

  console.log('📊 File Types:');
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type.padEnd(20)} ${count}`);
    });

  // Save results
  console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);

  const output = {
    metadata: {
      url: URL,
      scraped_at: new Date().toISOString(),
      total_files: files.length,
      file_types: byType,
      expanded_sections: expandedCount
    },
    files
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('✅ Saved!\n');

  // Show sample files
  console.log('📄 Sample Files (first 10):');
  files.slice(0, 10).forEach((file, i) => {
    console.log(`\n${i + 1}. ${file.link_text || 'Untitled'}`);
    console.log(`   Type: ${file.file_type}`);
    console.log(`   Product: ${file.product_name || 'Unknown'}`);
    console.log(`   URL: ${file.url}`);
  });

  await browser.close();

  console.log('\n\n🎉 Scrape complete!');
  console.log(`📦 Total files: ${files.length}`);
  console.log(`💾 Output: ${OUTPUT_FILE}`);
}

// Run
scrapeDownloadables().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
