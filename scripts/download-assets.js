// scripts/download-assets.js
const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'E3Ss5xBoPkkUpB5ogZ5MWU';

const imagesMeta = JSON.parse(fs.readFileSync('images_meta.json', 'utf8')).meta.images;
const homeImages = JSON.parse(fs.readFileSync('home_images.json', 'utf8'));

const outDir = path.join(__dirname, '..', 'public', 'assets', 'images');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      } else {
        file.close();
        fs.unlink(dest, () => {});
        reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err.message);
    });
  });
}

async function run() {
  console.log(`Starting download of ${homeImages.length} image references...`);
  
  // Track unique imageRefs to avoid duplicate downloads
  const downloadedRefs = new Map();
  const manifest = [];

  for (let i = 0; i < homeImages.length; i++) {
    const item = homeImages[i];
    const ref = item.imageRef;
    const url = imagesMeta[ref];

    if (!url) {
      console.warn(`No URL found for imageRef ${ref} (${item.name})`);
      continue;
    }

    // Clean name for file
    const safeName = item.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
    let filename;
    
    if (downloadedRefs.has(ref)) {
      filename = downloadedRefs.get(ref);
    } else {
      filename = `${String(i + 1).padStart(2, '0')}_${safeName}_${ref.substring(0, 8)}.jpg`;
      const destPath = path.join(outDir, filename);
      console.log(`[${i + 1}/${homeImages.length}] Downloading ${filename}...`);
      try {
        await downloadFile(url, destPath);
        downloadedRefs.set(ref, filename);
      } catch (err) {
        console.error(`Failed to download ${ref}:`, err);
      }
    }

    manifest.push({
      id: item.id,
      name: item.name,
      path: item.path,
      imageRef: ref,
      localFile: `assets/images/${filename}`,
      width: Math.round(item.bbox?.width || 0),
      height: Math.round(item.bbox?.height || 0)
    });
  }

  fs.writeFileSync(path.join(__dirname, '..', 'public', 'assets', 'images_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nSuccessfully processed all images! Saved manifest to public/assets/images_manifest.json`);
}

run();
