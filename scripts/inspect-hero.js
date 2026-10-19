// scripts/inspect-hero.js
const fs = require('fs');

const nodeData = JSON.parse(fs.readFileSync('node_data.json', 'utf8'));
const homeNode = nodeData.nodes['353:1563'];

function findNodeById(node, id) {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

const hero = findNodeById(homeNode.document, '353:1666');
fs.writeFileSync('hero_detail.json', JSON.stringify(hero, null, 2));
console.log('Saved hero_detail.json');
