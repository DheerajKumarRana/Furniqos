// scripts/parse-nodes.js
const fs = require('fs');

const nodeData = JSON.parse(fs.readFileSync('node_data.json', 'utf8'));
const homeNode = nodeData.nodes['353:1563'];

if (!homeNode) {
  console.log('Node 353:1563 not found in node_data.json');
  process.exit(1);
}

const doc = homeNode.document;
console.log('Name:', doc.name);
console.log('Type:', doc.type);
console.log('Size:', doc.absoluteBoundingBox);

function summarizeChildren(node, depth = 0) {
  const indent = '  '.repeat(depth);
  const info = `${indent}- [${node.type}] ${node.name} (id: ${node.id}, w: ${Math.round(node.absoluteBoundingBox?.width || 0)}, h: ${Math.round(node.absoluteBoundingBox?.height || 0)})`;
  console.log(info);

  if (node.children && depth < 2) {
    for (const child of node.children) {
      summarizeChildren(child, depth + 1);
    }
  }
}

console.log('\n--- Section Hierarchy ---');
summarizeChildren(doc, 0);

// Find all nodes that have image fills or are components/vectors
const imageNodes = [];
const textNodes = [];

function walk(node, path = '') {
  const currentPath = path ? `${path} > ${node.name}` : node.name;
  
  if (node.fills) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageRef) {
        imageNodes.push({
          id: node.id,
          name: node.name,
          path: currentPath,
          imageRef: fill.imageRef,
          bbox: node.absoluteBoundingBox
        });
      }
    }
  }

  if (node.type === 'TEXT') {
    textNodes.push({
      id: node.id,
      name: node.name,
      characters: node.characters,
      style: node.style
    });
  }

  if (node.children) {
    for (const c of node.children) {
      walk(c, currentPath);
    }
  }
}

walk(doc);

console.log(`\nTotal Image Nodes in Home Page: ${imageNodes.length}`);
console.log(`Total Text Nodes in Home Page: ${textNodes.length}`);

fs.writeFileSync('home_images.json', JSON.stringify(imageNodes, null, 2));
fs.writeFileSync('home_texts.json', JSON.stringify(textNodes, null, 2));
console.log('Saved home_images.json and home_texts.json');
