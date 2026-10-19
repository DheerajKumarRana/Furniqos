// scripts/dump-featured.js
const fs = require('fs');

const featured = JSON.parse(fs.readFileSync('featured_detail.json', 'utf8'));

function dump(n, depth = 0) {
  const indent = '  '.repeat(depth);
  let extra = '';
  if (n.type === 'TEXT') extra = ` -> "${n.characters}"`;
  if (n.fills) {
    const imgFill = n.fills.find(f => f.type === 'IMAGE');
    if (imgFill) extra += ` -> IMAGE: ${imgFill.imageRef}`;
  }
  console.log(`${indent}${n.name} (${n.type})${extra}`);
  if (n.children) n.children.forEach(c => dump(c, depth + 1));
}

dump(featured);
