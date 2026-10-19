// scripts/inspect-mobile.js
const fs = require('fs');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'E3Ss5xBoPkkUpB5ogZ5MWU';
const MOBILE_NODE_ID = '353:1331';

async function fetchMobile() {
  console.log('Fetching mobile node...');
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(MOBILE_NODE_ID)}`, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });

  if (!res.ok) {
    console.error('Failed to fetch mobile node:', res.status);
    return;
  }

  const data = await res.json();
  const mobileNode = data.nodes[MOBILE_NODE_ID]?.document;
  if (!mobileNode) {
    console.error('No mobile node document found');
    return;
  }

  console.log('Mobile Frame:', mobileNode.name, mobileNode.absoluteBoundingBox);
  
  const sections = [];
  if (mobileNode.children) {
    for (const c of mobileNode.children) {
      sections.push({
        id: c.id,
        name: c.name,
        type: c.type,
        y: Math.round(c.absoluteBoundingBox?.y || 0),
        h: Math.round(c.absoluteBoundingBox?.height || 0),
        w: Math.round(c.absoluteBoundingBox?.width || 0)
      });
    }
  }

  sections.sort((a, b) => a.y - b.y);
  console.log('Mobile Sections in order:');
  sections.forEach((s, idx) => console.log(`  [${idx + 1}] ${s.name} (w: ${s.w}, h: ${s.h}, y: ${s.y})`));

  fs.writeFileSync('mobile_sections.json', JSON.stringify(sections, null, 2));
}

fetchMobile();
