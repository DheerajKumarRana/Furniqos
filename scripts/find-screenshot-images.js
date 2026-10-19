// scripts/find-screenshot-images.js
const fs = require('fs');

const nodeData = JSON.parse(fs.readFileSync('node_data.json', 'utf8'));
const imagesMeta = JSON.parse(fs.readFileSync('images_meta.json', 'utf8')).meta.images;

console.log('Total images in meta:', Object.keys(imagesMeta).length);

// Search for nodes named "Interior Design", "Space Planning", "Renovation Design" in node_data
function searchNodes(node) {
  if (node.name && (
    node.name.toLowerCase().includes('interior design') ||
    node.name.toLowerCase().includes('space planning') ||
    node.name.toLowerCase().includes('renovation') ||
    node.name.toLowerCase().includes('furniture & styling')
  )) {
    console.log(`Found node: ${node.name} (id: ${node.id}, type: ${node.type})`);
  }
  if (node.children) {
    node.children.forEach(searchNodes);
  }
}

searchNodes(nodeData.nodes['353:1563'].document);
