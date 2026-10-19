// scripts/inspect-featured.js
const fs = require('fs');

const nodeData = JSON.parse(fs.readFileSync('node_data.json', 'utf8'));

function findNode(node, id) {
  if (node.id === id) return node;
  if (node.children) {
    for (const c of node.children) {
      const res = findNode(c, id);
      if (res) return res;
    }
  }
  return null;
}

const featured = findNode(nodeData.nodes['353:1563'].document, '353:1764');
fs.writeFileSync('featured_detail.json', JSON.stringify(featured, null, 2));

function extractCards(n) {
  console.log(`Node: ${n.name} (id: ${n.id}, type: ${n.type})`);
  if (n.children) {
    n.children.forEach(c => {
      console.log(`  Child: ${c.name} (id: ${c.id}, type: ${c.type})`);
      if (c.children) {
        c.children.forEach(gc => {
          console.log(`    Sub: ${gc.name} (id: ${gc.id}, type: ${gc.type})`);
          if (gc.fills) {
            gc.fills.forEach(f => {
              if (f.type === 'IMAGE') console.log(`      ImageRef: ${f.imageRef}`);
            });
          }
          if (gc.type === 'TEXT') {
            console.log(`      Text: "${gc.characters}"`);
          }
        });
      }
    });
  }
}

extractCards(featured);
