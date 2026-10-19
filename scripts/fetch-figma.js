// scripts/fetch-figma.js
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'E3Ss5xBoPkkUpB5ogZ5MWU';
const NODE_ID = '353:1563';

async function fetchFigmaData() {
  console.log('Fetching Figma file info...');
  const headers = { 'X-Figma-Token': FIGMA_TOKEN };
  
  try {
    // 1. Fetch file nodes for the Home Page
    const nodeRes = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(NODE_ID)}`, { headers });
    if (!nodeRes.ok) {
      const errText = await nodeRes.text();
      console.error(`Error fetching node: ${nodeRes.status} ${nodeRes.statusText}`, errText);
      return;
    }
    const nodeData = await nodeRes.json();
    fs.writeFileSync('node_data.json', JSON.stringify(nodeData, null, 2));
    console.log('Saved node_data.json successfully!');

    // 2. Fetch all pages/frames in the file
    const fileRes = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}?depth=2`, { headers });
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      fs.writeFileSync('file_summary.json', JSON.stringify({
        name: fileData.name,
        lastModified: fileData.lastModified,
        pages: fileData.document.children.map(p => ({
          id: p.id,
          name: p.name,
          frames: p.children ? p.children.map(f => ({ id: f.id, name: f.name, type: f.type })) : []
        }))
      }, null, 2));
      console.log('Saved file_summary.json successfully!');
    }

    // 3. Fetch image fills in the file
    const imagesRes = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/images`, { headers });
    if (imagesRes.ok) {
      const imagesData = await imagesRes.json();
      fs.writeFileSync('images_meta.json', JSON.stringify(imagesData, null, 2));
      console.log(`Found ${Object.keys(imagesData.meta?.images || {}).length} image fills! Saved to images_meta.json`);
    }

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

fetchFigmaData();
