#!/usr/bin/env node

/**
 * Diagnostic: View extracted content from specific pages
 * Helps verify PDF rendering and text extraction is working
 */

import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const PDF_PATH = '/Users/nicholasdowling/Downloads/exhibitors-handbook.pdf';

async function viewPageContent(pageNum) {
  console.log(`\n📄 Viewing content from page ${pageNum}...\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    console.log('Loading PDF...');
    await page.goto(`file://${PDF_PATH}#page=${pageNum}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    const pageText = await page.evaluate(() => document.body.innerText);

    console.log('─'.repeat(80));
    console.log('EXTRACTED TEXT:');
    console.log('─'.repeat(80));
    console.log(pageText.substring(0, 1500));
    console.log('─'.repeat(80));
    console.log(`\nTotal characters: ${pageText.length}`);
    console.log(`First 100 chars: "${pageText.substring(0, 100)}"`);

  } finally {
    await browser.close();
  }
}

// View page 22 (the one user mentioned: "light boxes on page 22")
viewPageContent(22).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
