// scripts/inspect-all-sections.js
const fs = require('fs');

const nodeData = JSON.parse(fs.readFileSync('node_data.json', 'utf8'));
const homeNode = nodeData.nodes['353:1563'].document;

console.log('Home Page size:', homeNode.absoluteBoundingBox);

// Sort children by Y coordinate
const children = [...homeNode.children].sort((a, b) => {
  return (a.absoluteBoundingBox?.y || 0) - (b.absoluteBoundingBox?.y || 0);
});

children.forEach((c, idx) => {
  console.log(`\n[${idx + 1}] ID: ${c.id} | Name: "${c.name}" | Type: ${c.type}`);
  console.log(`     Y: ${c.absoluteBoundingBox?.y}, H: ${c.absoluteBoundingBox?.height}, W: ${c.absoluteBoundingBox?.width}`);

  // Print all direct texts or high level description
  const texts = [];
  function getTexts(n) {
    if (n.type === 'TEXT') texts.push(n.characters.trim().replace(/\n/g, ' '));
    if (n.children) n.children.forEach(getTexts);
  }
  getTexts(c);
  console.log(`     Texts (${texts.length}):`, texts.slice(0, 8).join(' | '));
});
