#!/usr/bin/env node

const testString = '9.25"W x 12.75" H x 3.17" D';

console.log('Original:', testString);
console.log('Char codes:', [...testString].map((c,i) => `${i}:${c}(${c.charCodeAt(0)})`).join(' '));

const normalized = testString.replace(/[""]/g, '"').replace(/['']/g, "'");
console.log('\nNormalized:', normalized);
console.log('Char codes:', [...normalized].map((c,i) => `${i}:${c}(${c.charCodeAt(0)})`).join(' '));

const widthMatch = normalized.match(/(\d+\.?\d*)\s*["']?\s*W/i);
const heightMatch = normalized.match(/(\d+\.?\d*)\s*["']?\s*H/i);
const depthMatch = normalized.match(/(\d+\.?\d*)\s*["']?\s*D/i);

console.log('\nMatches:');
console.log('Width:', widthMatch ? parseFloat(widthMatch[1]) / 12 + ' ft' : 'NO MATCH');
console.log('Height:', heightMatch ? parseFloat(heightMatch[1]) / 12 + ' ft' : 'NO MATCH');
console.log('Depth:', depthMatch ? parseFloat(depthMatch[1]) / 12 + ' ft' : 'NO MATCH');
