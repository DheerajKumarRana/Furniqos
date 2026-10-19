// scripts/find-vectors.js
const fs = require('fs');

const nodeData = JSON.parse(fs.readFileSync('node_data.json', 'utf8'));
const homeNode = nodeData.nodes['353:1563'];

const vectors = [];

function findVectors(node) {
  // If node is a vector, star, boolean operation, or group/component with only vectors
  if (['VECTOR', 'STAR', 'LINE', 'ELLIPSE', 'BOOLEAN_OPERATION'].includes(node.type) || 
      (node.name && (node.name.toLowerCase().includes('icon') || node.name.toLowerCase().includes('logo') || node.name.toLowerCase().includes('arrow')))) {
    vectors.push({
      id: node.id,
      name: node.name,
      type: node.type,
      bbox: node.absoluteBoundingBox
    });
  }

  if (node.children) {
    for (const child of node.children) {
      findVectors(child);
    }
  }
}

findVectors(homeNode.document);

console.log(`Found ${vectors.length} vector/icon candidates:`);
fs.writeFileSync('home_vectors.json', JSON.stringify(vectors, null, 2));
console.log('Saved home_vectors.json');
