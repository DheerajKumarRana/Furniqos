// scripts/export-highres.js
const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'E3Ss5xBoPkkUpB5ogZ5MWU';

const outDir = path.join(__dirname, '..', 'public', 'assets', 'images');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      } else {
        file.close();
        fs.unlink(dest, () => {});
        reject(`Failed ${response.statusCode}`);
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function exportNodes(nodes, format = 'png', scale = 2) {
  const ids = nodes.map(n => n.id).join(',');
  const url = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`;
  console.log(`Requesting export for ${nodes.length} nodes (${format}@${scale}x)...`);
  
  const res = await fetch(url, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });

  if (!res.ok) {
    console.error('Export request failed:', res.status, await res.text());
    return;
  }

  const data = await res.json();
  const images = data.images;

  for (const item of nodes) {
    const imgUrl = images[item.id];
    if (imgUrl) {
      const dest = path.join(outDir, item.filename);
      console.log(`Downloading ${item.filename}...`);
      try {
        await downloadFile(imgUrl, dest);
      } catch (e) {
        console.error(`Error saving ${item.filename}:`, e);
      }
    } else {
      console.warn(`No image returned for ${item.id} (${item.filename})`);
    }
  }
}

async function run() {
  // Key high-res elements to render directly
  const pngNodes = [
    { id: '353:1718', filename: 'furniqos_logo_hero.png' },     // Hero FURNIQOS logo + mark
    { id: '353:1759', filename: 'furniqos_logo_footer.png' },   // Footer big FURNIQOS mark
    { id: '353:1667', filename: 'hero_full_background.jpg' },   // Hero full background with sofa
    { id: '353:1589', filename: 'why_furniqos_bg.jpg' },        // Dark luxury sofa fireplace bg
    { id: '353:1651', filename: 'cta_banner_bg.jpg' },          // CTA banner background
    { id: '353:1566', filename: 'process_showcase.jpg' },       // Process section main image
    { id: '353:1609', filename: 'about_showcase_arch.jpg' }     // About us section arch image
  ];

  await exportNodes(pngNodes, 'png', 2);
  console.log('Finished high-res exports!');
}

run();
