const fs = require('fs');
const path = require('path');

const candidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
];

const src = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
if (src) {
  const dest = path.resolve(__dirname, '../public');
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[copy-dist] Copied ${src} -> ${dest}`);
} else {
  console.log('[copy-dist] frontend/dist not found, skipping copy.');
}
