// Simple script to create a VS Code extension logo for MARIA Code
const fs = require('fs');

// Create a simple SVG logo for MARIA Code
const svgLogo = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background circle -->
  <circle cx="64" cy="64" r="64" fill="#007ACC"/>
  
  <!-- Inner circle -->
  <circle cx="64" cy="64" r="48" fill="#FFFFFF" opacity="0.1"/>
  
  <!-- MARIA text -->
  <text x="64" y="48" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">MARIA</text>
  
  <!-- CODE text -->
  <text x="64" y="72" font-family="Arial, sans-serif" font-size="14" fill="#FFFFFF" text-anchor="middle" opacity="0.9">CODE</text>
  
  <!-- AI symbol -->
  <circle cx="64" cy="88" r="4" fill="#00FF88"/>
  <circle cx="56" cy="88" r="2" fill="#00FF88" opacity="0.6"/>
  <circle cx="72" cy="88" r="2" fill="#00FF88" opacity="0.6"/>
</svg>`;

// Save as SVG
fs.writeFileSync('resources/icon.svg', svgLogo);

console.log('Logo created: resources/icon.svg');
console.log('To convert to PNG, use: npx svgexport icon.svg icon.png 128:128');