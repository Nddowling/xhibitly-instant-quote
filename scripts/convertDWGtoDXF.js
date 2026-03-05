#!/usr/bin/env node

/**
 * Convert DWG files to DXF using ODA File Converter
 *
 * Requires ODA File Converter to be installed at:
 * /Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ODA File Converter paths
const ODA_CONVERTER_PATHS = [
  '/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter',
  '/Applications/ODA File Converter.app/Contents/MacOS/ODAFileConverter',
  process.env.ODA_FILE_CONVERTER_PATH
].filter(Boolean);

/**
 * Find ODA File Converter installation
 */
function findODAConverter() {
  for (const converterPath of ODA_CONVERTER_PATHS) {
    if (existsSync(converterPath)) {
      return converterPath;
    }
  }
  return null;
}

/**
 * Convert DWG files in a directory to DXF
 *
 * @param {string} inputDir - Directory containing DWG files
 * @param {string} outputDir - Directory for DXF output
 * @returns {string[]} - Array of converted DXF file paths
 */
export async function convertDWGtoDXF(inputDir, outputDir) {
  const converterPath = findODAConverter();

  if (!converterPath) {
    throw new Error(
      'ODA File Converter not found. Please install from:\n' +
      'https://www.opendesign.com/guestfiles/oda_file_converter\n\n' +
      'Or set ODA_FILE_CONVERTER_PATH environment variable.'
    );
  }

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Find DWG files
  const dwgFiles = readdirSync(inputDir).filter(f =>
    f.toLowerCase().endsWith('.dwg')
  );

  if (dwgFiles.length === 0) {
    return [];
  }

  console.log(`  🔧 Found ${dwgFiles.length} DWG file(s), converting to DXF...`);

  try {
    // ODA File Converter command
    // Format: ODAFileConverter <input_dir> <output_dir> <output_version> <output_format> <recurse> <audit> <input_filter>
    const command = `"${converterPath}" "${inputDir}" "${outputDir}" ACAD2018 DXF 0 1 "*.dwg"`;

    execSync(command, {
      stdio: 'pipe',
      timeout: 60000 // 60 second timeout per conversion
    });

    // Find converted DXF files
    const dxfFiles = readdirSync(outputDir)
      .filter(f => f.toLowerCase().endsWith('.dxf'))
      .map(f => path.join(outputDir, f));

    console.log(`  ✅ Converted ${dxfFiles.length} DWG → DXF`);

    return dxfFiles;

  } catch (error) {
    console.error(`  ❌ DWG conversion failed: ${error.message}`);
    return [];
  }
}

/**
 * Check if ODA File Converter is installed
 */
export function checkODAInstalled() {
  const converterPath = findODAConverter();
  return {
    installed: !!converterPath,
    path: converterPath
  };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const status = checkODAInstalled();

  if (status.installed) {
    console.log('✅ ODA File Converter found at:');
    console.log(`   ${status.path}`);
  } else {
    console.log('❌ ODA File Converter not found');
    console.log('\n📥 Download from:');
    console.log('   https://www.opendesign.com/guestfiles/oda_file_converter');
    console.log('\n📍 Expected location:');
    console.log('   /Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter');
    process.exit(1);
  }
}
