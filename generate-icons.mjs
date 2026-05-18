// Run once with: node generate-icons.mjs
// Generates PWA icons using pure Node.js (no canvas dependency needed)
// Uses SVG → PNG via a minimal approach

import { writeFileSync } from 'fs'

// Minimal PNG encoder for a solid-color icon with text
// We'll create SVG files and note that the user can convert them
// or use a service like https://realfavicongenerator.net

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="40" fill="#0a0e1a"/>
  <text x="96" y="130" font-size="110" text-anchor="middle" font-family="serif">🛡️</text>
  <text x="96" y="175" font-size="18" text-anchor="middle" font-family="monospace" fill="#00e5a0" letter-spacing="1">ADVOCATE</text>
</svg>`

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0a0e1a"/>
  <text x="256" y="340" font-size="280" text-anchor="middle" font-family="serif">🛡️</text>
  <text x="256" y="460" font-size="48" text-anchor="middle" font-family="monospace" fill="#00e5a0" letter-spacing="3">ADVOCATE</text>
</svg>`

writeFileSync('public/icons/icon-192.svg', svg192)
writeFileSync('public/icons/icon-512.svg', svg512)

console.log('SVG icons written to public/icons/')
console.log('')
console.log('Next step: convert to PNG using one of these methods:')
console.log('  1. Open each SVG in a browser, right-click → Save as PNG')
console.log('  2. Use https://realfavicongenerator.net — upload icon-512.svg')
console.log('  3. Use https://cloudconvert.com/svg-to-png')
console.log('')
console.log('Save the results as:')
console.log('  public/icons/icon-192.png  (192×192)')
console.log('  public/icons/icon-512.png  (512×512)')
